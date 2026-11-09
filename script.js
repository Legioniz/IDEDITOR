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
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    
    const { getAuth, onAuthStateChanged, getRedirectResult } = authModule;
    
    const app = initializeApp(firebaseConfig);
    fbAuth = getAuth(app);
    fbDb = getFirestore(app);
    
    const loggedOutUI = document.getElementById('firebaseLoggedOut');
    const loggedInUI = document.getElementById('firebaseLoggedIn');
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    
    getRedirectResult(fbAuth).then((result) => {
      if (result && result.user) showToast('Logged in as ' + result.user.displayName);
    }).catch((error) => console.error('Redirect login error:', error));
    
    onAuthStateChanged(fbAuth, (user) => {
      fbUser = user;
      if (user) {
        loggedOutUI.style.display = 'none';
        loggedInUI.style.display = 'block';
        const displayName = user.displayName || user.email.split('@')[0];
        nameEl.textContent = displayName;
        avatarEl.textContent = displayName.charAt(0);
        addTermLine('Firebase Connected: ' + displayName, 'success');
      } else {
        loggedInUI.style.display = 'none';
        loggedOutUI.style.display = 'block';
      }
    });
    firebaseEnabled = true;
  } catch (e) {
    console.warn('Firebase failed to load', e);
  }
}

async function saveToCloud() {
  if (!firebaseEnabled || !fbUser) return showToast('Login to save to cloud');
  try {
    showToast('Saving to cloud...');
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const data = {};
    Object.keys(models).forEach(k => { data[k] = models[k].getValue(); });
    await setDoc(doc(fbDb, 'users', fbUser.uid, 'projects', 'main'), { files: data, updatedAt: new Date().toISOString() });
    showToast('Saved to cloud!'); addTermLine('Saved to cloud!', 'success');
  } catch (e) { showToast('Cloud save failed'); }
}

async function loadFromCloud() {
  if (!firebaseEnabled || !fbUser) return showToast('Login to load from cloud');
  try {
    showToast('Loading from cloud...');
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const docSnap = await getDoc(doc(fbDb, 'users', fbUser.uid, 'projects', 'main'));
    if (!docSnap.exists()) return showToast('No cloud project found');
    
    const cloudFiles = docSnap.data().files;
    if (editor) editor.setModel(null);
    filesList.length = 0;
    Object.keys(FILES).forEach(k => delete FILES[k]);
    Object.keys(models).forEach(k => { if(models[k]) models[k].dispose(); delete models[k]; });
    Object.keys(savedSnapshot).forEach(k => delete savedSnapshot[k]);
    
    Object.keys(cloudFiles).forEach(name => {
      FILES[name] = { lang: langFromFilename(name), content: cloudFiles[name] };
      filesList.push(name); ensureModel(name);
    });
    if (!filesList.length) filesList = ['index.html'];
    activeFile = filesList[0];
    renderTabs(); renderSidebarFiles(); switchFile(activeFile); saveNow();
    showToast('Loaded from cloud!');
  } catch (e) { showToast('Cloud load failed'); }
}

/* =========================================================
   HELPERS & INIT
   ========================================================= */
const isMobile = () => window.matchMedia('(max-width:899px)').matches;
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const basename = (path) => path.split('/').pop();

function langFromFilename(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return { html: 'html', htm: 'html', css: 'css', js: 'javascript', mjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown', xml: 'xml', svg: 'xml', txt: 'plaintext' }[ext] || 'plaintext';
}
function parserForFile(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return { html: 'html', htm: 'html', css: 'css', js: 'babel', mjs: 'babel', jsx: 'babel', ts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown' }[ext] || null;
}

let loadedFromUrl = false;
function tryLoadFromHash() {
  if (typeof LZString === 'undefined' || !location.hash.startsWith('#s=')) return false;
  try {
    const raw = LZString.decompressFromEncodedURIComponent(location.hash.slice(3));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const names = Object.keys(parsed).filter(k => typeof parsed[k] === 'string');
    if (names.length === 0) return false;
    FILES = {}; filesList = names.slice();
    names.forEach(name => { FILES[name] = { lang: langFromFilename(name), content: parsed[name] }; });
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  } catch (e) { return false; }
}
function tryLoadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const names = Object.keys(parsed).filter(k => typeof parsed[k] === 'string');
    if (names.length === 0) return false;
    FILES = {}; filesList = names.slice();
    names.forEach(name => { FILES[name] = { lang: langFromFilename(name), content: parsed[name] }; });
    return true;
  } catch (e) { return false; }
}
loadedFromUrl = tryLoadFromHash();
if (!loadedFromUrl) tryLoadFromStorage();
document.documentElement.setAttribute('data-theme', localStorage.getItem(THEME_KEY) || 'dark');

/* =========================================================
   EDITOR SETUP
   ========================================================= */
let editor = null, models = {}, savedSnapshot = {};
let activeFile = 'index.html', uriSeq = 0;
let minimapEnabled = localStorage.getItem(MINIMAP_KEY) === 'true';
let fontSize = parseInt(localStorage.getItem(FONTSIZE_KEY), 10) || (isMobile() ? 14 : 13);

