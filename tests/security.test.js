'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('index.html');
const script = read('script.js');
const agents = read('ai-agents.js');

test('preview iframe is sandboxed without same-origin privileges', () => {
  const tag = html.match(/<iframe\b[^>]*\bid=["']preview["'][^>]*>/i)?.[0] || '';
  assert.ok(tag, 'preview iframe must exist');
  assert.match(tag, /\bsandbox=["']allow-scripts["']/i);
  assert.doesNotMatch(tag, /allow-same-origin|allow-top-navigation|allow-popups/i);
});

test('preview messages are accepted only from the preview frame', () => {
  assert.match(script, /event\.source !== frame\.contentWindow/);
  assert.match(script, /PREVIEW_MESSAGE_TYPES/);
  assert.match(script, /typeof data\.msg !== 'string'/);
  assert.match(script, /data\.msg\.slice\(0,\s*5000\)/);
});

test('preview export downloads a file instead of opening an unsandboxed blob window', () => {
  const start = script.indexOf("btnOpen.addEventListener('click'");
  const end = script.indexOf('let autoOn = false', start);
  assert.ok(start >= 0 && end > start);
  const handler = script.slice(start, end);
  assert.match(handler, /link\.download\s*=/);
  assert.doesNotMatch(handler, /window\.open/);
});

test('GitHub tokens are memory-only and legacy local storage is cleared', () => {
  assert.match(script, /let volatileGitToken = ''/);
  assert.match(script, /localStorage\.removeItem\(GIT_TOKEN_KEY\)/);
  assert.doesNotMatch(script, /localStorage\.setItem\(GIT_TOKEN_KEY/);
  assert.doesNotMatch(script, /data\.token/);
  assert.match(html, /localStorage\.removeItem\('idEditor\.gitToken'\)/);
});

test('AI provider keys are excluded from persisted agent settings', () => {
  const saveBody = agents.match(/function save\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(saveBody, /const \{ apiKey, \.\.\.safeAgent \} = agent/);
  assert.match(saveBody, /writeJson\(STORAGE\.agents, safeAgents\)/);
  assert.match(agents, /localStorage\.removeItem\(LEGACY\.key\)/);
  assert.match(html, /localStorage\.removeItem\('idEditor\.aiKey'\)/);
});

test('AI Markdown is sanitized before DOM insertion', () => {
  assert.match(agents, /function sanitizeMarkdownHtml\(markup\)/);
  assert.match(agents, /contentDiv\.appendChild\(sanitizeMarkdownHtml\(window\.marked\.parse\(text\(value\)\)\)\)/);
  assert.match(agents, /MARKDOWN_DROP_TAGS/);
});

test('GitHub pushes are fast-forward only and branch refs are URL-encoded', () => {
  assert.match(script, /encodeURIComponent\(branch\)/);
  assert.match(script, /force:\s*false/);
  assert.doesNotMatch(script, /force:\s*true/);
});

test('local application scripts exist and are referenced', () => {
  assert.match(html, /src=["']\.\/editor-core\.js["']/);
  assert.match(html, /src=["']script\.js["']/);
  assert.match(html, /src=["']ai-agents\.js["']/);
  assert.ok(fs.existsSync(path.join(root, 'script.js')));
  assert.ok(fs.existsSync(path.join(root, 'ai-agents.js')));
});
