import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
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
function apiHarness({ online = true, fetchImpl, mode = 'local' } = {}) {
  let nextTimer = 0;
  const timers = new Map();
  const requests = [];
  const xhrs = [];
  let xhrCreated;
  const nextXHR = new Promise(resolve => { xhrCreated = resolve; });
  class FakeXHR {
    constructor() { this.upload = {}; this.status = 0; this.response = null; this.headers = {}; this.abortCalls = 0; this.sendCalls = 0; xhrs.push(this); xhrCreated(this); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    send(body) { this.body = body; this.sendCalls++; }
    abort() { this.abortCalls++; this.onabort?.(); }
    fail() { this.onerror?.(); }
    progress(loaded, total) { this.upload.onprogress?.({ lengthComputable: true, loaded, total }); }
    complete(status, response) { this.status = status; this.response = response; this.onload?.(); }
  }
  const context = {
    exports: {}, File, FormData, AbortController, XMLHttpRequest: FakeXHR, crypto: webcrypto, URL,
    navigator: { onLine: online },
    setTimeout: (callback, duration) => { const id = ++nextTimer; timers.set(id, { callback, duration }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, init) => {
      requests.push({ url, init });
      return fetchImpl ? fetchImpl(url, init) : response(200, url === '/api/admin/upload' ? { mode } : { saved: true });
    },
  };
  vm.runInNewContext(compiled('src/admin/api.ts'), context, { filename: 'src/admin/api.ts' });
  return { api: context.exports, context, requests, timers, xhrs, nextXHR };
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

test('local upload progress reaches completion only after a valid response and rejects expired sessions', async () => {
  const harness = apiHarness();
  const progress = [];
  const file = new File(['video'], 'story.mp4', { type: 'video/mp4' });
  const pending = harness.api.uploadMedia(file, value => progress.push(value));
  const xhr = await harness.nextXHR;
  assert.equal(xhr.method, 'POST');
  assert.equal(xhr.url, '/api/admin/upload');
  assert.equal(xhr.timeout, 5 * 60_000);
  assert.equal(xhr.body.get('file'), file);
  xhr.progress(50, 100);
  xhr.progress(100, 100);
  assert.deepEqual(progress, [0, 50, 99], 'sent bytes alone cannot confirm a successful upload');
  xhr.complete(201, { url: '/api/media/12345678-1234-1234-1234-123456789abc.mp4' });
  assert.equal((await pending).url, '/api/media/12345678-1234-1234-1234-123456789abc.mp4');
  assert.equal(progress.at(-1), 100);
  assert.equal(xhr.upload.onprogress, null);

  const expired = apiHarness();
  const rejected = expired.api.uploadMedia(file, () => {});
  const check = assert.rejects(rejected, error => error instanceof expired.api.ApiError && error.status === 401 && error.message === 'Session ended.');
  (await expired.nextXHR).complete(401, { error: 'Session ended.' });
  await check;

  const malformed = apiHarness();
  const incomplete = malformed.api.uploadMedia(file, () => {});
  const malformedCheck = assert.rejects(incomplete, error => error.status === 502 && error.outcomeUnknown);
  (await malformed.nextXHR).complete(201, {});
  await malformedCheck;
});

const cloudinaryUploadURL = 'https://api.cloudinary.com/v1_1/test-cloud/video/upload';
const cloudinarySignature = 'a'.repeat(40);

function uploadedResponse(xhr) {
  const kind = new URL(xhr.url).pathname.split('/')[3];
  return { secure_url: `https://res.cloudinary.com/test-cloud/${kind}/upload/v123/${xhr.body.get('public_id')}.${xhr.body.get('allowed_formats')}` };
}

function cloudinaryFetch({ authorizationStatus = 200, authorizationData, complete } = {}) {
  return async (_url, init) => {
    if (!init.method || init.method === 'GET') return response(200, { mode: 'cloudinary' });
    const data = JSON.parse(init.body);
    if (data.type === 'vivid.upload-authorize') {
      const extension = data.filename.split('.').pop();
      return response(authorizationStatus, {
        uploadUrl: `https://api.cloudinary.com/v1_1/test-cloud/${['mp4', 'webm'].includes(extension) ? 'video' : 'image'}/upload`,
        fields: { timestamp: 123, public_id: `vivid/media/${data.filename.slice(0, -(extension.length + 1))}`, overwrite: false, allowed_formats: extension, type: 'upload', api_key: 'test-key', signature: cloudinarySignature },
        ...authorizationData,
      });
    }
    assert.equal(data.type, 'vivid.upload-complete');
    return complete ? complete(data) : response(201, { url: data.url });
  };
}

test('files above Vercel request limits use signed Cloudinary multipart upload and progress waits for signature confirmation', async () => {
  let completeUpload;
  let finalizationStarted;
  const finalizing = new Promise(resolve => { finalizationStarted = resolve; });
  const harness = apiHarness({
    fetchImpl: cloudinaryFetch({ complete: data => new Promise(resolve => {
      completeUpload = () => resolve(response(201, { url: data.url }));
      finalizationStarted();
    }) }),
  });
  const file = new File([new Uint8Array(6 * 1024 * 1024)], 'large-video.mp4', { type: 'video/mp4' });
  const progress = [];
  const pending = harness.api.uploadMedia(file, value => progress.push(value));
  const xhr = await harness.nextXHR;
  assert.equal(xhr.method, 'POST');
  assert.equal(xhr.url, cloudinaryUploadURL);
  assert.equal(xhr.body.get('file'), file, 'file bytes go only to Cloudinary');
  assert.equal(xhr.body.get('signature'), cloudinarySignature);
  assert.equal(xhr.body.get('overwrite'), 'false');
  assert.equal(xhr.withCredentials, false, 'the storage request carries no studio credentials');
  assert.equal(xhr.headers['Content-Type'], undefined, 'the browser creates the multipart boundary');
  assert.equal(xhr.timeout, 5 * 60_000);
  xhr.progress(50, 100);
  xhr.progress(100, 100);
  assert.deepEqual(progress, [0, 50, 99]);
  assert.equal(harness.requests.length, 2, 'only configuration and authorization reach Next.js before the transfer finishes');
  xhr.complete(200, uploadedResponse(xhr));
  await finalizing;
  assert.deepEqual(progress, [0, 50, 99], 'Cloudinary success cannot confirm file contents by itself');
  assert.equal(harness.requests.length, 3);
  assert.equal(harness.xhrs.length, 1, 'file bytes never use the Next.js multipart endpoint');
  for (const { init } of harness.requests.filter(item => item.init.method === 'POST')) {
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.ok(init.body.length < 1024, 'Next.js receives metadata rather than file bytes');
  }
  const authorization = JSON.parse(harness.requests[1].init.body);
  const confirmation = JSON.parse(harness.requests[2].init.body);
  assert.match(authorization.filename, /^[0-9a-f-]{36}\.mp4$/);
  assert.equal(confirmation.filename, authorization.filename);
  completeUpload();
  assert.equal((await pending).url, uploadedResponse(xhr).secure_url);
  assert.equal(progress.at(-1), 100);
  assert.equal(harness.timers.size, 0);
  assert.equal(xhr.upload.onprogress, null);
  assert.equal(xhr.onload, null);
  assert.equal(xhr.onabort, null);
  assert.equal(xhr.abortCalls, 0);
});

test('direct uploads retain auth and configuration errors without falling back to oversized multipart requests', async () => {
  const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' });
  const missing = apiHarness({ fetchImpl: async () => response(503, { error: 'Configure Cloudinary credentials first.' }) });
  await assert.rejects(missing.api.uploadMedia(file, () => {}), error => error.status === 503 && /Cloudinary/.test(error.message));
  assert.equal(missing.xhrs.length, 0);
  assert.equal(missing.requests.length, 1);

  const expired = apiHarness({ fetchImpl: cloudinaryFetch({ authorizationStatus: 401, authorizationData: { error: 'Your studio session has ended.' } }) });
  await assert.rejects(expired.api.uploadMedia(file, () => {}), error => error.status === 401 && /session has ended/.test(error.message) && !error.outcomeUnknown);
  assert.equal(expired.xhrs.length, 0);
  assert.equal(expired.requests.length, 2);
  assert.equal(expired.timers.size, 0);
});

test('malformed or untrusted signed authorization URLs cannot receive file bytes', async () => {
  const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' });
  for (const uploadUrl of [undefined, 123, 'not a URL', 'http://api.cloudinary.com/v1_1/test-cloud/image/upload', 'https://evil.example/', 'https://api.cloudinary.com/otherpath', 'https://api.cloudinary.com/v1_1/test-cloud/image/upload/', 'https://api.cloudinary.com.evil.example/v1_1/test-cloud/image/upload', 'https://api.cloudinary.com@evil.example/v1_1/test-cloud/image/upload', 'https://user:secret@api.cloudinary.com/v1_1/test-cloud/image/upload', 'https://api.cloudinary.com:8443/v1_1/test-cloud/image/upload', 'https://api.cloudinary.com/v1_1/test-cloud/image/upload?secret=1']) {
    const harness = apiHarness({ fetchImpl: cloudinaryFetch({ authorizationData: { uploadUrl } }) });
    await assert.rejects(harness.api.uploadMedia(file, () => {}), error => error.status === 502 && !error.outcomeUnknown);
    assert.equal(harness.xhrs.length, 0);
    assert.equal(harness.requests.length, 2);
    assert.equal(harness.timers.size, 0);
  }
});

test('signed upload constraints cannot change format, permit overwrites or expose extra credential fields', async () => {
  const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' });
  for (const tamper of [
    data => { data.fields.overwrite = true; },
    data => { data.fields.allowed_formats = 'svg'; },
    data => { data.fields.public_id = 'vivid/content/latest'; },
    data => { data.fields.api_secret = 'never-send-server-secrets'; },
    data => { data.fields.signature = 'missing-a-real-signature'; },
  ]) {
    const normalFetch = cloudinaryFetch();
    const h = apiHarness({ fetchImpl: async (url, init) => {
      const result = await normalFetch(url, init);
      if (init.method === 'POST' && JSON.parse(init.body).type === 'vivid.upload-authorize') {
        const data = await result.json();
        tamper(data);
        return response(200, data);
      }
      return result;
    } });
    await assert.rejects(h.api.uploadMedia(file, () => {}), error => error.status === 502 && !error.outcomeUnknown);
    assert.equal(h.xhrs.length, 0);
    assert.equal(h.timers.size, 0);
  }
});

test('failed Cloudinary transfers are never finalized and completion errors never show 100 percent', async () => {
  const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' });
  for (const fail of [xhr => xhr.fail(), xhr => xhr.complete(413, null), xhr => xhr.complete(403, null)]) {
    const harness = apiHarness({ fetchImpl: cloudinaryFetch() });
    const progress = [];
    const pending = harness.api.uploadMedia(file, value => progress.push(value));
    const rejected = assert.rejects(pending);
    const xhr = await harness.nextXHR;
    fail(xhr);
    await rejected;
    assert.equal(harness.requests.length, 2);
    assert.equal(xhr.sendCalls, 1, 'the upload is not automatically retried');
    assert.ok(!progress.includes(100));
    assert.equal(harness.timers.size, 0);
    assert.equal(xhr.upload.onprogress, null);
    assert.equal(xhr.onload, null);
  }
  for (const complete of [() => response(400, { error: 'The file contents must match its type.' }), () => response(201, {}), () => response(201, { url: '/api/media/another.png' })]) {
    const harness = apiHarness({ fetchImpl: cloudinaryFetch({ complete }) });
    const progress = [];
    const pending = harness.api.uploadMedia(file, value => progress.push(value));
    const rejected = assert.rejects(pending);
    await harness.nextXHR;
    harness.xhrs[0].complete(200, uploadedResponse(harness.xhrs[0]));
    await rejected;
    assert.equal(harness.requests.length, 3);
    assert.ok(!progress.includes(100));
    assert.equal(harness.timers.size, 0);
  }
});

test('Cloudinary image transfers confirm the exact CDN asset and reject malformed successful responses', async () => {
  const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' });
  const success = apiHarness({ fetchImpl: cloudinaryFetch() });
  const pending = success.api.uploadMedia(file, () => {});
  const xhr = await success.nextXHR;
  assert.match(xhr.url, /\/image\/upload$/);
  assert.equal(xhr.body.get('allowed_formats'), 'jpg');
  assert.equal(xhr.body.get('file'), file);
  xhr.complete(200, uploadedResponse(xhr));
  assert.equal((await pending).url, uploadedResponse(xhr).secure_url);

  for (const result of [null, {}, { secure_url: 'https://foreign.example/photo.jpg' }, { secure_url: 'https://res.cloudinary.com/other-cloud/image/upload/v123/vivid/media/12345678-1234-1234-1234-123456789abc.jpg' }]) {
    const h = apiHarness({ fetchImpl: cloudinaryFetch() });
    const attempt = h.api.uploadMedia(file, () => {});
    const rejected = assert.rejects(attempt, error => error.status === 502 && error.outcomeUnknown);
    (await h.nextXHR).complete(200, result);
    await rejected;
    assert.equal(h.requests.length, 2, 'unconfirmed CDN assets never reach finalization');
  }
});

test('direct upload timeout aborts the transfer and clears timers without finalizing', async () => {
  const harness = apiHarness({ fetchImpl: cloudinaryFetch() });
  const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' });
  const pending = harness.api.uploadMedia(file, () => {});
  const rejected = assert.rejects(pending, error => error.status === 408 && error.outcomeUnknown && /timed out/.test(error.message));
  const xhr = await harness.nextXHR;
  const timer = [...harness.timers.values()].find(value => value.duration === 5 * 60_000);
  assert.ok(timer);
  timer.callback();
  await rejected;
  assert.equal(xhr.abortCalls, 1);
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.timers.size, 0);
  assert.equal(xhr.upload.onprogress, null);
  assert.equal(xhr.onabort, null);
});

test('the direct upload deadline also covers authorization and finalization without leaving transfer abort listeners', async () => {
  for (const phase of ['vivid.upload-authorize', 'vivid.upload-complete']) {
    let phaseStarted;
    const started = new Promise(resolve => { phaseStarted = resolve; });
    const normalFetch = cloudinaryFetch();
    const harness = apiHarness({ fetchImpl: async (url, init) => {
      if (init.method === 'POST' && JSON.parse(init.body).type === phase) {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
          phaseStarted();
        });
      }
      return normalFetch(url, init);
    } });
    const pending = harness.api.uploadMedia(new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' }), () => {});
    const rejected = assert.rejects(pending, error => error.status === 408 && error.outcomeUnknown === (phase === 'vivid.upload-complete'));
    if (phase === 'vivid.upload-complete') {
      const xhr = await harness.nextXHR;
      xhr.complete(200, uploadedResponse(xhr));
    }
    await started;
    [...harness.timers.values()].find(value => value.duration === 5 * 60_000).callback();
    await rejected;
    assert.equal(harness.requests.at(-1).init.signal.aborted, true);
    assert.equal(harness.timers.size, 0);
    if (phase === 'vivid.upload-authorize') assert.equal(harness.xhrs.length, 0);
    else assert.equal(harness.xhrs[0].abortCalls, 0, 'a completed upload has detached the shared signal listener');
  }
});

test('a plain hosting 413 gives a direct-storage recovery message', async () => {
  const harness = apiHarness();
  const pending = harness.api.uploadMedia(new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' }), () => {});
  const rejected = assert.rejects(pending, error => error.status === 413 && /direct storage/.test(error.message));
  (await harness.nextXHR).complete(413, null);
  await rejected;
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
  const instagramContext = { exports: {}, URL };
  vm.runInNewContext(compiled('src/lib/instagram.ts'), instagramContext, { filename: 'src/lib/instagram.ts' });
  const context = {
    exports: {},
    require: id => id === './api' ? {} : id === '../lib/instagram' ? instagramContext.exports : require(id),
  };
  const code = `${compiled('src/admin/Studio.tsx')}\nexports.__controls = { MediaField, ReelVideoField, ContentEditor };`;
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

// test('creator social profile links remain editable while media inputs stay upload-only', () => {
test('creator editing remains disabled and an existing uploaded reel keeps its video control', () => {
  const { ContentEditor } = renderedEditorHarness();
  const noop = () => {};
  const creator = editorFixture('creator');
  const props = {
    creators: [], brands: [], saving: false, onSave: async () => true, onClose: noop,
    onDraftChange: noop, onSessionExpired: noop, onErrorClear: noop,
  };
  const creatorMarkup = renderToStaticMarkup(React.createElement(ContentEditor, { ...props, editor: creator }));
  // Restore these assertions when creator editing is re-enabled.
  // const profileInputs = inputElements(creatorMarkup).filter(input => /type="url"/.test(input));
  // assert.equal(profileInputs.length, 1);
  // assert.match(profileInputs[0], /value="https:\/\/instagram\.com\/creator"/);
  // assert.equal(inputElements(creatorMarkup).filter(input => /type="file"/.test(input)).length, 1);
  assert.equal(creatorMarkup, '');
  const reelMarkup = renderToStaticMarkup(React.createElement(ContentEditor, { ...props, editor: editorFixture('reel') }));
  assert.doesNotMatch(reelMarkup, /Creator profile|Creator name/);
  assert.equal(inputElements(reelMarkup).filter(input => /type="url"/.test(input)).length, 0);
  assert.equal(inputElements(reelMarkup).filter(input => /type="file"/.test(input)).length, 2);
  assert.match(reelMarkup, /Instagram link/);
  assert.match(reelMarkup, /Upload video/);
  const cloudinaryEditor = editorFixture('reel');
  cloudinaryEditor.value.video = 'https://res.cloudinary.com/test-cloud/video/upload/v123/vivid/media/12345678-1234-1234-1234-123456789abc.mp4';
  const cloudinaryMarkup = renderToStaticMarkup(React.createElement(ContentEditor, { ...props, editor: cloudinaryEditor }));
  assert.match(cloudinaryMarkup, /Instagram link/);
  assert.match(cloudinaryMarkup, /Upload video/);
  assert.match(cloudinaryMarkup, /<video[^>]+src="https:\/\/res\.cloudinary\.com\//);
});

test('new and linked reels offer an Instagram URL while their cover stays upload-only', () => {
  const { ContentEditor } = renderedEditorHarness();
  const noop = () => {};
  for (const video of ['', 'https://www.instagram.com/reel/ABC123/?igsh=share']) {
    const editor = editorFixture('reel');
    editor.value.video = video;
    editor.value.published = true;
    editor.isNew = !video;
    const markup = renderToStaticMarkup(React.createElement(ContentEditor, {
      editor, creators: [], brands: [], saving: false, onSave: async () => true,
      onClose: noop, onDraftChange: noop, onSessionExpired: noop, onErrorClear: noop,
    }));
    const inputs = inputElements(markup);
    const links = inputs.filter(input => /type="url"/.test(input));
    assert.equal(links.length, 1);
    assert.match(links[0], /required=""/);
    assert.match(links[0], /placeholder="https:\/\/www\.instagram\.com\/reel\//);
    assert.equal(inputs.filter(input => /type="file"/.test(input)).length, 1, 'the cover still uses a file picker');
    assert.match(markup, /Instagram link|Upload video/);
    assert.match(markup, /must be public and allow embedding/);
    if (video) assert.match(markup, /href="https:\/\/www\.instagram\.com\/reel\/ABC123\/"/);
  }
});

test('Instagram links survive unsaved draft recovery', () => {
  const harness = draftHarness();
  const editor = editorFixture('reel');
  editor.value.video = 'https://www.instagram.com/reel/ABC123/?igsh=share';
  harness.rememberDraft(editor);
  assert.equal(harness.recoveredDraft().value.video, editor.value.video);
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
