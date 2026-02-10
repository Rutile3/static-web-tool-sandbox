// PDF metadata editor (client-side)
// - Read/write metadata via pdf-lib

/* global window, document */

const { PDFDocument } = window.PDFLib;

/** @typedef {{
 *  id: string,
 *  file: File,
 *  buf: ArrayBuffer,
 *  selected: boolean,
 *  meta: { title: string, author: string, subject: string, keywords: string }
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
  bulkAuthor: document.getElementById('bulkAuthor'),
  bulkSubject: document.getElementById('bulkSubject'),
  bulkKeywords: document.getElementById('bulkKeywords'),
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
        <td colspan="6" class="text-secondary">PDFを選択するとここに一覧表示されます。</td>
      </tr>`;
    updateButtons();
    return;
  }

  el.tableBody.innerHTML = items.map((it, idx) => {
    const m = it.meta;
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
        <td><input class="form-control form-control-sm meta-input" data-field="title" value="${escapeHtml(m.title)}"></td>
        <td><input class="form-control form-control-sm meta-input" data-field="author" value="${escapeHtml(m.author)}"></td>
        <td><input class="form-control form-control-sm meta-input" data-field="subject" value="${escapeHtml(m.subject)}"></td>
        <td><input class="form-control form-control-sm meta-input" data-field="keywords" value="${escapeHtml(m.keywords)}" placeholder="tag1, tag2"></td>
      </tr>`;
  }).join('');

  updateButtons();
}

function uniqueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizeKeywords(kw) {
  if (!kw) return '';
  if (Array.isArray(kw)) return kw.join(', ');
  return String(kw);
}

async function readMetaFromPdf(arrayBuffer) {
  // pdf-lib throws on encrypted PDFs unless ignoreEncryption (then limited).
  try {
    const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const title = doc.getTitle() ?? '';
    const author = doc.getAuthor() ?? '';
    const subject = doc.getSubject() ?? '';
    const keywords = normalizeKeywords(doc.getKeywords());
    return {
      title: String(title),
      author: String(author),
      subject: String(subject),
      keywords: String(keywords),
    };
  } catch (_) {
    return { title: '', author: '', subject: '', keywords: '' };
  }
}

async function handleFiles(fileList) {
  const files = Array.from(fileList || []).filter(f => {
    const n = (f.name || '').toLowerCase();
    return n.endsWith('.pdf') || f.type === 'application/pdf';
  });

  if (files.length === 0) {
    setStatus('warn', 'PDFファイルが選択されていません。');
    return;
  }

  setStatus('info', `読み込み中…（${files.length}件）`);

  const newItems = [];
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const meta = await readMetaFromPdf(buf);
    // Heuristic: if everything blank, it might still be a valid PDF with no metadata.
    // Count failures when pdf-lib likely couldn't parse (we can't distinguish perfectly here).
    if (meta.title === '' && meta.author === '' && meta.subject === '' && meta.keywords === '') {
      // no-op
    }
    newItems.push({
      id: uniqueId(),
      file: f,
      buf,
      selected: true,
      meta,
    });
  }

  items = newItems;
  setStatus('', '');
  render();
}

function parseKeywords(text) {
  const s = (text ?? '').trim();
  if (s === '') return [];
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

async function writeAndDownload(item) {
  const doc = await PDFDocument.load(item.buf, { ignoreEncryption: true });
  doc.setTitle(item.meta.title ?? '');
  doc.setAuthor(item.meta.author ?? '');
  doc.setSubject(item.meta.subject ?? '');
  doc.setKeywords(parseKeywords(item.meta.keywords));

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });

  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = item.file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadSelected() {
  const targets = items.filter(x => x.selected);
  if (targets.length === 0) return;
  for (const it of targets) {
    try {
      await writeAndDownload(it);
    } catch (_) {
      setStatus('error', `保存に失敗しました: ${it.file.name}（暗号化PDFや破損PDFの可能性）`);
    }
  }
}

async function downloadAll() {
  for (const it of items) {
    try {
      await writeAndDownload(it);
    } catch (_) {
      setStatus('error', `保存に失敗しました: ${it.file.name}（暗号化PDFや破損PDFの可能性）`);
    }
  }
}

function applyBulk() {
  const author = el.bulkAuthor.value.trim();
  const subject = el.bulkSubject.value.trim();
  const keywords = el.bulkKeywords.value.trim();

  for (const it of items) {
    if (!it.selected) continue;
    if (author !== '') it.meta.author = author;
    if (subject !== '') it.meta.subject = subject;
    if (keywords !== '') it.meta.keywords = keywords;
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
el.downloadSelectedBtn.addEventListener('click', () => { void downloadSelected(); });
el.downloadAllBtn.addEventListener('click', () => { void downloadAll(); });

el.tableBody.addEventListener('input', (e) => {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  const it = items[idx];
  if (!it) return;

  const input = e.target.closest('.meta-input');
  if (input) {
    const field = input.dataset.field;
    if (field && it.meta[field] != null) {
      it.meta[field] = input.value;
    }
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
