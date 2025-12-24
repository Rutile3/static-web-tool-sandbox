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
    // S(r, L): レベル1〜Lまでの累積要求数（Lは0も可）
    if (!Number.isInteger(r) || !Number.isInteger(L) || r <= 0 || L < 0) {
      throw new Error('rank は正の整数、level は0以上の整数である必要があります');
    }
    if (L === 0) return 0;
    const q = Math.floor(L / r);
    const m = L % r;
    return (r * q * (q + 1)) / 2 + m * (q + 1);
  }

  /**
   * ランク r・現在レベル cur・目標レベル tgt から「cur→tgtの必要数」を求める。
   * need = S(r, tgt) - S(r, cur)
   */
  function requiredBetween(r, cur, tgt) {
    if (tgt < cur) {
      // UI入力ミス対策：逆だった場合は入れ替える
      const tmp = cur;
      cur = tgt;
      tgt = tmp;
    }
    return totalRequired(r, tgt) - totalRequired(r, cur);
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
    const cur = parseInt($('curLevel').value, 10);
    const tgt = parseInt($('tgtLevel').value, 10);

    try {
      const need = requiredBetween(rank, cur, tgt);
      setResult(String(need));
    } catch (e) {
      setResult('エラー');
      console.error(e);
    }
  }

  // 初期化
  document.addEventListener('DOMContentLoaded', () => {
    const rankSel = $('rank');
    const curSel = $('curLevel');
    const tgtSel = $('tgtLevel');

    fillSelect(rankSel, 1, 5);
    fillSelect(curSel, 0, 10);
    fillSelect(tgtSel, 1, 10);

    // 初期値
    rankSel.value = '1';
    curSel.value = '0';
    tgtSel.value = '10';
    calcAndRender();

    $('btnCalc').addEventListener('click', calcAndRender);

    // UX: セレクト変更でも再計算（ボタン操作は要件通り残す）
    rankSel.addEventListener('change', () => setResult('-'));
    curSel.addEventListener('change', () => setResult('-'));
    tgtSel.addEventListener('change', () => setResult('-'));
  });
})();
