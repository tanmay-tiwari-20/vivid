import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const workspace = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const uuid = '12345678-1234-1234-1234-123456789abc';
const signatures = {
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]),
  webp: Buffer.from('RIFF0000WEBP0000'),
  gif: Buffer.from('GIF89a0000000000'),
  mp4: Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]),
  webm: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
};
const kindOf = extension => ['mp4', 'webm'].includes(extension) ? 'video' : 'image';
const cdnURL = (extension = 'png', folder = 'vivid') => `https://res.cloudinary.com/test-cloud/${kindOf(extension)}/upload/v123/${folder}/media/${uuid}.${extension}`;

function harness({ extension = 'png', folder = 'vivid', metadata = {}, resourceError, fetchError, responseFactory } = {}) {
  const requests = [];
  const resources = [];
  const modules = new Map();
  const expectedURL = cdnURL(extension, folder);
  const sdk = {
    config: () => ({ cloud_name: 'test-cloud' }),
    api: {
      async resource(publicId, options) {
        resources.push({ publicId, options });
        if (resourceError) throw resourceError;
        return {
          public_id: `${folder}/media/${uuid}`, resource_type: kindOf(extension), type: 'upload',
          format: extension, version: 123, secure_url: expectedURL, bytes: 512, ...metadata,
        };
      },
    },
  };
  function load(relative) {
    const filename = path.resolve(workspace, relative);
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = id => {
      if (id === 'server-only') return {};
      if (id === './cloudinary') return { cloudinaryClient: () => sdk, cloudinaryFolder: () => folder };
      if (id.startsWith('.')) return load(path.relative(workspace, path.resolve(path.dirname(filename), `${id}.ts`)));
      return require(id);
    };
    vm.runInNewContext(code, {
      exports, require: localRequire, Buffer, URL, Response, ReadableStream, AbortSignal,
      fetch: async (url, options) => {
        requests.push({ url, options });
        if (fetchError) throw fetchError;
        return responseFactory ? responseFactory() : new Response(signatures[extension], { status: 206 });
      },
    }, { filename });
    return exports;
  }
  const media = load('src/lib/cloudinary-media.ts');
  const { ContentError } = load('src/lib/content-validation.ts');
  return { media, ContentError, resources, requests, url: expectedURL };
}

test('own versioned Cloudinary uploads verify all supported image and video formats', async () => {
  for (const extension of Object.keys(signatures)) {
    const h = harness({ extension, folder: 'agency/preview' });
    await h.media.validateCloudinaryMedia(h.url, kindOf(extension));
    assert.equal(h.resources.length, 1);
    assert.equal(h.resources[0].publicId, `agency/preview/media/${uuid}`);
    assert.equal(h.resources[0].options.resource_type, kindOf(extension));
    assert.equal(h.resources[0].options.type, 'upload');
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, h.url);
    assert.equal(h.requests[0].options.headers.Range, 'bytes=0-15');
    assert.equal(h.requests[0].options.redirect, 'error');
    assert.equal(h.requests[0].options.cache, 'no-store');
  }
});

test('foreign, transformed, malformed and incorrect-kind URLs never reach storage or fetch', async () => {
  const url = cdnURL();
  for (const source of [
    url.replace('/test-cloud/', '/foreign-cloud/'),
    url.replace('/vivid/media/', '/another-site/media/'),
    url.replace('/upload/', '/upload/c_fill,w_200/'),
    url.replace('/image/', '/video/'),
    url.replace('/upload/', '/authenticated/'),
    url.replace('/v123/', '/v0/'),
    url.replace('/v123/', '/v9007199254740992/'),
    url.replace('res.cloudinary.com', 'res.cloudinary.com.evil.example'),
    url.replace('https://', 'http://'),
    url.replace('https://', 'https://user:password@'),
    url.replace('res.cloudinary.com/', 'res.cloudinary.com:444/'),
    url.replace('.png', '.svg'),
    url.replace(uuid, 'not-an-upload'),
    `${url}?download=1`, `${url}#fragment`,
    `https://foreign.example/${uuid}.png`, `/api/media/${uuid}.png`,
  ]) {
    const h = harness();
    await assert.rejects(h.media.validateCloudinaryMedia(source), error => error instanceof h.ContentError && error.status === 400, source);
    assert.equal(h.resources.length, 0, source);
    assert.equal(h.requests.length, 0, source);
  }
  const wrongKind = harness();
  await assert.rejects(wrongKind.media.validateCloudinaryMedia(wrongKind.url, 'video'), /uploaded video/);
  assert.equal(wrongKind.resources.length, 0);
  assert.equal(wrongKind.requests.length, 0);
});

