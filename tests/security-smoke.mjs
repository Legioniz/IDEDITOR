import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, script, agents] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../script.js', import.meta.url), 'utf8'),
  readFile(new URL('../ai-agents.js', import.meta.url), 'utf8')
]);

assert.match(html, /<iframe[^>]*id="preview"[^>]*sandbox="allow-scripts"/i);
assert.doesNotMatch(html.match(/<iframe[^>]*id="preview"[^>]*>/i)?.[0] || '', /allow-same-origin/i);
assert.match(html, /dompurify\/3\.4\.17\/purify\.min\.js/i);
assert.match(html, /GitHub token stays in memory/i);
assert.match(html, /AI provider keys stay in memory/i);
assert.match(script, /event\.source !== preview\.contentWindow/);
assert.match(script, /\['log', 'info', 'warn', 'error'\]\.includes\(data\.type\)/);
assert.match(script, /data\.msg\.slice\(0, 5000\)/);
assert.match(script, /localStorage\.removeItem\(GIT_TOKEN_KEY\)/);
assert.doesNotMatch(script, /localStorage\.setItem\(GIT_TOKEN_KEY/);
assert.doesNotMatch(script, /localStorage\.getItem\(GIT_TOKEN_KEY/);
assert.match(script, /token: gitTokenSession/);
assert.doesNotMatch(script, /settings\/git'\), \{ url, token/);
assert.match(agents, /apiKey: ''/);
assert.match(agents, /localStorage\.removeItem\(LEGACY\.key\)/);
assert.match(agents, /window\.DOMPurify\.sanitize\(renderedMarkdown/);
assert.match(agents, /Provider API keys stay in memory/);
console.log('IDEDITOR security smoke tests passed.');
