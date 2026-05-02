/* ============================================================
   GABDRIVE — app.js  (v2 — drag, lasso, multi-select)
   ============================================================ */

// ── STATE ────────────────────────────────────────────────────
let files = [];
let trash = [];

let currentView = 'all';
let currentFolderId = null;
let currentLayout = 'grid';
let currentSort = 'date';
let currentFilter = 'all';
let selectedIds = new Set();
let ctxTargetId = null;
let renameTargetId = null;
let sortDir = -1;

// Lasso state
let lassoActive = false;
let lassoStart = { x: 0, y: 0 };

// Drag-to-move state
let dragSrcIds = [];
let dragGhost = null;

function save() {
  localforage.setItem('gabdrive_files', files);
  localforage.setItem('gabdrive_trash', trash);
}

// ── FILE UTILS ───────────────────────────────────────────────
function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    img: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif'],
    doc: ['pdf', 'doc', 'docx', 'txt', 'md', 'xls', 'xlsx', 'ppt', 'pptx', 'csv',
      'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'rb', 'go', 'rs', 'sh'],
    vid: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv', 'wmv'],
    aud: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'],
    zip: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  };
  for (const [t, exts] of Object.entries(map)) {
    if (exts.includes(ext)) return t;
  }
  return 'other';
}

function getFileEmoji(type, name) {
  const ext = name.split('.').pop().toLowerCase();
  const docEmojis = {
    pdf: '📑', doc: '📝', docx: '📝', txt: '📃', md: '📋',
    xls: '📊', xlsx: '📊', csv: '📊', ppt: '📊', pptx: '📊',
    json: '🔧', xml: '🔧', html: '🌐', css: '🎨',
    js: '⚡', ts: '⚡', py: '🐍', java: '☕',
    c: '⚙️', cpp: '⚙️', rb: '💎', go: '🐹', rs: '🦀', sh: '💻',
  };
  if (type === 'img') return '🖼️';
  if (type === 'vid') return '🎬';
  if (type === 'aud') return '🎵';
  if (type === 'zip') return '🗜️';
  if (type === 'doc') return docEmojis[ext] || '📄';
  return '📦';
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(2) + ' MB';
  return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}

function formatDate(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return Math.floor(diff / 60) + ' min';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 7 * 86400) return Math.floor(diff / 86400) + 'j';
  return new Date(ts).toLocaleDateString('fr-FR');
}

function totalSize() {
  return files.reduce((acc, f) => acc + (f.size || 0), 0);
}

// ── VIEWS ────────────────────────────────────────────────────
function setView(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  currentView = el.dataset.view;
  currentFolderId = null;
  clearSelection();
  renderFiles();
}

function setLayout(mode) {
  currentLayout = mode;
  document.getElementById('grid-btn').classList.toggle('active', mode === 'grid');
  document.getElementById('list-btn').classList.toggle('active', mode === 'list');
  renderFiles();
}

function setSortDir(key) {
  if (currentSort === key) sortDir *= -1;
  else { currentSort = key; sortDir = -1; }
  renderFiles();
}

function setFilter(btn, filter) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = filter;
  renderFiles();
}

