import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = readFileSync(path.resolve(import.meta.dirname, '../src/HeroReels.tsx'), 'utf8');
const context = { exports: {}, require: id => id === 'next/link' ? props => React.createElement('a', props) : require(id) };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, context);
const HeroReels = context.exports.default;
const reel = (id, overrides = {}) => ({
  id, title: `Story ${id}`, brand: `Brand ${id}`, category: 'Lifestyle',
  image: `/images/${id}.jpg`, video: 'https://www.instagram.com/reel/ABC123/',
  views: '', reach: '', featured: true, published: true, ...overrides,
});
const render = campaigns => renderToStaticMarkup(React.createElement(HeroReels, { campaigns, onCampaign() {} }));
const cards = markup => [...markup.matchAll(/<button class="hero-reel hero-reel-(main|left|right)"[^>]*aria-label="Play reel: ([^"]+)"/g)].map(match => ({ position: match[1], title: match[2] }));

test('admin order controls the three hero slots even when later reels have higher views or reach', () => {
  const campaigns = [
    reel('first', { views: '12' }), reel('second', { reach: '20' }),
    reel('third', { views: '1.2M' }), reel('fourth', { views: '10B', reach: '20B' }),
  ];
  const original = structuredClone(campaigns);
  const markup = render(campaigns);
  assert.deepEqual(cards(markup), [
    { position: 'main', title: 'Story first' }, { position: 'left', title: 'Story second' }, { position: 'right', title: 'Story third' },
  ]);
  assert.doesNotMatch(markup, /Story fourth/);
  assert.match(markup, /THE VIVID EFFECT<\/small><strong>12<\/strong>/);
  assert.deepEqual(campaigns, original, 'hero rendering must not reorder the shared content array');
});

test('drafts and reels not featured on home cannot occupy hero slots', () => {
  const markup = render([
    reel('draft', { published: false, views: '10B' }), reel('unfeatured', { featured: false, views: '9B' }),
    reel('first'), reel('hidden-draft', { published: false }), reel('second'), reel('third'),
  ]);
  assert.deepEqual(cards(markup).map(card => card.title), ['Story first', 'Story second', 'Story third']);
  assert.doesNotMatch(markup, /Story draft|Story unfeatured|Story hidden-draft/);
});

test('a saved priority change moves the newly leading reel and its metrics to the main hero slot', () => {
  const first = reel('first', { views: '8M' });
  const promoted = reel('promoted', { reach: '75K' });
  const third = reel('third', { views: '3M' });
  assert.equal(cards(render([first, third, promoted]))[0].title, 'Story first');
  const markup = render([promoted, first, third]);
  assert.deepEqual(cards(markup), [
    { position: 'main', title: 'Story promoted' }, { position: 'left', title: 'Story first' }, { position: 'right', title: 'Story third' },
  ]);
  assert.match(markup, /THE VIVID EFFECT<\/small><strong>75K<\/strong><span>reach<\/span>/);
});

test('one or two featured reels fill available hero slots and an empty selection offers the work collection', () => {
  for (const count of [1, 2]) {
    const markup = render(['first', 'second'].slice(0, count).map(id => reel(id)));
    assert.equal(cards(markup).length, count);
    assert.match(markup, new RegExp(`data-count="${count}"`));
    assert.doesNotMatch(markup, /hero-reels-empty/);
  }
  const empty = render([reel('draft', { published: false }), reel('unfeatured', { featured: false })]);
  assert.equal(cards(empty).length, 0);
  assert.match(empty, /class="hero-reels-empty" href="\/work"/);
});