if (typeof require === 'undefined') {
  document.getElementById('editor').innerHTML = '<div style="padding:20px;color:#ff7b72;font-family:sans-serif">Failed to load Monaco Editor.</div>';
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
    model: models[activeFile], theme: 'vs-dark', fontSize: fontSize,
    minimap: { enabled: minimapEnabled }, lineNumbersMinChars: 2, automaticLayout: true,
    wordWrap: 'on', scrollBeyondLastLine: false, padding: { top: 8 }, tabSize: 2,
    bracketPairColorization: { enabled: true }, guides: { bracketPairs: true },
    lineHeight: Math.round(fontSize * 1.5), lineDecorationsWidth: 8
  });

  editor.onDidChangeCursorPosition(e => {
    document.getElementById('statusCursor').textContent = 'Ln ' + e.position.lineNumber + ', Col ' + e.position.column;
  });

  renderTabs(); renderSidebarFiles();
  wireFindBar(); wireRun(); wireConsole(); wireClipboard(); wireSettings(); wirePreviewControls(); wireSidebar(); wireMobileActions(); wireTier1Features(); setupSaveFlush(); wireGitUI();
  Object.values(models).forEach(m => window.__hookAutoRun && window.__hookAutoRun(m));

  editor.addAction({ id: 'custom-open-find', label: 'Find', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF], run: openFindBar });
  editor.addAction({ id: 'custom-run-kb', label: 'Run', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: run });

  if (loadedFromUrl) saveNow();
  setTheme(localStorage.getItem(THEME_KEY) || 'dark');
  updateStatusFont(); switchFile(activeFile);
  initFirebase();
  showToast('Loaded');
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNow(); showToast('Saved'); }
});

function wireTier1Features() {
  document.getElementById('btnCmdPalette').addEventListener('click', () => { if (editor) { editor.focus(); setTimeout(() => editor.trigger('', 'editor.action.quickCommand'), 50); }});
  const btnMinimap = document.getElementById('btnMinimap');
  btnMinimap.classList.toggle('on', minimapEnabled);
  btnMinimap.addEventListener('click', () => {
    minimapEnabled = !minimapEnabled;
    editor.updateOptions({ minimap: { enabled: minimapEnabled } });
    btnMinimap.classList.toggle('on', minimapEnabled);
    localStorage.setItem(MINIMAP_KEY, minimapEnabled);
  });

  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileImport').click());
  document.getElementById('fileImport').addEventListener('change', async (e) => {
    const files = e.target.files; if (!files.length) return;
    let firstImported = null;
    for (const file of files) {
      if (FILES[file.name] && !confirm(`Overwrite "${file.name}"?`)) continue;
      if (models[file.name]) { models[file.name].dispose(); delete models[file.name]; }
      FILES[file.name] = { lang: langFromFilename(file.name), content: await file.text() };
      if (!filesList.includes(file.name)) filesList.push(file.name);
      ensureModel(file.name); if (!firstImported) firstImported = file.name;
    }
    renderTabs(); renderSidebarFiles(); if (firstImported) switchFile(firstImported);
    saveNow(); showToast('Imported files'); e.target.value = '';
  });

  // Resizer logic
  const resizer = document.getElementById('resizer'), editorPane = document.getElementById('editorPane'), outputPane = document.getElementById('outputPane');
  let isResizing = false, startX = 0, startY = 0, startWidth = 0, startHeight = 0;
  resizer.addEventListener('pointerdown', (e) => {
    isResizing = true; startX = e.clientX; startY = e.clientY;
    startWidth = editorPane.getBoundingClientRect().width; startHeight = editorPane.getBoundingClientRect().height;
    resizer.classList.add('active'); document.body.style.userSelect = 'none';
  });
  document.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const panesContainer = document.getElementById('panes');
    if (isMobile()) {
      const newHeight = startHeight + (e.clientY - startY);
      const totalHeight = panesContainer.getBoundingClientRect().height;
      if (newHeight > totalHeight * 0.2 && newHeight < totalHeight * 0.8) {
        const percent = (newHeight / totalHeight) * 100;
        editorPane.style.flex = `1 1 ${percent}%`; outputPane.style.flex = `1 1 ${100 - percent}%`;
        if (editor) editor.layout();
      }
    } else {
      const newWidth = startWidth + (e.clientX - startX);
      const totalWidth = panesContainer.getBoundingClientRect().width;
      if (newWidth > totalWidth * 0.2 && newWidth < totalWidth * 0.8) {
        const percent = (newWidth / totalWidth) * 100;
        editorPane.style.flex = `1 1 ${percent}%`; outputPane.style.flex = `1 1 ${100 - percent}%`;
        if (editor) editor.layout();
      }
    }
  });
  document.addEventListener('pointerup', () => { if (isResizing) { isResizing = false; resizer.classList.remove('active'); document.body.style.userSelect = ''; } });
}

/* =========================================================
   STATUS, SAVE, RENDER
   ========================================================= */