function getFilteredFiles() {
  const q = document.getElementById('search-input').value.toLowerCase();
  let list = currentView === 'trash'
    ? [...trash]
    : files.filter(f => !f.trashed);

  if (currentView === 'recent') {
    list = list.filter(f => !f.folder).sort((a, b) => b.date - a.date).slice(0, 20);
  }
  else if (currentView === 'starred') list = list.filter(f => f.starred);
  else if (currentView === 'images') list = list.filter(f => f.type === 'img');
  else if (currentView === 'documents') list = list.filter(f => f.type === 'doc');
  else if (currentView === 'videos') list = list.filter(f => f.type === 'vid');
  else if (currentView === 'audio') list = list.filter(f => f.type === 'aud');
  else if (currentView === 'archives') list = list.filter(f => f.type === 'zip');

  if (currentFilter !== 'all' && currentView === 'all') {
    list = list.filter(f => currentFilter === 'folder' ? f.isFolder : f.type === currentFilter);
  }
  if (currentView === 'all') {
    list = list.filter(f => f.folder === (currentFolderId || undefined));
  }
  if (q) list = list.filter(f => f.name.toLowerCase().includes(q));

  if (currentView !== 'recent') {
    list.sort((a, b) => {
      let va, vb;
      if (currentSort === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (currentSort === 'size') { va = a.size || 0; vb = b.size || 0; }
      else { va = a.date; vb = b.date; }
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
    list.sort((a, b) => (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0));
  }
  return list;
}

function renderSidebarFolders() {
  const container = document.getElementById('sidebar-folders');
  if (!container) return;
  const folders = files.filter(f => f.isFolder && !f.trashed && !f.isExternal);
  container.innerHTML = folders.map(f => `
    <div class="nav-item ${currentFolderId === f.id ? 'active' : ''}" 
         onclick="openFolder('${f.id}')">
      <span class="icon">📁</span> ${f.name}
    </div>
  `).join('');
}

function openFolder(id) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const root = document.querySelector('.nav-item[data-view="all"]');
  if (root) root.classList.add('active');
  currentView = 'all';
  currentFolderId = id;
  clearSelection();
  renderFiles();
}

function backToRoot() {
  currentFolderId = null;
  clearSelection();
  renderFiles();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const root = document.querySelector('.nav-item[data-view="all"]');
  if (root) root.classList.add('active');
}

function goBack() {
  if (!currentFolderId) return;
  const f = files.find(x => x.id === currentFolderId);
  if (f && f.folder) {
    openFolder(f.folder);
  } else {
    backToRoot();
  }
}

// ── RENDER ───────────────────────────────────────────────────
function renderFiles() {
  updateBadges();
  updateStorage();
  renderSidebarFolders();
  const list = getFilteredFiles();
  const content = document.getElementById('content');
  const typeLabels = { all: 'Tout', img: 'Images', doc: 'Documents', vid: 'Vidéos', aud: 'Audio', zip: 'Archives', folder: 'Dossiers' };
  let html = '';

  if (currentView === 'all') {
    if (currentFolderId) {
      let bHtml = '';
      let f = files.find(x => x.id === currentFolderId);
      while(f) {
        bHtml = ` &nbsp;/&nbsp; <span class="breadcrumb-link" onclick="openFolder('${f.id}')">${f.name}</span>` + bHtml;
        f = f.folder ? files.find(x => x.id === f.folder) : null;
      }
      html += `<div class="breadcrumb" style="margin-bottom:20px; display:flex; align-items:center; gap:10px;">
        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" onclick="goBack()">⬅ Retour</button>
        <div><span onclick="backToRoot()" class="breadcrumb-link" style="cursor:pointer">🏠 Tout</span> ${bHtml}</div>
      </div>`;
    } else {
      const total = files.filter(f => !f.trashed && !f.isFolder).length;
      const imgs = files.filter(f => !f.trashed && f.type === 'img').length;
      const docs = files.filter(f => !f.trashed && f.type === 'doc').length;
      html += `<div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Fichiers</div><div class="stat-value">${total}</div><div class="stat-sub">stockés</div></div>
        <div class="stat-card"><div class="stat-label">Images</div><div class="stat-value">${imgs}</div><div class="stat-sub">photos & visuels</div></div>
        <div class="stat-card"><div class="stat-label">Documents</div><div class="stat-value">${docs}</div><div class="stat-sub">fichiers texte</div></div>
        <div class="stat-card"><div class="stat-label">Taille totale</div><div class="stat-value" style="font-size:18px">${formatSize(totalSize())}</div><div class="stat-sub">utilisé</div></div>
      </div>`;
    }
  }

  if (currentView !== 'trash') {
    html += `<div class="upload-zone" onclick="document.getElementById('file-input').click()">
      <div class="upload-zone-icon">☁️</div>
      <h3>Glissez-déposez vos fichiers ici</h3>
      <p>ou cliquez pour sélectionner — tous types acceptés</p>
    </div>`;
  }

  const si = k => currentSort === k ? (sortDir === -1 ? ' ↓' : ' ↑') : '';
  html += `<div class="sort-bar">
    <span class="sort-label">Trier par</span>
    <button class="sort-btn ${currentSort === 'date' ? 'active' : ''}" onclick="setSortDir('date')">📅 Date${si('date')}</button>
    <button class="sort-btn ${currentSort === 'name' ? 'active' : ''}" onclick="setSortDir('name')">🔤 Nom${si('name')}</button>
    <button class="sort-btn ${currentSort === 'size' ? 'active' : ''}" onclick="setSortDir('size')">📏 Taille${si('size')}</button>
    <div class="filter-chips">
      ${['all', 'folder', 'img', 'doc', 'vid', 'aud', 'zip'].map(t => `
        <button class="chip ${currentFilter === t && currentView === 'all' ? 'active' : ''}"
          onclick="setFilter(this,'${t}')">${typeLabels[t]}</button>
      `).join('')}
    </div>
  </div>`;

  if (list.length === 0) {
    html += `<div class="empty-state">
      <div class="big-icon">${currentView === 'trash' ? '🗑️' : '📭'}</div>
      <h3>${currentView === 'trash' ? 'Corbeille vide' : 'Aucun fichier ici'}</h3>
      <p>${currentView === 'trash' ? 'Les fichiers supprimés apparaissent ici.' : 'Importez des fichiers pour commencer.'}</p>
    </div>`;

  } else if (currentLayout === 'grid') {
    html += `<div class="files-grid" id="files-container">`;
    list.forEach((f, i) => {
      const sel = selectedIds.has(f.id) ? 'selected' : '';
      const tc = f.isFolder ? 'type-folder' : `type-${f.type}`;
      const emoji = f.isFolder ? '📁' : getFileEmoji(f.type, f.name);
      const folderAttr = f.isFolder
        ? `ondragover="onFolderDragOver(event,'${f.id}')" ondragleave="onFolderDragLeave(event)" ondrop="onFolderDrop(event,'${f.id}')"` : '';
      html += `<div class="file-card ${sel}" id="fc-${f.id}" data-id="${f.id}"
          style="animation-delay:${i * 20}ms" draggable="true"
          onclick="handleCardClick(event,'${f.id}')"
          ondblclick="${f.isFolder ? `openFolder('${f.id}')` : `openFile('${f.id}')`}"
          oncontextmenu="openCtx(event,'${f.id}')"
          ondragstart="onItemDragStart(event,'${f.id}')"
          ondragend="onItemDragEnd(event)"
          ${folderAttr}>
        <div class="file-card-check" onclick="toggleSelectOnly(event,'${f.id}')">✓</div>
        <div class="file-icon ${tc}">${f.starred ? '⭐' : emoji}</div>
        <div class="file-name" title="${f.name}">${f.name}</div>
        <div class="file-meta">${formatDate(f.date)}${f.size ? ' · ' + formatSize(f.size) : ''}${f.folder ? ' · 📁' : ''}</div>
      </div>`;
    });
    html += `</div>`;

  } else {
    const tagLabel = { img: 'Image', doc: 'Document', vid: 'Vidéo', aud: 'Audio', zip: 'Archive', other: 'Fichier' };
    html += `<div class="files-list" id="files-container">`;
    list.forEach((f, i) => {
      const sel = selectedIds.has(f.id) ? 'selected' : '';
      const tc = f.isFolder ? 'type-folder' : `type-${f.type}`;
      const emoji = f.isFolder ? '📁' : getFileEmoji(f.type, f.name);
      const tagClass = f.isFolder ? 'tag-other' : `tag-${f.type}`;
      const label = f.isFolder ? 'Dossier' : (tagLabel[f.type] || 'Fichier');
      const folderAttr = f.isFolder
        ? `ondragover="onFolderDragOver(event,'${f.id}')" ondragleave="onFolderDragLeave(event)" ondrop="onFolderDrop(event,'${f.id}')"` : '';
      html += `<div class="file-list-item ${sel}" id="fl-${f.id}" data-id="${f.id}"
          style="animation-delay:${i * 10}ms" draggable="true"
          onclick="handleCardClick(event,'${f.id}')"
          ondblclick="${f.isFolder ? `openFolder('${f.id}')` : `openFile('${f.id}')`}"
          oncontextmenu="openCtx(event,'${f.id}')"
          ondragstart="onItemDragStart(event,'${f.id}')"
          ondragend="onItemDragEnd(event)"
          ${folderAttr}>
        <div class="file-list-icon ${tc}">${f.starred ? '⭐' : emoji}</div>
        <div class="file-list-name">${f.name}</div>
        <span class="tag ${tagClass}">${label}</span>
        <div class="file-list-meta"><span>${formatDate(f.date)}</span><span>${formatSize(f.size || 0)}</span></div>
        <div class="file-list-actions">
          <button class="icon-btn"        onclick="downloadFile(event,'${f.id}')" title="Télécharger">⬇</button>
          <button class="icon-btn"        onclick="starFile(event,'${f.id}')"     title="Favori">⭐</button>
          <button class="icon-btn danger" onclick="deleteFile(event,'${f.id}')"   title="Supprimer">🗑️</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  if (currentView === 'trash' && trash.length > 0) {
    html += `<div style="text-align:center;margin-top:24px">
      <button class="btn btn-secondary" onclick="emptyTrash()" style="color:var(--danger)">
        🗑️ Vider la corbeille (${trash.length} fichier${trash.length > 1 ? 's' : ''})
      </button>
    </div>`;
  }

  content.innerHTML = html;
  bindLasso();
}

function updateBadges() {
  const a = files.filter(f => !f.trashed);
  document.getElementById('badge-all').textContent = a.length;
  document.getElementById('badge-recent').textContent = Math.min(20, a.length);
  document.getElementById('badge-starred').textContent = a.filter(f => f.starred).length;
  document.getElementById('badge-trash').textContent = trash.length;
  document.getElementById('badge-images').textContent = a.filter(f => f.type === 'img').length;
  document.getElementById('badge-documents').textContent = a.filter(f => f.type === 'doc').length;
  document.getElementById('badge-videos').textContent = a.filter(f => f.type === 'vid').length;
  document.getElementById('badge-audio').textContent = a.filter(f => f.type === 'aud').length;
  document.getElementById('badge-archives').textContent = a.filter(f => f.type === 'zip').length;
}

function updateStorage() {
  const used = totalSize();
  const pct = Math.min(100, (used / (5 * 1024 ** 3)) * 100);
  document.getElementById('storage-fill').style.width = pct + '%';
  document.getElementById('storage-text').textContent = formatSize(used) + ' / 5 GB';
}

// ── CLICK & SELECTION ────────────────────────────────────────
let lastClickedId = null;

function handleCardClick(e, id) {
  if (e.target.closest('.file-list-actions') || e.target.closest('.icon-btn') || e.target.closest('.file-card-check')) return;

  if (e.ctrlKey || e.metaKey) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    lastClickedId = id;
  } else if (e.shiftKey && lastClickedId) {
    const list = getFilteredFiles().map(f => f.id);
    const a = list.indexOf(lastClickedId);
    const b = list.indexOf(id);
    const [from, to] = a < b ? [a, b] : [b, a];
    list.slice(from, to + 1).forEach(fid => selectedIds.add(fid));
  } else {
    // If not holding any modifiers, and clicking something NOT selected, select ONLY that item.
    // If clicking something ALREADY selected, we do nothing (so drag works without unselecting everything).
    // The actual "unselect everything else" when clicking an already-selected item normally happens on mouseup if not drag, but for simplicity here we just keep it selected.
    if (!selectedIds.has(id)) {
      selectedIds.clear();
      selectedIds.add(id);
    }
    lastClickedId = id;
  }
  updateSelectionBar();
  renderFiles();
}

function toggleSelectOnly(e, id) {
  e.stopPropagation();
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  lastClickedId = id;
  updateSelectionBar();
  renderFiles();
}

function clearSelection() {
  selectedIds.clear();
  lastClickedId = null;
  updateSelectionBar();
  renderFiles();
}

function updateSelectionBar() {
  const bar = document.getElementById('selection-bar');
  document.getElementById('sel-count').textContent = selectedIds.size;

  const btnStar = document.getElementById('btn-star-sel');
  if (btnStar) {
    const allStarred = [...selectedIds].every(id => {
      const f = files.find(x => x.id === id);
      return f && f.starred;
    });
    if (allStarred && selectedIds.size > 0) {
      btnStar.innerHTML = "☆ Retirer favoris";
      btnStar.dataset.action = "unstar";
    } else {
      btnStar.innerHTML = "⭐ Favori";
      btnStar.dataset.action = "star";
    }
  }

  bar.classList.toggle('show', selectedIds.size > 0);
}

// ── LASSO SELECTION ──────────────────────────────────────────
function bindLasso() {
  const container = document.getElementById('files-container');
  if (!container) return;
  const lasso = document.getElementById('lasso-box');

  container.addEventListener('mousedown', (e) => {
    if (e.target !== container) return;
    if (e.button !== 0) return;
    lassoActive = true;
    lassoStart = { x: e.clientX, y: e.clientY };
    lasso.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:0;height:0;display:block`;
    if (!e.ctrlKey && !e.metaKey) { selectedIds.clear(); updateSelectionBar(); }
  });
}

document.addEventListener('mousemove', (e) => {
  if (!lassoActive) return;
  const lasso = document.getElementById('lasso-box');
  const x = Math.min(e.clientX, lassoStart.x);
  const y = Math.min(e.clientY, lassoStart.y);
  const w = Math.abs(e.clientX - lassoStart.x);
  const h = Math.abs(e.clientY - lassoStart.y);
  lasso.style.left = x + 'px';
  lasso.style.top = y + 'px';
  lasso.style.width = w + 'px';
  lasso.style.height = h + 'px';

  const lr = lasso.getBoundingClientRect();
  document.querySelectorAll('[data-id]').forEach(el => {
    const r = el.getBoundingClientRect();
    const hit = !(r.right < lr.left || r.left > lr.right || r.bottom < lr.top || r.top > lr.bottom);
    if (hit) selectedIds.add(el.dataset.id);
    else if (!e.ctrlKey && !e.metaKey) selectedIds.delete(el.dataset.id);
    el.classList.toggle('selected', selectedIds.has(el.dataset.id));
  });
  updateSelectionBar();
});

document.addEventListener('mouseup', () => {
  if (!lassoActive) return;
  lassoActive = false;
  document.getElementById('lasso-box').style.display = 'none';
  if (selectedIds.size > 0) renderFiles();
});

// ── DRAG TO MOVE ─────────────────────────────────────────────
function onItemDragStart(e, id) {
  if (!selectedIds.has(id)) { selectedIds.clear(); selectedIds.add(id); updateSelectionBar(); }
  dragSrcIds = [...selectedIds];

  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  const name = files.find(f => f.id === id)?.name || 'fichier';
  dragGhost.innerHTML = `<span>${dragSrcIds.length > 1 ? dragSrcIds.length + ' fichiers' : name}</span>`;
  document.body.appendChild(dragGhost);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setDragImage(dragGhost, 20, 20);

  dragSrcIds.forEach(fid => {
    const el = document.querySelector(`[data-id="${fid}"]`);
    if (el) el.classList.add('dragging');
  });
}

function onItemDragEnd() {
  if (dragGhost) { dragGhost.remove(); dragGhost = null; }
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  dragSrcIds = [];
}

function onFolderDragOver(e, folderId) {
  if (dragSrcIds.includes(folderId)) return;
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  const el = document.querySelector(`[data-id="${folderId}"]`);
  if (el) el.classList.add('drop-target');
}

function onFolderDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drop-target');
  }
}

function onFolderDrop(e, folderId) {
  e.preventDefault(); e.stopPropagation();
  const folder = files.find(f => f.id === folderId && f.isFolder);
  if (!folder) return;
  const moved = dragSrcIds.filter(id => id !== folderId);
  moved.forEach(id => { const f = files.find(x => x.id === id); if (f) f.folder = folderId; });
  save(); clearSelection();
  showToast(`📁 ${moved.length} fichier(s) dans "${folder.name}"`, 'success');
}

function moveToFolder(e, folderId) {
  e.stopPropagation();
  document.getElementById('ctx-menu').classList.remove('show');
  const ids = selectedIds.size > 0 ? [...selectedIds] : ctxTargetId ? [ctxTargetId] : [];
  const folder = files.find(f => f.id === folderId);
  if (!folder) return;
  ids.forEach(id => { const f = files.find(x => x.id === id); if (f && !f.isFolder) f.folder = folderId; });
  save(); clearSelection();
  showToast(`📁 Déplacé dans "${folder.name}"`, 'success');
}

function removeFromFolder(id) {
  const f = files.find(x => x.id === id);
  if (f) { delete f.folder; save(); renderFiles(); showToast('📤 Sorti du dossier', 'success'); }
}

// ── EXTERNAL DRAG & DROP ─────────────────────────────────────
function handleFileInput(filesInput) {
  if (filesInput.length) {
    const list = Array.from(filesInput).map(f => ({ file: f, folderId: currentFolderId || undefined }));
    importFileObjects(list);
  }
}

function importFileObjects(fileObjList) {
  const progress = document.getElementById('upload-progress');
  const fill = document.getElementById('progress-fill');
  const title = document.getElementById('progress-title');
  progress.classList.add('show');
  title.textContent = "Importation en cours...";

  let loaded = 0;
  const total = fileObjList.length;

  if (total === 0) {
    progress.classList.remove('show');
    return;
  }

  fileObjList.forEach((obj, i) => {
    const f = obj.file;
    const reader = new FileReader();
    reader.onload = e => {
      files.push({
        id: 'file_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 7),
        name: f.name,
        size: f.size,
        type: getFileType(f.name),
        date: Date.now(),
        starred: false,
        trashed: false,
        isFolder: false,
        folder: obj.folderId,
        data: e.target.result
      });
      loaded++;
      fill.style.width = (loaded / total * 100) + '%';
      if (loaded === total) {
        setTimeout(() => {
          progress.classList.remove('show');
          save();
          renderFiles();
          showToast(`✅ ${total} fichier(s) importé(s)`, 'success');
        }, 500);
      }
    };
    reader.onerror = () => {
      loaded++;
      if (loaded === total) { progress.classList.remove('show'); renderFiles(); }
    };
    reader.readAsDataURL(f);
  });
}

function importFiles(fileList) {
  const list = fileList.map(f => ({ file: f, folderId: currentFolderId || undefined }));
  importFileObjects(list);
}

let extDragCounter = 0;
document.addEventListener('dragenter', (e) => {
  if (dragSrcIds.length) return;
  e.preventDefault(); extDragCounter++;
  document.getElementById('drop-overlay').classList.add('active');
});
document.addEventListener('dragleave', () => {
  if (dragSrcIds.length) return;
  if (--extDragCounter <= 0) { extDragCounter = 0; document.getElementById('drop-overlay').classList.remove('active'); }
});
document.addEventListener('dragover', (e) => e.preventDefault());

async function traverseFileTree(item, parentId, allFiles) {
  if (item.isFile) {
    const file = await new Promise(resolve => item.file(resolve));
    allFiles.push({ file, folderId: parentId });
  } else if (item.isDirectory) {
    const newFolderId = 'folder_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    files.push({
      id: newFolderId,
      name: item.name,
      size: 0,
      type: 'other',
      date: Date.now(),
      starred: false,
      trashed: false,
      isFolder: true,
      isExternal: true,
      folder: parentId
    });

    const dirReader = item.createReader();
    const entries = await new Promise(resolve => {
      let results = [];
      const readEntries = () => {
        dirReader.readEntries(res => {
          if (!res.length) resolve(results);
          else { results.push(...res); readEntries(); }
        });
      };
      readEntries();
    });

    for (const en of entries) {
      await traverseFileTree(en, newFolderId, allFiles);
    }
  }
}

