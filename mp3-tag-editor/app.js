// MP3 ID3 tag editor (client-side)
// - Read tags via jsmediatags
// - Write tags via browser-id3-writer

/* global window, document, jsmediatags */

const ID3Writer = window.ID3Writer;

/** @typedef {{
 *  id: string,
 *  file: File,
 *  buf: ArrayBuffer,
 *  selected: boolean,
 *  tags: { title: string, artist: string, album: string, track: string, year: string, genre: string }
 * }} Item */

/** @type {Item[]} */
let items = [];

const el = {
  fileInput: document.getElementById('fileInput'),
  clearBtn: document.getElementById('clearBtn'),
  status: document.getElementById('status'),
  tableBody: document.getElementById('tableBody'),
  headerSelect: document.getElementById('headerSelect'),
  downloadSelectedBtn: document.getElementById('downloadSelectedBtn'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
  applyBulkBtn: document.getElementById('applyBulkBtn'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  deselectAllBtn: document.getElementById('deselectAllBtn'),
  bulkArtist: document.getElementById('bulkArtist'),
  bulkAlbum: document.getElementById('bulkAlbum'),
  bulkYear: document.getElementById('bulkYear'),
};

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = i === 0 ? 0 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

function setStatus(type, message) {
  if (!message) {
    el.status.innerHTML = '';
    return;
  }
  const cls = type === 'error' ? 'alert-danger'
    : type === 'warn' ? 'alert-warning'
      : 'alert-info';
  el.status.innerHTML = `<div class="alert ${cls} py-2 mb-0">${escapeHtml(message)}</div>`;
}

function anySelected() {
  return items.some(x => x.selected);
}

function updateButtons() {
  const has = items.length > 0;
  el.clearBtn.disabled = !has;
  el.downloadAllBtn.disabled = !has;
  el.downloadSelectedBtn.disabled = !has || !anySelected();
  el.applyBulkBtn.disabled = !has || !anySelected();
  el.selectAllBtn.disabled = !has;
  el.deselectAllBtn.disabled = !has;
  el.headerSelect.disabled = !has;
  if (has) {
    const all = items.every(x => x.selected);
    const some = items.some(x => x.selected);
    el.headerSelect.indeterminate = some && !all;
    el.headerSelect.checked = all;
  } else {
    el.headerSelect.indeterminate = false;
    el.headerSelect.checked = false;
  }
}

function render() {
  if (items.length === 0) {
    el.tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-secondary">MP3を選択するとここに一覧表示されます。</td>
      </tr>`;
    updateButtons();
    return;
  }

  el.tableBody.innerHTML = items.map((it, idx) => {
    const t = it.tags;
    return `
      <tr data-idx="${idx}">
        <td>
          <input type="checkbox" class="form-check-input row-select" ${it.selected ? 'checked' : ''}>
        </td>
        <td>
          <div class="file-meta">
            <div class="name">${escapeHtml(it.file.name)}</div>
            <div class="sub">${escapeHtml(fmtBytes(it.file.size))}</div>
          </div>
        </td>
        <td><input class="form-control form-control-sm tag-input" data-field="title" value="${escapeHtml(t.title)}"></td>
        <td><input class="form-control form-control-sm tag-input" data-field="artist" value="${escapeHtml(t.artist)}"></td>
        <td><input class="form-control form-control-sm tag-input" data-field="album" value="${escapeHtml(t.album)}"></td>
        <td><input class="form-control form-control-sm tag-input" data-field="track" inputmode="numeric" value="${escapeHtml(t.track)}"></td>
        <td><input class="form-control form-control-sm tag-input" data-field="year" inputmode="numeric" value="${escapeHtml(t.year)}"></td>
        <td><input class="form-control form-control-sm tag-input" data-field="genre" value="${escapeHtml(t.genre)}"></td>
      </tr>`;
  }).join('');

  updateButtons();
}

function normalizeText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return String(v[0] ?? '');
  return String(v);
}

function readTags(file) {
  return new Promise((resolve) => {
    try {
      jsmediatags.read(file, {
        onSuccess: (result) => {
          const tag = result.tags || {};
          resolve({
            title: normalizeText(tag.title),
            artist: normalizeText(tag.artist),
            album: normalizeText(tag.album),
            track: normalizeText(tag.track),
            year: normalizeText(tag.year),
            genre: normalizeText(tag.genre),
          });
        },
        onError: () => {
          // Read failure: allow editing from blank.
          resolve({ title: '', artist: '', album: '', track: '', year: '', genre: '' });
        }
      });
    } catch (_) {
      resolve({ title: '', artist: '', album: '', track: '', year: '', genre: '' });
    }
  });
}

function uniqueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function handleFiles(fileList) {
  const files = Array.from(fileList || []).filter(f => {
    const n = (f.name || '').toLowerCase();
    return n.endsWith('.mp3') || f.type === 'audio/mpeg';
  });

  if (files.length === 0) {
    setStatus('warn', 'MP3ファイルが選択されていません。');
    return;
  }

  setStatus('info', `読み込み中…（${files.length}件）`);

  const newItems = [];
  for (const f of files) {
    const [buf, tags] = await Promise.all([
      f.arrayBuffer(),
      readTags(f),
    ]);
    newItems.push({
      id: uniqueId(),
      file: f,
      buf,
      selected: true,
      tags,
    });
  }

  items = newItems;
  setStatus('', '');
  render();
}

function setFrameSafe(writer, frameId, value) {
  const v = (value ?? '').toString().trim();
  if (v === '') return;
  writer.setFrame(frameId, v);
}

function writeAndDownload(item) {
  const writer = new ID3Writer(item.buf);
  // v2.3 is widely compatible; browser-id3-writer defaults to v2.3.
  // Remove old tag then set new frames.
  writer.removeTag();

  setFrameSafe(writer, 'TIT2', item.tags.title);
  setFrameSafe(writer, 'TPE1', item.tags.artist);
  setFrameSafe(writer, 'TALB', item.tags.album);
  setFrameSafe(writer, 'TRCK', item.tags.track);
  setFrameSafe(writer, 'TYER', item.tags.year); // v2.3
  setFrameSafe(writer, 'TCON', item.tags.genre);

  writer.addTag();
  const tagged = writer.arrayBuffer;
  const blob = new Blob([tagged], { type: 'audio/mpeg' });

  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = item.file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSelected() {
  const targets = items.filter(x => x.selected);
  if (targets.length === 0) return;
  for (const it of targets) writeAndDownload(it);
}

function downloadAll() {
  for (const it of items) writeAndDownload(it);
}

function applyBulk() {
  const artist = el.bulkArtist.value.trim();
  const album = el.bulkAlbum.value.trim();
  const year = el.bulkYear.value.trim();
  for (const it of items) {
    if (!it.selected) continue;
    if (artist !== '') it.tags.artist = artist;
    if (album !== '') it.tags.album = album;
    if (year !== '') it.tags.year = year;
  }
  render();
}

// Events
el.fileInput.addEventListener('change', async (e) => {
  await handleFiles(e.target.files);
});

el.clearBtn.addEventListener('click', () => {
  items = [];
  el.fileInput.value = '';
  setStatus('', '');
  render();
});

el.headerSelect.addEventListener('change', () => {
  const checked = el.headerSelect.checked;
  for (const it of items) it.selected = checked;
  render();
});

el.selectAllBtn.addEventListener('click', () => {
  for (const it of items) it.selected = true;
  render();
});

el.deselectAllBtn.addEventListener('click', () => {
  for (const it of items) it.selected = false;
  render();
});

el.applyBulkBtn.addEventListener('click', applyBulk);
el.downloadSelectedBtn.addEventListener('click', downloadSelected);
el.downloadAllBtn.addEventListener('click', downloadAll);

el.tableBody.addEventListener('input', (e) => {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  const it = items[idx];
  if (!it) return;

  const input = e.target.closest('.tag-input');
  if (input) {
    const field = input.dataset.field;
    if (field && it.tags[field] != null) {
      it.tags[field] = input.value;
    }
    return;
  }
});

el.tableBody.addEventListener('change', (e) => {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  const it = items[idx];
  if (!it) return;

  const checkbox = e.target.closest('.row-select');
  if (checkbox) {
    it.selected = checkbox.checked;
    updateButtons();
  }
});

// Initial render
render();
