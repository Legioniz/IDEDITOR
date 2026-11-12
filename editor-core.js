/* IDEDITOR shared, dependency-free application logic. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.IDEditorCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function inferLanguage(path) {
    const ext = String(path).split('.').pop().toLowerCase();
    return ({html:'html',htm:'html',css:'css',js:'javascript',mjs:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',json:'json',md:'markdown',xml:'xml',svg:'xml',txt:'plaintext'})[ext] || 'plaintext';
  }
  function normalizeProjectFiles(files) {
    const normalized = {};
    Object.entries(files && typeof files === 'object' ? files : {}).forEach(([path, raw]) => {
      if (typeof raw === 'string') normalized[path] = { lang: inferLanguage(path), content: raw };
      else if (raw && typeof raw === 'object') normalized[path] = { lang: typeof raw.lang === 'string' ? raw.lang : inferLanguage(path), content: String(raw.content == null ? '' : raw.content) };
    });
    return normalized;
  }
  function nextProjectIdAfterRemoval(projects, removedId) {
    return Object.keys(projects || {}).find(id => id !== removedId) || null;
  }
  function sameFileSnapshots(left, right) {
    left = left || {}; right = right || {};
    const a = Object.keys(left).sort(), b = Object.keys(right).sort();
    return a.length === b.length && a.every((key, i) => key === b[i] && left[key] === right[key]);
  }
  function mergeFileSnapshots(base, local, remote) {
    base = base || {}; local = local || {}; remote = remote || {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    const files = {}, conflicts = [];
    const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const equal = (a, b, key) => has(a, key) === has(b, key) && (!has(a, key) || a[key] === b[key]);
    [...keys].sort().forEach(path => {
      if (equal(local, base, path)) { if (has(remote, path)) files[path] = remote[path]; }
      else if (equal(remote, base, path) || equal(local, remote, path)) { if (has(local, path)) files[path] = local[path]; }
      else conflicts.push(path);
    });
    return { files: conflicts.length ? null : files, conflicts };
  }
  function canPublishAgainst(remoteHead, expectedHead) {
    return Boolean(remoteHead && expectedHead && remoteHead === expectedHead);
  }
  function buildGitTreeEntries(localFiles, baseFiles, blobShas) {
    localFiles = localFiles || {}; baseFiles = baseFiles || {}; blobShas = blobShas || {};
    const entries = [];
    Object.keys(localFiles).sort().forEach(path => {
      if (!Object.prototype.hasOwnProperty.call(baseFiles, path) || localFiles[path] !== baseFiles[path]) {
        if (!blobShas[path]) throw new Error('Missing uploaded blob for ' + path);
        entries.push({ path, mode:'100644', type:'blob', sha:blobShas[path] });
      }
    });
    Object.keys(baseFiles).sort().forEach(path => {
      if (!Object.prototype.hasOwnProperty.call(localFiles, path)) entries.push({ path, mode:'100644', type:'blob', sha:null });
    });
    return entries;
  }
  function buildPreviewDocument(html, css, js) {
    const openScript = '<scr' + 'ipt>', closeScript = '</scr' + 'ipt>';
    const hook = openScript + "(function(){function ser(v){if(typeof v==='string')return v;if(v instanceof Error)return v.message;try{return JSON.stringify(v);}catch(e){return String(v);}}function send(type,args){try{parent.postMessage({__preview:true,type:type,msg:Array.prototype.map.call(args,ser).join(' ')},'*');}catch(e){}}['log','info','warn','error'].forEach(function(t){var orig=console[t]?console[t].bind(console):function(){};console[t]=function(){orig.apply(null,arguments);send(t,arguments);};});window.addEventListener('error',function(e){send('error',[e.message+' @ line '+e.lineno]);});window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled rejection: '+ser(e.reason)]);});})();" + closeScript;
    const head = hook + '<style>\n' + (css || '') + '\n</style>';
    const body = openScript + '\ntry{\n' + (js || '') + '\n}catch(e){ console.error(e && e.message ? e.message : e); }\n' + closeScript;
    const source = html || '';
    if (/<html[\s>]/i.test(source)) {
      let output = source;
      if (/<\/head>/i.test(output)) output = output.replace(/<\/head>/i, head + '</head>');
      else output = output.replace(/<html[^>]*>/i, match => match + '<head>' + head + '</head>');
      if (/<\/body>/i.test(output)) output = output.replace(/<\/body>/i, body + '</body>');
      else output += body;
      return output;
    }
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + head + '</head><body>' + source + body + '</body></html>';
  }
  async function orchestrateAgents(mode, prompt, agents, runAgent, onPipelineStep, startIndex, previousOutput) {
    if (!agents || !agents.length) return { ok:false, error:new Error('No agents selected.') };
    const firstIndex = Number.isInteger(startIndex) ? Math.max(0, Math.min(startIndex, agents.length - 1)) : 0;
    if (mode === 'single') return runAgent(prompt, agents[firstIndex], firstIndex, previousOutput || '');
    if (mode === 'parallel') return Promise.all(agents.map((agent, index) => runAgent(prompt, agent, index, '')));
    if (mode !== 'pipeline') throw new Error('Unknown AI orchestration mode: ' + mode);
    let previous = previousOutput || '';
    for (let index = firstIndex; index < agents.length; index++) {
      const agent = agents[index];
      const stepPrompt = index === 0 ? prompt : 'Previous agent (' + agents[index - 1].name + ') produced:\n\n' + previous + '\n\nNow improve/fix/complete this:\n' + prompt;
      const result = await runAgent(stepPrompt, agent, index, previous);
      if (!result || !result.ok) return result || { ok:false };
      previous = result.result;
      if (index < agents.length - 1 && onPipelineStep) onPipelineStep(agents[index + 1].name);
    }
    return { ok:true, result:previous };
  }
  return { inferLanguage, normalizeProjectFiles, nextProjectIdAfterRemoval, sameFileSnapshots, mergeFileSnapshots, canPublishAgainst, buildGitTreeEntries, buildPreviewDocument, orchestrateAgents };
}));