function updateStatusFont() { const el = document.getElementById('statusFont'); if (el) el.textContent = fontSize + 'px'; }
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
    btn.dataset.file = name; btn.textContent = basename(name); btn.title = name;
    attachFileMenuHandlers(btn, name); nav.appendChild(btn);
  });
  const prevBtn = document.createElement('button');
  prevBtn.className = 'tab tab-preview' + (activeFile === 'preview' ? ' active' : '');
  prevBtn.dataset.file = 'preview'; prevBtn.innerHTML = '▶ Preview';
  prevBtn.addEventListener('click', () => switchFile('preview')); nav.appendChild(prevBtn);
  const addBtn = document.createElement('button'); addBtn.className = 'tab-add'; addBtn.title = 'New file'; addBtn.textContent = '+';
  addBtn.addEventListener('click', promptNewFile); nav.appendChild(addBtn);
  filesList.forEach(markDirtyState);
}

let foldersInitialized = false;
const expandedFolders = new Set();
function renderSidebarFiles() {
  if (!foldersInitialized && filesList.length > 0) {
    filesList.forEach(f => {
      const parts = f.split('/'); let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) { currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]; expandedFolders.add(currentPath); }
    });
    foldersInitialized = true;
  }
  const list = document.getElementById('sideFiles'); list.innerHTML = '';
  const filter = (document.getElementById('fileFilter')?.value || '').trim().toLowerCase();
  const visibleFiles = filter ? filesList.filter(name => name.toLowerCase().includes(filter)) : filesList;
  const tree = {};
  visibleFiles.forEach(path => {
    const parts = path.split('/'); let current = tree;
    parts.forEach((part, i) => { if (!current[part]) current[part] = (i === parts.length - 1) ? 'FILE' : {}; current = current[part]; });
  });

  function buildNode(node, path, container) {
    const keys = Object.keys(node).sort((a, b) => {
      const aIsFile = node[a] === 'FILE'; const bIsFile = node[b] === 'FILE';
      if (aIsFile && !bIsFile) return 1; if (!aIsFile && bIsFile) return -1; return a.localeCompare(b);
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
          childrenContainer.classList.toggle('hidden', nowCollapsed); folderHeader.classList.toggle('collapsed', nowCollapsed);
          if (nowCollapsed) expandedFolders.delete(fullPath); else expandedFolders.add(fullPath);
        });
        folderDiv.appendChild(folderHeader); folderDiv.appendChild(childrenContainer); container.appendChild(folderDiv);
        buildNode(node[key], fullPath, childrenContainer);
      }
    });
  }
  if (visibleFiles.length) buildNode(tree, '', list);
  else { const empty = document.createElement('div'); empty.className = 'file-filter-empty'; empty.textContent = 'No matching files'; list.appendChild(empty); }
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
    if (act === 'rename') { const newName = prompt('Rename "' + name + '" to:', name); if (newName && newName.trim() && newName.trim() !== name) renameFile(name, newName.trim()); }
    else if (act === 'delete') deleteFile(name);
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
  FILES[name] = { lang: langFromFilename(name), content: '' }; filesList.push(name); ensureModel(name);
  renderTabs(); renderSidebarFiles(); switchFile(name); saveNow(); showToast('Created ' + name);
}
function promptNewFolder() {
  const raw = prompt('New folder path (e.g. src/components):'); if (!raw) return;
  let folder = raw.trim().replace(/^\/+/, '').replace(/[\\:*?"<>|\x00-\x1F]/g, '');
  if (!folder) return showToast('Invalid name');
  const placeholder = `${folder}/.gitkeep`;
  if (FILES[placeholder]) return showToast('Folder already exists');
  FILES[placeholder] = { lang: 'plaintext', content: '' }; filesList.push(placeholder); ensureModel(placeholder);
  const parts = folder.split('/'); let currentPath = '';
  parts.forEach(p => { currentPath = currentPath ? `${currentPath}/${p}` : p; expandedFolders.add(currentPath); });
  renderTabs(); renderSidebarFiles(); saveNow(); showToast('Created folder ' + folder);
}
function renameFile(oldName, newName) {
  newName = (newName || '').trim().replace(/^\/+/, '').replace(/[\\:*?"<>|\x00-\x1F]/g, '');
  if (!newName) return showToast('Invalid name'); if (newName === oldName) return; if (FILES[newName]) return showToast('File already exists');
  const oldModel = models[oldName], oldContent = oldModel ? oldModel.getValue() : '', newLang = langFromFilename(newName);
  if (oldModel) oldModel.dispose(); delete models[oldName];
  FILES[newName] = { lang: newLang, content: oldContent }; delete FILES[oldName];
  savedSnapshot[newName] = savedSnapshot[oldName] || oldContent; delete savedSnapshot[oldName];
  filesList = filesList.map(n => n === oldName ? newName : n); if (activeFile === oldName) activeFile = newName;
  const newModel = monaco.editor.createModel(oldContent, newLang, makeUri(newName));
  models[newName] = newModel; newModel.onDidChangeContent(() => { markDirtyState(newName); scheduleSave(); });
  if (window.__hookAutoRun) window.__hookAutoRun(newModel);
  renderTabs(); renderSidebarFiles(); switchFile(activeFile); saveNow(); showToast('Renamed to ' + newName);
}
function deleteFile(name) {
  if (filesList.length <= 1) return showToast('Cannot delete the last file');
  if (!confirm('Delete "' + name + '"?')) return;
  if (models[name]) { models[name].dispose(); delete models[name]; }
  delete FILES[name]; delete savedSnapshot[name]; filesList = filesList.filter(n => n !== name);
  if (activeFile === name) { activeFile = filesList[0]; editor.setModel(models[activeFile]); }
  renderTabs(); renderSidebarFiles(); switchFile(activeFile); saveNow(); showToast('Deleted ' + name);
}

function openSidebar() { document.getElementById('sidebar').classList.remove('hidden'); document.getElementById('sidebarBackdrop').classList.add('show'); localStorage.setItem(SIDEBAR_KEY, '0'); }
function closeSidebar() { document.getElementById('sidebar').classList.add('hidden'); document.getElementById('sidebarBackdrop').classList.remove('show'); localStorage.setItem(SIDEBAR_KEY, '1'); }
function toggleSidebar() { const sidebar = document.getElementById('sidebar'); if (sidebar.classList.contains('hidden')) openSidebar(); else closeSidebar(); }

function wireSidebar() {
  const sidebar = document.getElementById('sidebar'), toggle = document.getElementById('btnSidebarToggle'), backdrop = document.getElementById('sidebarBackdrop');
  if (localStorage.getItem(SIDEBAR_KEY) === '1' || (!localStorage.getItem(SIDEBAR_KEY) && isMobile())) sidebar.classList.add('hidden');
  else if (isMobile()) backdrop.classList.add('show');
  toggle.addEventListener('click', toggleSidebar); backdrop.addEventListener('click', closeSidebar);
  document.getElementById('btnNewFile').addEventListener('click', promptNewFile);
  document.getElementById('btnNewFolder').addEventListener('click', promptNewFolder);
  const fileFilter = document.getElementById('fileFilter');
  fileFilter.addEventListener('input', renderSidebarFiles);
  fileFilter.addEventListener('keydown', e => { if (e.key === 'Escape' && fileFilter.value) { fileFilter.value = ''; renderSidebarFiles(); }});
  document.getElementById('btnReset').addEventListener('click', () => { if (!confirm('Reset all files?')) return; localStorage.clear(); location.reload(); });
  document.getElementById('btnCloudSave').addEventListener('click', saveToCloud);
  document.getElementById('btnCloudLoad').addEventListener('click', loadFromCloud);
  document.getElementById('btnFirebaseLogin').addEventListener('click', () => {
    if (!firebaseEnabled || !authModule) return showToast('Firebase loading...');
    const provider = new authModule.GoogleAuthProvider();
    if (isMobile()) authModule.signInWithRedirect(fbAuth, provider); else authModule.signInWithPopup(fbAuth, provider);
  });
  document.getElementById('btnFirebaseLogout').addEventListener('click', () => { if (firebaseEnabled && authModule) authModule.signOut(fbAuth); });
}

function switchFile(file) {
  if (file !== 'preview' && !models[file]) return;
  activeFile = file;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.file === file));
  document.querySelectorAll('.side-item[data-file]').forEach(b => b.classList.toggle('active', b.dataset.file === file));
  const panes = document.getElementById('panes'), outputPane = document.getElementById('outputPane');
  if (file === 'preview') {
    panes.classList.add('preview-tab-mode'); outputPane.classList.add('show');
    document.getElementById('editor').style.display = 'none'; document.getElementById('statusFile').textContent = 'Preview'; run();
  } else {
    panes.classList.remove('preview-tab-mode'); document.getElementById('editor').style.display = 'block';
    editor.setModel(models[file]); document.getElementById('statusFile').textContent = basename(file);
    clearDecorations(); if (findbar.classList.contains('show')) refreshMatches();
  }
}

function getSelectedText() { const sel = editor.getSelection(); return (!sel || sel.isEmpty()) ? '' : editor.getModel().getValueInRange(sel); }
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
  t.style.cssText = 'position:fixed;bottom:' + (isMobile() ? 'calc(88px + env(safe-area-inset-bottom))' : '24px') + ';left:50%;transform:translateX(-50%);background:#0a84ff;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:99999;pointer-events:none;opacity:0;transition:opacity .2s;font-family:-apple-system,sans-serif;max-width:80vw;text-align:center;';
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
    const ok = await writeClipboardAsync(location.origin + location.pathname + '#s=' + compressed); showToast(ok ? 'Share link copied' : 'Copy failed', 1600);
  });
  document.getElementById('btnFormat').addEventListener('click', formatCurrent);
  document.getElementById('btnZip').addEventListener('click', downloadZip);
}