test('metadata must match the public ID, resource type, format, exact version and URL', async () => {
  for (const metadata of [
    { public_id: `other/media/${uuid}` }, { resource_type: 'video' }, { type: 'private' },
    { format: 'jpg' }, { version: 124 }, { version: '123' },
    { secure_url: cdnURL().replace('test-cloud', 'foreign-cloud') },
    { bytes: 0 }, { bytes: -1 }, { bytes: 1.5 }, { bytes: '512' },
  ]) {
    const h = harness({ metadata });
    await assert.rejects(h.media.validateCloudinaryMedia(h.url), error => error instanceof h.ContentError && error.status === 400);
    assert.equal(h.resources.length, 1);
    assert.equal(h.requests.length, 0, 'invalid metadata is rejected before downloading');
  }
  const wrongVersion = harness();
  await assert.rejects(wrongVersion.media.validateCloudinaryMedia(wrongVersion.url.replace('/v123/', '/v124/')), /invalid file type/);
  assert.equal(wrongVersion.requests.length, 0);
});

test('authoritative sizes enforce the 10 MB image and 100 MB video limits', async () => {
  for (const [extension, limit] of [['png', 10], ['mp4', 100]]) {
    const accepted = harness({ extension, metadata: { bytes: limit * 1024 * 1024 } });
    await accepted.media.validateCloudinaryMedia(accepted.url);
    const oversized = harness({ extension, metadata: { bytes: limit * 1024 * 1024 + 1 } });
    await assert.rejects(oversized.media.validateCloudinaryMedia(oversized.url), error => error instanceof oversized.ContentError && error.status === 413);
    assert.equal(oversized.requests.length, 0);
  }
});

test('a missing asset is unavailable and metadata or download transport failures report 503', async () => {
  const missing = harness({ resourceError: { http_code: 404 } });
  await assert.rejects(missing.media.validateCloudinaryMedia(missing.url), error => error instanceof missing.ContentError && error.status === 400 && /unavailable/.test(error.message));
  assert.equal(missing.requests.length, 0);
  for (const options of [{ resourceError: new Error('API connection lost') }, { fetchError: new TypeError('CDN connection lost') }]) {
    const h = harness(options);
    await assert.rejects(h.media.validateCloudinaryMedia(h.url), error => error instanceof h.ContentError && error.status === 503);
  }
});

test('only the first 16 bytes are consumed when the CDN ignores Range and returns a video', async () => {
  let cancelled = false;
  let pulls = 0;
  const video = Buffer.concat([signatures.mp4, Buffer.alloc(2 * 1024 * 1024)]);
  const h = harness({ extension: 'mp4', responseFactory: () => new Response(new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(video); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 }), { status: 200 }) });
  await h.media.validateCloudinaryMedia(h.url, 'video');
  assert.equal(pulls, 1, 'the next video chunk is never requested');
  assert.equal(cancelled, true, 'the remaining video response is cancelled');
  assert.equal(h.requests[0].options.headers.Range, 'bytes=0-15');
});

test('mismatched or truncated bytes and unavailable CDN responses are rejected', async () => {
  for (const responseFactory of [
    () => new Response(signatures.jpg, { status: 206 }),
    () => new Response(Buffer.from([0x89, 0x50]), { status: 206 }),
    () => new Response(null, { status: 204 }),
    () => new Response('Not found', { status: 404 }),
  ]) {
    const h = harness({ responseFactory });
    await assert.rejects(h.media.validateCloudinaryMedia(h.url), error => error instanceof h.ContentError && error.status === 400);
  }
});

test('upload IDs stay confined to a supported UUID filename in the configured folder', () => {
  const h = harness({ folder: 'agency/preview' });
  assert.equal(h.media.cloudinaryMediaId(`${uuid}.png`), `agency/preview/media/${uuid}`);
  for (const filename of ['', `../${uuid}.png`, `${uuid}.svg`, `vivid/content/${uuid}.png`, `${uuid}.png?file=other`]) {
    assert.throws(() => h.media.cloudinaryMediaId(filename), error => error instanceof h.ContentError && error.status === 400);
  }
});
