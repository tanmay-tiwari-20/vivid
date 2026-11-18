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

function loadModule(relative, overrides = {}, exposed = '', globals = {}) {
  const resolved = path.resolve(workspace, relative);
  const code = ts.transpileModule(`${readFileSync(resolved, 'utf8')}\n${exposed}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const context = {
    exports: {}, URL, ...globals,
    require: id => Object.hasOwn(overrides, id) ? overrides[id] : id.startsWith('.')
      ? loadModule(path.relative(workspace, path.resolve(path.dirname(resolved), `${id}.ts`)), overrides, '', globals)
      : require(id),
  };
  vm.runInNewContext(code, context, { filename: resolved });
  return context.exports;
}

const { getInstagramReel } = loadModule('src/lib/instagram.ts');
const ReelPlayer = loadModule('src/ReelPlayer.tsx').default;
const reel = video => ({
  id: 'linked-reel', title: 'A vivid story', brand: 'Vivid', brandId: '', creator: '', creatorId: '',
  category: 'Fashion', description: '', image: '/images/cover.jpg', video, views: '', reach: '',
  color: '#1ec89a', featured: true, published: true, demo: false,
});

test('Instagram reel share links become canonical embed URLs without tracking data', () => {
  for (const source of [
    'https://instagram.com/reel/ABC_def-12',
    'https://www.instagram.com/reel/ABC_def-12/',
    'https://m.instagram.com/reels/ABC_def-12/?igsh=tracking#caption',
    'https://www.instagram.com:443/reel/ABC_def-12/?utm_source=website',
    '  https://WWW.INSTAGRAM.COM/reel/ABC_def-12/  ',
  ]) {
    const result = getInstagramReel(source);
    assert.equal(result?.url, 'https://www.instagram.com/reel/ABC_def-12/', source);
    assert.equal(result?.embed, 'https://www.instagram.com/reel/ABC_def-12/embed/', source);
  }
  for (const kind of ['p', 'tv']) {
    assert.equal(getInstagramReel(`https://instagram.com/${kind}/ABC_def-12?igsh=tracking`)?.embed,
      `https://www.instagram.com/${kind}/ABC_def-12/embed/`);
  }
});

test('Instagram parsing rejects unsafe hosts and unsupported URLs', () => {
  for (const source of [
    '', '/videos/reel.mp4', '//instagram.com/reel/ABC_def-12/',
    'http://instagram.com/reel/ABC_def-12/', 'javascript:alert(1)',
    'https://instagram.com.example.com/reel/ABC_def-12/',
    'https://example.com/reel/ABC_def-12/', 'https://instagram.com./reel/ABC_def-12/',
    'https://instagram.com@evil.example/reel/ABC_def-12/',
    'https://user:password@instagram.com/reel/ABC_def-12/',
    'https://instagram.com:444/reel/ABC_def-12/',
    'https://instagram.com/creator/', 'https://instagram.com/stories/creator/123/',
    'https://instagram.com/reel/', 'https://instagram.com/reel/ABC_def-12/embed/',
    'https://instagram.com/reel/ABC_def-12/extra', 'https://instagram.com/reel/ABC%2F123/',
    'https://instagram.com/reel/ABC.123/', `https://instagram.com/reel/${'a'.repeat(101)}/`,
  ]) assert.equal(getInstagramReel(source), null, source);
});

