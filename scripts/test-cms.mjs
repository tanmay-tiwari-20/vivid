/**
 * CMS integration checks against an isolated running Next.js server.
 * Run: node --env-file=.env.local scripts/test-cms.mjs
 * BASE_URL defaults to http://127.0.0.1:3100. VIVID_DATA_DIR must end in
 * `verification`; the server must use that same directory. This suite mutates
 * content, restores its original storage file, and leaves uploads in the test volume.
 * Never run it against the live site's data directory.
 */
import assert from 'node:assert/strict';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:3100');
const origin = process.env.VIVID_SITE_ORIGIN || base.origin;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(path.basename(process.env.VIVID_DATA_DIR || ''), 'verification', 'Use an isolated VIVID_DATA_DIR ending in verification.');
assert.ok(process.env.VIVID_ADMIN_PASSWORD, 'VIVID_ADMIN_PASSWORD is required.');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'These mutation checks must target a local test server.');
assert.ok(!process.env.VERCEL && (process.env.VIVID_STORAGE_MODE === 'local' || ![process.env.CLOUDINARY_URL, process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].some(Boolean)), 'This filesystem integration suite requires isolated local storage. Set VIVID_STORAGE_MODE=local when Cloudinary credentials are present.');
const verificationDirectory = path.resolve(process.env.VIVID_DATA_DIR);
const contentFile = path.join(verificationDirectory, 'content.json');
const originalFile = await readFile(contentFile).catch(error => { if (error.code === 'ENOENT') return null; throw error; });

let cookie = '';
let original;
let working;
let fixtureImage;
let fixtureVideo;
let passed = 0;
const tag = `verification-${Date.now()}`;
const clone = value => structuredClone(value);

async function request(endpoint, { method = 'GET', body, auth = true, requestOrigin = origin, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  if (auth && cookie) finalHeaders.Cookie = cookie;
  if (method !== 'GET' && method !== 'HEAD' && requestOrigin !== null) finalHeaders.Origin = requestOrigin;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    body = JSON.stringify(body);
    finalHeaders['Content-Type'] = 'application/json';
  }
  return fetch(new URL(endpoint, base), { method, body, headers: finalHeaders, signal: AbortSignal.timeout(30000) });
}

async function json(endpoint, options, status = 200) {
  const response = await request(endpoint, options);
  assert.equal(response.status, status, `${options?.method || 'GET'} ${endpoint}: unexpected status`);
  assert.match(response.headers.get('cache-control') || '', /no-store/, `${endpoint} must not cache content or session data`);
  return response.json();
}

async function check(label, run) {
  await run();
  passed++;
  process.stdout.write(`PASS ${label}\n`);
}

function contentLengthIfPresent(response, expected) {
  // This bundled Next.js strips Content-Length from Route Handler responses.
  // Bodies and Content-Range below still verify exact transmitted byte counts.
  const header = response.headers.get('content-length');
  if (header !== null) assert.equal(Number(header), expected);
}

async function signIn() {
  const response = await request('/api/admin/session', { method: 'POST', auth: false, body: { password: process.env.VIVID_ADMIN_PASSWORD } });
  assert.equal(response.status, 200, 'Configured administrator must be able to sign in.');
  const setCookie = response.headers.getSetCookie().find(value => value.startsWith('vivid_studio='));
  assert.ok(setCookie, 'Login must set the studio session cookie.');
  assert.match(setCookie, /;\s*HttpOnly/i);
  assert.match(setCookie, /;\s*SameSite=Strict/i);
  assert.match(setCookie, /;\s*Secure/i, 'Run this suite against a production server.');
  cookie = setCookie.split(';')[0];
  assert.equal((await response.json()).authenticated, true);
  assert.equal((await json('/api/admin/upload')).mode, 'local', 'The test server must use isolated local storage; never mutate a connected Cloudinary account with this suite.');
}

async function save(next) {
  working = await json('/api/admin/content', { method: 'PUT', body: next });
  return working;
}

function creator(id, name, featured, published) {
  return { id, name, featured, published, category: 'VERIFICATION', specialty: 'Stories with personality.', bio: `Biography for ${name}.`, image: fixtureImage, profileUrl: 'https://www.instagram.com/vividverification/', handle: '@vividverification', followers: '12K', demo: false };
}