document.addEventListener('drop', async (e) => {
  extDragCounter = 0;
  document.getElementById('drop-overlay').classList.remove('active');
  if (dragSrcIds.length) return;
  e.preventDefault();

  if (e.dataTransfer.items) {
    const items = e.dataTransfer.items;
    const allFiles = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry();
      if (item) {
        await traverseFileTree(item, currentFolderId || undefined, allFiles);
      }
    }
    save();
    renderFiles();
    if (allFiles.length > 0) importFileObjects(allFiles);
  } else {
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) importFiles(dropped);
  }
});

// ── CONTEXT MENU ─────────────────────────────────────────────
function openCtx(e, id) {
  e.preventDefault();
  ctxTargetId = id;
  if (!selectedIds.has(id)) { selectedIds.clear(); selectedIds.add(id); updateSelectionBar(); renderFiles(); }

  const targetFile = files.find(f => f.id === id);
  const folders = files.filter(f => f.isFolder && !f.trashed && f.id !== id);
  const folderItems = folders.length
    ? `<div class="ctx-divider"></div><div class="ctx-sub-label">Déplacer vers</div>${folders.map(fd => `<div class="ctx-item" onclick="moveToFolder(event,'${fd.id}')">📁 ${fd.name}</div>`).join('')}`
    : '';

  document.getElementById('ctx-menu-inner').innerHTML = `
    <div class="ctx-item" onclick="ctxAction('download')">⬇ Télécharger la sélection</div>
    <div class="ctx-item" onclick="ctxAction('rename')">✏️ Renommer</div>
    <div class="ctx-item" onclick="ctxAction('star')">⭐ ${targetFile?.starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}</div>
    ${targetFile?.folder ? `<div class="ctx-item" onclick="removeFromFolder('${id}')">📤 Sortir du dossier</div>` : ''}
    ${folderItems}
    <div class="ctx-divider"></div>
    <div class="ctx-item" onclick="ctxAction('export-sel')">📤 Exporter la sélection</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item danger" onclick="ctxAction('delete')">🗑️ Supprimer</div>`;

  const menu = document.getElementById('ctx-menu');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 210) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 260) + 'px';
  menu.classList.add('show');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#ctx-menu')) document.getElementById('ctx-menu').classList.remove('show');
});