function wireMobileActions() {
  document.getElementById('mobileActions').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'undo') { editor.trigger('', 'undo'); editor.focus(); }
    else if (act === 'redo') { editor.trigger('', 'redo'); editor.focus(); }
    else if (act === 'copy') copySelection(); else if (act === 'paste') pasteFromClipboard();
    else if (act === 'format') formatCurrent(); else if (act === 'run') run();
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
  if (!editor) return; const parser = parserForFile(activeFile); if (!parser) return showToast('No formatter for ' + activeFile);
  try {
    showToast('Formatting…'); await ensurePrettier();
    const P = window.prettierPlugins || {}; const plugins = [P.babel, P.estree, P.html, P.postcss, P.typescript, P.markdown].filter(Boolean);
    const model = models[activeFile], code = model.getValue(), formatted = await window.prettier.format(code, { parser, plugins, tabWidth: 2, printWidth: 80, singleQuote: true });
    if (formatted === code) return showToast('Already formatted');
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text: formatted }], () => null); showToast('Formatted');
  } catch (e) { showToast('Format failed'); }
}
async function downloadZip() {
  try {
    if (!window.JSZip) await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    const zip = new window.JSZip(); Object.keys(models).forEach(k => zip.file(k, models[k].getValue()));
    const blob = await zip.generateAsync({ type: 'blob' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'idEditor-project.zip'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000); showToast('Downloaded');
  } catch (e) { showToast('Zip failed'); }
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
  findInput.addEventListener('keydown', e => { if (e.key === 'Escape') { findbar.classList.remove('show'); clearDecorations(); return; } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goTo(matchIndex + (e.shiftKey ? -1 : 1)); } });
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
  const model = editor.getModel(), q = normalizeNL(findInput.value);
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
function replaceCurrent() { if (!matches.length || matchIndex < 0) return refreshMatches(); editor.getModel().pushEditOperations([], [{ range: matches[matchIndex], text: normalizeNL(replInput.value) }], () => null); refreshMatches(true); }
function replaceAll() {
  const q = normalizeNL(findInput.value); if (!q) return;
  const model = editor.getModel(), found = model.findMatches(q, false, false, isCaseSensitive(), null, false);
  if (!found.length) return showToast('No matches');
  const repl = normalizeNL(replInput.value);
  const edits = found.map(r => ({ range: r.range, text: repl })).sort((a, b) => b.range.startLineNumber - a.range.startLineNumber || b.range.startColumn - a.range.startColumn);
  model.pushEditOperations([], edits, () => null); refreshMatches();
  showToast('Replaced ' + found.length + (found.length === 1 ? ' match' : ' matches'));
}

function wireRun() { document.getElementById('btnRun').addEventListener('click', run); }
const consoleEl = document.getElementById('console'), termEl = document.getElementById('terminal'), termOutput = document.getElementById('termOutput'), termInput = document.getElementById('termInput'), bottomPanel = document.getElementById('bottomPanel');
let activePanel = 'console';

function setActivePanel(panel) {
  activePanel = panel;
  document.getElementById('btnTabConsole').classList.toggle('active', panel === 'console');
  document.getElementById('btnTabTerminal').classList.toggle('active', panel === 'terminal');
  if (panel === 'console') { consoleEl.style.display = 'block'; consoleEl.classList.add('show'); termEl.style.display = 'none'; }
  else { consoleEl.style.display = 'none'; termEl.style.display = 'flex'; termInput.focus(); }
}

function wireConsole() {
  document.getElementById('btnTogglePanel').addEventListener('click', () => { bottomPanel.classList.toggle('hidden'); if (!bottomPanel.classList.contains('hidden')) { if (activePanel === 'terminal') termInput.focus(); if (editor) editor.layout(); } else { if (editor) editor.layout(); }});
  document.getElementById('btnClosePanel').addEventListener('click', () => { bottomPanel.classList.add('hidden'); if (editor) editor.layout(); });
  document.getElementById('btnTabConsole').addEventListener('click', () => setActivePanel('console'));
  document.getElementById('btnTabTerminal').addEventListener('click', () => setActivePanel('terminal'));
  document.getElementById('btnCopyPanel').addEventListener('click', async () => {
    const text = activePanel === 'console' ? Array.from(consoleEl.children).map(el => el.textContent).join('\n') : termOutput.textContent;
    if (!text.trim()) return showToast('Empty'); showToast(await writeClipboardAsync(text) ? 'Copied' : 'Copy failed');
  });
  document.getElementById('btnClearPanel').addEventListener('click', () => { if (activePanel === 'console') clearConsole(); else termOutput.innerHTML = ''; });
  termInput.addEventListener('keydown', e => { if (e.key === 'Enter') { const cmd = termInput.value.trim(); termInput.value = ''; if (cmd) executeCommand(cmd); } });
  termOutput.innerHTML = `<div class="term-line term-success">Welcome to IDEDITOR Terminal.</div><div class="term-line">Type <span class="term-success">help</span> for a list of commands.</div><br>`;
}

function addTermLine(msg, type = '') {
  const div = document.createElement('div'); div.className = 'term-line' + (type ? ' term-' + type : ''); div.textContent = msg;
  termOutput.appendChild(div); termOutput.scrollTop = termOutput.scrollHeight;
}

function parseTerminalArgs(raw) {
  const args = [], pattern = /"([^"]*)"|'([^']*)'|(\S+)/g; let match;
  while ((match = pattern.exec(raw)) !== null) { args.push(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]); }
  return args;
}

