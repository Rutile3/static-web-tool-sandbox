(() => {
  'use strict';

  // ------------------------------------------------------------
  // 数学ロジック（素材）
  // ------------------------------------------------------------

  /**
   * ランク r とレベル L(0以上) から「レベル1〜Lの累積要求数 S(r,L)」を求める。
   * ループなし（閉形式）:
   *   q = floor(L / r)
   *   m = L % r
   *   S = r * q * (q + 1) / 2 + m * (q + 1)
   */
  function cumulativeRequired(r, L) {
    if (!Number.isInteger(r) || r <= 0) throw new Error('rank は正の整数である必要があります');
    if (!Number.isInteger(L) || L < 0) throw new Error('level は0以上の整数である必要があります');

    const q = Math.floor(L / r);
    const m = L % r;
    return (r * q * (q + 1)) / 2 + m * (q + 1);
  }

  /**
   * 素材番号(1〜4)に応じた「要求開始レベル」を返す。
   *  - 素材1/2: Lv1から
   *  - 素材3  : Lv3から
   *  - 素材4  : Lv6から
   */
  function materialStartLevel(materialNo) {
    switch (materialNo) {
      case 1:
      case 2:
        return 1;
      case 3:
        return 3;
      case 4:
        return 6;
      default:
        // 未指定・不正値は安全側で「Lv1から」として扱う
        return 1;
    }
  }

  /**
   * 「その素材にとっての有効レベル」に変換する。
   * 例: startLv=3 のとき
   *  - level=0..2 => 0
   *  - level=3    => 1
   *  - level=10   => 8
   */
  function effectiveLevel(level, startLv) {
    return Math.max(0, level - (startLv - 1));
  }

  /**
   * ランク r、素材 materialNo、現在レベル cur、目標レベル tgt から
   * 「cur→tgt に必要な素材数」を求める。
   *
   * 仕様:
   *  - 素材が解禁されたレベル(startLv)から要求が始まる
   *  - その素材の要求数は「解禁レベルを1としてカウント」する
   *
   * need = S(r, tgt') - S(r, cur')
   *  - cur' = effectiveLevel(cur, startLv)
   *  - tgt' = effectiveLevel(tgt, startLv)
   */
  function requiredMaterialBetween(r, materialNo, cur, tgt) {
    if (![cur, tgt].every(Number.isInteger)) throw new Error('level は整数である必要があります');
    if (cur < 0 || tgt < 0) throw new Error('level は0以上である必要があります');

    // 入力が逆でも破綻しないように正規化（差分量は同じ）
    const lo = Math.min(cur, tgt);
    const hi = Math.max(cur, tgt);

    const startLv = materialStartLevel(materialNo);
    const curEff = effectiveLevel(lo, startLv);
    const tgtEff = effectiveLevel(hi, startLv);

    if (tgtEff <= curEff) return 0;
    return cumulativeRequired(r, tgtEff) - cumulativeRequired(r, curEff);
  }

  // ------------------------------------------------------------
  // 数学ロジック（チャリン）
  // ------------------------------------------------------------

  /**
   * 0〜n の和（n>=0）
   */
  function sum1to(n) {
    if (!Number.isInteger(n) || n < 0) throw new Error('n は0以上の整数である必要があります');
    return (n * (n + 1)) / 2;
  }

  /**
   * チャリン基準額 base と現在レベル cur / 目標レベル tgt から、
   * 「cur→tgt に必要なチャリン」を求める。
   *
   * 仕様:
   *  - レベルkへのアップに必要なチャリンは base * k
   *  - したがって cur→tgt は base * ( (cur+1) + ... + tgt )
   *
   * needCharin = base * (sum1to(tgt) - sum1to(cur))
   */
  function requiredCharinBetween(base, cur, tgt) {
    if (!Number.isInteger(base) || base < 0) throw new Error('base は0以上の整数である必要があります');
    if (![cur, tgt].every(Number.isInteger)) throw new Error('level は整数である必要があります');
    if (cur < 0 || tgt < 0) throw new Error('level は0以上である必要があります');

    const lo = Math.min(cur, tgt);
    const hi = Math.max(cur, tgt);

    if (hi <= lo) return 0;
    return base * (sum1to(hi) - sum1to(lo));
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function fillSelectRange(selectEl, start, end) {
    selectEl.innerHTML = '';
    for (let i = start; i <= end; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i);
      selectEl.appendChild(opt);
    }
  }

  function fillSelectList(selectEl, values) {
    selectEl.innerHTML = '';
    for (const v of values) {
      const opt = document.createElement('option');
      opt.value = String(v);
      opt.textContent = String(v);
      selectEl.appendChild(opt);
    }
  }

  function init() {
    const materialSel = $('material');
    const rankSel = $('rank');
    const charinSel = $('charin');
    const curSel = $('curLevel');
    const tgtSel = $('tgtLevel');

    if (!materialSel || !rankSel || !charinSel || !curSel || !tgtSel) {
      console.error('必須の入力要素(material/rank/charin/curLevel/tgtLevel)が見つかりません');
      return;
    }

    fillSelectRange(materialSel, 1, 4);
    fillSelectRange(rankSel, 1, 5);
    fillSelectList(charinSel, [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
    fillSelectRange(curSel, 0, 10);
    fillSelectRange(tgtSel, 1, 10);

    // 初期値（任意）
    materialSel.value = '1';
    rankSel.value = '1';
    charinSel.value = '35';
    curSel.value = '0';
    tgtSel.value = '10';

    const reset = () => {
      setText('materialResult', '-');
      setText('charinResult', '-');
    };

    const calcAndRender = () => {
      const materialNo = parseInt(materialSel.value, 10);
      const rank = parseInt(rankSel.value, 10);
      const base = parseInt(charinSel.value, 10);
      const cur = parseInt(curSel.value, 10);
      const tgt = parseInt(tgtSel.value, 10);

      try {
        const needMat = requiredMaterialBetween(rank, materialNo, cur, tgt);
        const needCharin = requiredCharinBetween(base, cur, tgt);

        setText('materialResult', String(needMat));
        setText('charinResult', String(needCharin));
      } catch (e) {
        setText('materialResult', 'エラー');
        setText('charinResult', 'エラー');
        console.error(e);
      }
    };

    const btn = $('btnCalc');
    if (btn) btn.addEventListener('click', calcAndRender);

    materialSel.addEventListener('change', reset);
    rankSel.addEventListener('change', reset);
    charinSel.addEventListener('change', reset);
    curSel.addEventListener('change', reset);
    tgtSel.addEventListener('change', reset);

    reset();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
