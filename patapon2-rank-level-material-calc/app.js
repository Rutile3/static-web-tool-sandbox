(() => {
  'use strict';

  /**
   * ランク r とレベル L から「レベル1〜Lの累積要求数」を求める。
   * ループなしの閉形式：
   *   q = floor(L / r)
   *   m = L % r
   *   total = r * q * (q + 1) / 2 + m * (q + 1)
   */
  function totalRequired(r, L) {
    if (!Number.isInteger(r) || !Number.isInteger(L) || r <= 0 || L <= 0) {
      throw new Error('rank と level は正の整数である必要があります');
    }
    const q = Math.floor(L / r);
    const m = L % r;
    return (r * q * (q + 1)) / 2 + m * (q + 1);
  }

  function fillSelect(selectEl, from, to) {
    selectEl.innerHTML = '';
    for (let v = from; v <= to; v++) {
      const opt = document.createElement('option');
      opt.value = String(v);
      opt.textContent = String(v);
      selectEl.appendChild(opt);
    }
  }

  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Element not found: #${id}`);
    return el;
  }

  function setResult(text) {
    const out = $('result');
    out.textContent = text;
  }

  function calcAndRender() {
    const rank = parseInt($('rank').value, 10);
    const level = parseInt($('level').value, 10);
    try {
      const total = totalRequired(rank, level);
      setResult(String(total));
    } catch (e) {
      setResult('エラー');
      console.error(e);
    }
  }

  // 初期化
  document.addEventListener('DOMContentLoaded', () => {
    const rankSel = $('rank');
    const levelSel = $('level');

    fillSelect(rankSel, 1, 5);
    fillSelect(levelSel, 1, 10);

    // 初期値（表に合わせて最大寄り）
    rankSel.value = '1';
    levelSel.value = '10';
    calcAndRender();

    $('btnCalc').addEventListener('click', calcAndRender);

    // UX: セレクト変更でも再計算（ボタン操作は要件通り残す）
    rankSel.addEventListener('change', () => setResult('-'));
    levelSel.addEventListener('change', () => setResult('-'));
  });
})();
