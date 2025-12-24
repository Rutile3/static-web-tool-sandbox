(() => {
  'use strict';

  // ------------------------------------------------------------
  // 数学ロジック
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
   * 仕様（ユーザー想定）:
   *  - 素材が解禁されたレベル(startLv)から要求が始まる
   *  - その素材の要求数は「解禁レベルを1としてカウント」する
   *
   * したがって、元のレベルをそのまま使うのではなく
   * 有効レベル(cur', tgt')に変換して差分を取る。
   *
   * need = S(r, tgt') - S(r, cur')
   */
  function requiredBetweenWithMaterial(r, materialNo, cur, tgt) {
    if (![cur, tgt].every(Number.isInteger)) throw new Error('level は整数である必要があります');
    if (cur < 0 || tgt < 0) throw new Error('level は0以上である必要があります');

    // 入力が逆でも破綻しないように正規化
    const lo = Math.min(cur, tgt);
    const hi = Math.max(cur, tgt);

    const startLv = materialStartLevel(materialNo);
    const curEff = effectiveLevel(lo, startLv);
    const tgtEff = effectiveLevel(hi, startLv);

    if (tgtEff <= curEff) return 0;
    return cumulativeRequired(r, tgtEff) - cumulativeRequired(r, curEff);
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function setResult(text) {
    const el = $('result');
    if (el) el.textContent = text;
  }

  function fillSelectRange(selectEl, start, end) {
    // start..end をすべて追加
    selectEl.innerHTML = '';
    for (let i = start; i <= end; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i);
      selectEl.appendChild(opt);
    }
  }

  function init() {
    const rankSel = $('rank');
    const curSel = $('curLevel');
    const tgtSel = $('tgtLevel');

    // 素材セレクト（存在する場合のみ初期化）
    const materialSel = $('material');

    if (!rankSel || !curSel || !tgtSel) {
      console.error('必須の入力要素(rank/curLevel/tgtLevel)が見つかりません');
      return;
    }

    fillSelectRange(rankSel, 1, 5);
    fillSelectRange(curSel, 0, 10);
    fillSelectRange(tgtSel, 1, 10);

    if (materialSel) {
      fillSelectRange(materialSel, 1, 4);
      materialSel.value = '1';
    }

    // 初期値
    rankSel.value = '1';
    curSel.value = '0';
    tgtSel.value = '10';

    const calcAndRender = () => {
      const rank = parseInt(rankSel.value, 10);
      const cur = parseInt(curSel.value, 10);
      const tgt = parseInt(tgtSel.value, 10);

      // material が無ければ素材1扱い（旧UI互換）
      const materialNo = materialSel ? parseInt(materialSel.value, 10) : 1;

      try {
        const need = requiredBetweenWithMaterial(rank, materialNo, cur, tgt);
        setResult(String(need));
      } catch (e) {
        setResult('エラー');
        console.error(e);
      }
    };

    const btn = $('btnCalc');
    if (btn) btn.addEventListener('click', calcAndRender);

    // UX: セレクト変更で結果を一旦リセット（押下計算を基本とする）
    const reset = () => setResult('-');
    rankSel.addEventListener('change', reset);
    curSel.addEventListener('change', reset);
    tgtSel.addEventListener('change', reset);
    if (materialSel) materialSel.addEventListener('change', reset);

    // 初回表示（テンプレによっては自動計算したい場合があるため）
    // 要件的に「ボタンで計算」なので結果は '-' で開始
    setResult('-');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