function ctxAction(action) {
  document.getElementById('ctx-menu').classList.remove('show');
  const ids = [...selectedIds];
  if (action === 'download') ids.forEach(id => downloadFileById(id));
  if (action === 'rename') openRenameModal(ctxTargetId);
  if (action === 'delete') { ids.forEach(id => moveToTrash(id)); clearSelection(); renderFiles(); }
  if (action === 'export-sel') exportSelected();
  if (action === 'star') { ids.forEach(id => { const f = files.find(x => x.id === id); if (f) f.starred = !f.starred; }); save(); renderFiles(); showToast('⭐ Favoris mis à jour', 'success'); }
}

// ── FILE ACTIONS ─────────────────────────────────────────────
function moveToTrash(id) {
  const idx = files.findIndex(f => f.id === id);
  if (idx === -1) return;
  const [f] = files.splice(idx, 1);
  f.trashed = true; trash.push(f); save();
  selectedIds.delete(id); updateSelectionBar();
}

function emptyTrash() {
  if (!confirm(`Vider la corbeille (${trash.length} fichier${trash.length > 1 ? 's' : ''}) ? Action irréversible.`)) return;
  trash = []; save(); renderFiles(); showToast('🗑️ Corbeille vidée', 'success');
}

function downloadFile(e, id) { e.stopPropagation(); downloadFileById(id); }
function starFile(e, id) { e.stopPropagation(); const f = files.find(x => x.id === id); if (!f) return; f.starred = !f.starred; save(); renderFiles(); showToast(f.starred ? '⭐ Favori ajouté' : 'Favori retiré', 'success'); }
function deleteFile(e, id) { e.stopPropagation(); moveToTrash(id); renderFiles(); showToast('🗑️ Déplacé dans la corbeille', ''); }

