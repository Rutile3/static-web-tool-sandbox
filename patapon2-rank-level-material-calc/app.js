(() => {
  "use strict";

  // -----------------------------
  // 設定
  // -----------------------------
  const RAREPON_MASTER_JSON_PATH = "./data/rarepon_master.json";
  const PATAPON_MASTER_JSON_PATH = "./data/patapon_master.json";
  const MATERIAL_MASTER_JSON_PATH = "./data/material_master.json";

  // 素材ごとの要求開始レベル（ゲーム仕様）
  // 素材1/2: Lv1から、素材3: Lv3から、素材4: Lv6から
  const MATERIAL_START_LEVELS = [1, 1, 3, 6];

  // -----------------------------
  // 数学ロジック
  // -----------------------------

  /**
   * ランク rank とレベル level(0以上) から「レベル1〜levelの累積要求数 S(level,level)」を求める。
   * （各レベル i の要求数 = ceil(i / r) という法則を閉形式で計算）
   *
   * q = floor(level / rank)
   * m = level % rank
   * S = rank * q * (q + 1) / 2 + m * (q + 1)
   */
  function cumulativeRequired(rank, level) {
    if (!Number.isInteger(rank) || rank <= 0)
      throw new Error("rank は正の整数である必要があります");
    if (!Number.isInteger(level) || level < 0)
      throw new Error("level は0以上の整数である必要があります");

    const q = Math.floor(level / rank);
    const m = level % rank;
    return (rank * q * (q + 1)) / 2 + m * (q + 1);
  }

  /**
   * 「素材が解禁される開始レベル(startLv)」に対して、レベルを有効レベルに変換する。
   * 例: startLv=3 のとき
   *  - level=0..2 => 0
   *  - level=3    => 1（ここで1からカウント開始）
   *  - level=10   => 8
   */
  function effectiveLevel(level, startLv) {
    return Math.max(0, level - (startLv - 1));
  }

  /**
   * ランク rank、素材startLv、現在レベル cur、目標レベル tgt から必要素材数を求める。
   * need = S(rank, tgt') - S(rank, cur')
   * ただし cur' / tgt' は startLv を原点にした有効レベル
   */
  function requiredMaterialBetween(rank, startLv, cur, tgt) {
    if (![rank, startLv, cur, tgt].every(Number.isInteger))
      throw new Error("入力は整数である必要があります");
    if (rank <= 0) throw new Error("rank は1以上である必要があります");
    if (startLv <= 0) throw new Error("startLv は1以上である必要があります");
    if (cur < 0 || tgt < 0)
      throw new Error("level は0以上である必要があります");

    const lo = Math.min(cur, tgt);
    const hi = Math.max(cur, tgt);

    const curEff = effectiveLevel(lo, startLv);
    const tgtEff = effectiveLevel(hi, startLv);

    if (tgtEff <= curEff) return 0;
    return cumulativeRequired(rank, tgtEff) - cumulativeRequired(rank, curEff);
  }

  /**
   * 三角数 T(n)=1+2+...+n（n>=0）
   */
  function tri(n) {
    if (!Number.isInteger(n) || n < 0)
      throw new Error("tri の引数は0以上の整数が必要です");
    return (n * (n + 1)) / 2;
  }

  /**
   * チャリン必要数：base × ((lo+1)+...+hi)
   */
  function requiredCharinBetween(base, cur, tgt) {
    if (!Number.isInteger(base) || base < 0)
      throw new Error("base は0以上の整数が必要です");
    if (!Number.isInteger(cur) || !Number.isInteger(tgt))
      throw new Error("level は整数である必要があります");
    if (cur < 0 || tgt < 0)
      throw new Error("level は0以上の整数である必要があります");

    const lo = Math.min(cur, tgt);
    const hi = Math.max(cur, tgt);

    // (lo+1)+...+hi = T(hi) - T(lo)
    return base * (tri(hi) - tri(lo));
  }

  // -----------------------------
  // マスタ読み込み
  // -----------------------------
  async function loadRareponMaster() {
    const res = await fetch(RAREPON_MASTER_JSON_PATH, { cache: "no-cache" });
    if (!res.ok) throw new Error(`マスタ読込に失敗しました: ${res.status}`);
    return await res.json();
  }

  async function loadPataponMaster() {
    const res = await fetch(PATAPON_MASTER_JSON_PATH, { cache: "no-cache" });
    if (!res.ok) throw new Error(`マスタ読込に失敗しました: ${res.status}`);
    return await res.json();
  }

  async function loadMaterialMaster() {
    const res = await fetch(MATERIAL_MASTER_JSON_PATH, { cache: "no-cache" });
    if (!res.ok) throw new Error(`マスタ読込に失敗しました: ${res.status}`);
    return await res.json();
  }

  // -----------------------------
  // UI
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  function fillSelectRange(selectEl, start, end) {
    selectEl.innerHTML = "";
    for (let i = start; i <= end; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      selectEl.appendChild(opt);
    }
  }

  function fillPataponSelect(selectEl, master) {
    selectEl.innerHTML = "";
    Object.keys(master).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
  }

  function fillRareponSelect(selectEl, master) {
    selectEl.innerHTML = "";
    Object.keys(master).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
  }

  function getMaterialName(materialMaster, materialType, rank) {
    if (!materialMaster) return "";
    const mat = materialMaster[String(materialType)];
    if (!mat || !mat.ranks) return "";
    return mat.ranks[String(rank)] || "";
  }

  function setResultTable(rows) {
    const tbody = $("resultTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 2;
      td.className = "text-muted";
      td.textContent = "-";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    for (const r of rows) {
      const tr = document.createElement("tr");

      const td1 = document.createElement("td");
      td1.className = "text-center";
      td1.textContent = r.name;

      const td2 = document.createElement("td");
      td2.className = "text-center";
      td2.textContent = String(r.need);

      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    }
  }

  function setError(message) {
    setResultTable([
      {
        label: "エラー",
        rankOrBase: "-",
        need: message || "計算に失敗しました",
      },
    ]);
  }

  async function init() {
    const pataponSel = $("patapon");
    const rareponSel = $("rarepon");
    const curSel = $("curLevel");
    const tgtSel = $("tgtLevel");
    const btn = $("btnCalc");

    if (!pataponSel || !rareponSel || !curSel || !tgtSel || !btn) {
      console.error(
        "必須の要素が見つかりません（patapon/rarepon/curLevel/tgtLevel/btnCalc）"
      );
      return;
    }

    // レベル選択肢
    fillSelectRange(curSel, 0, 9);
    fillSelectRange(tgtSel, 1, 10);

    // マスタ読み込み → れあポンセレクト構築
    let rareponMaster;
    let pataponMaster;
    let materialMaster;
    try {
      [rareponMaster, pataponMaster, materialMaster] = await Promise.all([
        loadRareponMaster(),
        loadPataponMaster(),
        loadMaterialMaster(),
      ]);
      fillRareponSelect(rareponSel, rareponMaster);
      fillPataponSelect(pataponSel, pataponMaster);
    } catch (e) {
      console.error(e);
      setError("マスタ読み込み失敗");
      return;
    }

    // 初期値
    curSel.value = "0";
    tgtSel.value = "10";
    if (pataponSel.options.length > 0) pataponSel.selectedIndex = 0;
    if (rareponSel.options.length > 0) rareponSel.selectedIndex = 0;

    const calcAndRender = () => {
      try {
        const pataponName = pataponSel.value;
        const rareponName = rareponSel.value;
        const cur = parseInt(curSel.value, 10);
        const tgt = parseInt(tgtSel.value, 10);

        const rareConf = rareponMaster[rareponName];
        if (!rareConf) throw new Error("れあポン設定が見つかりません");

        const patConf = pataponMaster[pataponName];
        if (!patConf) throw new Error("パタポン設定が見つかりません");

        const materials = rareConf.materials;
        const baseCharin = rareConf.charin;

        const rows = [];

        // 素材1〜4
        for (let i = 0; i < 4; i++) {
          const rank = parseInt(materials[i], 10);
          const startLv = MATERIAL_START_LEVELS[i];
          const need = requiredMaterialBetween(rank, startLv, cur, tgt);
          if (need <= 0) continue;
          const matType = patConf.materials[i];
          const matName = getMaterialName(materialMaster, matType, rank);
          rows.push({
            // 素材名はマスタから取得（見つからない場合は種類名でフォールバック）
            name: matName || `素材${i + 1}（${matType}）`,
            need,
          });
        }

        // チャリン（パタポン倍率を適用）
        const base = parseInt(baseCharin, 10);
        const needCharinRaw = requiredCharinBetween(base, cur, tgt);
        const mult = Number(patConf.charinMultiplier ?? 1);
        // 端数が出る可能性があるため、最終結果は四捨五入して整数化
        const needCharin = Math.round(needCharinRaw * mult);
        const multLabel = Number.isFinite(mult) ? String(mult) : "1";
        rows.push({
          name: "チャリン",
          need: needCharin,
        });

        setResultTable(rows);
      } catch (e) {
        console.error(e);
        setError("計算失敗");
      }
    };

    btn.addEventListener("click", calcAndRender);

    // UX: 変更したら表示をリセット
    const reset = () => setResultTable([]);
    pataponSel.addEventListener("change", reset);
    rareponSel.addEventListener("change", reset);
    curSel.addEventListener("change", reset);
    tgtSel.addEventListener("change", reset);

    // 初期表示は未計算
    setResultTable([]);
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
})();