async function executeCommand(raw) {
  addTermLine(`$ ${raw}`);
  const args = parseTerminalArgs(raw), cmd = args[0].toLowerCase();
  switch (cmd) {
    case 'help': addTermLine('Available: clear, ls, cat, touch, mkdir, run, format, git clone, git commit, git push, firebase save/load, theme', 'info'); break;
    case 'clear': termOutput.innerHTML = ''; break;
    case 'ls': addTermLine(filesList.join('    ')); break;
    case 'cat': if (!args[1] || !models[args[1]]) return addTermLine('File not found', 'error'); addTermLine(models[args[1]].getValue()); break;
    case 'touch': if (!args[1]) return addTermLine('Usage: touch <file>', 'error'); if (FILES[args[1]]) return addTermLine('Exists', 'error'); FILES[args[1]] = { lang: langFromFilename(args[1]), content: '' }; filesList.push(args[1]); ensureModel(args[1]); renderTabs(); renderSidebarFiles(); saveNow(); addTermLine(`Created ${args[1]}`, 'success'); break;
    case 'mkdir': if (!args[1]) return addTermLine('Usage: mkdir <folder>', 'error'); const placeholder = `${args[1]}/.gitkeep`; if (FILES[placeholder]) return addTermLine('Exists', 'error'); FILES[placeholder] = { lang: 'plaintext', content: '' }; filesList.push(placeholder); ensureModel(placeholder); renderTabs(); renderSidebarFiles(); saveNow(); addTermLine(`Created folder`, 'success'); break;
    case 'run': run(); addTermLine('Preview triggered', 'success'); break;
    case 'format': await formatCurrent(); break;
    case 'theme': if (args[1] === 'dark' || args[1] === 'light') { setTheme(args[1]); addTermLine(`Theme set to ${args[1]}`, 'success'); } else addTermLine('Usage: theme <dark|light>', 'error'); break;
    case 'git': handleGitCommand(args); break;
    case 'firebase': handleFirebaseCommand(args); break;
    default: addTermLine(`Command not found: ${cmd}`, 'error');
  }
}