async function downloadFileById(id) {
  const f = files.find(x => x.id === id) || trash.find(x => x.id === id);
  if (!f) return;

  if (f.isFolder) {
    if (typeof JSZip === 'undefined') {
      showToast('Le téléchargement de dossiers nécessite JSZip', 'error');
      return;
    }
    showToast('📦 Préparation de l\'archive...', '');
    const zip = new JSZip();

    function addFolderToZip(currentZip, folderId) {
      const children = files.filter(x => !x.trashed && x.folder === folderId);
      children.forEach(child => {
        if (child.isFolder) {
          const subZip = currentZip.folder(child.name);
          addFolderToZip(subZip, child.id);
        } else if (child.data) {
          const base64Data = child.data.split(',')[1];
          if (base64Data) {
            currentZip.file(child.name, base64Data, {base64: true});
          }
        }
      });
    }

    addFolderToZip(zip, f.id);
    
    try {
      const content = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(content);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = f.name + '.zip'; 
      a.click();
      URL.revokeObjectURL(url);
      showToast('⬇ Téléchargement démarré', 'success');
    } catch (e) {
      showToast('Erreur lors de la création du ZIP', 'error');
    }
    return;
  }

  // Standard file download
  if (!f.data) { showToast('Téléchargement indisponible', 'error'); return; }
  const a = document.createElement('a'); a.href = f.data; a.download = f.name; a.click();
  showToast('⬇ Téléchargement démarré', 'success');
}

