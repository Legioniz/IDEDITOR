/* =========================================================
   DEFAULT FILES
   ========================================================= */
const DEFAULT_HTML = `<h1>Hello 👋</h1>
<button id="btn">Click me</button>
<p id="out"></p>`;

const DEFAULT_CSS = `body {
  font-family: system-ui, sans-serif;
  padding: 16px;
  color: #222;
}
h1 { color: #0a84ff; }
button {
  padding: 10px 16px;
  font-size: 16px;
  border: 0;
  border-radius: 8px;
  background: #0a84ff;
  color: #fff;
}
#out { font-size: 18px; font-weight: 600; }`;

const DEFAULT_JS = `let n = 0;
document.getElementById('btn').addEventListener('click', () => {
  n++;
  document.getElementById('out').textContent =
    'Clicked ' + n + ' time' + (n === 1 ? '' : 's');
  console.log('click', n);
});`;

let FILES = {
  'index.html': { lang: 'html',       content: DEFAULT_HTML },
  'style.css':  { lang: 'css',        content: DEFAULT_CSS  },
  'script.js':  { lang: 'javascript', content: DEFAULT_JS   }
};
let filesList = ['index.html', 'style.css', 'script.js'];

const STORAGE_KEY  = 'idEditor.files';
const THEME_KEY    = 'idEditor.theme';
const FONTSIZE_KEY = 'idEditor.fontSize';
const SIDEBAR_KEY  = 'idEditor.sidebarHidden';
const GIT_URL_KEY  = 'idEditor.gitRepo';
const GIT_TOKEN_KEY = 'idEditor.gitToken';
const MINIMAP_KEY = 'idEditor.minimap';

/* =========================================================
   FIREBASE SETUP
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyADeeUFn-vYEzeT5peaTUD2cT8z92f1Aos",
  authDomain: "our-story-ca956.firebaseapp.com",
  projectId: "our-story-ca956",
  storageBucket: "our-story-ca956.firebasestorage.app",
  messagingSenderId: "28026494674",
  appId: "1:28026494674:web:4e65f36f4217269336570b",
  measurementId: "G-9206ZG2YT2"
};

let fbAuth = null, fbDb = null, fbUser = null;
let firebaseEnabled = false;
let authModule = null; 

async function initFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    authModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    
    const { getAuth, onAuthStateChanged, getRedirectResult } = authModule;
    
    const app = initializeApp(firebaseConfig);
    fbAuth = getAuth(app);
    fbDb = getFirestore(app);
    
    const loggedOutUI = document.getElementById('firebaseLoggedOut');
    const loggedInUI = document.getElementById('firebaseLoggedIn');
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    
    getRedirectResult(fbAuth).then((result) => {
      if (result && result.user) {
        showToast('Logged in as ' + result.user.displayName);
      }
    }).catch((error) => {
      console.error('Redirect login error:', error);
      showToast('Login failed: ' + error.message);
    });
    
    onAuthStateChanged(fbAuth, (user) => {
      fbUser = user;
      
      if (user) {
        loggedOutUI.style.display = 'none';
        loggedInUI.style.display = 'block';
        
        const displayName = user.displayName || user.email.split('@')[0];
        nameEl.textContent = displayName;
        avatarEl.textContent = displayName.charAt(0);
        
        showToast('Logged in as ' + displayName);
        addTermLine('Firebase Connected: ' + displayName, 'success');
      } else {
        loggedInUI.style.display = 'none';
        loggedOutUI.style.display = 'block';
      }
    });
    
    firebaseEnabled = true;
  } catch (e) {
    console.warn('Firebase failed to load', e);
    addTermLine('Firebase failed to load', 'error');
  }
}

async function saveToCloud() {
  if (!firebaseEnabled || !fbUser) return showToast('Login to save to cloud');
  try {
    showToast('Saving to cloud...');
    addTermLine('Saving to cloud...', 'info');
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    
    const data = {};
    Object.keys(models).forEach(k => { data[k] = models[k].getValue(); });
    
    await setDoc(doc(fbDb, 'users', fbUser.uid, 'projects', 'main'), {
      files: data,
      updatedAt: new Date().toISOString()
    });
    showToast('Saved to cloud!');
    addTermLine('Saved to cloud!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Cloud save failed');
    addTermLine('Cloud save failed: ' + e.message, 'error');
  }
}

async function loadFromCloud() {
  if (!firebaseEnabled || !fbUser) return showToast('Login to load from cloud');
  try {
    showToast('Loading from cloud...');
    addTermLine('Loading from cloud...', 'info');
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    
    const docSnap = await getDoc(doc(fbDb, 'users', fbUser.uid, 'projects', 'main'));
    if (!docSnap.exists()) {
      showToast('No cloud project found');
      addTermLine('No cloud project found', 'error');
      return;
    }
    
    const cloudFiles = docSnap.data().files;
    
    filesList.length = 0;
    Object.keys(FILES).forEach(k => delete FILES[k]);
    Object.keys(models).forEach(k => { if(models[k]) models[k].dispose(); delete models[k]; });
    Object.keys(savedSnapshot).forEach(k => delete savedSnapshot[k]);
    
    Object.keys(cloudFiles).forEach(name => {
      FILES[name] = { lang: langFromFilename(name), content: cloudFiles[name] };
      filesList.push(name);
      ensureModel(name);
    });
    
    if (!filesList.length) filesList = ['index.html'];
    activeFile = filesList[0];
    
    renderTabs(); renderSidebarFiles(); switchFile(activeFile); saveNow();
    showToast('Loaded from cloud!');
    addTermLine('Loaded from cloud!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Cloud load failed');
    addTermLine('Cloud load failed: ' + e.message, 'error');
  }
}

/* =========================================================
   HELPERS
   ========================================================= */
const isMobile = () => window.matchMedia('(max-width:899px)').matches;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function basename(path) {
  return path.split('/').pop();
}

function langFromFilename(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return {
    html: 'html', htm: 'html', css: 'css',
    js: 'javascript', mjs: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript', json: 'json',
    md: 'markdown', markdown: 'markdown', xml: 'xml', svg: 'xml', txt: 'plaintext'
  }[ext] || 'plaintext';
}

function parserForFile(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return {
    html: 'html', htm: 'html', css: 'css',
    js: 'babel', mjs: 'babel', jsx: 'babel',
    ts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown'
  }[ext] || null;
}

/* =========================================================
   INITIAL LOAD
   ========================================================= */
let loadedFromUrl = false;

function tryLoadFromHash() {
  if (typeof LZString === 'undefined') return false;
  if (!location.hash.startsWith('#s=')) return false;
  try {
    const raw = LZString.decompressFromEncodedURIComponent(location.hash.slice(3));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const names = Object.keys(parsed).filter(k => typeof parsed[k] === 'string');
    if (names.length === 0) return false;
    FILES = {};
    filesList = names.slice();
    names.forEach(name => { FILES[name] = { lang: langFromFilename(name), content: parsed[name] }; });
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  } catch (e) { console.warn('Invalid share link:', e); }
  return false;
}

function tryLoadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const names = Object.keys(parsed).filter(k => typeof parsed[k] === 'string');
    if (names.length === 0) return false;
    FILES = {};
    filesList = names.slice();
    names.forEach(name => { FILES[name] = { lang: langFromFilename(name), content: parsed[name] }; });
    return true;
  } catch (e) { return false; }
}

loadedFromUrl = tryLoadFromHash();
if (!loadedFromUrl) tryLoadFromStorage();

document.documentElement.setAttribute('data-theme', localStorage.getItem(THEME_KEY) || 'dark');

/* =========================================================
   GIT SETUP
   ========================================================= */
let git = null, http = null, LightningFS = null;
let gitFs = null, pfs = null;
let gitEnabled = false;
const GIT_DIR = '/repo';
const CORS_PROXY = '/api/proxy?url=';

