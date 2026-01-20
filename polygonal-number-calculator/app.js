/*
  N角数・中心付きN角数 計算ツール

  入力:
    - k: 角数 (>=3)
    - n: 番目 (>=1)
    - 中心のあり/なし
  出力:
    - 一般式
    - 代入した式
    - 解
    - 点の数を可視化する簡易図

  実装メモ:
    - BigIntで計算し、オーバーフローを回避
    - 2で割る箇所は整数で必ず割り切れる
*/

(() => {
  /** @type {HTMLInputElement} */
  const kInput = document.getElementById('kInput');
  /** @type {HTMLInputElement} */
  const nInput = document.getElementById('nInput');
  /** @type {HTMLInputElement} */
  const centerOff = document.getElementById('centerOff');
  /** @type {HTMLInputElement} */
  const centerOn = document.getElementById('centerOn');
  /** @type {HTMLButtonElement} */
  const calcBtn = document.getElementById('calcBtn');
  /** @type {HTMLButtonElement} */
  const resetBtn = document.getElementById('resetBtn');

  const selectedFormulaEl = document.getElementById('selectedFormula');
  const substitutedFormulaEl = document.getElementById('substitutedFormula');
  const resultValueEl = document.getElementById('resultValue');

  /** @type {HTMLInputElement} */
  const scaleInput = document.getElementById('scaleInput');
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('viz');
  const ctx = canvas.getContext('2d');

  const FORMULA_NORMAL = 'P(k, n) = ((k − 2)n² − (k − 4)n) / 2';
  const FORMULA_CENTERED = 'C(k, n) = 1 + k n (n − 1) / 2';

  function clampInt(v, min, max) {
    const x = Number(v);
    if (!Number.isFinite(x)) return min;
    const xi = Math.trunc(x);
    return Math.max(min, Math.min(max, xi));
  }

  function getMode() {
    return centerOn.checked ? 'centered' : 'normal';
  }

  function toBigIntSafe(num) {
    // Number入力→整数BigInt
    // ここで範囲を軽く縛る（UI上の制約と合わせて過度な負荷を避ける）
    const x = clampInt(num, 0, 2_000_000_000); // 20億まで
    return BigInt(x);
  }

  /**
   * 通常のk角数
   * P(k,n) = ((k-2)n^2 - (k-4)n)/2
   */
  function polygonal(k, n) {
    const two = 2n;
    const num = (k - 2n) * n * n - (k - 4n) * n;
    return num / two;
  }

  /**
   * 中心付きk角数
   * C(k,n) = 1 + k*n*(n-1)/2
   */
  function centeredPolygonal(k, n) {
    const two = 2n;
    return 1n + (k * n * (n - 1n)) / two;
  }

  function formatBigInt(x) {
    // 3桁区切り（BigInt）
    const s = x.toString();
    const neg = s.startsWith('-');
    const t = neg ? s.slice(1) : s;
    const withComma = t.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return neg ? '-' + withComma : withComma;
  }

  function renderText(mode, k, n, value) {
    if (mode === 'centered') {
      selectedFormulaEl.textContent = FORMULA_CENTERED;
      substitutedFormulaEl.textContent =
        `C(${k}, ${n}) = 1 + ${k}×${n}×(${n}−1)/2 = ${formatBigInt(value)}`;
      resultValueEl.textContent = `C(${k}, ${n}) = ${formatBigInt(value)}`;
      return;
    }

    selectedFormulaEl.textContent = FORMULA_NORMAL;
    substitutedFormulaEl.textContent =
      `P(${k}, ${n}) = ((${k}−2)×${n}² − (${k}−4)×${n})/2 = ${formatBigInt(value)}`;
    resultValueEl.textContent = `P(${k}, ${n}) = ${formatBigInt(value)}`;
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 背景はCSSで白だが、透過対策として塗っておく
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
  }

  function drawDot(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCentered(k, n, scale) {
    // 中心 + リング（層）
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const rDot = 2.2 * scale;
    const baseRadius = 22 * scale;

    drawDot(cx, cy, rDot);
    const MAX_POINTS_PER_RING = 2500; // 描画負荷対策
    for (let layer = 2; layer <= n; layer++) {
      const cntRaw = k * (layer - 1);
      const cnt = Math.min(cntRaw, MAX_POINTS_PER_RING);
      const radius = baseRadius * (layer - 1);
      for (let i = 0; i < cnt; i++) {
        // cntRawが大きい場合は間引き（均等サンプリング）
        const idx = cntRaw > cnt ? Math.floor((i * cntRaw) / cnt) : i;
        const theta = (Math.PI * 2 * idx) / cntRaw;
        const x = cx + Math.cos(theta) * radius;
        const y = cy + Math.sin(theta) * radius;
        drawDot(x, y, rDot);
      }
    }
  }

  function diffPolygonal(k, n) {
    // ΔP(k,n) = P(k,n) - P(k,n-1)
    // BigIntで返す
    if (n <= 1) return 1n;
    const kb = BigInt(k);
    const nb = BigInt(n);
    return polygonal(kb, nb) - polygonal(kb, nb - 1n);
  }

  function drawNormalLayered(k, n, scale) {
    // 通常のk角数は「厳密な幾何配置」を作るのが重いので、
    // 増分(階差)を層として横並びに描く。
    // layer=1..n の点数 = ΔP(k,layer)

    const pad = 16 * scale;
    const rDot = 2.0 * scale;
    const gap = 7.5 * scale;
    const rowGap = 12 * scale;

    let y = pad;
    const MAX_DOTS_TOTAL = 7000; // 描画負荷対策（全体）
    let drawn = 0;
    for (let layer = 1; layer <= n; layer++) {
      const diff = diffPolygonal(k, layer);
      // diffが巨大な場合は「点を全部描く」こと自体が非現実なので間引く
      const cnt = diff > BigInt(MAX_DOTS_TOTAL) ? MAX_DOTS_TOTAL : Number(diff);
      // 1行に収まらない場合は折り返し（row=複数行）
      const maxPerRow = Math.max(1, Math.floor((canvas.width - pad * 2) / gap));
      let remaining = cnt;
      while (remaining > 0) {
        const take = Math.min(remaining, maxPerRow);
        const rowWidth = (take - 1) * gap;
        const x0 = (canvas.width - rowWidth) / 2;
        for (let i = 0; i < take; i++) {
          drawDot(x0 + i * gap, y, rDot);
          drawn++;
          if (drawn >= MAX_DOTS_TOTAL) return;
        }
        remaining -= take;
        y += rowGap;
        // 画面をはみ出す場合は打ち切り（UIの入力制約で過度なケースは避ける）
        if (y > canvas.height - pad) return;
      }
      y += rowGap * 0.6;
      if (y > canvas.height - pad) return;
    }
  }

  function render() {
    const k = clampInt(kInput.value, 3, 1_000_000);
    const n = clampInt(nInput.value, 1, 2000);

    // UIにも反映（不正値が入った場合に戻す）
    kInput.value = String(k);
    nInput.value = String(n);

    const kb = BigInt(k);
    const nb = BigInt(n);
    const mode = getMode();

    const value = mode === 'centered'
      ? centeredPolygonal(kb, nb)
      : polygonal(kb, nb);

    renderText(mode, k, n, value);

    clearCanvas();
    const scale = clampInt(scaleInput.value, 1, 6);
    if (mode === 'centered') {
      drawCentered(k, n, scale);
    } else {
      drawNormalLayered(k, n, scale);
    }
  }

  function reset() {
    kInput.value = '3';
    nInput.value = '1';
    centerOff.checked = true;
    scaleInput.value = '3';
    render();
  }

  // Events
  calcBtn.addEventListener('click', render);
  resetBtn.addEventListener('click', reset);

  // 入力変更で即時反映（軽い処理なので）
  [kInput, nInput, centerOff, centerOn, scaleInput].forEach(el => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  // 初期描画
  reset();
})();