function deleteSelected() { [...selectedIds].forEach(id => moveToTrash(id)); clearSelection(); renderFiles(); }
function downloadSelected() { [...selectedIds].forEach(id => downloadFileById(id)); clearSelection(); }
function starSelected() {
  const btnStar = document.getElementById('btn-star-sel');
  const action = btnStar ? btnStar.dataset.action : 'star';
  const makeStar = action !== 'unstar';

  [...selectedIds].forEach(id => {
    const f = files.find(x => x.id === id);
    if (f) f.starred = makeStar;
  });
  save();
  clearSelection();
  renderFiles();
  showToast(makeStar ? '⭐ Ajoutés aux favoris' : '☆ Retirés des favoris', 'success');
}

// ── PREVIEW / OPEN FILE ──────────────────────────────────────
function openFile(id) {
  const f = files.find(x => x.id === id);
  if (!f || !f.data) return;
  document.getElementById('preview-title').textContent = f.name;
  const content = document.getElementById('preview-content');
  content.innerHTML = '';
  
  if (f.type === 'img') {
    content.innerHTML = `<img src="${f.data}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
  } else if (f.type === 'vid') {
    content.innerHTML = `<video src="${f.data}" controls style="max-width: 100%; max-height: 100%; outline: none;" autoplay></video>`;
  } else if (f.type === 'aud') {
    content.innerHTML = `<audio src="${f.data}" controls style="width: 80%; outline: none;" autoplay></audio>`;
  } else if (f.type === 'doc' && f.name.toLowerCase().endsWith('.pdf')) {
    content.innerHTML = `<iframe src="${f.data}" style="width: 100%; height: 100%; border: none;"></iframe>`;
  } else {
    // Attempt decoding text
    if (['txt', 'md', 'css', 'js', 'json', 'html', 'xml', 'csv', 'py', 'java', 'c', 'cpp'].some(ext => f.name.toLowerCase().endsWith('.'+ext))) {
       try {
         const base64Data = f.data.split(',')[1];
         const text = decodeURIComponent(escape(atob(base64Data)));
         content.innerHTML = `<pre style="width: 100%; height: 100%; margin: 0; padding: 15px; background: #1e1e2e; color: #cdd6f4; overflow: auto; text-align: left; box-sizing: border-box;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
       } catch (e) {
         content.innerHTML = `<div style="text-align:center; color: #a6adc8;"><div style="font-size: 40px; margin-bottom: 20px;">📄</div><p>Aperçu indisponible</p><button class="btn btn-primary" onclick="downloadFileById('${f.id}')">Télécharger</button></div>`;
       }
    } else {
      content.innerHTML = `<div style="text-align:center; color: #a6adc8;"><div style="font-size: 40px; margin-bottom: 20px;">📦</div><p>Aperçu indisponible pour ce format</p><button class="btn btn-primary" style="margin-top:20px;" onclick="downloadFileById('${f.id}')">Télécharger</button></div>`;
    }
  }
  document.getElementById('modal-preview').classList.add('show');
}