async function loadGitLibraries() {
  try {
    const [gitModule, httpModule, fsModule] = await Promise.all([
      import('https://esm.sh/isomorphic-git@1.25.2'),
      import('https://esm.sh/isomorphic-git@1.25.2/http/web'),
      import('https://esm.sh/@isomorphic-git/lightning-fs@4.6.0')
    ]);
    git = gitModule.default; http = httpModule.default; LightningFS = fsModule.default;
    gitFs = new LightningFS('idEditorFS'); pfs = gitFs.promises;
    gitEnabled = true;
  } catch (e) { 
    console.warn('Git failed to load', e); 
    gitEnabled = false; 
  }
}

function getRepoConfig() {
  return { url: localStorage.getItem(GIT_URL_KEY) || '', token: localStorage.getItem(GIT_TOKEN_KEY) || '' };
}

/* =========================================================
   PREVIEW BUILDER
   ========================================================= */
function buildDoc(html, css, js) {
  const openScript = '<scr' + 'ipt>';
  const closeScript = '</scr' + 'ipt>';
  const consoleHook = `
    ${openScript}
      (function(){
        function ser(v){
          if (typeof v === 'string') return v;
          if (v instanceof Error) return v.message;
          try { return JSON.stringify(v); } catch(e){ return String(v); }
        }
        function send(type, args){
          try { parent.postMessage({ __preview: true, type: type, msg: Array.prototype.map.call(args, ser).join(' ') }, '*'); } catch(e){}
        }
        ['log','info','warn','error'].forEach(function(t){
          var orig = console[t] ? console[t].bind(console) : function(){};
          console[t] = function(){ orig.apply(null, arguments); send(t, arguments); };
        });
        window.addEventListener('error', function(e){ send('error', [e.message + ' @ line ' + e.lineno]); });
        window.addEventListener('unhandledrejection', function(e){ send('error', ['Unhandled rejection: ' + ser(e.reason)]); });
      })();
    ${closeScript}
  `;
  const headInject = consoleHook + '<style>\n' + (css || '') + '\n</style>';
  const bodyInject = openScript + '\ntry{\n' + (js || '') + '\n}catch(e){ console.error(e && e.message ? e.message : e); }\n' + closeScript;
  const h = html || '';

  if (/<html[\s>]/i.test(h)) {
    let out = h;
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, headInject + '</head>');
    else out = out.replace(/<html[^>]*>/i, m => m + '<head>' + headInject + '</head>');
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, bodyInject + '</body>');
    else out += bodyInject;
    return out;
  }
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + headInject + '</head><body>' + h + bodyInject + '</body></html>';
}

/* =========================================================
   EDITOR SETUP
   ========================================================= */
let editor = null, models = {}, savedSnapshot = {};
let activeFile = 'index.html', uriSeq = 0;
let minimapEnabled = localStorage.getItem(MINIMAP_KEY) === 'true';

function getInitialFontSize() {
  const stored = localStorage.getItem(FONTSIZE_KEY);
  if (stored) { const n = parseInt(stored, 10); if (!isNaN(n)) return n; }
  return isMobile() ? 14 : 13;
}
let fontSize = getInitialFontSize();

if (typeof require === 'undefined') {
  document.getElementById('editor').innerHTML = '<div style="padding:20px;color:#ff7b72;font-family:sans-serif">Failed to load Monaco Editor.<br>Check your internet connection and reload.</div>';
} else {
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
  require(['vs/editor/editor.main'], initEditor);
}

function makeUri(name) { return monaco.Uri.parse('inmemory:///' + encodeURIComponent(name) + '/' + (++uriSeq)); }

function ensureModel(name) {
  if (models[name]) return models[name];
  const meta = FILES[name];
  const model = monaco.editor.createModel(meta ? meta.content : '', meta ? meta.lang : langFromFilename(name), makeUri(name));
  models[name] = model;
  savedSnapshot[name] = model.getValue();
  model.onDidChangeContent(() => { markDirtyState(name); scheduleSave(); });
  if (window.__hookAutoRun) window.__hookAutoRun(model);
  return model;
}

function initEditor() {
  if (!filesList.length) filesList = ['index.html', 'style.css', 'script.js'];
  if (!filesList.includes(activeFile)) activeFile = filesList[0];

  filesList.forEach(ensureModel);

  editor = monaco.editor.create(document.getElementById('editor'), {
    model: models[activeFile],
    theme: 'vs-dark',
    fontSize: fontSize,
    minimap: { enabled: minimapEnabled },
    lineNumbersMinChars: 2,
    automaticLayout: true,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    padding: { top: 8 },
    tabSize: 2,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true },
    lineHeight: Math.round(fontSize * 1.5),
    lineDecorationsWidth: 8
  });

  editor.onDidChangeCursorPosition(e => {
    document.getElementById('statusCursor').textContent = 'Ln ' + e.position.lineNumber + ', Col ' + e.position.column;
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => { if (editor) editor.layout(); });
  }

  renderTabs();
  renderSidebarFiles();

  wireFindBar(); wireRun(); wireConsole(); wireClipboard(); wireSettings(); wirePreviewControls(); wireSidebar(); wireMobileActions(); wireTier1Features(); setupSaveFlush();

  Object.values(models).forEach(m => window.__hookAutoRun && window.__hookAutoRun(m));

  editor.addAction({ id: 'custom-open-find', label: 'Open Find Bar', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF], run: () => openFindBar() });
  editor.addAction({ id: 'custom-run-kb', label: 'Run preview', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => run() });
  editor.addAction({ id: 'custom-comment', label: 'Toggle line comment', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash], run: () => editor.trigger('', 'editor.action.commentLine') });
  editor.addAction({ id: 'custom-goto', label: 'Go to line…', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG], run: () => {
    const n = parseInt(prompt('Go to line:'), 10);
    if (isNaN(n) || n < 1) return;
    const line = Math.min(n, editor.getModel().getLineCount());
    editor.revealLineInCenter(line); editor.setPosition({ lineNumber: line, column: 1 }); editor.focus();
  }});
  editor.addAction({ id: 'custom-cmd-palette', label: 'Command Palette', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP], run: () => editor.trigger('', 'editor.action.quickCommand') });

  if (loadedFromUrl) saveNow();
  setTheme(localStorage.getItem(THEME_KEY) || 'dark');
  updateStatusFont();
  switchFile(activeFile);

  loadGitLibraries().then(() => { wireGit(); });
  initFirebase();

  showToast('Loaded');
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveNow(); showToast('Saved'); }
});

/* =========================================================
   TIER 1 FEATURES
   ========================================================= */