test('Instagram mounts immediately without an extra application Play button and preserves its canonical original link', () => {
  const markup = renderToStaticMarkup(React.createElement(ReelPlayer, {
    reel: reel('https://m.instagram.com/reels/ABC_def-12/?igsh=tracking#caption'),
  }));
  assert.match(markup, /class="modal-video-wrap reel-instagram-player"/);
  assert.match(markup, /<iframe[^>]*src="https:\/\/www\.instagram\.com\/reel\/ABC_def-12\/embed\/"/);
  assert.match(markup, /title="A vivid story on Instagram"/);
  assert.match(markup, /allow="autoplay; fullscreen; picture-in-picture; encrypted-media"/);
  assert.match(markup, /scrolling="no"/);
  assert.match(markup, /href="https:\/\/www\.instagram\.com\/reel\/ABC_def-12\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(markup, /Watch on Instagram/);
  assert.doesNotMatch(markup, /igsh|tracking|<video|<button|Play reel/);
});

test('Cloudinary and local uploaded videos and existing YouTube and Vimeo embeds keep their players', () => {
  for (const source of [
    '/api/media/story.mp4',
    'https://res.cloudinary.com/vivid-demo/video/upload/v123/vivid/media/12345678-1234-1234-1234-123456789012.mp4',
  ]) {
    const uploaded = renderToStaticMarkup(React.createElement(ReelPlayer, { reel: reel(source) }));
    assert.ok(uploaded.includes(`<video src="${source}"`), source);
    assert.match(uploaded, /poster="\/images\/cover\.jpg"[^>]*controls=""[^>]*playsInline=""/);
    assert.doesNotMatch(uploaded, /<iframe|Watch on Instagram/);
  }
  for (const [source, embed] of [
    ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'],
    ['https://vimeo.com/123456789', 'https://player.vimeo.com/video/123456789'],
  ]) {
    const markup = renderToStaticMarkup(React.createElement(ReelPlayer, { reel: reel(source) }));
    assert.ok(markup.includes(`src="${embed}"`), source);
    assert.doesNotMatch(markup, /Watch on Instagram|<video/);
  }
  const profile = renderToStaticMarkup(React.createElement(ReelPlayer, { reel: reel('https://www.instagram.com/creator/') }));
  assert.doesNotMatch(profile, /<iframe|<video/);
  assert.match(profile, /Watch on Instagram/);
});

function findElement(element, type, matches = () => true) {
  if (!element || typeof element !== 'object') return null;
  if (element.type === type && matches(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) {
    const found = findElement(child, type, matches);
    if (found) return found;
  }
  return null;
}

test('an uploaded reel can switch to Instagram and back without losing either source', () => {
  const states = [];
  let cursor = 0;
  const { __ReelVideoField: Field } = loadModule('src/admin/Studio.tsx', { react: {
    ...React,
    useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
  } }, 'exports.__ReelVideoField = ReelVideoField;');
  const original = 'https://res.cloudinary.com/vivid-demo/video/upload/v123/vivid/media/12345678-1234-1234-1234-123456789012.mp4';
  let selected = original;
  const render = () => {
    cursor = 0;
    return Field({ value: selected, disabled: false, required: true, onChange: next => { selected = next; }, onBusy() {}, onSessionExpired() {} });
  };
  const sourceButtons = element => React.Children.toArray(findElement(element, 'div').props.children)
    .find(child => child.props?.['aria-label'] === 'Reel video source').props.children;
  sourceButtons(render())[0].props.onClick();
  assert.equal(selected, '', 'switching asks for the new Instagram link');
  const link = 'https://www.instagram.com/reel/ABC_def-12/?igsh=tracking';
  findElement(render(), 'input').props.onChange({ target: { value: link } });
  assert.equal(selected, link);
  sourceButtons(render())[1].props.onClick();
  assert.equal(selected, original, 'the uploaded video is retained while editing the link');
  sourceButtons(render())[0].props.onClick();
  assert.equal(selected, link, 'the entered link is retained while viewing the upload');
});

function playerHarness() {
  const states = [];
  const refs = [];
  const effects = [];
  const timers = new Map();
  const listeners = new Map();
  const observers = [];
  let stateCursor = 0;
  let refCursor = 0;
  let effectCursor = 0;
  let nextTimer = 0;
  const Player = loadModule('src/ReelPlayer.tsx', { react: {
    ...React,
    useState: initial => {
      const index = stateCursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useRef: initial => {
      const index = refCursor++;
      return refs[index] ||= { current: initial };
    },
    useEffect: (callback, dependencies) => {
      const index = effectCursor++;
      const previous = effects[index];
      const changed = !previous || dependencies.some((value, position) => !Object.is(value, previous.dependencies[position]));
      effects[index] = { ...previous, dependencies, callback, pending: changed };
    },
  } }, '', { window: {
    setTimeout(callback, duration) { const id = ++nextTimer; timers.set(id, { callback, duration }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
  }, ResizeObserver: class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  } });
  return {
    render(value) { stateCursor = 0; refCursor = 0; effectCursor = 0; return Player.default({ reel: value }); },
    commitEffects() {
      for (const effect of effects) {
        if (!effect.pending) continue;
        effect.cleanup?.();
        effect.cleanup = effect.callback();
        effect.pending = false;
      }
    },
    timers, observers, listeners,
  };
}

test('the immediate embed confirms loading and preserves the external original on playback failure without another Play button', () => {
  const h = playerHarness();
  const linked = reel('https://instagram.com/reel/ABC_def-12/');
  const loading = h.render(linked);
  assert.equal(findElement(loading, 'button'), null);
  h.commitEffects();
  const frame = findElement(loading, 'iframe');
  assert.equal(frame.props.src, 'https://www.instagram.com/reel/ABC_def-12/embed/');
  assert.equal(frame.props.title, 'A vivid story on Instagram');
  assert.ok(findElement(loading, 'span', node => node.props.role === 'status'));
  frame.props.onLoad();
  const ready = h.render(linked);
  assert.equal(findElement(ready, 'div', node => node.props.className === 'instagram-player-stage').props['aria-busy'], false);
  assert.equal(findElement(ready, 'span', node => node.props.role === 'status'), null);
  findElement(ready, 'iframe').props.onError();
  const failedInstagram = h.render(linked);
  assert.equal(findElement(failedInstagram, 'iframe'), null);
  assert.equal(findElement(failedInstagram, 'a').props.href, 'https://www.instagram.com/reel/ABC_def-12/');
  assert.equal(findElement(failedInstagram, 'button'), null);
  assert.equal(findElement(failedInstagram, 'span', node => node.props.role === 'status'), null);
});

test('the bounded loading marker clears without blocking Instagram and source changes reset its timer without masking uploaded videos', () => {
  const h = playerHarness();
  const linked = reel('https://instagram.com/reel/ABC_def-12/');
  const initial = h.render(linked);
  assert.ok(findElement(initial, 'iframe'));
  h.commitEffects();
  assert.equal(h.timers.size, 1);
  const timer = [...h.timers.values()][0];
  assert.equal(timer.duration, 12_000);
  timer.callback();
  const revealed = h.render(linked);
  assert.ok(findElement(revealed, 'iframe'));
  assert.equal(findElement(revealed, 'div', node => node.props.className === 'instagram-player-stage').props['aria-busy'], false);
  assert.equal(findElement(revealed, 'a').props.href, 'https://www.instagram.com/reel/ABC_def-12/');
  const next = reel('/videos/next.mp4');
  const nextPlayer = h.render(next);
  assert.equal(findElement(nextPlayer, 'video')?.props.src, '/videos/next.mp4');
  h.commitEffects();
  assert.equal(h.timers.size, 0);
  const reset = h.render(linked);
  assert.ok(findElement(reset, 'iframe'));
  assert.equal(findElement(reset, 'button'), null);
  assert.equal(findElement(reset, 'div', node => node.props.className === 'instagram-player-stage').props['aria-busy'], true);
});

test('the full Instagram frame fits its available stage and accepts height reports only from its own provider frame', () => {
  const h = playerHarness();
  const linked = reel('https://instagram.com/reel/ABC_def-12/');
  const initial = h.render(linked);
  const frameWindow = {};
  findElement(initial, 'div', node => node.props.className === 'instagram-player-stage').props.ref.current = {};
  findElement(initial, 'iframe').props.ref.current = { contentWindow: frameWindow };
  h.commitEffects();
  const rectangle = { width: 230, height: 510 };
  const resize = () => h.observers.at(-1).callback([{ contentRect: rectangle }]);
  const checkFits = () => {
    const bounds = findElement(h.render(linked), 'div', node => node.props.className === 'instagram-embed-frame').props.style;
    assert.ok(bounds.width > 0 && bounds.width <= rectangle.width);
    assert.ok(bounds.height > 0 && bounds.height <= rectangle.height);
  };
  resize();
  checkFits();
  const originalHeight = findElement(h.render(linked), 'iframe').props.style.height;
  const report = (data, origin = 'https://www.instagram.com', source = frameWindow) => h.listeners.get('message')({ origin, source, data });
  report({ type: 'MEASURE', details: { height: 1200 } }, 'https://foreign.example');
  report({ type: 'MEASURE', details: { height: 1200 } }, 'https://www.instagram.com', {});
  for (const height of [NaN, Infinity, 0, -1, 99999, '1200']) report({ type: 'MEASURE', details: { height } });
  report('invalid json');
  assert.equal(findElement(h.render(linked), 'iframe').props.style.height, originalHeight);
  report(JSON.stringify({ type: 'MEASURE', details: { height: 1200 } }));
  assert.equal(findElement(h.render(linked), 'iframe').props.style.height, 1200);
  h.commitEffects();
  resize();
  checkFits();
  // React clears DOM refs when this provider frame is removed.
  findElement(initial, 'div', node => node.props.className === 'instagram-player-stage').props.ref.current = null;
  findElement(initial, 'iframe').props.ref.current = null;
  h.render(reel('/videos/next.mp4'));
  h.commitEffects();
  assert.equal(h.listeners.has('message'), false);
  assert.ok(h.observers.every(observer => observer.disconnected));
});