function brand(id, name, published) {
  return { id, name, published, category: 'VERIFICATION', description: `About ${name}.`, logo: fixtureImage, websiteUrl: 'https://www.example.com/verification/', demo: false };
}

function reel(id, title, creatorId, brandId, featured, published) {
  return { id, title, creatorId, brandId, creator: 'Outdated name', featured, published, brand: 'Outdated brand', category: 'VERIFICATION', description: `Story for ${title}.`, image: fixtureImage, video: fixtureVideo, views: '1.2M', reach: '900K', color: '#1ec89a', demo: false };
}

async function upload(bytes, type, filename, expected = 201, options = {}) {
  const body = new FormData();
  body.append('file', new Blob([bytes], { type }), filename);
  return json('/api/admin/upload', { method: 'POST', body, ...options }, expected);
}

async function visibleCards(endpoint, label) {
  const response = await request(endpoint, { auth: false });
  assert.equal(response.status, 200, `${endpoint} must render.`);
  const html = await response.text();
  const pattern = new RegExp(`aria-label="${label} ([^"]+)"`, 'g');
  // Collection checks exclude the additional hero previews on these pages.
  const cardClass = endpoint === '/work' ? 'work-project-image' : endpoint === '/creators' ? 'creators-profile-portrait' : null;
  const buttons = (html.match(/<button\b[^>]*>/g) || []).filter(tag => !cardClass || tag.includes(`class="${cardClass}"`));
  return { html, labels: buttons.flatMap(tag => [...tag.matchAll(pattern)].map(match => match[1])) };
}