async function handleFirebaseCommand(args) {
  if (!firebaseEnabled || !fbUser) return addTermLine('Not logged in to Firebase', 'error');
  if (args[1] === 'save') await saveToCloud(); else if (args[1] === 'load') await loadFromCloud(); else addTermLine('Unknown firebase command', 'error');
}

function clearConsole() { if (consoleEl) consoleEl.innerHTML = ''; }
function addConsoleLine(type, msg) {
  if (!consoleEl) return; const row = document.createElement('div'); row.className = 'cl cl-' + type;
  row.textContent = (type === 'error' ? '✖ ' : type === 'warn' ? '⚠ ' : '') + msg;
  if (type === 'error') { const m = msg.match(/@\s*line\s+(\d+)/i); if (m) { const line = parseInt(m[1], 10); row.classList.add('cl-clickable'); row.title = 'Jump to line ' + line; row.addEventListener('click', () => { if (editor) { editor.revealLineInCenter(line); editor.setPosition({ lineNumber: line, column: 1 }); editor.focus(); }}); } }
  consoleEl.appendChild(row); 
  if (type === 'error' && bottomPanel.classList.contains('hidden')) { bottomPanel.classList.remove('hidden'); setActivePanel('console'); if (editor) editor.layout(); }
  consoleEl.scrollTop = consoleEl.scrollHeight;
}
window.addEventListener('message', e => { const d = e.data; if (!d || d.__preview !== true) return; addConsoleLine(d.type, d.msg); });

function buildDoc(html, css, js) {
  const openScript = '<scr' + 'ipt>', closeScript = '</scr' + 'ipt>';
  const consoleHook = `${openScript}(function(){function ser(v){if(typeof v==='string')return v;if(v instanceof Error)return v.message;try{return JSON.stringify(v);}catch(e){return String(v);}}function send(type,args){try{parent.postMessage({__preview:true,type:type,msg:Array.prototype.map.call(args,ser).join(' ')},'*');}catch(e){}}['log','info','warn','error'].forEach(function(t){var orig=console[t]?console[t].bind(console):function(){};console[t]=function(){orig.apply(null,arguments);send(t,arguments);};});window.addEventListener('error',function(e){send('error',[e.message+' @ line '+e.lineno]);});window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled rejection: '+ser(e.reason)]);});})();${closeScript}`;
  const headInject = consoleHook + '<style>\n' + (css || '') + '\n</style>';
  const bodyInject = openScript + '\ntry{\n' + (js || '') + '\n}catch(e){ console.error(e && e.message ? e.message : e); }\n' + closeScript;
  const h = html || '';
  if (/<html[\s>]/i.test(h)) {
    let out = h;
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, headInject + '</head>'); else out = out.replace(/<html[^>]*>/i, m => m + '<head>' + headInject + '</head>');
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, bodyInject + '</body>'); else out += bodyInject;
    return out;
  }
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + headInject + '</head><body>' + h + bodyInject + '</body></html>';
}

function run() { if (!editor) return; clearConsole(); document.getElementById('outputPane').classList.add('show'); document.getElementById('preview').srcdoc = buildDoc(models['index.html'] ? models['index.html'].getValue() : '', models['style.css'] ? models['style.css'].getValue() : '', models['script.js'] ? models['script.js'].getValue() : ''); }

