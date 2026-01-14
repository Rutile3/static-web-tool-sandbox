(() => {
  "use strict";

  // -----------------------------
  // 設定
  // -----------------------------
  const RAREPON_MASTER_JSON_PATH = "./data/rarepon_master.json";
  const PATAPON_MASTER_JSON_PATH = "./data/patapon_master.json";
  const MATERIAL_MASTER_JSON_PATH = "./data/material_master.json";

  // -----------------------------
  // 設定値
  // -----------------------------
  const CONFIG = {
    // 素材スロット数（素材1〜N）
    materialSlots: 4,
    // 素材ごとの要求開始レベル（ゲーム仕様）
    // 素材1/2: Lv1から、素材3: Lv3から、素材4: Lv6から
    materialStartLevels: [1, 1, 3, 6],
    // レベル選択肢（UI）
    level: {
      curMin: 0,
      curMax: 9,   // Lv10は「これ以上上げない」前提で選択肢から除外
      tgtMin: 1,
      tgtMax: 10,
    },
  };

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
  function toEffectiveLevel(level, startLv) {
    return Math.max(0, level - (startLv - 1));
  }

  /**
   * ランク rank、素材startLv、現在レベル cur、目標レベル tgt から必要素材数を求める。
   * need = S(rank, tgt') - S(rank, cur')
   * ただし cur' / tgt' は startLv を原点にした有効レベル
   */
  function requiredMaterialBetween(rank, startLv, cur, tgt) {
    if (!Number.isInteger(rank) || rank <= 0)
      throw new Error("rank は正の整数である必要があります");
    if (!Number.isInteger(startLv) || startLv < 1)
      throw new Error("startLv は1以上の整数である必要があります");
    if (!Number.isInteger(cur) || cur < 0)
      throw new Error("cur は0以上の整数である必要があります");
    if (!Number.isInteger(tgt) || tgt < 1)
      throw new Error("tgt は1以上の整数である必要があります");
    if (tgt <= cur)
      throw new Error("tgt は cur より大きい必要があります");

    const curEff = toEffectiveLevel(cur, startLv);
    const tgtEff = toEffectiveLevel(tgt, startLv);

    if (tgtEff <= curEff) return 0;
    return cumulativeRequired(rank, tgtEff) - cumulativeRequired(rank, curEff);
  }

  /**
   * チャリン必要数を求める。
   */
  function requiredCharinBetween(pataponMult, rareponMult, cur, tgt) {
    if (pataponMult < 0)
      throw new Error("pataponMult は0より大きい必要があります");
    if (rareponMult < 0)
      throw new Error("rareponMult は0より大きい必要があります");
    if (!Number.isInteger(cur) || cur < 0)
      throw new Error("cur は0以上の整数である必要があります");
    if (!Number.isInteger(tgt) || tgt < 1)
      throw new Error("tgt は1以上の整数である必要があります");
    if (tgt <= cur)
      throw new Error("tgt は cur より大きい必要があります");

    let sum = 0;
    for (let lv = cur + 1; lv <= tgt; lv++) {
      sum += (pataponMult * rareponMult) * lv;
    }
    return sum;
  }


  // -----------------------------
  // マスタ読み込み
  // -----------------------------
  async function fetchMasterJsonNoCache(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`マスタ読込に失敗しました: ${res.status}`);
    return await res.json();
  }

  // -----------------------------
  // UI
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  // DOM参照のキャッシュ
  const ui = {
    pataponSel: $("patapon"),
    rareponSel: $("rarepon"),
    curSel: $("curLevel"),
    tgtSel: $("tgtLevel"),
    btnCalc: $("btnCalc"),
    resultTbody: $("resultTableBody"),
  };

  function assertUi() {
    const missing = Object.entries(ui)
      .filter(([, el]) => !el)
      .map(([k]) => k);
    if (missing.length) {
      console.error("必須の要素が見つかりません: " + missing.join(", "));
      return false;
    }
    return true;
  }

  function fillSelectRange(selectEl, start, end) {
    selectEl.innerHTML = "";
    for (let i = start; i <= end; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      selectEl.appendChild(opt);
    }
  }

  function fillSelectMasterName(selectEl, master) {
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

  // ランクに応じたCSSクラス（ランク1は指定なし）
  function rankToClass(rank) {
    switch (Number(rank)) {
      case 2: return "rank-2";
      case 3: return "rank-3";
      case 4: return "rank-4";
      case 5: return "rank-5";
      default: return null;
    }
  }

  function renderResultTable(rows) {
    const tbody = ui.resultTbody;
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


      const cls = rankToClass(r.rank);
      if (cls) td1.classList.add(cls);
      const td2 = document.createElement("td");
      td2.className = "text-center";
      td2.textContent = String(r.need);

      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    }
  }

  function setError(message) {
    renderResultTable([
      {
        name: "エラー",
        need: message || "計算に失敗しました",
      },
    ]);
  }

  async function init() {
    if (!assertUi()) return;
    // レベル選択肢
    fillSelectRange(ui.curSel, CONFIG.level.curMin, CONFIG.level.curMax);
    fillSelectRange(ui.tgtSel, CONFIG.level.tgtMin, CONFIG.level.tgtMax);

    // マスタ読み込み → れあポンセレクト構築
    let rareponMaster;
    let pataponMaster;
    let materialMaster;
    try {
      [rareponMaster, pataponMaster, materialMaster] = await Promise.all([
        fetchMasterJsonNoCache(RAREPON_MASTER_JSON_PATH),
        fetchMasterJsonNoCache(PATAPON_MASTER_JSON_PATH),
        fetchMasterJsonNoCache(MATERIAL_MASTER_JSON_PATH),
      ]);
      fillSelectMasterName(ui.rareponSel, rareponMaster);
      fillSelectMasterName(ui.pataponSel, pataponMaster);
    } catch (e) {
      console.error(e);
      setError("マスタ読み込み失敗");
      return;
    }

    // 初期値
    ui.curSel.value = "0";
    ui.tgtSel.value = "10";
    if (ui.pataponSel.options.length > 0) ui.pataponSel.selectedIndex = 0;
    if (ui.rareponSel.options.length > 0) ui.rareponSel.selectedIndex = 0;

    const calcAndRender = () => {
      try {
        const pataponName = ui.pataponSel.value;
        const rareponName = ui.rareponSel.value;
        const cur = parseInt(ui.curSel.value, 10);
        const tgt = parseInt(ui.tgtSel.value, 10);

        const rareponConf = rareponMaster[rareponName];
        if (!rareponConf) throw new Error("れあポン設定が見つかりません");
        const pataponConf = pataponMaster[pataponName];
        if (!pataponConf) throw new Error("パタポン設定が見つかりません");

        // 「現在レベル → 目標レベル」の場合のみ計算する
        if (tgt <= cur) {
          renderResultTable([]);
          return;
        }

        const rows = [];

        // 素材1〜4
        for (let i = 0; i < CONFIG.materialSlots; i++) {
          const matType = pataponConf.materials[i];
          const matRank = parseInt(rareponConf.materials[i], 10);
          const matName = getMaterialName(materialMaster, matType, matRank);

          const startLv = CONFIG.materialStartLevels[i];
          const need = requiredMaterialBetween(matRank, startLv, cur, tgt);
          if (need <= 0) continue;
          rows.push({// 素材名はマスタから取得（見つからない場合は種類名でフォールバック）
            name: matName || `素材${i + 1}（${matType}）`,
            rank: matRank,
            need,
          });
        }

        // チャリン（パタポン倍率を適用）
        const patponMult = Number(patponConf.charinMultiplier ?? 1);
        const rareponMult = parseInt(rareponConf.charinMultiplier, 10);
        const need = requiredCharinBetween(patponMult, rareponMult, cur, tgt);
        rows.push({
          name: "チャリン",
          rank: null,
          need,
        });

        renderResultTable(rows);
      } catch (e) {
        console.error(e);
        setError("計算失敗");
      }
    };

    ui.btnCalc.addEventListener("click", calcAndRender);

    // UX: 変更したら表示を即時更新
    ui.pataponSel.addEventListener("change", calcAndRender);
    ui.rareponSel.addEventListener("change", calcAndRender);
    ui.curSel.addEventListener("change", calcAndRender);
    ui.tgtSel.addEventListener("change", calcAndRender);

    // 初期表示
    calcAndRender();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
})();