try {
  await check('Private routes reject anonymous access', async () => {
    assert.equal((await json('/api/admin/session', { auth: false })).authenticated, false);
    await json('/api/admin/content', { auth: false }, 401);
    await json('/api/admin/content', { method: 'PUT', auth: false, body: {} }, 401);
    await upload(Buffer.from('fake'), 'image/png', 'fake.png', 401, { auth: false });
  });

  await check('Login validates credentials and protects its cookie', async () => {
    await json('/api/admin/session', { method: 'POST', auth: false, body: { password: 'incorrect-verification-password' } }, 401);
    await json('/api/admin/session', { method: 'POST', auth: false, requestOrigin: null, body: { password: process.env.VIVID_ADMIN_PASSWORD } }, 403);
    await json('/api/admin/session', { method: 'POST', auth: false, requestOrigin: 'https://foreign.example', body: { password: process.env.VIVID_ADMIN_PASSWORD } }, 403);
    await signIn();
    assert.equal((await json('/api/admin/session')).authenticated, true);
    original = await json('/api/admin/content');
    working = clone(original);
  });

  await check('Tampered and malformed sessions are rejected', async () => {
    const validCookie = cookie;
    try {
      cookie = `${validCookie.slice(0, -1)}${validCookie.endsWith('A') ? 'B' : 'A'}`;
      await json('/api/admin/content', {}, 401);
      assert.equal((await json('/api/admin/session')).authenticated, false);
      cookie = 'vivid_studio=malformed';
      await json('/api/admin/content', {}, 401);
    } finally { cookie = validCookie; }
  });

  await check('Mutations reject missing and foreign origins', async () => {
    for (const requestOrigin of [null, 'https://foreign.example']) {
      await json('/api/admin/content', { method: 'PUT', requestOrigin, body: working }, 403);
      await json('/api/admin/session', { method: 'DELETE', requestOrigin }, 403);
      await upload(Buffer.from('fake'), 'image/png', 'fake.png', 403, { requestOrigin });
    }
    await json('/api/admin/content', { method: 'PUT', body: working, headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403);
  });

  await check('Empty collections render without errors', async () => {
    await save({ revision: working.revision, reels: [], creators: [], brands: [] });
    // for (const endpoint of ['/', '/work', '/creators']) {
    for (const endpoint of ['/', '/work']) {
      const response = await request(endpoint, { auth: false });
      assert.equal(response.status, 200);
      assert.match(await response.text(), /on (?:their|its) way/);
    }
  });

  await check('The temporarily disabled creators page returns 404', async () => {
    const response = await request('/creators', { auth: false });
    assert.equal(response.status, 404);
    assert.ok(!/aria-label="Meet [^"]+"/.test(await response.text()), 'The disabled route must not render creator profiles.');
  });

  const names = [`${tag} Featured Creator`, `${tag} Work Creator`, `${tag} Draft Creator`];
  const brandNames = [`${tag} Published Brand`, `${tag} Secondary Brand`, `${tag} Draft Brand`];
  const titles = [`${tag} Featured Reel`, `${tag} Work Reel`, `${tag} Draft Reel`];
  const ids = [`${tag}-featured`, `${tag}-work`, `${tag}-draft`];

  await check('Image and video fixtures upload before creating content', async () => {
    const image = await upload(await readFile(path.join(root, 'public/images/vivid-logo-preview.png')), 'image/png', 'fixture.png');
    const video = await upload(await readFile(path.join(root, 'public/videos/fashion.mp4')), 'video/mp4', 'fixture.mp4');
    fixtureImage = image.url;
    fixtureVideo = video.url;
    assert.match(fixtureImage, /^\/api\/media\/[0-9a-f-]+\.png$/);
    assert.match(fixtureVideo, /^\/api\/media\/[0-9a-f-]+\.mp4$/);
  });

  await check('Published, featured, and draft content reaches the correct pages', async () => {
    await save({ revision: working.revision,
      brands: ids.map((id, i) => brand(`brand-${id}`, brandNames[i], i !== 2)),
      creators: ids.map((id, i) => creator(`creator-${id}`, names[i], i === 0, i !== 2)),
      reels: ids.map((id, i) => reel(`reel-${id}`, titles[i], `creator-${id}`, `brand-${id}`, i === 0, i !== 2)),
    });
    const publicData = await json('/api/content', { auth: false });
    assert.deepEqual(publicData.creators.map(item => item.name), names.slice(0, 2));
    assert.deepEqual(publicData.reels.map(item => item.title), titles.slice(0, 2));
    assert.deepEqual(publicData.brands.map(item => item.name), brandNames.slice(0, 2));
    assert.equal(publicData.reels[0].creator, names[0], 'Linked creator name must be authoritative.');
    assert.equal(publicData.reels[0].brand, brandNames[0], 'Linked brand name must be authoritative.');
    const homeReels = await visibleCards('/', 'Watch');
    assert.deepEqual(homeReels.labels, [titles[0]]);
    const homeCreators = await visibleCards('/', 'Meet');
    // Creator profile cards are temporarily disabled; keep their original visibility checks.
    // assert.ok(homeCreators.labels.includes(names[0]));
    // assert.ok(!homeCreators.labels.includes(names[1]));
    assert.deepEqual(homeCreators.labels, [], 'Home must not expose creator profile cards.');
    const work = await visibleCards('/work', 'Watch');
    assert.deepEqual(work.labels, titles.slice(0, 2));
    // const creators = await visibleCards('/creators', 'Meet');
    // assert.deepEqual(creators.labels, names.slice(0, 2));
    // for (const html of [homeReels.html, homeCreators.html, work.html, creators.html]) {
    for (const html of [homeReels.html, homeCreators.html, work.html]) {
      assert.ok(!html.includes(names[2]) && !html.includes(titles[2]) && !html.includes(brandNames[2]), 'Drafts must not leak into page HTML or serialized props.');
      assert.ok(!/<a\b[^>]*\bhref="\/creators"/.test(html), 'Public navigation must not link to the disabled creators page.');
    }
    for (const html of [homeReels.html, work.html]) for (const name of brandNames.slice(0, 2)) assert.ok(html.includes(name), 'Published brands must appear on home and work pages.');
  });

  await check('Record validation rejects duplicates, unsafe URLs, and invalid flags', async () => {
    const invalid = [];
    const duplicateReel = clone(working); duplicateReel.reels.push(clone(duplicateReel.reels[0])); invalid.push(duplicateReel);
    const duplicateCreator = clone(working); duplicateCreator.creators.push(clone(duplicateCreator.creators[0])); invalid.push(duplicateCreator);
    const duplicateBrand = clone(working); duplicateBrand.brands.push(clone(duplicateBrand.brands[0])); invalid.push(duplicateBrand);
    for (const field of ['featured', 'published', 'demo']) { const next = clone(working); next.reels[0][field] = 'true'; invalid.push(next); }
    for (const value of ['javascript:alert(1)', 'data:image/png;base64,abc', '//foreign.example/photo.jpg', '/images/../secret']) { const next = clone(working); next.reels[0].image = value; invalid.push(next); }
    const unsafeVideo = clone(working); unsafeVideo.reels[0].video = 'javascript:alert(1)'; invalid.push(unsafeVideo);
    const unsafeProfile = clone(working); unsafeProfile.creators[0].profileUrl = 'http://example.com/profile'; invalid.push(unsafeProfile);
    const unsafeWebsite = clone(working); unsafeWebsite.brands[0].websiteUrl = 'http://example.com/brand'; invalid.push(unsafeWebsite);
    const unknownCreator = clone(working); unknownCreator.reels[0].creatorId = 'missing-creator'; invalid.push(unknownCreator);
    const unknownBrand = clone(working); unknownBrand.reels[0].brandId = 'missing-brand'; invalid.push(unknownBrand);
    const invalidColor = clone(working); invalidColor.reels[0].color = 'red'; invalid.push(invalidColor);
    const missingImage = clone(working); missingImage.creators[0].image = ''; invalid.push(missingImage);
    const missingLogo = clone(working); missingLogo.brands[0].logo = ''; invalid.push(missingLogo);
    for (const next of invalid) await json('/api/admin/content', { method: 'PUT', body: next }, 400);
    await json('/api/admin/content', { method: 'PUT', body: '{malformed', headers: { 'Content-Type': 'application/json' } }, 400);
    await json('/api/admin/content', { method: 'PUT', body: '{}', headers: { 'Content-Type': 'text/plain' } }, 400);
    await json('/api/admin/content', { method: 'PUT', body: ' '.repeat(8 * 1024 * 1024 + 1), headers: { 'Content-Type': 'application/json' } }, 413);
    assert.equal((await json('/api/admin/content')).revision, working.revision, 'Rejected writes must not change stored content.');
  });

  await check('Media edits require uploaded files while profile and website links stay supported', async () => {
    for (const [collection, field, wrongType] of [['creators', 'image', fixtureVideo], ['reels', 'image', fixtureVideo], ['reels', 'video', fixtureImage], ['brands', 'logo', fixtureVideo]]) {
      for (const value of ['https://cdn.example/file', 'https://drive.google.com/file/d/example/view', '/images/creator-fashion.jpg', wrongType, '/api/media/00000000-0000-0000-0000-000000000000.png']) {
        const next = clone(working); next[collection][0][field] = value;
        await json('/api/admin/content', { method: 'PUT', body: next }, 400);
      }
    }
    assert.equal((await json('/api/admin/content')).revision, working.revision);
  });

  await check('Creator data persists while public profiles stay disabled', async () => {
    const next = clone(working);
    next.creators[0].name = `${names[0]} Updated`;
    const replacement = await upload(await readFile(path.join(root, 'public/images/vivid-logo-preview.png')), 'image/png', 'replacement.png');
    next.creators[0].image = replacement.url;
    next.creators[0].profileUrl = 'https://www.instagram.com/updatedverification/';
    next.creators[0].bio = 'Updated biography.';
    next.creators[0].featured = false;
    next.brands[0].name = `${brandNames[0]} Updated`;
    next.brands[0].description = 'Updated brand details.';
    next.brands[0].logo = replacement.url;
    next.brands[0].websiteUrl = 'https://www.example.com/updated-brand/';
    next.creators[1].featured = true;
    next.reels[0].featured = false;
    next.reels[1].featured = true;
    next.creators.reverse(); next.reels.reverse();
    await save(next);
    const publicData = await json('/api/content', { auth: false });
    assert.deepEqual(publicData.reels.map(item => item.title), [titles[1], titles[0]]);
    assert.equal(publicData.reels.find(item => item.title === titles[0]).creator, `${names[0]} Updated`);
    assert.equal(publicData.reels.find(item => item.title === titles[0]).brand, `${brandNames[0]} Updated`);
    assert.equal(publicData.brands.find(item => item.id === `brand-${ids[0]}`).logo, replacement.url);
    assert.equal(publicData.creators.find(item => item.id === `creator-${ids[0]}`).bio, 'Updated biography.');
    assert.deepEqual((await visibleCards('/', 'Watch')).labels, [titles[1]]);
    const featuredNames = (await visibleCards('/', 'Meet')).labels;
    // assert.ok(featuredNames.includes(names[1]));
    // assert.ok(!featuredNames.includes(`${names[0]} Updated`));
    assert.deepEqual(featuredNames, [], 'Creator data edits must not restore the disabled profile cards.');
    assert.deepEqual((await visibleCards('/work', 'Watch')).labels, [titles[1], titles[0]]);
  });

  await check('Hidden brand details do not leak through published reels', async () => {
    const next = clone(working);
    next.brands.find(item => item.id === `brand-${ids[0]}`).published = false;
    await save(next);
    const publicData = await json('/api/content', { auth: false });
    const linkedReel = publicData.reels.find(item => item.title === titles[0]);
    assert.equal(linkedReel.brandId, '');
    assert.equal(linkedReel.brand, '');
    assert.ok(!publicData.brands.some(item => item.id === `brand-${ids[0]}`));
    for (const endpoint of ['/', '/work']) {
      const response = await request(endpoint, { auth: false });
      assert.ok(!(await response.text()).includes(`${brandNames[0]} Updated`), 'Hidden brand details must not leak into rendered pages.');
    }
  });

  await check('Hidden creator details do not leak through published reels', async () => {
    const next = clone(working);
    next.creators.find(item => item.id === `creator-${ids[0]}`).published = false;
    await save(next);
    const publicData = await json('/api/content', { auth: false });
    const linkedReel = publicData.reels.find(item => item.title === titles[0]);
    assert.equal(linkedReel.creatorId, '');
    assert.equal(linkedReel.creator, '');
    assert.ok(!publicData.creators.some(item => item.id === `creator-${ids[0]}`));
  });

  await check('Concurrent stale writes cannot overwrite each other', async () => {
    const first = clone(working); first.reels[0].description = 'Concurrent change A';
    const second = clone(working); second.reels[0].description = 'Concurrent change B';
    const responses = await Promise.all([request('/api/admin/content', { method: 'PUT', body: first }), request('/api/admin/content', { method: 'PUT', body: second })]);
    assert.deepEqual(responses.map(item => item.status).sort(), [200, 409]);
    const winningResponse = responses.find(item => item.status === 200);
    working = await winningResponse.json();
    await responses.find(item => item.status === 409).arrayBuffer();
    assert.equal((await json('/api/admin/content')).revision, working.revision);
    await json('/api/admin/content', { method: 'PUT', body: first }, 409);
  });

  await check('Real images upload and serve intact with correct headers', async () => {
    const bytes = await readFile(path.join(root, 'public/images/vivid-logo-preview.png'));
    const { url } = await upload(bytes, 'image/png', 'verification.png');
    assert.match(url, /^\/api\/media\/[0-9a-f-]+\.png$/);
    const response = await request(url, { auth: false });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    contentLengthIfPresent(response, bytes.length);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const next = clone(working); next.creators[0].image = url; next.reels[0].image = url;
    await save(next);
    assert.equal((await json('/api/admin/content')).creators[0].image, url);
  });

  await check('Video uploads support seeking, suffix ranges, and HEAD', async () => {
    const bytes = await readFile(path.join(root, 'public/videos/fashion.mp4'));
    const { url } = await upload(bytes, 'video/mp4', 'verification.mp4');
    const head = await request(url, { method: 'HEAD', auth: false });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-type'), 'video/mp4');
    assert.equal(head.headers.get('accept-ranges'), 'bytes');
    contentLengthIfPresent(head, bytes.length);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    for (const [range, start, end] of [['bytes=0-31', 0, 31], ['bytes=-20', bytes.length - 20, bytes.length - 1], [`bytes=${bytes.length - 20}-`, bytes.length - 20, bytes.length - 1], [`bytes=0-${bytes.length + 20}`, 0, bytes.length - 1]]) {
      const response = await request(url, { auth: false, headers: { Range: range } });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
      contentLengthIfPresent(response, end - start + 1);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
    }
    for (const range of ['bytes=9999999999-', 'bytes=3-1', 'bytes=0-1,3-4', 'bytes=-0', 'bytes=-']) {
      const response = await request(url, { auth: false, headers: { Range: range } });
      assert.equal(response.status, 416);
      assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`);
      await response.arrayBuffer();
    }
    const next = clone(working); next.reels[0].video = url; await save(next);
    const invalidPath = await request('/api/media/unsafe.mp4', { auth: false });
    assert.equal(invalidPath.status, 404);
  });

  await check('Uploads reject spoofed files, unsupported formats, and excessive image size', async () => {
    await upload(Buffer.from('fake PNG'), 'image/png', 'fake.png', 400);
    await upload(Buffer.from('fake MP4'), 'video/mp4', 'fake.mp4', 400);
    await upload(Buffer.from('<svg></svg>'), 'image/svg+xml', 'unsafe.svg', 400);
    await upload(Buffer.alloc(0), 'image/png', 'empty.png', 400);
    const png = await readFile(path.join(root, 'public/images/vivid-logo-preview.png'));
    await upload(png, 'image/jpeg', 'spoofed.jpg', 400);
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1); png.copy(oversized, 0);
    await upload(oversized, 'image/png', 'oversized.png', 413);
  });

  await check('Deleting linked records requires clearing their relationships', async () => {
    const danglingBrand = clone(working);
    danglingBrand.brands = danglingBrand.brands.filter(item => item.id !== `brand-${ids[1]}`);
    await json('/api/admin/content', { method: 'PUT', body: danglingBrand }, 400);
    const dangling = clone(working);
    dangling.creators = dangling.creators.filter(item => item.id !== `creator-${ids[1]}`);
    await json('/api/admin/content', { method: 'PUT', body: dangling }, 400);
    dangling.reels = dangling.reels.filter(item => item.creatorId !== `creator-${ids[1]}`);
    dangling.brands = dangling.brands.filter(item => item.id !== `brand-${ids[1]}`);
    await save(dangling);
    const publicData = await json('/api/content', { auth: false });
    assert.ok(!publicData.creators.some(item => item.id === `creator-${ids[1]}`));
    assert.ok(!publicData.reels.some(item => item.title === titles[1]));
    assert.ok(!publicData.brands.some(item => item.id === `brand-${ids[1]}`));
  });

  await check('Logout clears session and returns to protected access', async () => {
    const response = await request('/api/admin/session', { method: 'DELETE' });
    assert.equal(response.status, 200);
    assert.ok(response.headers.getSetCookie().some(value => /Max-Age=0/i.test(value)));
    cookie = '';
    assert.equal((await json('/api/admin/session')).authenticated, false);
    await json('/api/admin/content', {}, 401);
  });
} finally {
  if (original) {
    // Restore the exact isolated file, including pre-upload legacy media. An API
    // write would treat deleted original records as new and correctly reject it.
    if (originalFile) {
      const restorationFile = path.join(verificationDirectory, `content-restore-${tag}.tmp`);
      await writeFile(restorationFile, originalFile, { mode: 0o600, flag: 'wx' });
      await rename(restorationFile, contentFile);
    } else {
      await unlink(contentFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
    if (!cookie) await signIn();
    const restored = await json('/api/admin/content');
    assert.equal(restored.revision, original.revision);
    assert.deepEqual(restored.reels, original.reels);
    assert.deepEqual(restored.creators, original.creators);
    assert.deepEqual(restored.brands, original.brands);
    const response = await request('/api/admin/session', { method: 'DELETE' });
    assert.equal(response.status, 200);
    cookie = '';
    process.stdout.write('RESTORED original test content\n');
  }
}
process.stdout.write(`Completed ${passed} CMS integration checks.\n`);