function wirePreviewControls() {
  const outputPane = document.getElementById('outputPane'), btnFullscreen = document.getElementById('btnFullscreen'), btnOpen = document.getElementById('btnOpen'), btnAuto = document.getElementById('btnAuto'), btnClose = document.getElementById('btnClosePreview');
  btnClose.addEventListener('click', () => { outputPane.classList.remove('show'); document.getElementById('panes').classList.remove('preview-tab-mode'); document.getElementById('editor').style.display = 'block'; if (activeFile === 'preview') switchFile(filesList[0]); });
  function setFullscreen(on) { outputPane.classList.toggle('fullscreen', on); if (on) outputPane.classList.add('show'); btnFullscreen.classList.toggle('on', on); btnFullscreen.title = on ? 'Exit fullscreen' : 'Fullscreen preview'; }
  btnFullscreen.addEventListener('click', () => setFullscreen(!outputPane.classList.contains('fullscreen')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && outputPane.classList.contains('fullscreen')) setFullscreen(false); });
  btnOpen.addEventListener('click', () => { const blob = new Blob([buildDoc(models['index.html'] ? models['index.html'].getValue() : '', models['style.css'] ? models['style.css'].getValue() : '', models['script.js'] ? models['script.js'].getValue() : '')], { type: 'text/html' }); const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); if (!w) alert('Popup blocked'); });
  let autoOn = false, autoTimer = null;
  btnAuto.addEventListener('click', () => { autoOn = !autoOn; btnAuto.classList.toggle('on', autoOn); if (autoOn) run(); });
  const hookAuto = (m) => m.onDidChangeContent(() => { if (!autoOn) return; clearTimeout(autoTimer); autoTimer = setTimeout(run, 600); });
  Object.values(models).forEach(hookAuto); window.__hookAutoRun = hookAuto;
}

/* =========================================================
   GITHUB REST API IMPLEMENTATION (NO PROXY NEEDED)
   ========================================================= */

function getRepoConfig() {
  return { url: localStorage.getItem(GIT_URL_KEY) || '', token: localStorage.getItem(GIT_TOKEN_KEY) || '' };
}

function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function encodeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function decodeBase64(str) {
  return decodeURIComponent(escape(atob(str)));
}

async function handleGitCommand(args) {
  const sub = args[1];
  if (sub === 'clone') {
    if (!args[2]) return addTermLine('Usage: git clone <url>', 'error');
    const repoUrl = args.slice(2).join(' ').trim();
    localStorage.setItem(GIT_URL_KEY, repoUrl);
    document.getElementById('gitRepoUrl').value = repoUrl;
    addTermLine(`Cloning: ${repoUrl}...`, 'info');
    const loader = document.createElement('div'); loader.className = 'term-line term-info'; loader.textContent = '⏳ Downloading repository...'; termOutput.appendChild(loader); termOutput.scrollTop = termOutput.scrollHeight;
    try { await gitClone(); } catch (err) { addTermLine('Clone failed: ' + (err.message || err), 'error'); } finally { if (loader.parentNode) loader.parentNode.removeChild(loader); }
  } else if (sub === 'commit') {
    const msgIndex = args.indexOf('-m');
    if (msgIndex === -1 || !args[msgIndex + 1]) return addTermLine('Usage: git commit -m "message"', 'error');
    document.getElementById('gitMessage').value = args.slice(msgIndex + 1).join(' ');
    addTermLine(`Committing...`, 'info'); await gitCommit();
  } else if (sub === 'push') {
    addTermLine('Pushing...', 'info'); await gitPush();
  } else {
    addTermLine('Unknown git command', 'error');
  }
}

async function gitClone() {
  const { url, token } = getRepoConfig();
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('Invalid GitHub URL');

  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  // 1. Get default branch
  const repoRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers });
  if (!repoRes.ok) throw new Error(`GitHub API: ${repoRes.status} ${repoRes.statusText}`);
  const repoData = await repoRes.json();
  const branch = repoData.default_branch || 'main';

  // 2. Get file tree
  const treeRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`, { headers });
  if (!treeRes.ok) throw new Error(`GitHub API: ${treeRes.status} ${treeRes.statusText}`);
  const treeData = await treeRes.json();
  const blobs = treeData.tree.filter(item => item.type === 'blob');

  // 3. Fetch file contents
  const newFiles = {};
  await Promise.all(blobs.map(async (blob) => {
    if (blob.size > 5000000) return; // Skip >5MB
    const contentRes = await fetch(blob.url, { headers });
    if (contentRes.ok) {
      const contentData = await contentRes.json();
      const base64 = contentData.content.replace(/\n/g, '');
      newFiles[blob.path] = decodeBase64(base64);
    }
  }));

  // 4. Update Editor
  if (editor) editor.setModel(null);
  filesList.length = 0;
  Object.keys(FILES).forEach(k => delete FILES[k]);
  Object.keys(models).forEach(k => { try { models[k].dispose(); } catch (e) {} delete models[k]; });
  Object.keys(savedSnapshot).forEach(k => delete savedSnapshot[k]);
  expandedFolders.clear(); foldersInitialized = false;

  Object.keys(newFiles).forEach(name => {
    FILES[name] = { lang: langFromFilename(name), content: newFiles[name] };
    filesList.push(name); ensureModel(name);
  });

  if (!filesList.length) filesList = ['index.html'];
  activeFile = filesList[0];
  renderTabs(); renderSidebarFiles(); switchFile(activeFile); saveNow();
  
  localStorage.setItem('idEditor.gitBranch', branch);
  localStorage.setItem('idEditor.gitOwner', parsed.owner);
  localStorage.setItem('idEditor.gitRepoName', parsed.repo);
  
  showToast('Cloned successfully!');
  updateGitStatus();
}

async function gitPush() {
  const { url, token } = getRepoConfig();
  const parsed = parseGitHubUrl(url);
  if (!parsed || !token) return showToast('Set repo URL and token in Git Settings');
  
  const branch = localStorage.getItem('idEditor.gitBranch') || 'main';
  const headers = { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${token}`, 'Content-Type': 'application/json' };

  try {
    // 1. Get latest commit
    let refRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${branch}`, { headers });
    if (!refRes.ok) throw new Error('Failed to fetch latest commit ref');
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get base tree
    const commitRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/commits/${latestCommitSha}`, { headers });
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Create new tree (blobs)
    const treeItems = [];
    for (const [path, model] of Object.entries(models)) {
      const content = model.getValue();
      const blobRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/blobs`, {
        method: 'POST', headers, body: JSON.stringify({ content, encoding: 'utf-8' })
      });
      if (!blobRes.ok) throw new Error('Failed to upload blob for ' + path);
      const blobData = await blobRes.json();
      treeItems.push({ path, mode: '100644', type: 'blob', sha: blobData.sha });
    }

    const newTreeRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees`, {
      method: 'POST', headers, body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
    });
    const newTreeData = await newTreeRes.json();

    // 4. Create new commit
    const msg = (document.getElementById('gitMessage').value || 'Update from IDEDITOR').trim();
    const newCommitRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/commits`, {
      method: 'POST', headers, body: JSON.stringify({ message: msg, tree: newTreeData.sha, parents: [latestCommitSha] })
    });
    const newCommitData = await newCommitRes.json();

    // 5. Update branch reference
    const updateRefRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/refs/heads/${branch}`, {
      method: 'PATCH', headers, body: JSON.stringify({ sha: newCommitData.sha, force: true })
    });
    if (!updateRefRes.ok) throw new Error('Failed to update branch');

    document.getElementById('gitMessage').value = '';
    showToast('Pushed successfully!');
    addTermLine('Push successful', 'success');
    updateGitStatus();

  } catch (e) {
    showToast('Push failed: ' + e.message);
    addTermLine('Push failed: ' + e.message, 'error');
  }
}