function wireTier1Features() {
  document.getElementById('btnCmdPalette').addEventListener('click', (e) => {
    e.preventDefault();
    if (!editor) return;
    editor.focus();
    setTimeout(() => { editor.trigger('', 'editor.action.quickCommand'); }, 50);
  });
  
  const btnMinimap = document.getElementById('btnMinimap');
  btnMinimap.classList.toggle('on', minimapEnabled);
  btnMinimap.addEventListener('click', () => {
    minimapEnabled = !minimapEnabled;
    editor.updateOptions({ minimap: { enabled: minimapEnabled } });
    btnMinimap.classList.toggle('on', minimapEnabled);
    localStorage.setItem(MINIMAP_KEY, minimapEnabled);
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    let firstImported = null;
    for (const file of files) {
      const name = file.name;
      if (FILES[name] && !confirm(`File "${name}" already exists. Overwrite?`)) continue;
      if (models[name]) { models[name].dispose(); delete models[name]; }
      const content = await file.text();
      FILES[name] = { lang: langFromFilename(name), content };
      if (!filesList.includes(name)) filesList.push(name);
      ensureModel(name);
      if (!firstImported) firstImported = name;
    }
    renderTabs(); renderSidebarFiles();
    if (firstImported) switchFile(firstImported);
    saveNow(); showToast('Imported files'); e.target.value = '';
  });

  const resizer = document.getElementById('resizer');
  const editorPane = document.getElementById('editorPane');
  const outputPane = document.getElementById('outputPane');
  let isResizing = false, startX = 0, startY = 0, startWidth = 0, startHeight = 0;

  resizer.addEventListener('pointerdown', (e) => {
    isResizing = true;
    startX = e.clientX; startY = e.clientY;
    startWidth = editorPane.getBoundingClientRect().width;
    startHeight = editorPane.getBoundingClientRect().height;
    resizer.classList.add('active');
    document.body.style.cursor = isMobile() ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const panesContainer = document.getElementById('panes');
    if (isMobile()) {
      const dy = e.clientY - startY;
      const totalHeight = panesContainer.getBoundingClientRect().height;
      const newHeight = startHeight + dy;
      if (newHeight > totalHeight * 0.2 && newHeight < totalHeight * 0.8) {
        const percent = (newHeight / totalHeight) * 100;
        editorPane.style.flex = `1 1 ${percent}%`;
        outputPane.style.flex = `1 1 ${100 - percent}%`;
        if (editor) editor.layout();
      }
    } else {
      const dx = e.clientX - startX;
      const totalWidth = panesContainer.getBoundingClientRect().width;
      const newWidth = startWidth + dx;
      if (newWidth > totalWidth * 0.2 && newWidth < totalWidth * 0.8) {
        const percent = (newWidth / totalWidth) * 100;
        editorPane.style.flex = `1 1 ${percent}%`;
        outputPane.style.flex = `1 1 ${100 - percent}%`;
        if (editor) editor.layout();
      }
    }
  });

  document.addEventListener('pointerup', () => {
    if (!isResizing) return;
    isResizing = false; resizer.classList.remove('active');
    document.body.style.cursor = ''; document.body.style.userSelect = '';
  });

  window.addEventListener('resize', () => {
    if (isMobile()) {
      editorPane.style.flex = '1 1 auto';
      outputPane.style.flex = '0 0 50%';
    } else {
      editorPane.style.flex = '1 1 50%';
      outputPane.style.flex = '1 1 50%';
    }
    if (editor) editor.layout();
  });
}

/* =========================================================
   STATUS, SAVE, RENDER, CLIPBOARD, ETC.
   ========================================================= */
function updateStatusFont() { const el = document.getElementById('statusFont'); if (el) el.textContent = fontSize + 'px'; }
function updateStatusFile() { const el = document.getElementById('statusFile'); if (el) el.textContent = basename(activeFile); }

function findTabEl(name) { return Array.from(document.querySelectorAll('.tab')).find(t => t.dataset.file === name) || null; }
function findSideItemEl(name) { return Array.from(document.querySelectorAll('.side-item[data-file]')).find(t => t.dataset.file === name) || null; }

function markDirtyState(file) {
  const dirty = (savedSnapshot[file] || '') !== (models[file] ? models[file].getValue() : '');
  const tab = findTabEl(file); if (tab) tab.classList.toggle('dirty', dirty);
  const item = findSideItemEl(file); if (item) item.classList.toggle('dirty', dirty);
}

