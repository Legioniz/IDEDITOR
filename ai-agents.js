/* AI agents: OpenAI, Groq, Gemini, Together, OpenRouter, Fireworks,
   Mistral, Ollama, Custom, and Mock. */
(function () {
  'use strict';

  const STORAGE = {
    agents: 'idEditor.agents.v1',
    active: 'idEditor.activeAgentId',
    mode: 'idEditor.orchestrationMode',
    compare: 'idEditor.compareAgentIds',
    pipeline: 'idEditor.pipelineAgentIds'
  };
  const DEFAULT_PROMPT = 'You are an expert AI coding assistant inside IDEDITOR.';
  const LABELS = {
    openai: 'OpenAI', groq: 'Groq', gemini: 'Gemini', together: 'Together',
    openrouter: 'OpenRouter', fireworks: 'Fireworks', mistral: 'Mistral',
    ollama: 'Ollama', custom: 'Custom', mock: 'Mock'
  };
  const PRESETS = {
    openai: ['https://api.openai.com/v1', ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini']],
    groq: ['https://api.groq.com/openai/v1', ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct']],
    gemini: ['https://generativelanguage.googleapis.com/v1beta', ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash']],
    together: ['https://api.together.xyz/v1', []],
    openrouter: ['https://openrouter.ai/api/v1', []],
    fireworks: ['https://api.fireworks.ai/inference/v1', []],
    mistral: ['https://api.mistral.ai/v1', ['mistral-large-latest', 'mistral-small-latest']],
    ollama: ['http://localhost:11434/v1', ['llama3.2', 'qwen2.5-coder', 'deepseek-coder-v2']],
    custom: ['', []],
    mock: ['mock', []]
  };
  let state = { agents: [], active: '', mode: 'single', compare: [], pipeline: [] };
  let context = null;
  let messages = [];
  let controllers = new Set();
  let attached = false;
  let modalBody = null;
  let formState = null;

  const get = id => document.getElementById(id);
  const text = value => String(value == null ? '' : value);
  const esc = value => text(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const providerLabel = provider => LABELS[provider] || provider;
  const id = () => 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const readJson = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; } catch (_) { return fallback; }
  };
  const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const toast = message => { if (typeof window.showToast === 'function') window.showToast(message); };

  function normalizeAgent(agent) {
    const provider = PRESETS[agent.provider] ? agent.provider : 'custom';
    const preset = PRESETS[provider];
    return {
      id: text(agent.id) || id(), name: text(agent.name) || 'New Agent', enabled: agent.enabled !== false,
      provider, baseUrl: text(agent.baseUrl) || preset[0], apiShape: (text(agent.baseUrl) || preset[0]) === 'mock' ? 'mock' : provider === 'gemini' ? 'gemini' : provider === 'mock' ? 'mock' : 'openai',
      apiKey: text(agent.apiKey), model: text(agent.model), systemPrompt: text(agent.systemPrompt) || DEFAULT_PROMPT,
      temperature: Number.isFinite(Number(agent.temperature)) ? Math.max(0, Math.min(2, Number(agent.temperature))) : 0.7,
      maxTokens: Math.max(1, Number(agent.maxTokens) || 1024), createdAt: Number(agent.createdAt) || Date.now(), updatedAt: Date.now()
    };
  }
  function save() {
    writeJson(STORAGE.agents, state.agents);
    localStorage.setItem(STORAGE.active, state.active);
    localStorage.setItem(STORAGE.mode, state.mode);
    writeJson(STORAGE.compare, state.compare);
    writeJson(STORAGE.pipeline, state.pipeline);
  }
  function load() {
    const stored = localStorage.getItem(STORAGE.agents);
    if (stored === null) {
      const provider = localStorage.getItem('idEditor.aiProvider');
      const key = localStorage.getItem('idEditor.aiKey');
      const model = localStorage.getItem('idEditor.aiModel');
      if (provider || key || model) {
        const preset = PRESETS[provider] || PRESETS.openai;
        state.agents = [normalizeAgent({ id: 'a_legacy', name: 'Default Agent', provider: provider || 'openai', baseUrl: preset[0], apiKey: key, model: model || preset[1][0] })];
        state.active = 'a_legacy';
        state.mode = 'single';
        console.info('[ai-agents] Migrated legacy single-agent config.');
      }
    } else {
      state.agents = readJson(STORAGE.agents, []).map(normalizeAgent);
    }
    state.active = localStorage.getItem(STORAGE.active) || state.agents[0]?.id || '';
    state.mode = ['single', 'parallel', 'pipeline'].includes(localStorage.getItem(STORAGE.mode)) ? localStorage.getItem(STORAGE.mode) : 'single';
    state.compare = readJson(STORAGE.compare, []);
    state.pipeline = readJson(STORAGE.pipeline, []);
    repairSelections();
    save();
  }
  function enabledAgents() { return state.agents.filter(agent => agent.enabled); }
  function repairSelections() {
    const enabled = new Set(enabledAgents().map(agent => agent.id));
    if (!enabled.has(state.active)) state.active = enabledAgents()[0]?.id || '';
    state.compare = state.compare.filter(agentId => enabled.has(agentId)).slice(0, 4);
    state.pipeline = state.pipeline.filter(agentId => enabled.has(agentId)).slice(0, 4);
    if (!state.compare.length && state.active) state.compare = [state.active];
    if (!state.pipeline.length && state.active) state.pipeline = [state.active];
  }
  function agentById(agentId) { return state.agents.find(agent => agent.id === agentId); }

  function validate(agent) {
    if (!agent) throw new Error('No agent configured.');
    if (!agent.model) throw new Error(`${agent.name}: model is required.`);
    if (agent.apiShape !== 'mock' && !agent.apiKey) throw new Error(`${agent.name}: API key is required.`);
    if (agent.apiShape !== 'mock' && !(agent.baseUrl.startsWith('https://') || agent.baseUrl.startsWith('http://localhost:') || agent.baseUrl.startsWith('http://127.0.0.1:'))) {
      throw new Error(`${agent.name}: base URL must use HTTPS or localhost.`);
    }
  }
  function request(agent, userText, signal, maxTokens) {
    validate(agent);
    if (agent.apiShape === 'mock') {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(`This is a mock response from ${agent.name} (${agent.provider}/${agent.model}).\nEcho of your prompt: ${userText}`), 400);
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Request aborted', 'AbortError')); }, { once: true });
      });
    }
    let url;
    let options;
    switch (agent.apiShape) {
      case 'openai':
        url = agent.baseUrl.replace(/\/$/, '') + '/chat/completions';
        options = { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + agent.apiKey }, body: JSON.stringify({ model: agent.model, messages: [{ role: 'system', content: agent.systemPrompt }, { role: 'user', content: userText }], temperature: agent.temperature, max_tokens: maxTokens || agent.maxTokens }), signal };
        break;
      case 'gemini':
        url = agent.baseUrl.replace(/\/$/, '') + '/models/' + encodeURIComponent(agent.model) + ':generateContent?key=' + encodeURIComponent(agent.apiKey);
        options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: agent.systemPrompt + '\n\n' + userText }] }], generationConfig: { temperature: agent.temperature, maxOutputTokens: maxTokens || agent.maxTokens } }), signal };
        break;
      default:
        return Promise.reject(new Error('Unsupported API shape.'));
    }
    return fetch(url, options).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || 'HTTP ' + response.status);
      let output;
      if (agent.apiShape === 'openai') output = data.choices?.[0]?.message?.content;
      else output = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!output) throw new Error(data.error?.message || 'Provider returned no message content.');
      return output;
    });
  }

  function renderMessage(role, value, meta) {
    const container = get('aiMessages');
    if (!container) return null;
    const div = document.createElement('div');
    div.className = 'ai-msg ai-' + role;
    if (meta?.agent) {
      const chip = document.createElement('span');
      chip.className = 'ai-agent-chip';
      chip.textContent = meta.agent.name + ' · ' + providerLabel(meta.agent.provider);
      div.appendChild(chip);
    }
    if (meta?.error) div.classList.add('ai-error-card');
    const parts = text(value).split(/(```[\s\S]*?```)/g);
    parts.forEach(part => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '');
        const block = document.createElement('div');
        block.className = 'ai-code-block';
        const pre = document.createElement('pre');
        pre.textContent = code;
        const button = document.createElement('button');
        button.className = 'btn primary';
        button.textContent = '⚡ Apply to Editor';
        button.onclick = () => {
          const file = context?.getActiveFile();
          const model = file && context.models[file];
          if (!model) return;
          model.pushEditOperations([], [{ range: model.getFullModelRange(), text: code }], () => null);
          toast('Applied to ' + file.split('/').pop() + '!');
        };
        block.append(pre, button);
        div.appendChild(block);
      } else if (part) {
        const paragraph = document.createElement('div');
        paragraph.innerHTML = esc(part).replace(/\n/g, '<br>');
        div.appendChild(paragraph);
      }
    });
    if (meta?.retry) {
      const retry = document.createElement('button');
      retry.className = 'btn';
      retry.textContent = 'Retry';
      retry.onclick = meta.retry;
      div.appendChild(retry);
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }
  function clearMessages() {
    messages = [];
    const container = get('aiMessages');
    if (container) container.innerHTML = '';
  }
  function fileContext() {
    const file = context?.getActiveFile?.();
    const content = file && context.models[file] ? context.models[file].getValue() : '';
    return file ? `\nThe user is currently working on "${file}".\nCurrent code:\n\`\`\`\n${content}\n\`\`\`` : '';
  }
  function beginRequest() { const controller = new AbortController(); controllers.add(controller); return controller; }
  function endRequest(controller) { controllers.delete(controller); }
  function stopRequests() { controllers.forEach(controller => controller.abort()); controllers.clear(); if (window.__aiStopButton) window.__aiStopButton.style.display = 'none'; }
  function selectedIds() {
    const ids = state.mode === 'single' ? [state.active] : state.mode === 'parallel' ? state.compare : state.pipeline;
    return ids.map(agentById).filter(Boolean);
  }
  async function send() {
    const input = get('aiInput');
    const prompt = input?.value.trim();
    if (!prompt) return;
    input.value = '';
    input.style.height = '36px';
    const agents = selectedIds();
    if (!agents.length) { renderMessage('system', 'No enabled agent is configured. Open AI Settings to add one.'); return; }
    if (window.__aiStopButton) window.__aiStopButton.style.display = 'inline-flex';
    renderMessage('user', prompt);
    const groupId = id();
    const basePrompt = prompt + fileContext();
    if (state.mode === 'parallel') {
      const jobs = agents.map(agent => {
        const controller = beginRequest();
        return request(agent, basePrompt, controller.signal).then(result => ({ agent, result })).catch(error => ({ agent, error })).finally(() => endRequest(controller));
      });
      jobs.forEach(job => job.then(item => {
        if (item.error) renderMessage('assistant', providerLabel(item.agent.provider) + ': ' + item.error.message, { agent: item.agent, error: true, retry: send });
        else renderMessage('assistant', item.result, { agent: item.agent, groupId });
      }).finally(() => { if (!controllers.size && window.__aiStopButton) window.__aiStopButton.style.display = 'none'; }));
      return;
    }
    let previous = '';
    for (let index = 0; index < agents.length; index += 1) {
      const agent = agents[index];
      const promptForAgent = index === 0 ? basePrompt : `Previous agent (${agents[index - 1].name} via ${providerLabel(agents[index - 1].provider)}) produced:\n\n${previous}\n\nNow improve/fix/complete this:\n${prompt}`;
      const controller = beginRequest();
      try {
        previous = await request(agent, promptForAgent, controller.signal);
        renderMessage('assistant', previous, { agent, groupId });
        if (state.mode === 'pipeline' && agents[index + 1]) {
          const divider = document.createElement('div');
          divider.className = 'ai-pipeline-divider';
          divider.textContent = '↓ passed to ' + agents[index + 1].name;
          get('aiMessages').appendChild(divider);
        }
      } catch (error) {
        renderMessage('assistant', providerLabel(agent.provider) + ': ' + error.message, { agent, error: true, retry: send });
        break;
      } finally { endRequest(controller); if (!controllers.size && window.__aiStopButton) window.__aiStopButton.style.display = 'none'; }
    }
  }

  function renderToolbar() {
    const panel = get('aiPanel');
    const messagesEl = get('aiMessages');
    if (!panel || !messagesEl || panel.querySelector('.ai-toolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'ai-toolbar';
    const picker = document.createElement('div');
    picker.className = 'ai-agent-picker';
    const pickerButton = document.createElement('button');
    pickerButton.className = 'btn';
    const menu = document.createElement('div');
    menu.className = 'ai-agent-menu';
    picker.append(pickerButton, menu);
    const mode = document.createElement('select');
    mode.className = 'git-input ai-mode-select';
    ['single', 'parallel', 'pipeline'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; mode.appendChild(option); });
    const manage = document.createElement('button');
    manage.className = 'btn'; manage.textContent = 'Manage Agents ⚙';
    const clear = document.createElement('button');
    clear.className = 'btn'; clear.textContent = 'Clear';
    const stop = document.createElement('button');
    stop.className = 'btn'; stop.textContent = 'Stop'; stop.style.display = 'none';
    toolbar.append(picker, mode, manage, clear, stop);
    panel.insertBefore(toolbar, messagesEl);
    mode.value = state.mode;
    function refresh() {
      menu.innerHTML = '';
      const chosen = state.mode === 'single' ? [state.active] : state.mode === 'parallel' ? state.compare : state.pipeline;
      pickerButton.textContent = chosen.map(agentId => agentById(agentId)?.name).filter(Boolean).join(', ') || 'Select agents';
      enabledAgents().forEach(agent => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.checked = chosen.includes(agent.id);
        label.append(checkbox, document.createTextNode(' ' + agent.name + ' · ' + providerLabel(agent.provider) + ' · ' + agent.model));
        checkbox.onchange = () => {
          let selected = chosen.filter(agentId => agentId !== agent.id);
          if (checkbox.checked) selected.push(agent.id);
          if (state.mode === 'single') selected = [agent.id];
          else if (selected.length > 4) { checkbox.checked = false; toast('Maximum 4 agents in parallel mode'); return; }
          if (state.mode === 'single') state.active = selected[0] || '';
          else if (state.mode === 'parallel') state.compare = selected;
          else state.pipeline = selected;
          save(); refresh();
        };
        menu.appendChild(label);
      });
    }
    pickerButton.onclick = () => { menu.classList.toggle('open'); };
    mode.onchange = () => { stopRequests(); state.mode = mode.value; repairSelections(); save(); refresh(); };
    manage.onclick = () => openModal();
    clear.onclick = clearMessages;
    stop.onclick = stopRequests;
    window.__aiStopButton = stop;
    refresh();
    const sendButton = get('btnSendAI');
    sendButton?.addEventListener('click', send);
    get('aiInput')?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } });
  }

  function openModal(tab) {
    const modal = get('aiSettingsModal');
    if (!modal) return;
    modal.style.display = 'flex';
    if (!modalBody) {
      const content = modal.querySelector('.modal-content');
      content.innerHTML = '<h3>AI Assistant Settings</h3><div class="ai-settings-tabs"><button class="btn active" data-tab="agents">Agents</button><button class="btn" data-tab="help">How it works</button></div><div class="ai-settings-body"></div><div class="modal-buttons"><button class="btn primary" id="btnSaveAISettings" style="display:none;">Save Settings</button><button class="btn" id="btnCloseAISettings">Close</button></div><select id="aiProvider" style="display:none;"></select><input id="aiApiKey" style="display:none;"><select id="aiModel" style="display:none;"></select>';
      modalBody = content.querySelector('.ai-settings-body');
      content.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => renderModal(button.dataset.tab));
      get('btnCloseAISettings').onclick = () => { modal.style.display = 'none'; };
    }
    renderModal(tab || 'agents');
  }
  function renderModal(tab) {
    if (!modalBody) return;
    modalBody.innerHTML = '';
    if (tab === 'help') {
      modalBody.innerHTML = '<p>Agents can use any supported provider independently. Single mode asks one agent, parallel mode asks up to four agents at once, and pipeline mode passes each result to the next agent.</p>';
      return;
    }
    const list = document.createElement('div');
    state.agents.forEach(agent => {
      const row = document.createElement('div'); row.className = 'ai-agent-row';
      row.innerHTML = `<label><input type="checkbox" ${agent.enabled ? 'checked' : ''}> ${esc(agent.name)}</label><span>${providerLabel(agent.provider)} · ${esc(agent.model)}</span>`;
      const actions = document.createElement('span');
      ['Edit', 'Duplicate', 'Delete'].forEach(action => { const button = document.createElement('button'); button.className = 'btn'; button.textContent = action; button.onclick = () => { if (action === 'Edit') showForm(agent); if (action === 'Duplicate') { showForm({ ...agent, id: id(), name: agent.name + ' Copy' }); } if (action === 'Delete') { state.agents = state.agents.filter(item => item.id !== agent.id); repairSelections(); save(); renderModal('agents'); } }; actions.appendChild(button); });
      row.querySelector('input').onchange = event => { agent.enabled = event.target.checked; repairSelections(); save(); };
      row.appendChild(actions); list.appendChild(row);
    });
    const add = document.createElement('button'); add.className = 'btn primary'; add.textContent = 'Add Agent'; add.onclick = () => showForm();
    modalBody.append(list, add);
  }
  function showForm(existing) {
    formState = existing ? normalizeAgent(existing) : normalizeAgent({ id: id(), name: 'New Agent', provider: 'openai', model: 'gpt-4o-mini' });
    modalBody.innerHTML = '';
    const form = document.createElement('form'); form.className = 'ai-agent-form';
    const fields = [
      ['provider', 'Provider preset', 'select'], ['name', 'Name'], ['baseUrl', 'Base URL'], ['apiKey', 'API key', 'password'],
      ['model', 'Model'], ['systemPrompt', 'System prompt', 'textarea'], ['temperature', 'Temperature', 'range'], ['maxTokens', 'Max tokens', 'number']
    ];
    const inputs = {};
    fields.forEach(([key, label, type]) => {
      const wrapper = document.createElement('label'); wrapper.textContent = label;
      const input = type === 'textarea' ? document.createElement('textarea') : type === 'select' ? document.createElement('select') : document.createElement('input');
      input.type = type === 'select' || type === 'textarea' ? '' : type || 'text';
      if (key === 'provider') Object.keys(PRESETS).filter(value => value !== 'mock').forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = LABELS[value]; input.appendChild(option); });
      input.value = formState[key];
      if (key === 'temperature') { input.min = 0; input.max = 2; input.step = 0.1; }
      if (key === 'maxTokens') input.min = 1;
      wrapper.appendChild(input); form.appendChild(wrapper); inputs[key] = input;
    });
    const updatePreset = () => { const preset = PRESETS[inputs.provider.value]; inputs.baseUrl.value = preset[0]; if (preset[1][0]) inputs.model.value = preset[1][0]; };
    inputs.provider.onchange = updatePreset;
    const buttons = document.createElement('div');
    const test = document.createElement('button'); test.type = 'button'; test.className = 'btn'; test.textContent = 'Test connection';
    const saveButton = document.createElement('button'); saveButton.type = 'submit'; saveButton.className = 'btn primary'; saveButton.textContent = 'Save';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = 'Cancel';
    buttons.append(test, saveButton, cancel); form.appendChild(buttons); modalBody.appendChild(form);
    test.onclick = async () => { try { const candidate = normalizeAgent(Object.fromEntries(Object.keys(inputs).map(key => [key, inputs[key].value]))); candidate.apiKey = inputs.apiKey.value; const controller = beginRequest(); await request(candidate, 'Respond with one token.', controller.signal, 1); endRequest(controller); toast('Connected'); } catch (error) { toast(error.message); } };
    cancel.onclick = () => renderModal('agents');
    form.onsubmit = event => { event.preventDefault(); const candidate = normalizeAgent({ ...formState, ...Object.fromEntries(Object.keys(inputs).map(key => [key, inputs[key].value])) }); if (candidate.provider === 'custom' && !candidate.baseUrl) { toast('Custom agents need a base URL.'); return; } state.agents = state.agents.filter(agent => agent.id !== candidate.id); state.agents.push(candidate); repairSelections(); save(); renderModal('agents'); };
  }
  function attach(options) {
    if (attached) return;
    attached = true; context = options; load(); renderToolbar();
    get('btnAISettings')?.addEventListener('click', () => openModal('agents'));
  }

  window.AIAgents = { attach, renderMessage: (role, value) => renderMessage(role, value), send, stop: stopRequests };
  if (window.__aiAttachOptions) attach(window.__aiAttachOptions);
}());
