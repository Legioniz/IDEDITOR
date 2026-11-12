'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../editor-core.js');

test('legacy string project files normalize without losing contents', () => {
  const normalized = core.normalizeProjectFiles({
    'index.html': '<h1>Saved</h1>',
    'style.css': { content: 'body { color: red; }' }
  });
  assert.equal(normalized['index.html'].content, '<h1>Saved</h1>');
  assert.equal(normalized['index.html'].lang, 'html');
  assert.equal(normalized['style.css'].content, 'body { color: red; }');
  assert.equal(normalized['style.css'].lang, 'css');
});

test('deleting the active project chooses another project without reusing the deleted ID', () => {
  const projects = { alpha: {}, beta: {}, gamma: {} };
  assert.equal(core.nextProjectIdAfterRemoval(projects, 'alpha'), 'beta');
  assert.equal(core.nextProjectIdAfterRemoval({ alpha: {} }, 'alpha'), null);
});

test('project sync merges non-overlapping local and remote edits', () => {
  const base = { 'index.html': 'base', 'app.js': 'base-js' };
  const local = { 'index.html': 'local', 'app.js': 'base-js', 'local.txt': 'new local' };
  const remote = { 'index.html': 'base', 'app.js': 'remote-js', 'remote.txt': 'new remote' };
  const result = core.mergeFileSnapshots(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.files, {
    'index.html': 'local',
    'app.js': 'remote-js',
    'local.txt': 'new local',
    'remote.txt': 'new remote'
  });
});

test('project sync reports overlapping changes and refuses a partial merge', () => {
  const result = core.mergeFileSnapshots(
    { 'app.js': 'base' },
    { 'app.js': 'local edit' },
    { 'app.js': 'remote edit' }
  );
  assert.deepEqual(result.conflicts, ['app.js']);
  assert.equal(result.files, null);
});

test('git tree plan stages changed files and remote deletions', () => {
  const entries = core.buildGitTreeEntries(
    { 'index.html': 'new', 'added.js': 'added' },
    { 'index.html': 'old', 'removed.js': 'gone' },
    { 'index.html': 'blob-new', 'added.js': 'blob-added' }
  );
  assert.deepEqual(entries, [
    { path: 'added.js', mode: '100644', type: 'blob', sha: 'blob-added' },
    { path: 'index.html', mode: '100644', type: 'blob', sha: 'blob-new' },
    { path: 'removed.js', mode: '100644', type: 'blob', sha: null }
  ]);
});

test('git publishing is blocked when the remote branch has moved', () => {
  assert.equal(core.canPublishAgainst('head-a', 'head-a'), true);
  assert.equal(core.canPublishAgainst('head-b', 'head-a'), false);
  assert.equal(core.canPublishAgainst('', 'head-a'), false);
});

test('preview builder injects CSS, app code, and console capture', () => {
  const output = core.buildPreviewDocument(
    '<!doctype html><html><head></head><body><main>Hello</main></body></html>',
    'main { color: red; }',
    'console.log("preview test");'
  );
  assert.match(output, /main \{ color: red; \}/);
  assert.match(output, /console\.log\("preview test"\)/);
  assert.match(output, /parent\.postMessage/);
  assert.match(output, /<main>Hello<\/main>/);
});

test('AI parallel orchestration runs every selected agent', async () => {
  const agents = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const called = [];
  const results = await core.orchestrateAgents('parallel', 'prompt', agents, async (prompt, agent) => {
    called.push(agent.name);
    return { ok: true, result: agent.name + ':' + prompt };
  });
  assert.deepEqual(called.sort(), ['A', 'B', 'C']);
  assert.equal(results.length, 3);
});

test('AI pipeline passes each result to the next agent in sequence', async () => {
  const agents = [{ name: 'Planner' }, { name: 'Builder' }, { name: 'Reviewer' }];
  const received = [];
  const dividers = [];
  const result = await core.orchestrateAgents('pipeline', 'Build a page', agents, async (prompt, agent) => {
    received.push({ name: agent.name, prompt });
    return { ok: true, result: agent.name + ' output' };
  }, (name) => dividers.push(name));
  assert.equal(received.length, 3);
  assert.match(received[1].prompt, /Planner output/);
  assert.match(received[2].prompt, /Builder output/);
  assert.deepEqual(dividers, ['Builder', 'Reviewer']);
  assert.equal(result.result, 'Reviewer output');
});