// ── FOLDER ───────────────────────────────────────────────────
function openFolderModal() {
  document.getElementById('folder-name').value = '';
  document.getElementById('modal-folder').classList.add('show');
  setTimeout(() => document.getElementById('folder-name').focus(), 100);
}
function createFolder() {
  const name = document.getElementById('folder-name').value.trim();
  if (!name) return;
  files.push({ id: 'folder_' + Date.now(), name, size: 0, type: 'other', date: Date.now(), starred: false, trashed: false, isFolder: true });
  save(); closeModal('modal-folder'); renderFiles(); showToast('📁 Dossier créé', 'success');
}

// ── RENAME ───────────────────────────────────────────────────
function openRenameModal(id) {
  renameTargetId = id;
  const f = files.find(x => x.id === id) || trash.find(x => x.id === id);
  if (!f) return;
  document.getElementById('rename-input').value = f.name;
  document.getElementById('modal-rename').classList.add('show');
  setTimeout(() => document.getElementById('rename-input').focus(), 100);
}
function doRename() {
  const name = document.getElementById('rename-input').value.trim();
  if (!name) return;
  const f = files.find(x => x.id === renameTargetId) || trash.find(x => x.id === renameTargetId);
  if (f) { f.name = name; save(); renderFiles(); showToast('✏️ Renommé', 'success'); }
  closeModal('modal-rename');
}

