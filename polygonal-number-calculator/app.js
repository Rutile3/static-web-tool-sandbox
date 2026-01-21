/*
  多角数計算ツール

  入力:
    - k: 角数 (>=3)
    - n: 番目 (>=1)
    - 中心のあり/なし
  出力:
    - 一般式
    - 代入した式
    - 解

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
  }

  function reset() {
    kInput.value = '3';
    nInput.value = '1';
    centerOff.checked = true;
    render();
  }

  // Events
  calcBtn.addEventListener('click', render);
  resetBtn.addEventListener('click', reset);

  // 入力変更で即時反映（軽い処理なので）
  [kInput, nInput, centerOff, centerOn].forEach(el => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  // 初期描画
  reset();
})();