let saveTimer = null, hasPendingSave = false;
function saveNow() {
  try {
    const data = {};
    Object.keys(models).forEach(k => { data[k] = models[k].getValue(); savedSnapshot[k] = data[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
  hasPendingSave = false; Object.keys(models).forEach(markDirtyState);
}
function scheduleSave() { hasPendingSave = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); }
function setupSaveFlush() {
  document.addEventListener('visibilitychange', () => { if (document.hidden && hasPendingSave) saveNow(); });
  window.addEventListener('beforeunload', () => { if (hasPendingSave) saveNow(); });
}

function renderTabs() {
  const nav = document.getElementById('tabs'); nav.innerHTML = '';
  filesList.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (name === activeFile ? ' active' : ''); 
    btn.dataset.file = name; 
    btn.textContent = basename(name); 
    btn.title = name;
    attachFileMenuHandlers(btn, name); 
    nav.appendChild(btn);
  });
  
  const prevBtn = document.createElement('button');
  prevBtn.className = 'tab tab-preview' + (activeFile === 'preview' ? ' active' : '');
  prevBtn.dataset.file = 'preview';
  prevBtn.innerHTML = '▶ Preview';
  prevBtn.addEventListener('click', () => switchFile('preview'));
  nav.appendChild(prevBtn);

  const addBtn = document.createElement('button'); addBtn.className = 'tab-add'; addBtn.title = 'New file'; addBtn.textContent = '+';
  addBtn.addEventListener('click', promptNewFile); nav.appendChild(addBtn);
  filesList.forEach(markDirtyState);
}

let foldersInitialized = false; 
const expandedFolders = new Set();
function renderSidebarFiles() {
  if (!foldersInitialized && filesList.length > 0) {
    filesList.forEach(f => {
      const parts = f.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        expandedFolders.add(currentPath);
      }
    });
    foldersInitialized = true;
  }

  const list = document.getElementById('sideFiles'); list.innerHTML = '';
  const tree = {};
  filesList.forEach(path => {
    const parts = path.split('/');
    let current = tree;
    parts.forEach((part, i) => {
      if (!current[part]) current[part] = (i === parts.length - 1) ? 'FILE' : {};
      current = current[part];
    });
  });

  function buildNode(node, path, container) {
    const keys = Object.keys(node).sort((a, b) => {
      const aIsFile = node[a] === 'FILE';
      const bIsFile = node[b] === 'FILE';
      if (aIsFile && !bIsFile) return 1;
      if (!aIsFile && bIsFile) return -1;
      return a.localeCompare(b);
    });

    keys.forEach(key => {
      const fullPath = path ? `${path}/${key}` : key;
      if (node[key] === 'FILE') {
        const btn = document.createElement('button');
        btn.className = 'side-item' + (fullPath === activeFile ? ' active' : ''); 
        btn.dataset.file = fullPath;
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M14 3v5h5" stroke="currentColor" stroke-width="1.8" fill="none"/></svg><span>' + escapeHtml(key) + '</span>';
        attachFileMenuHandlers(btn, fullPath, () => { switchFile(fullPath); if (isMobile()) closeSidebar(); });
        container.appendChild(btn);
      } else {
        const folderDiv = document.createElement('div');
        const isExpanded = expandedFolders.has(fullPath);
        
        const folderHeader = document.createElement('div');
        folderHeader.className = 'tree-folder' + (isExpanded ? '' : ' collapsed');
        folderHeader.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${escapeHtml(key)}</span>`;
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-folder-children' + (isExpanded ? '' : ' hidden');

        folderHeader.addEventListener('click', () => {
          const nowCollapsed = !childrenContainer.classList.contains('hidden');
          childrenContainer.classList.toggle('hidden', nowCollapsed);
          folderHeader.classList.toggle('collapsed', nowCollapsed);
          if (nowCollapsed) expandedFolders.delete(fullPath);
          else expandedFolders.add(fullPath);
        });

        folderDiv.appendChild(folderHeader);
        folderDiv.appendChild(childrenContainer);
        container.appendChild(folderDiv);
        
        buildNode(node[key], fullPath, childrenContainer);
      }
    });
  }

  buildNode(tree, '', list);
  filesList.forEach(markDirtyState);
}

let tabMenuEl = null, tabMenuFile = null;
function getTabMenu() {
  if (tabMenuEl) return tabMenuEl;
  tabMenuEl = document.createElement('div'); tabMenuEl.className = 'tab-menu';
  tabMenuEl.innerHTML = '<button class="menu-item" data-act="rename"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg><span>Rename</span></button><button class="menu-item" data-act="delete"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Delete</span></button>';
  document.body.appendChild(tabMenuEl);
  tabMenuEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const act = btn.dataset.act, name = tabMenuFile; closeTabMenu();
    if (act === 'rename') {
      const newName = prompt('Rename "' + name + '" to:', name);
      if (newName && newName.trim() && newName.trim() !== name) renameFile(name, newName.trim());
    } else if (act === 'delete') deleteFile(name);
  });
  document.addEventListener('click', e => { if (tabMenuEl && !tabMenuEl.contains(e.target)) closeTabMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTabMenu(); });
  return tabMenuEl;
}
function showTabMenu(x, y, filename) {
  const menu = getTabMenu(); tabMenuFile = filename;
  menu.style.left = x + 'px'; menu.style.top = y + 'px'; menu.style.display = 'block';
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > innerWidth) menu.style.left = Math.max(8, innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > innerHeight) menu.style.top = Math.max(8, innerHeight - rect.height - 8) + 'px';
  });
}
function closeTabMenu() { if (tabMenuEl) tabMenuEl.style.display = 'none'; tabMenuFile = null; }

function attachFileMenuHandlers(el, filename, onClickOverride) {
  el.addEventListener('contextmenu', e => { e.preventDefault(); showTabMenu(e.clientX, e.clientY, filename); });
  let pressTimer = null, suppressClick = false;
  el.addEventListener('touchstart', e => { const touch = e.touches[0]; pressTimer = setTimeout(() => { suppressClick = true; showTabMenu(touch.clientX, touch.clientY, filename); }, 500); }, { passive: true });
  el.addEventListener('touchend', () => { clearTimeout(pressTimer); if (suppressClick) setTimeout(() => { suppressClick = false; }, 400); });
  el.addEventListener('touchmove', () => clearTimeout(pressTimer));
  el.addEventListener('touchcancel', () => clearTimeout(pressTimer));
  el.addEventListener('click', e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; } if (onClickOverride) onClickOverride(); else switchFile(filename); });
}

function promptNewFile() {
  const raw = prompt('New file path (e.g. src/utils.js):'); if (!raw) return;
  let name = raw.trim().replace(/^\/+/, '').replace(/[\\:*?"<>|\x00-\x1F]/g, ''); 
  if (!name) return showToast('Invalid name');
  if (!/\.[a-z0-9]+$/i.test(name)) name += '.txt'; 
  if (FILES[name]) return showToast('File already exists');
  
  FILES[name] = { lang: langFromFilename(name), content: '' }; 
  filesList.push(name); 
  ensureModel(name);
  renderTabs(); renderSidebarFiles(); switchFile(name); saveNow(); showToast('Created ' + name);
}

function promptNewFolder() {
  const raw = prompt('New folder path (e.g. src/components):'); if (!raw) return;
  let folder = raw.trim().replace(/^\/+/, '').replace(/[\\:*?"<>|\x00-\x1F]/g, ''); 
  if (!folder) return showToast('Invalid name');
  
  const placeholder = `${folder}/.gitkeep`;
  if (FILES[placeholder]) return showToast('Folder already exists');
  
  FILES[placeholder] = { lang: 'plaintext', content: '' }; 
  filesList.push(placeholder); 
  ensureModel(placeholder);
  
  const parts = folder.split('/');
  let currentPath = '';
  parts.forEach(p => { currentPath = currentPath ? `${currentPath}/${p}` : p; expandedFolders.add(currentPath); });
  
  renderTabs(); renderSidebarFiles(); saveNow(); showToast('Created folder ' + folder);
}

function renameFile(oldName, newName) {
  newName = (newName || '').trim().replace(/^\/+/, '').replace(/[\\:*?"<>|\x00-\x1F]/g, ''); 
  if (!newName) return showToast('Invalid name');
  if (newName === oldName) return; 
  if (FILES[newName]) return showToast('File already exists');
  
  const oldModel = models[oldName], oldContent = oldModel ? oldModel.getValue() : '', newLang = langFromFilename(newName);
  if (oldModel) oldModel.dispose(); delete models[oldName];
  
  FILES[newName] = { lang: newLang, content: oldContent }; delete FILES[oldName];
  savedSnapshot[newName] = savedSnapshot[oldName] || oldContent; delete savedSnapshot[oldName];
  filesList = filesList.map(n => n === oldName ? newName : n); 
  if (activeFile === oldName) activeFile = newName;
  
  const newModel = monaco.editor.createModel(oldContent, newLang, makeUri(newName));
  models[newName] = newModel; newModel.onDidChangeContent(() => { markDirtyState(newName); scheduleSave(); });
  if (window.__hookAutoRun) window.__hookAutoRun(newModel);
  
  renderTabs(); renderSidebarFiles(); switchFile(activeFile); saveNow(); showToast('Renamed to ' + newName);
}

function deleteFile(name) {
  if (filesList.length <= 1) return showToast('Cannot delete the last file');
  if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
  
  if (models[name]) { models[name].dispose(); delete models[name]; }
  delete FILES[name]; delete savedSnapshot[name]; 
  filesList = filesList.filter(n => n !== name);
  
  if (activeFile === name) { 
    activeFile = filesList[0]; 
    editor.setModel(models[activeFile]); 
  }
  renderTabs(); renderSidebarFiles(); switchFile(activeFile); saveNow(); showToast('Deleted ' + name);
}

function openSidebar() { document.getElementById('sidebar').classList.remove('hidden'); document.getElementById('sidebarBackdrop').classList.add('show'); localStorage.setItem(SIDEBAR_KEY, '0'); }
function closeSidebar() { document.getElementById('sidebar').classList.add('hidden'); document.getElementById('sidebarBackdrop').classList.remove('show'); localStorage.setItem(SIDEBAR_KEY, '1'); }
function toggleSidebar() { const sidebar = document.getElementById('sidebar'); if (sidebar.classList.contains('hidden')) openSidebar(); else closeSidebar(); }

/* =========================================================
   SIDEBAR WIRING
   ========================================================= */
function wireSidebar() {
  const sidebar = document.getElementById('sidebar'), toggle = document.getElementById('btnSidebarToggle'), backdrop = document.getElementById('sidebarBackdrop');
  const stored = localStorage.getItem(SIDEBAR_KEY);
  
  if (stored === '1' || (!stored && isMobile())) sidebar.classList.add('hidden'); 
  else if (isMobile()) backdrop.classList.add('show');
  
  toggle.addEventListener('click', toggleSidebar); 
  backdrop.addEventListener('click', closeSidebar);
  
  document.getElementById('btnNewFile').addEventListener('click', promptNewFile);
  document.getElementById('btnNewFolder').addEventListener('click', promptNewFolder);
  
  document.getElementById('btnReset').addEventListener('click', () => {
    if (!confirm('Reset all files and settings to defaults?')) return;
    try { localStorage.clear(); } catch (e) {} location.reload();
  });
  
  document.getElementById('btnCloudSave').addEventListener('click', saveToCloud);
  document.getElementById('btnCloudLoad').addEventListener('click', loadFromCloud);

  document.getElementById('btnFirebaseLogin').addEventListener('click', () => {
    if (!firebaseEnabled || !authModule) return showToast('Firebase is still loading...');
    const provider = new authModule.GoogleAuthProvider();
    if (isMobile()) authModule.signInWithRedirect(fbAuth, provider);
    else authModule.signInWithPopup(fbAuth, provider);
  });
  document.getElementById('btnFirebaseLogout').addEventListener('click', () => {
    if (firebaseEnabled && authModule) authModule.signOut(fbAuth);
  });
}

/* =========================================================
   FILE SWITCH & PREVIEW TAB LOGIC
   ========================================================= */
function switchFile(file) {
  if (file !== 'preview' && !models[file]) return;
  
  activeFile = file;
  
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.file === file));
  document.querySelectorAll('.side-item[data-file]').forEach(b => b.classList.toggle('active', b.dataset.file === file));
  
  const panes = document.getElementById('panes');
  const outputPane = document.getElementById('outputPane');

  if (file === 'preview') {
    panes.classList.add('preview-tab-mode');
    outputPane.classList.add('show');
    document.getElementById('editor').style.display = 'none';
    document.getElementById('statusFile').textContent = 'Preview';
    run();
  } else {
    panes.classList.remove('preview-tab-mode');
    document.getElementById('editor').style.display = 'block';
    editor.setModel(models[file]);
    document.getElementById('statusFile').textContent = basename(file);
    clearDecorations(); 
    if (findbar.classList.contains('show')) refreshMatches(); 
  }
}

/* =========================================================
   CLIPBOARD, FORMAT, ETC.
   ========================================================= */
function getSelectedText() { const sel = editor.getSelection(); if (!sel || sel.isEmpty()) return ''; return editor.getModel().getValueInRange(sel); }
async function writeClipboardAsync(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
  try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok; } catch (e) { return false; }
}
async function readClipboardAsync() { try { if (navigator.clipboard && navigator.clipboard.readText) return await navigator.clipboard.readText(); } catch (e) {} return null; }
async function copySelection() { const text = getSelectedText(); if (!text) return showToast('Nothing selected'); showToast(await writeClipboardAsync(text) ? 'Copied' : 'Copy failed'); }
async function cutSelection() { const text = getSelectedText(); if (!text) return showToast('Nothing selected'); const sel = editor.getSelection(); if (!(await writeClipboardAsync(text))) return showToast('Cut failed'); editor.executeEdits('cut', [{ range: sel, text: '' }]); showToast('Cut'); }
async function pasteFromClipboard() { const text = await readClipboardAsync(); if (text === null) return showToast('Paste not allowed'); if (text === '') return showToast('Clipboard empty'); let sel = editor.getSelection() || new monaco.Range(1, 1, 1, 1); editor.executeEdits('paste', [{ range: sel, text, forceMoveMarkers: true }]); showToast('Pasted'); }

function showToast(msg, ms) {
  const t = document.createElement('div'); t.textContent = msg;
  const safe = isMobile() ? 'calc(88px + env(safe-area-inset-bottom))' : '24px';
  t.style.cssText = 'position:fixed;bottom:' + safe + ';left:50%;transform:translateX(-50%);background:#0a84ff;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:99999;pointer-events:none;opacity:0;transition:opacity .2s;font-family:-apple-system,sans-serif;max-width:80vw;text-align:center;';
  document.body.appendChild(t); requestAnimationFrame(() => { t.style.opacity = '1'; }); setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, ms || 1200);
}

function wireClipboard() {
  document.getElementById('btnUndo').addEventListener('click', () => { editor.trigger('', 'undo'); editor.focus(); });
  document.getElementById('btnRedo').addEventListener('click', () => { editor.trigger('', 'redo'); editor.focus(); });
  document.getElementById('btnCopy').addEventListener('click', copySelection);
  document.getElementById('btnCut').addEventListener('click', cutSelection);
  document.getElementById('btnPaste').addEventListener('click', pasteFromClipboard);
  document.getElementById('btnSelectAll').addEventListener('click', () => { editor.setSelection(editor.getModel().getFullModelRange()); });
  document.getElementById('btnShare').addEventListener('click', async () => {
    if (typeof LZString === 'undefined') return showToast('Share unavailable');
    const data = {}; Object.keys(models).forEach(k => { data[k] = models[k].getValue(); });
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    const url = location.origin + location.pathname + '#s=' + compressed;
    const ok = await writeClipboardAsync(url); showToast(ok ? 'Share link copied' : 'Copy failed', 1600);
  });
  document.getElementById('btnFormat').addEventListener('click', formatCurrent);
  document.getElementById('btnZip').addEventListener('click', downloadZip);
}

function wireMobileActions() {
  const bar = document.getElementById('mobileActions'); if (!bar) return;
  bar.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'undo') { editor.trigger('', 'undo'); editor.focus(); }
    else if (act === 'redo') { editor.trigger('', 'redo'); editor.focus(); }
    else if (act === 'copy') copySelection();
    else if (act === 'paste') pasteFromClipboard();
    else if (act === 'format') formatCurrent();
    else if (act === 'run') run();
  });
}

function loadScript(url) { return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = url; s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + url)); document.head.appendChild(s); }); }
let prettierReady = false;
async function ensurePrettier() {
  if (prettierReady) return;
  const base = 'https://cdn.jsdelivr.net/npm/prettier@3.3.3/';
  await loadScript(base + 'standalone.js');
  await Promise.all([loadScript(base + 'plugins/babel.js'), loadScript(base + 'plugins/estree.js'), loadScript(base + 'plugins/html.js'), loadScript(base + 'plugins/postcss.js'), loadScript(base + 'plugins/typescript.js'), loadScript(base + 'plugins/markdown.js')]);
  prettierReady = true;
}
async function formatCurrent() {
  if (!editor) return;
  const parser = parserForFile(activeFile); if (!parser) return showToast('No formatter for ' + activeFile);
  try {
    showToast('Formatting…'); await ensurePrettier();
    const P = window.prettierPlugins || {}; const plugins = [P.babel, P.estree, P.html, P.postcss, P.typescript, P.markdown].filter(Boolean);
    const model = models[activeFile]; const code = model.getValue();
    const formatted = await window.prettier.format(code, { parser, plugins, tabWidth: 2, printWidth: 80, singleQuote: true });
    if (formatted === code) return showToast('Already formatted');
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text: formatted }], () => null);
    showToast('Formatted');
  } catch (e) { console.error(e); showToast('Format failed'); }
}
async function downloadZip() {
  try {
    if (!window.JSZip) await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    const zip = new window.JSZip(); Object.keys(models).forEach(k => zip.file(k, models[k].getValue()));
    const blob = await zip.generateAsync({ type: 'blob' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'idEditor-project.zip';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 60000);
    showToast('Downloaded');
  } catch (e) { console.error(e); showToast('Zip failed'); }
}

function applyFontSize(n) { fontSize = Math.max(10, Math.min(24, n)); if (editor) editor.updateOptions({ fontSize }); localStorage.setItem(FONTSIZE_KEY, fontSize); updateStatusFont(); }
function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme); document.documentElement.setAttribute('data-theme', theme);
  if (editor) monaco.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark');
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = theme === 'light' ? '#f3f3f3' : '#252526';
}
function wireSettings() {
  document.getElementById('btnFontMinus').addEventListener('click', () => applyFontSize(fontSize - 1));
  document.getElementById('btnFontPlus').addEventListener('click', () => applyFontSize(fontSize + 1));
  document.getElementById('btnTheme').addEventListener('click', () => { const cur = localStorage.getItem(THEME_KEY) || 'dark'; setTheme(cur === 'light' ? 'dark' : 'light'); });
}

let matches = [], matchIndex = -1, decorations = [];
const findbar = document.getElementById('findbar'), findInput = document.getElementById('findInput'), replInput = document.getElementById('replaceInput'), countEl = document.getElementById('count'), caseBtn = document.getElementById('btnCase');
function normalizeNL(s) { return s.replace(/\r\n?/g, '\n'); }
function autosize(el, max) { max = max || 110; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, max) + 'px'; }
function openFindBar() { findbar.classList.add('show'); autosize(findInput); autosize(replInput); findInput.focus(); findInput.select(); refreshMatches(); }
function wireFindBar() {
  document.getElementById('btnFind').addEventListener('click', () => { if (findbar.classList.contains('show')) { findbar.classList.remove('show'); clearDecorations(); } else openFindBar(); });
  document.getElementById('btnCloseFind').addEventListener('click', () => { findbar.classList.remove('show'); clearDecorations(); });
  caseBtn.addEventListener('click', () => { caseBtn.classList.toggle('on'); refreshMatches(); });
  findInput.addEventListener('input', () => { autosize(findInput); refreshMatches(); });
  findInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') { findbar.classList.remove('show'); clearDecorations(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goTo(matchIndex + (e.shiftKey ? -1 : 1)); }
  });
  replInput.addEventListener('input', () => autosize(replInput));
  replInput.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); replaceCurrent(); } });
  document.getElementById('btnNext').addEventListener('click', () => goTo(matchIndex + 1));
  document.getElementById('btnPrev').addEventListener('click', () => goTo(matchIndex - 1));
  document.getElementById('btnReplace').addEventListener('click', replaceCurrent);
  document.getElementById('btnReplaceAll').addEventListener('click', replaceAll);
  autosize(findInput); autosize(replInput);
}
function isCaseSensitive() { return caseBtn.classList.contains('on'); }
function refreshMatches(keepIndex) {
  if (!editor) return; if (!findbar.classList.contains('show')) return clearDecorations();
  const model = editor.getModel(); const q = normalizeNL(findInput.value);
  matches = q ? model.findMatches(q, false, false, isCaseSensitive(), null, false).map(r => r.range) : [];
  if (!keepIndex) matchIndex = matches.length ? 0 : -1;
  if (matchIndex >= matches.length) matchIndex = matches.length - 1;
  if (matchIndex < 0 && matches.length) matchIndex = 0;
  updateCount(); paintDecorations();
}
function updateCount() { countEl.textContent = matches.length ? (matchIndex + 1) + '/' + matches.length : '0/0'; }
function clearDecorations() { if (editor) decorations = editor.deltaDecorations(decorations, []); matches = []; matchIndex = -1; updateCount(); }
function paintDecorations() { if (!editor) return; decorations = editor.deltaDecorations(decorations, matches.map((r, i) => ({ range: r, options: { inlineClassName: i === matchIndex ? 'match-current' : 'match-all' } }))); }
function goTo(i) { if (!matches.length) return; matchIndex = ((i % matches.length) + matches.length) % matches.length; editor.revealRangeInCenter(matches[matchIndex]); updateCount(); paintDecorations(); }
function replaceCurrent() {
  if (!matches.length || matchIndex < 0) return refreshMatches();
  editor.getModel().pushEditOperations([], [{ range: matches[matchIndex], text: normalizeNL(replInput.value) }], () => null);
  refreshMatches(true);
}
function replaceAll() {
  const q = normalizeNL(findInput.value); if (!q) return;
  const model = editor.getModel(); const found = model.findMatches(q, false, false, isCaseSensitive(), null, false);
  if (!found.length) return showToast('No matches');
  const repl = normalizeNL(replInput.value);
  const edits = found.map(r => ({ range: r.range, text: repl })).sort((a, b) => b.range.startLineNumber - a.range.startLineNumber || b.range.startColumn - a.range.startColumn);
  model.pushEditOperations([], edits, () => null); refreshMatches();
  showToast('Replaced ' + found.length + (found.length === 1 ? ' match' : ' matches'));
}

function wireRun() { document.getElementById('btnRun').addEventListener('click', run); }

/* =========================================================
   CONSOLE & TERMINAL (Global Panel)
   ========================================================= */
const consoleEl = document.getElementById('console');
const termEl = document.getElementById('terminal');
const termOutput = document.getElementById('termOutput');
const termInput = document.getElementById('termInput');
const bottomPanel = document.getElementById('bottomPanel');
let activePanel = 'console';

function setActivePanel(panel) {
  activePanel = panel;
  document.getElementById('btnTabConsole').classList.toggle('active', panel === 'console');
  document.getElementById('btnTabTerminal').classList.toggle('active', panel === 'terminal');
  
  if (panel === 'console') {
    consoleEl.style.display = 'block';
    consoleEl.classList.add('show');
    termEl.style.display = 'none';
  } else {
    consoleEl.style.display = 'none';
    termEl.style.display = 'flex';
    termInput.focus();
  }
}

function wireConsole() {
  document.getElementById('btnTogglePanel').addEventListener('click', () => {
    bottomPanel.classList.toggle('hidden');
    if (!bottomPanel.classList.contains('hidden')) {
      if (activePanel === 'terminal') termInput.focus();
      if (editor) editor.layout();
    } else {
      if (editor) editor.layout();
    }
  });

  document.getElementById('btnClosePanel').addEventListener('click', () => {
    bottomPanel.classList.add('hidden');
    if (editor) editor.layout();
  });

  document.getElementById('btnTabConsole').addEventListener('click', () => setActivePanel('console'));
  document.getElementById('btnTabTerminal').addEventListener('click', () => setActivePanel('terminal'));

  document.getElementById('btnCopyPanel').addEventListener('click', async () => {
    const text = activePanel === 'console' 
      ? Array.from(consoleEl.children).map(el => el.textContent).join('\n')
      : termOutput.textContent;
    if (!text.trim()) return showToast('Empty');
    showToast(await writeClipboardAsync(text) ? 'Copied' : 'Copy failed');
  });

  document.getElementById('btnClearPanel').addEventListener('click', () => {
    if (activePanel === 'console') clearConsole();
    else termOutput.innerHTML = '';
  });

  termInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const cmd = termInput.value.trim();
      termInput.value = '';
      if (cmd) executeCommand(cmd);
    }
  });

  termOutput.innerHTML = `<div class="term-line term-success">Welcome to IDEDITOR Terminal.</div><div class="term-line">Type <span class="term-success">help</span> for a list of commands.</div><br>`;
}

function addTermLine(msg, type = '') {
  const div = document.createElement('div');
  div.className = 'term-line' + (type ? ' term-' + type : '');
  div.textContent = msg;
  termOutput.appendChild(div);
  termOutput.scrollTop = termOutput.scrollHeight;
}

async function executeCommand(raw) {
  addTermLine(`$ ${raw}`);
  const args = raw.split(/\s+/);
  const cmd = args[0].toLowerCase();
  
  switch (cmd) {
    case 'help':
      addTermLine('Available commands:', 'info');
      addTermLine('  clear                - Clear terminal');
      addTermLine('  ls                   - List all files');
      addTermLine('  cat <file>           - Print file contents');
      addTermLine('  touch <file>         - Create a new file');
      addTermLine('  mkdir <folder>       - Create a new folder');
      addTermLine('  run                  - Run preview');
      addTermLine('  format               - Format current file');
      addTermLine('  git status           - Check git status');
      addTermLine('  git commit -m "msg"  - Commit changes');
      addTermLine('  git push             - Push to remote');
      addTermLine('  git pull             - Pull from remote');
      addTermLine('  git clone <url>      - Clone a repository');
      addTermLine('  firebase save        - Save to Firebase');
      addTermLine('  firebase load        - Load from Firebase');
      addTermLine('  theme <dark|light>   - Switch theme');
      break;

    case 'clear':
      termOutput.innerHTML = '';
      break;

    case 'ls':
      addTermLine(filesList.join('    '));
      break;

    case 'cat':
      if (!args[1]) return addTermLine('Usage: cat <file>', 'error');
      if (!models[args[1]]) return addTermLine(`File not found: ${args[1]}`, 'error');
      addTermLine(models[args[1]].getValue());
      break;

    case 'touch':
      if (!args[1]) return addTermLine('Usage: touch <file>', 'error');
      if (FILES[args[1]]) return addTermLine('File already exists', 'error');
      FILES[args[1]] = { lang: langFromFilename(args[1]), content: '' };
      filesList.push(args[1]);
      ensureModel(args[1]);
      renderTabs(); renderSidebarFiles(); saveNow();
      addTermLine(`Created file: ${args[1]}`, 'success');
      break;

    case 'mkdir':
      if (!args[1]) return addTermLine('Usage: mkdir <folder>', 'error');
      const folder = args[1];
      const placeholder = `${folder}/.gitkeep`;
      if (FILES[placeholder]) return addTermLine('Folder already exists', 'error');
      FILES[placeholder] = { lang: 'plaintext', content: '' };
      filesList.push(placeholder);
      ensureModel(placeholder);
      renderTabs(); renderSidebarFiles(); saveNow();
      addTermLine(`Created folder: ${folder}`, 'success');
      break;

    case 'run':
      run();
      addTermLine('Preview triggered', 'success');
      break;

    case 'format':
      addTermLine('Formatting current file...', 'info');
      await formatCurrent();
      break;

    case 'theme':
      if (args[1] === 'dark' || args[1] === 'light') {
        setTheme(args[1]);
        addTermLine(`Theme set to ${args[1]}`, 'success');
      } else {
        addTermLine('Usage: theme <dark|light>', 'error');
      }
      break;

    case 'git':
      handleGitCommand(args);
      break;

    case 'firebase':
      handleFirebaseCommand(args);
      break;

    default:
      addTermLine(`Command not found: ${cmd}`, 'error');
  }
}

async function handleGitCommand(args) {
  const sub = args[1];
  if (!gitEnabled) return addTermLine('Git is not loaded yet.', 'error');

  if (sub === 'status') {
    addTermLine('Checking status...', 'info');
    try {
      const matrix = await git.statusMatrix({ fs: gitFs, dir: GIT_DIR });
      const changed = matrix.filter(([, head, workdir, stage]) => head !== workdir || head !== stage);
      if (changed.length === 0) addTermLine('Clean', 'success');
      else addTermLine(`${changed.length} change(s)`, 'info');
    } catch (e) { addTermLine('Error: ' + e.message, 'error'); }
  } 
  else if (sub === 'commit') {
    const msgIndex = args.indexOf('-m');
    if (msgIndex === -1 || !args[msgIndex + 1]) return addTermLine('Usage: git commit -m "message"', 'error');
    const msg = args.slice(msgIndex + 1).join(' ').replace(/^["']|["']$/g, '');
    document.getElementById('gitMessage').value = msg;
    addTermLine(`Committing: "${msg}"...`, 'info');
    await gitCommit();
  }
  else if (sub === 'push') {
    addTermLine('Pushing...', 'info');
    await gitPush();
  }
  else if (sub === 'pull') {
    addTermLine('Pulling...', 'info');
    await gitPull();
  }
  else if (sub === 'clone') {
    if (!args[2]) return addTermLine('Usage: git clone <url>', 'error');
    
    localStorage.setItem(GIT_URL_KEY, args[2]);
    document.getElementById('gitRepoUrl').value = args[2];
    
    addTermLine(`Cloning: ${args[2]}...`, 'info');
    
    const loader = document.createElement('div');
    loader.className = 'term-line term-info';
    loader.textContent = '⏳ Downloading repository (limit: 45s)...';
    termOutput.appendChild(loader);
    termOutput.scrollTop = termOutput.scrollHeight;

    try {
      await gitClone();
    } catch (err) {
      addTermLine('Clone failed: ' + (err && err.message ? err.message : String(err)), 'error');
    } finally {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }
  }
  else {
    addTermLine('Unknown git command', 'error');
  }
}

async function handleFirebaseCommand(args) {
  const sub = args[1];
  if (!firebaseEnabled) return addTermLine('Firebase not loaded', 'error');
  if (!fbUser) return addTermLine('Not logged in. Click Login in the sidebar.', 'error');

  if (sub === 'save') {
    await saveToCloud();
  } else if (sub === 'load') {
    await loadFromCloud();
  } else {
    addTermLine('Unknown firebase command', 'error');
  }
}

function clearConsole() { if (!consoleEl) return; consoleEl.innerHTML = ''; const head = document.getElementById('consoleHead'); if (head) head.classList.remove('has-new'); }
function addConsoleLine(type, msg) {
  if (!consoleEl) return; const row = document.createElement('div'); row.className = 'cl cl-' + type;
  row.textContent = (type === 'error' ? '✖ ' : type === 'warn' ? '⚠ ' : '') + msg;
  if (type === 'error') {
    const m = msg.match(/@\s*line\s+(\d+)/i);
    if (m) { const line = parseInt(m[1], 10); row.classList.add('cl-clickable'); row.title = 'Jump to line ' + line; row.addEventListener('click', () => { if (!editor) return; editor.revealLineInCenter(line); editor.setPosition({ lineNumber: line, column: 1 }); editor.focus(); }); }
  }
  consoleEl.appendChild(row); 
  const head = document.getElementById('consoleHead'); 
  if (head && activePanel !== 'console') head.classList.add('has-new');
  
  if (type === 'error' && bottomPanel.classList.contains('hidden')) {
    bottomPanel.classList.remove('hidden');
    setActivePanel('console');
    if (editor) editor.layout();
  }
  
  consoleEl.scrollTop = consoleEl.scrollHeight;
}
window.addEventListener('message', e => { const d = e.data; if (!d || d.__preview !== true) return; addConsoleLine(d.type, d.msg); });

function run() {
  if (!editor) return; clearConsole(); document.getElementById('outputPane').classList.add('show');
  document.getElementById('preview').srcdoc = buildDoc(models['index.html'] ? models['index.html'].getValue() : '', models['style.css'] ? models['style.css'].getValue() : '', models['script.js'] ? models['script.js'].getValue() : '');
}

function wirePreviewControls() {
  const outputPane = document.getElementById('outputPane'), btnFullscreen = document.getElementById('btnFullscreen'), btnOpen = document.getElementById('btnOpen'), btnAuto = document.getElementById('btnAuto'), btnClose = document.getElementById('btnClosePreview');
  
  btnClose.addEventListener('click', () => {
    outputPane.classList.remove('show');
    document.getElementById('panes').classList.remove('preview-tab-mode');
    document.getElementById('editor').style.display = 'block';
    if (activeFile === 'preview') switchFile(filesList[0]);
  });

  function setFullscreen(on) { outputPane.classList.toggle('fullscreen', on); if (on) outputPane.classList.add('show'); btnFullscreen.classList.toggle('on', on); btnFullscreen.title = on ? 'Exit fullscreen' : 'Fullscreen preview'; }
  btnFullscreen.addEventListener('click', () => setFullscreen(!outputPane.classList.contains('fullscreen')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && outputPane.classList.contains('fullscreen')) setFullscreen(false); });
  
  btnOpen.addEventListener('click', () => {
    if (!editor) return; const blob = new Blob([buildDoc(models['index.html'] ? models['index.html'].getValue() : '', models['style.css'] ? models['style.css'].getValue() : '', models['script.js'] ? models['script.js'].getValue() : '')], { type: 'text/html' });
    const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); if (!w) alert('Popup blocked');
  });
  let autoOn = false, autoTimer = null;
  btnAuto.addEventListener('click', () => { autoOn = !autoOn; btnAuto.classList.toggle('on', autoOn); if (autoOn) run(); });
  const hookAuto = (m) => m.onDidChangeContent(() => { if (!autoOn) return; clearTimeout(autoTimer); autoTimer = setTimeout(run, 600); });
  Object.values(models).forEach(hookAuto); window.__hookAutoRun = hookAuto;
}

/* =========================================================
   GIT WIRING & OPERATIONS
   ========================================================= */
function wireGit() {
  if (!gitEnabled) { 
    const st = document.getElementById('gitStatus'); 
    if (st) st.textContent = 'Git unavailable (check console)'; 
    return; 
  }
  
  document.getElementById('btnGitSettings').addEventListener('click', () => {
    const { url, token } = getRepoConfig(); 
    document.getElementById('gitRepoUrl').value = url; 
    document.getElementById('gitToken').value = token; 
    document.getElementById('gitSettingsModal').style.display = 'flex';
  });
  
  document.getElementById('btnGitSaveSettings').addEventListener('click', async () => {
    const url = document.getElementById('gitRepoUrl').value.trim(), token = document.getElementById('gitToken').value.trim();
    localStorage.setItem(GIT_URL_KEY, url); 
    localStorage.setItem(GIT_TOKEN_KEY, token);
    document.getElementById('gitSettingsModal').style.display = 'none'; 
    showToast('Git settings saved');
    
    try {
      const files = await pfs.readdir(GIT_DIR);
      if (!files.includes('.git')) { 
        if (confirm('Clone this repository into the editor? Current files will be replaced.')) gitClone(); 
      } else {
        updateGitStatus();
      }
    } catch (e) { 
      if (confirm('Clone this repository into the editor? Current files will be replaced.')) gitClone(); 
    }
  });
  
  document.getElementById('btnGitCloseSettings').addEventListener('click', () => document.getElementById('gitSettingsModal').style.display = 'none');
  document.getElementById('btnGitCommit').addEventListener('click', gitCommit);
  document.getElementById('btnGitPush').addEventListener('click', gitPush);
  document.getElementById('btnGitPull').addEventListener('click', gitPull);
  document.getElementById('btnGitGraph').addEventListener('click', () => { 
    renderGitGraph(); 
    document.getElementById('gitGraphContainer').style.display = 'block'; 
  });
  
  document.getElementById('btnGitCloseGraph').addEventListener('click', () => document.getElementById('gitGraphContainer').style.display = 'none');
  updateGitStatus();
}

async function ensureRepoDir() { if (!gitEnabled) return; try { await pfs.mkdir(GIT_DIR); } catch (e) {} }

async function syncFilesToFS() {
  if (!gitEnabled) return; await ensureRepoDir();
  for (const name of filesList) { 
    const content = models[name] ? models[name].getValue() : ''; 
    const dir = name.substring(0, name.lastIndexOf('/'));
    if (dir) {
      await pfs.mkdir(`${GIT_DIR}/${dir}`, { recursive: true });
    }
    await pfs.writeFile(`${GIT_DIR}/${name}`, content, 'utf8'); 
  }
}

async function walkDir(dir, base = '') {
  let files = [];
  try {
    const entries = await pfs.readdir(dir);
    for (const entry of entries) {
      if (entry === '.git' || entry === '.gitkeep') continue;
      const fullPath = `${dir}/${entry}`;
      const stat = await pfs.stat(fullPath);
      if (stat.isDirectory()) {
        files = files.concat(await walkDir(fullPath, `${base}${entry}/`));
      } else {
        files.push(`${base}${entry}`);
      }
    }
  } catch (e) {}
  return files;
}

async function syncFSToEditor() {
  if (!gitEnabled) return; 
  let filePaths = [];
  try { filePaths = await walkDir(GIT_DIR); } catch (e) { return; }
  
  Object.keys(models).forEach(k => { try { models[k].dispose(); } catch (e) {} }); 
  Object.keys(models).forEach(k => delete models[k]);
  Object.keys(FILES).forEach(k => delete FILES[k]); 
  Object.keys(savedSnapshot).forEach(k => delete savedSnapshot[k]);
  
  filesList.length = 0;
  expandedFolders.clear();
  foldersInitialized = false;
  
  for (const name of filePaths) {
    let content = ''; try { content = await pfs.readFile(`${GIT_DIR}/${name}`, 'utf8'); } catch (e) { continue; }
    FILES[name] = { lang: langFromFilename(name), content }; filesList.push(name); ensureModel(name);
  }
  if (filesList.length === 0) { FILES['index.html'] = { lang: 'html', content: DEFAULT_HTML }; filesList.push('index.html'); ensureModel('index.html'); }
  if (!filesList.includes(activeFile)) activeFile = filesList[0];
  renderTabs(); renderSidebarFiles(); switchFile(activeFile); saveNow(); showToast('Files synced from Git');
}

async function updateGitStatus() {
  const el = document.getElementById('gitStatus'); if (!el) return;
  if (!gitEnabled) { el.textContent = 'Git unavailable'; return; }
  try {
    const matrix = await git.statusMatrix({ fs: gitFs, dir: GIT_DIR });
    const changed = matrix.filter(([, head, workdir, stage]) => head !== workdir || head !== stage);
    if (changed.length === 0) el.textContent = 'Clean'; else el.textContent = changed.length + ' change(s)';
  } catch (e) { el.textContent = 'Not connected'; }
}

async function gitCommit() {
  if (!gitEnabled) return showToast('Git not available');
  const msg = (document.getElementById('gitMessage').value || '').trim(); if (!msg) return showToast('Enter a commit message');
  try {
    await ensureRepoDir(); try { await pfs.readdir(`${GIT_DIR}/.git`); } catch (e) { await git.init({ fs: gitFs, dir: GIT_DIR }); }
    await syncFilesToFS();
    for (const name of filesList) { 
      try { await git.add({ fs: gitFs, dir: GIT_DIR, filepath: name }); } catch (e) { console.warn('Add error:', name, e); } 
    }
    await git.commit({ fs: gitFs, dir: GIT_DIR, message: msg, author: { name: 'IDEDITOR', email: 'editor@example.com' } });
    document.getElementById('gitMessage').value = ''; showToast('Committed'); updateGitStatus();
    addTermLine('Commit successful', 'success');
  } catch (e) { console.error(e); showToast('Commit failed: ' + (e && e.message ? e.message : e)); addTermLine('Commit failed: ' + e.message, 'error'); }
}

async function gitPush() {
  if (!gitEnabled) return showToast('Git not available');
  const { url, token } = getRepoConfig(); if (!url || !token) return showToast('Set repo URL and token in Git Settings');
  try {
    await syncFilesToFS();
    await git.push({ fs: gitFs, http, dir: GIT_DIR, corsProxy: CORS_PROXY, url, onAuth: () => ({ username: 'x-access-token', password: token }) });
    showToast('Pushed'); updateGitStatus();
    addTermLine('Push successful', 'success');
  } catch (e) { console.error(e); showToast('Push failed: ' + (e && e.message ? e.message : e)); addTermLine('Push failed: ' + e.message, 'error'); }
}

async function gitPull() {
  if (!gitEnabled) return showToast('Git not available');
  const { url, token } = getRepoConfig(); if (!url || !token) return showToast('Set repo URL and token in Git Settings');
  if (!confirm('Pull latest changes? Local uncommitted edits may be lost.')) return;
  try {
    await git.pull({ fs: gitFs, http, dir: GIT_DIR, corsProxy: CORS_PROXY, url, singleBranch: true, author: { name: 'IDEDITOR', email: 'editor@example.com' }, onAuth: () => ({ username: 'x-access-token', password: token }) });
    await syncFSToEditor(); showToast('Pulled'); updateGitStatus();
    addTermLine('Pull successful', 'success');
  } catch (e) { console.error(e); showToast('Pull failed: ' + (e && e.message ? e.message : e)); addTermLine('Pull failed: ' + e.message, 'error'); }
}

async function gitClone() {
  if (!gitEnabled) throw new Error('Git not available');
  const { url, token } = getRepoConfig(); 
  if (!url) throw new Error('No repository URL provided.');
  
  const cloneTask = (async () => {
    try { await pfs.rmdir(GIT_DIR, { recursive: true }); } catch (e) {}
    return await git.clone({ 
      fs: gitFs, http, dir: GIT_DIR, corsProxy: CORS_PROXY, 
      url, 
      singleBranch: true, 
      depth: 1, 
      onAuth: token ? () => ({ username: 'x-access-token', password: token }) : undefined
    });
  })();

  const timeoutTask = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Timeout: The repository is too large for the proxy, or Vercel dropped the connection.")), 45000);
  });

  try {
    await Promise.race([cloneTask, timeoutTask]);
    await syncFSToEditor(); 
    showToast('Cloned'); 
    updateGitStatus();
  } catch (e) { 
    console.error(e); 
    const message = e && e.message ? e.message : String(e);
    showToast('Clone failed: ' + message);
    throw e; 
  }
}

async function renderGitGraph() {
  const svg = document.getElementById('gitGraphSvg'); svg.innerHTML = '';
  if (!gitEnabled) return showToast('Git not available');
  let commits; try { commits = await git.log({ fs: gitFs, dir: GIT_DIR, depth: 30 }); } catch (e) { return showToast('No commit history'); }
  if (!commits || !commits.length) return showToast('No commits yet');
  const rowH = 36, x = 40;
  svg.setAttribute('width', '100%'); svg.setAttribute('height', commits.length * rowH + 20); svg.style.background = 'var(--bg)';
  commits.forEach((c, i) => {
    const y = 20 + i * rowH;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', 6); circle.setAttribute('fill', '#0a84ff'); svg.appendChild(circle);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text'); text.setAttribute('x', x + 20); text.setAttribute('y', y + 4); text.setAttribute('fill', 'currentColor'); text.setAttribute('font-size', '12'); text.setAttribute('font-family', 'ui-monospace, monospace'); text.textContent = c.oid.slice(0, 7) + '  ' + c.message.split('\n')[0].slice(0, 60); svg.appendChild(text);
    (c.parent || []).forEach(pid => {
      const pIndex = commits.findIndex(pc => pc.oid === pid);
      if (pIndex > i) {
        const px = x + Math.min(pIndex - i, 4) * 10; const py = 20 + pIndex * rowH;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.setAttribute('x1', x); line.setAttribute('y1', y + 6); line.setAttribute('x2', px); line.setAttribute('y2', py - 6); line.setAttribute('stroke', '#555'); line.setAttribute('stroke-width', '2'); svg.appendChild(line);
      }
    });
  });
}