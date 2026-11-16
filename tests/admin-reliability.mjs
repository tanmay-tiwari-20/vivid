import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const workspace = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

function compiled(relative) {
  return ts.transpileModule(readFileSync(path.join(workspace, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
}

// Test actual browser helpers with controlled transport, timers and storage.
// Media controls below render the actual components with React's server renderer.
function apiHarness({ online = true, fetchImpl } = {}) {
  let nextTimer = 0;
  const timers = new Map();
  const requests = [];
  const xhrs = [];
  class FakeXHR {
    constructor() { this.upload = {}; this.status = 0; this.response = null; xhrs.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    send(body) { this.body = body; }
    progress(loaded, total) { this.upload.onprogress?.({ lengthComputable: true, loaded, total }); }
    complete(status, response) { this.status = status; this.response = response; this.onload?.(); }
  }
  const context = {
    exports: {}, File, FormData, AbortController, XMLHttpRequest: FakeXHR,
    navigator: { onLine: online },
    setTimeout: (callback, duration) => { const id = ++nextTimer; timers.set(id, { callback, duration }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, init) => {
      requests.push({ url, init });
      return fetchImpl ? fetchImpl(url, init) : { ok: true, status: 200, json: async () => ({ saved: true }) };
    },
  };
  vm.runInNewContext(compiled('src/admin/api.ts'), context, { filename: 'src/admin/api.ts' });
  return { api: context.exports, context, requests, timers, xhrs };
}

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test('admin requests return confirmed success and preserve server authentication errors', async () => {
  const success = apiHarness();
  assert.equal((await success.api.request('/api/admin/content')).saved, true);
  assert.equal(success.requests[0].init.credentials, 'same-origin');
  assert.equal(success.requests[0].init.cache, 'no-store');
  assert.equal(success.timers.size, 0, 'successful requests clean up their timeout');

  const rejected = apiHarness({ fetchImpl: async () => response(401, { error: 'Sign in again.' }) });
  await assert.rejects(rejected.api.request('/api/admin/content', { method: 'PUT' }), error =>
    error instanceof rejected.api.ApiError && error.status === 401 && error.message === 'Sign in again.' && !error.outcomeUnknown);
  assert.equal(rejected.requests.length, 1);
  assert.equal(rejected.timers.size, 0);
});

test('a failed write is never retried and an unreadable success never reports a saved result', async () => {
  const network = apiHarness({ fetchImpl: async () => { throw new TypeError('Lost connection'); } });
  await assert.rejects(network.api.request('/api/admin/content', { method: 'PUT' }), error =>
    error instanceof network.api.ApiError && error.outcomeUnknown && /latest content/i.test(error.message));
  assert.equal(network.requests.length, 1, 'automatic retry could overwrite a write that already succeeded');

  const unreadable = apiHarness({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid response'); } }) });
  await assert.rejects(unreadable.api.request('/api/admin/content', { method: 'PUT' }), error =>
    error instanceof unreadable.api.ApiError && error.status === 502 && error.outcomeUnknown);
  assert.equal(unreadable.requests.length, 1);

  const read = apiHarness({ fetchImpl: async () => { throw new TypeError('Lost connection'); } });
  await assert.rejects(read.api.request('/api/admin/content'), error => !error.outcomeUnknown);
});

test('offline requests are not sent, and timed-out writes abort once with an uncertain outcome', async () => {
  const offline = apiHarness({ online: false });
  await assert.rejects(offline.api.request('/api/admin/content', { method: 'PUT' }), error =>
    error instanceof offline.api.ApiError && !error.outcomeUnknown && /offline/i.test(error.message));
  assert.equal(offline.requests.length, 0);
  assert.equal(offline.timers.size, 0);

  const timeout = apiHarness({ fetchImpl: async (_url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  }) });
  const pending = timeout.api.request('/api/admin/content', { method: 'PUT' });
  const check = assert.rejects(pending, error =>
    error instanceof timeout.api.ApiError && error.status === 408 && error.outcomeUnknown && /timed out/i.test(error.message));
  const [timer] = timeout.timers.values();
  assert.equal(timer.duration, 45_000);
  timer.callback();
  await check;
  assert.equal(timeout.requests.length, 1);
  assert.equal(timeout.requests[0].init.signal.aborted, true);
  assert.equal(timeout.timers.size, 0);
});

test('mobile files with omitted MIME types are normalized while unsupported or mismatched files are rejected', () => {
  const { api } = apiHarness();
  const photo = api.mediaFile(new File(['image bytes'], 'Portrait.JPEG', { lastModified: 123 }), false);
  assert.equal(photo.type, 'image/jpeg');
  assert.equal(photo.name, 'Portrait.JPEG');
  assert.equal(photo.lastModified, 123);
  assert.equal(api.mediaFile(new File(['video bytes'], 'Story.MP4'), true).type, 'video/mp4');
  const canonical = new File(['image bytes'], 'portrait.jpg', { type: 'image/jpeg' });
  assert.equal(api.mediaFile(canonical, false), canonical);
  assert.throws(() => api.mediaFile(new File(['photo'], 'photo.HEIC'), false), /JPG or PNG/);
  assert.throws(() => api.mediaFile(new File(['photo'], 'photo.heif', { type: 'image/heif' }), false), /JPG or PNG/);
  assert.throws(() => api.mediaFile(new File(['bytes'], 'fake.jpg', { type: 'video/mp4' }), false), /JPG/);
  assert.throws(() => api.mediaFile(new File([], 'empty.jpg'), false), /empty/);
  assert.throws(() => api.mediaFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'too-large.jpg'), false), error => error.status === 413);
});

test('upload progress reaches completion only after a valid response and rejects expired sessions', async () => {
  const harness = apiHarness();
  const progress = [];
  const file = new File(['video'], 'story.mp4', { type: 'video/mp4' });
  const pending = harness.api.uploadMedia(file, value => progress.push(value));
  const xhr = harness.xhrs[0];
  assert.equal(xhr.method, 'POST');
  assert.equal(xhr.url, '/api/admin/upload');
  assert.equal(xhr.timeout, 5 * 60_000);
  assert.equal(xhr.body.get('file'), file);
  xhr.progress(50, 100);
  xhr.progress(100, 100);
  assert.deepEqual(progress, [0, 50, 99], 'sent bytes alone cannot confirm a successful upload');
  xhr.complete(201, { url: '/api/media/verified.mp4' });
  assert.equal((await pending).url, '/api/media/verified.mp4');
  assert.equal(progress.at(-1), 100);
  assert.equal(xhr.upload.onprogress, null);

  const expired = apiHarness();
  const rejected = expired.api.uploadMedia(file, () => {});
  const check = assert.rejects(rejected, error => error instanceof expired.api.ApiError && error.status === 401 && error.message === 'Session ended.');
  expired.xhrs[0].complete(401, { error: 'Session ended.' });
  await check;

  const malformed = apiHarness();
  const incomplete = malformed.api.uploadMedia(file, () => {});
  const malformedCheck = assert.rejects(incomplete, error => error.status === 502 && error.outcomeUnknown);
  malformed.xhrs[0].complete(201, {});
  await malformedCheck;
});

function draftHarness() {
  const entries = new Map();
  const now = 1_800_000_000_000;
  const storage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
  const context = {
    exports: {}, sessionStorage: storage, Date: class extends Date { static now() { return now; } },
    require: () => ({}),
  };
  const code = `${compiled('src/admin/Studio.tsx')}\nexports.__drafts = { rememberDraft, recoveredDraft, DRAFT_KEY };`;
  vm.runInNewContext(code, context, { filename: 'src/admin/Studio.tsx' });
  return { ...context.exports.__drafts, context, entries, now };
}

function editorFixture(kind = 'reel') {
  const value = kind === 'reel' ? {
    id: 'test-reel', title: 'Unsaved mobile story', brand: 'Vivid', brandId: 'test-brand', creator: 'Creator', creatorId: 'test-creator', category: 'Lifestyle',
    description: 'Typed before the signal dropped.', image: '/images/cover.jpg', video: '/videos/story.mp4', views: '120K', reach: '80K', color: '#1ec89a',
    featured: true, published: false, demo: false,
  } : kind === 'creator' ? {
    id: 'test-creator', name: 'Unsaved creator', category: 'Lifestyle', specialty: 'A perspective of their own.', bio: 'Typed on mobile.',
    image: '/images/portrait.jpg', profileUrl: 'https://instagram.com/creator', handle: '@creator', followers: '120K',
    featured: false, published: true, demo: false,
  } : {
    id: 'test-brand', name: 'Unsaved brand', category: 'Lifestyle', description: 'Typed before uploading a brand logo.',
    logo: '/images/brand-logo.png', websiteUrl: 'https://example.com/brand', published: true, demo: false,
  };
  const baseline = JSON.stringify(kind === 'reel' ? { ...value, title: 'Original title' } : { ...value, name: 'Original name' });
  return { kind, value, isNew: false, baseline };
}

test('unsaved reel, creator and brand drafts recover their text, links, flags and baseline after a page reload', () => {
  for (const kind of ['reel', 'creator', 'brand']) {
    const harness = draftHarness();
    const editor = editorFixture(kind);
    harness.rememberDraft(editor);
    const reloaded = draftHarness();
    reloaded.entries.set(reloaded.DRAFT_KEY, harness.entries.get(harness.DRAFT_KEY));
    const recovered = reloaded.recoveredDraft();
    assert.deepEqual(JSON.parse(JSON.stringify(recovered)), editor);
    assert.equal(recovered.value.published, editor.value.published);
    assert.equal(recovered.value.featured, editor.value.featured);
    if (kind === 'brand') {
      assert.equal(recovered.value.websiteUrl, 'https://example.com/brand');
      assert.equal(recovered.value.logo, '/images/brand-logo.png');
    }
  }
});

test('saved or closed editors clear their recovery data, and unavailable session storage does not break editing', () => {
  const harness = draftHarness();
  const editor = editorFixture();
  harness.rememberDraft(editor);
  harness.rememberDraft({ ...editor, baseline: JSON.stringify(editor.value) });
  assert.equal(harness.entries.has(harness.DRAFT_KEY), false);
  harness.rememberDraft(editor);
  harness.rememberDraft(null);
  assert.equal(harness.entries.has(harness.DRAFT_KEY), false);
  harness.context.sessionStorage = {
    getItem: () => { throw new Error('Storage denied'); },
    setItem: () => { throw new Error('Storage denied'); },
    removeItem: () => { throw new Error('Storage denied'); },
  };
  assert.doesNotThrow(() => harness.rememberDraft(editor));
  assert.doesNotThrow(() => harness.rememberDraft(null));
  assert.equal(harness.recoveredDraft(), null);
});

test('expired, corrupt and malformed recovery records cannot reopen an editor', () => {
  const harness = draftHarness();
  const valid = { editor: editorFixture(), savedAt: harness.now };
  const invalid = [
    { ...valid, savedAt: harness.now - 24 * 60 * 60_000 - 1 },
    { editor: valid.editor },
    { ...valid, savedAt: 'invalid' },
    { ...valid, savedAt: harness.now + 60_000 },
    { ...valid, editor: { ...valid.editor, kind: 'other' } },
    { ...valid, editor: { ...valid.editor, baseline: 42 } },
    { ...valid, editor: { ...valid.editor, value: { ...valid.editor.value, published: 'yes' } } },
    { ...valid, editor: { ...valid.editor, value: { ...valid.editor.value, title: null } } },
  ];
  for (const stored of invalid) {
    harness.entries.set(harness.DRAFT_KEY, JSON.stringify(stored));
    assert.equal(harness.recoveredDraft(), null, `rejected recovery record: ${JSON.stringify(stored)}`);
  }
  harness.entries.set(harness.DRAFT_KEY, '{broken json');
  assert.equal(harness.recoveredDraft(), null);
});

function renderedEditorHarness() {
  const context = {
    exports: {},
    require: id => id === './api' ? {} : require(id),
  };
  const code = `${compiled('src/admin/Studio.tsx')}\nexports.__controls = { MediaField, ContentEditor };`;
  vm.runInNewContext(code, context, { filename: 'src/admin/Studio.tsx' });
  return context.exports.__controls;
}

function inputElements(markup) {
  return Array.from(markup.matchAll(/<input\b[^>]*>/g), match => match[0]);
}

test('image and video media controls offer file upload without a media URL input', () => {
  const { MediaField } = renderedEditorHarness();
  const noop = () => {};
  for (const [label, video, existing] of [
    ['Cover image', false, '/images/creator-fashion.jpg'],
    ['Profile image', false, '/images/creator-beauty.jpg'],
    ['Reel video', true, '/videos/fashion.mp4'],
  ]) {
    for (const value of ['', existing]) {
      const markup = renderToStaticMarkup(React.createElement(MediaField, {
        label, video, value, disabled: false, onChange: noop, onBusy: noop, onSessionExpired: noop,
      }));
      const inputs = inputElements(markup);
      assert.equal(inputs.length, 1, `${label} has one file-picker input and no pasted media input`);
      assert.match(inputs[0], /type="file"/);
      assert.match(inputs[0], video ? /accept="[^"]*video\/mp4/ : /accept="[^"]*image\/jpeg/);
    }
  }
});

test('creator social profile links remain editable while media inputs stay upload-only', () => {
  const { ContentEditor } = renderedEditorHarness();
  const noop = () => {};
  const creator = editorFixture('creator');
  const props = {
    creators: [], brands: [], saving: false, onSave: async () => true, onClose: noop,
    onDraftChange: noop, onSessionExpired: noop, onErrorClear: noop,
  };
  const creatorMarkup = renderToStaticMarkup(React.createElement(ContentEditor, { ...props, editor: creator }));
  const profileInputs = inputElements(creatorMarkup).filter(input => /type="url"/.test(input));
  assert.equal(profileInputs.length, 1);
  assert.match(profileInputs[0], /value="https:\/\/instagram\.com\/creator"/);
  assert.equal(inputElements(creatorMarkup).filter(input => /type="file"/.test(input)).length, 1);
  const reelMarkup = renderToStaticMarkup(React.createElement(ContentEditor, { ...props, editor: editorFixture('reel') }));
  assert.equal(inputElements(reelMarkup).filter(input => /type="url"/.test(input)).length, 0);
  assert.equal(inputElements(reelMarkup).filter(input => /type="file"/.test(input)).length, 2);
});

test('brand logos are upload-only while brand website links remain editable', () => {
  const { ContentEditor } = renderedEditorHarness();
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(ContentEditor, {
    editor: editorFixture('brand'), creators: [], brands: [], saving: false,
    onSave: async () => true, onClose: noop, onDraftChange: noop,
    onSessionExpired: noop, onErrorClear: noop,
  }));
  const inputs = inputElements(markup);
  const links = inputs.filter(input => /type="url"/.test(input));
  const uploads = inputs.filter(input => /type="file"/.test(input));
  assert.equal(links.length, 1, 'the brand website remains a destination link');
  assert.match(links[0], /value="https:\/\/example\.com\/brand"/);
  assert.equal(uploads.length, 1, 'the logo has a file picker without a media URL field');
  assert.match(uploads[0], /accept="[^"]*image\/jpeg/);
});