async function updateGitStatus() {
  const el = document.getElementById('gitStatus');
  const { url, token } = getRepoConfig();
  const parsed = parseGitHubUrl(url);
  if (!parsed) { el.textContent = 'Not connected'; return; }
  
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers });
    if (res.ok) el.textContent = `Connected: ${parsed.owner}/${parsed.repo}`;
    else el.textContent = 'Not connected (Invalid URL/Token)';
  } catch (e) { el.textContent = 'Not connected'; }
}

function wireGitUI() {
  document.getElementById('btnGitSettings').addEventListener('click', () => {
    const { url, token } = getRepoConfig();
    document.getElementById('gitRepoUrl').value = url;
    document.getElementById('gitToken').value = token;
    document.getElementById('gitSettingsModal').style.display = 'flex';
  });

  document.getElementById('btnGitSaveSettings').addEventListener('click', () => {
    const url = document.getElementById('gitRepoUrl').value.trim();
    const token = document.getElementById('gitToken').value.trim();
    localStorage.setItem(GIT_URL_KEY, url);
    localStorage.setItem(GIT_TOKEN_KEY, token);
    document.getElementById('gitSettingsModal').style.display = 'none';
    showToast('Git settings saved');
    updateGitStatus();
  });

  document.getElementById('btnGitCloseSettings').addEventListener('click', () => document.getElementById('gitSettingsModal').style.display = 'none');
  document.getElementById('btnGitCommit').addEventListener('click', gitPush); // Commit & Push combined for API
  document.getElementById('btnGitPush').addEventListener('click', gitPush);
  document.getElementById('btnGitPull').addEventListener('click', gitClone); // Pull is just a fresh clone
  
  document.getElementById('btnGitGraph').addEventListener('click', () => {
    document.getElementById('gitGraphContainer').style.display = 'block';
    renderGitGraph();
  });
  document.getElementById('btnGitCloseGraph').addEventListener('click', () => document.getElementById('gitGraphContainer').style.display = 'none');
  
  updateGitStatus();
}

async function renderGitGraph() {
  const svg = document.getElementById('gitGraphSvg'); svg.innerHTML = '';
  const { url, token } = getRepoConfig();
  const parsed = parseGitHubUrl(url);
  if (!parsed) return showToast('No repo configured');
  
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits`, { headers });
    const commits = await res.json();
    if (!commits.length) return;
    
    const rowH = 36, x = 40;
    svg.setAttribute('width', '100%'); svg.setAttribute('height', commits.length * rowH + 20); svg.style.background = 'var(--bg)';
    commits.forEach((c, i) => {
      const y = 20 + i * rowH;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', 6); circle.setAttribute('fill', '#0a84ff'); svg.appendChild(circle);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text'); text.setAttribute('x', x + 20); text.setAttribute('y', y + 4); text.setAttribute('fill', 'currentColor'); text.setAttribute('font-size', '12'); text.setAttribute('font-family', 'ui-monospace, monospace'); text.textContent = c.sha.slice(0, 7) + '  ' + c.commit.message.split('\n')[0].slice(0, 60); svg.appendChild(text);
    });
  } catch (e) { showToast('Failed to load graph'); }
}