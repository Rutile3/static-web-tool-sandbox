(() => {
  "use strict";

  /**
   * 3色アルバムカバージェネレーター
   * - 背景（main）
   * - 顔シルエット（sub）: 既定パス
   * - 縦帯（accent）
   */

  // ---- Constants
  const CONFIG = {
    // Canvas size
    VIEWBOX_SIZE: 1000,
        
    // Color randomization factors
    RANDOMIZE: {
      DARKEN_FACTOR: 0.55,
      LIGHTEN_FACTOR: 0.55,
    },
    
    // File naming
    FILENAME_STEM: "three-color-album-cover",
    
    // Default colors
    DEFAULTS: {
      main: "#0b0b0b",
      sub: "#d8d4c8",
      accent: "#d6001c",
    },
  };

  // ---- Elements
  const el = {
    mainColor: document.getElementById("mainColor"),
    subColor: document.getElementById("subColor"),
    accentColor: document.getElementById("accentColor"),
    mainHex: document.getElementById("mainHex"),
    subHex: document.getElementById("subHex"),
    accentHex: document.getElementById("accentHex"),
    preview: document.getElementById("preview"),
    btnDownloadPNG: document.getElementById("btnDownloadPNG"),
    btnDownloadSVG: document.getElementById("btnDownloadSVG"),
    btnRandom: document.getElementById("btnRandom"),
    btnReset: document.getElementById("btnReset"),
  };

  // ---- Utils
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function normalizeHex(s) {
    if (!s) return null;
    const t = s.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
    return null;
  }

  function randHex() {
    const n = (Math.random() * 0xffffff) | 0;
    return "#" + n.toString(16).padStart(6, "0");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function svgToDataUrl(svgText) {
    // UTF-8 safe
    const encoded = encodeURIComponent(svgText)
      .replace(/%0A/g, "")
      .replace(/%20/g, " ");
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  }

  // ---- SVG generation
  function generateSvgText({ main, sub, accent }) {
    const VB = CONFIG.VIEWBOX_SIZE;
    const BAR = CONFIG.BAR;
    
    const elements = [
      `  <rect x="0" y="0" width="${VB}" height="${VB}" fill="${main}"/>`,
      `  <circle cx="450" cy="350" r="200" fill="${sub}" />`,
      `  <polygon points="350,500 550,500 700,1000 200,1000" fill="${sub}" />`,
      `  <rect x="425" y="50" width="150" height="900" fill="${accent}"/>`,
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${VB}" height="${VB}">\n${elements.join("\n")}\n</svg>`;
  }

  function renderPreview() {
    const main = el.mainColor.value;
    const sub = el.subColor.value;
    const accent = el.accentColor.value;

    const svgText = generateSvgText({ main, sub, accent });
    el.preview.innerHTML = svgText;
    return svgText;
  }

  // ---- Wiring
  function syncHexFromPicker(picker, hexInput) {
    hexInput.value = picker.value.toLowerCase();
  }

  function syncPickerFromHex(hexInput, picker) {
    const n = normalizeHex(hexInput.value);
    if (n) {
      picker.value = n;
      hexInput.classList.remove("is-invalid");
      return true;
    }
    hexInput.classList.add("is-invalid");
    return false;
  }

  // ---- File download helpers
  async function downloadAsImage(svgText) {
    const url = svgToDataUrl(svgText);
    const img = new Image();
    img.decoding = "async";

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = CONFIG.VIEWBOX_SIZE;
    canvas.height = CONFIG.VIEWBOX_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${CONFIG.FILENAME_STEM}.png`);
    }, "image/png");
  }

  async function downloadFile(format) {
    const svgText = renderPreview();

    if (format === "svg") {
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      downloadBlob(blob, `${CONFIG.FILENAME_STEM}.svg`);
    } else if (format === "png") {
      await downloadAsImage(svgText);
    }
  }

  function setColors({ main, sub, accent }) {
    el.mainColor.value = main;
    el.subColor.value = sub;
    el.accentColor.value = accent;

    syncHexFromPicker(el.mainColor, el.mainHex);
    syncHexFromPicker(el.subColor, el.subHex);
    syncHexFromPicker(el.accentColor, el.accentHex);

    renderPreview();
  }

  function randomize() {
    // ほどほどに破綻しにくいよう、mainは暗め、subは明るめ、accentは強め
    const main = darken(randHex(), CONFIG.RANDOMIZE.DARKEN_FACTOR);
    const sub = lighten(randHex(), CONFIG.RANDOMIZE.LIGHTEN_FACTOR);
    const accent = saturateLike(randHex());

    setColors({ main, sub, accent });
  }

  function reset() {
    setColors(CONFIG.DEFAULTS);
  }

  // ---- Simple color helpers
  function hexToRgb(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex({ r, g, b }) {
    const n = (clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255);
    return "#" + n.toString(16).padStart(6, "0");
  }

  function mix(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  function lighten(hex, t) {
    const c = hexToRgb(hex);
    if (!c) return hex;
    return rgbToHex({ r: mix(c.r, 255, t), g: mix(c.g, 255, t), b: mix(c.b, 255, t) });
  }

  function darken(hex, t) {
    const c = hexToRgb(hex);
    if (!c) return hex;
    return rgbToHex({ r: mix(c.r, 0, t), g: mix(c.g, 0, t), b: mix(c.b, 0, t) });
  }

  function saturateLike(hex) {
    // 雑な強調（彩度っぽさ）: 最大成分を255、最小成分を0寄りへ
    const c = hexToRgb(hex);
    if (!c) return hex;
    const arr = [c.r, c.g, c.b];
    const max = Math.max(...arr);
    const min = Math.min(...arr);
    const spread = Math.max(1, max - min);
    const k = 255 / spread;
    return rgbToHex({
      r: Math.round((c.r - min) * k),
      g: Math.round((c.g - min) * k),
      b: Math.round((c.b - min) * k),
    });
  }

  // ---- Event listeners
  const bindColorPair = (picker, hex) => {
    picker.addEventListener("input", () => {
      syncHexFromPicker(picker, hex);
      renderPreview();
    });
    hex.addEventListener("input", () => {
      if (syncPickerFromHex(hex, picker)) renderPreview();
    });
    hex.addEventListener("blur", () => {
      const n = normalizeHex(hex.value);
      if (n) hex.value = n;
    });
  };

  bindColorPair(el.mainColor, el.mainHex);
  bindColorPair(el.subColor, el.subHex);
  bindColorPair(el.accentColor, el.accentHex);

  el.btnDownloadSVG.addEventListener("click", () => downloadFile("svg").catch(console.error));
  el.btnDownloadPNG.addEventListener("click", () => downloadFile("png").catch(console.error));
  el.btnRandom.addEventListener("click", randomize);
  el.btnReset.addEventListener("click", reset);

  // Initialize values from CONFIG
  el.mainHex.value = CONFIG.DEFAULTS.main;
  el.mainColor.value = CONFIG.DEFAULTS.main;
  el.subHex.value = CONFIG.DEFAULTS.sub;
  el.subColor.value = CONFIG.DEFAULTS.sub;
  el.accentHex.value = CONFIG.DEFAULTS.accent;
  el.accentColor.value = CONFIG.DEFAULTS.accent;

  // Init
  renderPreview();
})();