// ── MODALS ───────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-bg').forEach(bg => {
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('show'); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { document.querySelectorAll('.modal-bg').forEach(m => m.classList.remove('show')); clearSelection(); }
  if (e.key === 'Delete' && selectedIds.size) deleteSelected();
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); getFilteredFiles().forEach(f => selectedIds.add(f.id)); updateSelectionBar(); renderFiles(); }
});
document.getElementById('folder-name').addEventListener('keydown', e => { if (e.key === 'Enter') createFolder(); });
document.getElementById('rename-input').addEventListener('keydown', e => { if (e.key === 'Enter') doRename(); });

// ── TOAST ────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── EXPORT / IMPORT ──────────────────────────────────────────
function exportVault() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), files, trash };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `gabdrive_backup_${new Date().toISOString().slice(0, 10)}.gabdrive`; a.click();
  URL.revokeObjectURL(url); showToast('📦 Drive exporté', 'success');
}

function exportSelected() {
  const ids = selectedIds.size > 0 ? [...selectedIds] : files.filter(f => !f.trashed).map(f => f.id);
  const list = ids.map(id => files.find(f => f.id === id)).filter(Boolean);
  if (!list.length) { showToast('Aucun fichier à exporter', 'error'); return; }
  list.forEach((f, i) => {
    if (!f.data) return;
    setTimeout(() => { const a = document.createElement('a'); a.href = f.data; a.download = f.name; a.click(); }, i * 300);
  });
  showToast(`⬇ ${list.length} fichier(s) téléchargé(s)`, 'success');
  clearSelection();
}

function importVault(fileList) {
  const file = fileList[0]; if (!file) return;
  document.getElementById('import-vault-input').value = '';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const payload = JSON.parse(e.target.result);
      if (!payload.version || !Array.isArray(payload.files)) { showToast('❌ Fichier invalide', 'error'); return; }
      const existingIds = new Set([...files, ...trash].map(f => f.id));
      let af = 0, at = 0;
      payload.files.forEach(f => { if (!existingIds.has(f.id)) { files.push(f); existingIds.add(f.id); af++; } });
      (payload.trash || []).forEach(f => { if (!existingIds.has(f.id)) { trash.push(f); existingIds.add(f.id); at++; } });
      save(); renderFiles(); showToast(`✅ ${af} fichier(s) restauré(s)${at ? ` + ${at} en corbeille` : ''}`, 'success');
    } catch { showToast('❌ Erreur de lecture', 'error'); }
  };
  reader.readAsText(file);
}

// ── INIT ─────────────────────────────────────────────────────
const DEMO_IDS = new Set(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9']);

async function initData() {
  try {
    let savedFiles = await localforage.getItem('gabdrive_files') || await localforage.getItem('vaultdrop_files');
    let savedTrash = await localforage.getItem('gabdrive_trash') || await localforage.getItem('vaultdrop_trash');

    // Migration de localStorage vers localForage si nécessaire
    if (!savedFiles) {
      const lsFiles = localStorage.getItem('gabdrive_files') || localStorage.getItem('vaultdrop_files');
      if (lsFiles) {
        savedFiles = JSON.parse(lsFiles);
        localStorage.removeItem('vaultdrop_files');
        localStorage.removeItem('gabdrive_files');
      }
    }
    if (!savedTrash) {
      const lsTrash = localStorage.getItem('gabdrive_trash') || localStorage.getItem('vaultdrop_trash');
      if (lsTrash) {
        savedTrash = JSON.parse(lsTrash);
        localStorage.removeItem('vaultdrop_trash');
        localStorage.removeItem('gabdrive_trash');
      }
    }

    files = savedFiles || [];
    trash = savedTrash || [];

    files = files.filter(f => !DEMO_IDS.has(f.id));
    save();
    renderFiles();
  } catch (err) {
    console.error('Erreur chargement localForage:', err);
    showToast('Erreur chargement de la base de données', 'error');
  }
}

initData();