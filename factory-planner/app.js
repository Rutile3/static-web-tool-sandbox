// ====== Storage ======
const LS_KEY = "factory-planner.items.v1";

function loadItems() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
}
function saveItems(items) {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
    refreshUI(items);
}

// ====== Data shape ======
// items[name] = {
//   name, timeSec: number|null, outQty: number (>=1),
//   color: "#rrggbb"|null, image: "url"|null,
//   ingredients: [{name, qty}]
// }

// ====== UI helpers ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toastWarn(msg) {
    const el = $("#calc-warn");
    el.textContent = msg;
    el.classList.toggle("d-none", !msg);
}

function ingredientRow(name = "", qty = "") {
    const row = document.createElement("div");
    row.className = "ing-row";
    row.innerHTML = `
    <input class="form-control ing-name" placeholder="素材名" value="${name}">
    <input type="number" min="0" step="0.0001" class="form-control ing-qty text-end" placeholder="数量" value="${qty}">
    <button type="button" class="btn btn-outline-danger" title="行を削除">×</button>
  `;
    row.querySelector("button").addEventListener("click", () => row.remove());
    return row;
}

function refreshItemListDatalist(items) {
    const dl = $("#item-list");
    dl.innerHTML = Object.keys(items).sort().map(n => `<option value="${n}"></option>`).join("");
}

function renderItemsTable(items) {
    const tbody = $("#items-table tbody");
    const rows = Object.values(items).sort((a, b) => a.name.localeCompare(b.name)).map(it => {
        const ing = it.ingredients?.map(x => `${x.name}×${x.qty}`).join(", ") || "";
        const imgChip = it.image ? `<span class="img-chip"><img src="${it.image}" alt=""></span>` : "";
        const colorChip = it.color ? `<span class="badge" style="background:${it.color}">&nbsp;</span>` : "";
        return `
      <tr>
        <td>${it.name}</td>
        <td class="text-end">${it.timeSec ?? "-"}</td>
        <td class="text-end">${it.outQty ?? 1}</td>
        <td>${ing}</td>
        <td>${colorChip} ${imgChip}</td>
        <td><button class="btn btn-sm btn-outline-secondary btn-load" data-name="${it.name}">編集</button></td>
      </tr>
    `;
    });
    tbody.innerHTML = rows.join("") || `<tr><td colspan="6" class="text-body-secondary">まだ何もありません。左のフォームから追加してね。</td></tr>`;
    tbody.querySelectorAll(".btn-load").forEach(btn => {
        btn.addEventListener("click", () => {
            const it = items[btn.dataset.name];
            $("#item-name").value = it.name;
            $("#item-time").value = it.timeSec ?? "";
            $("#item-outqty").value = it.outQty ?? 1;
            $("#item-color").value = it.color ?? "#b9d4ff";
            $("#item-image").value = it.image ?? "";
            const wrap = $("#ingredients");
            wrap.innerHTML = "";
            (it.ingredients || []).forEach(ing => wrap.appendChild(ingredientRow(ing.name, ing.qty)));
            if ((it.ingredients || []).length === 0) wrap.appendChild(ingredientRow());
            // 移動
            bootstrap.Tab.getOrCreateInstance(document.querySelector('#tab-items')).show();
        });
    });
}

function refreshUI(items) {
    renderItemsTable(items);
    refreshItemListDatalist(items);
}

// ====== Validation ======
function upsertPlaceholder(items, name) {
    if (!items[name]) {
        items[name] = { name, timeSec: null, outQty: 1, color: null, image: null, ingredients: [] };
    }
}

// ====== Graph / Calc ======
function buildGraph(items) {
    // adjacency: parent -> [children...], where edges parent (output) <- requires - child (ingredient)
    const graph = {};
    Object.values(items).forEach(it => {
        if (!graph[it.name]) graph[it.name] = new Set();
        (it.ingredients || []).forEach(ing => {
            if (!graph[ing.name]) graph[ing.name] = new Set();
            graph[it.name].add(ing.name);
        });
    });
    return graph;
}

function detectCycleFrom(root, items) {
    const graph = buildGraph(items);
    const visiting = new Set(), visited = new Set();
    let hasCycle = false;
    function dfs(n) {
        if (visited.has(n) || hasCycle) return;
        visiting.add(n);
        for (const child of (graph[n] || [])) {
            if (visiting.has(child)) { hasCycle = true; return; }
            dfs(child);
        }
        visiting.delete(n);
        visited.add(n);
    }
    dfs(root);
    return hasCycle;
}

function gatherSubtree(root, items) {
    const result = new Set();
    function dfs(n) {
        if (result.has(n)) return;
        result.add(n);
        const it = items[n];
        (it?.ingredients || []).forEach(ing => dfs(ing.name));
    }
    dfs(root);
    return Array.from(result);
}

// requiredRates: recursively compute per-second demand
function computeRates(root, targetPerSec, items) {
    const rates = {}; // name -> perSec
    function need(name, perSec) {
        rates[name] = (rates[name] || 0) + perSec;
        const it = items[name];
        if (!it || !it.ingredients || it.ingredients.length === 0) return;
        const outQty = Math.max(1, it.outQty || 1);
        // To output perSec of 'name', crafts per second needed:
        const craftsPerSec = perSec / outQty;
        it.ingredients.forEach(ing => {
            need(ing.name, craftsPerSec * Number(ing.qty));
        });
    }
    need(root, targetPerSec);
    return rates;
}

// machine counts from rate: machine = requiredRate / capacityPerMachine
function computeMachines(rates, items) {
    const rows = [];
    for (const [name, perSec] of Object.entries(rates)) {
        const it = items[name];
        if (!it || it.timeSec == null) continue; // 原料など加工無しはスキップ
        const outQty = Math.max(1, it.outQty || 1);
        const capacity = outQty / Number(it.timeSec); // 個/秒
        const machines = perSec / capacity;
        rows.push({ name, capacity, machines, ceil: Math.ceil(machines * 1e6) / 1e6 /* pretty ceil? real ceil number */ });
    }
    // better ceil displayed as integer up
    rows.forEach(r => r.ceil = Math.ceil(r.machines));
    rows.sort((a, b) => b.machines - a.machines);
    return rows;
}

// ====== Mermaid builder ======
function hexOrDefault(c) {
    if (!c) return "--fp-node-default";
    return c;
}

function buildMermaid(root, items) {
    // Build only the subtree under root for clarity
    const sub = new Set(gatherSubtree(root, items));
    const lines = [];
    lines.push("flowchart TD");
    // Nodes
    for (const name of sub) {
        const it = items[name] || {};
        const color = it.color || null;
        // Node label with outQty/time if available
        const meta = (it.timeSec != null)
            ? `\\n(出力:${it.outQty || 1}/回, ${it.timeSec}s)`
            : "";
        const safeId = name.replace(/[^a-zA-Z0-9_]/g, "_");
        lines.push(`${safeId}["${name}${meta}"]`);
        if (color) {
            lines.push(`style ${safeId} fill:${color},stroke:#333,stroke-width:1px`);
        }
    }
    // Edges: parent (product) --> ingredient
    for (const name of sub) {
        const it = items[name];
        if (!it?.ingredients?.length) continue;
        const parent = name.replace(/[^a-zA-Z0-9_]/g, "_");
        it.ingredients.forEach(ing => {
            if (!sub.has(ing.name)) return;
            const child = ing.name.replace(/[^a-zA-Z0-9_]/g, "_");
            lines.push(`${parent} -->|×${ing.qty}| ${child}`);
        });
    }
    return lines.join("\n");
}

// ====== Event wiring ======
const items = loadItems();
document.addEventListener("DOMContentLoaded", () => {
    refreshUI(items);

    // 初期行
    if ($("#ingredients").children.length === 0) {
        $("#ingredients").appendChild(ingredientRow());
    }

    $("#btn-add-ing").addEventListener("click", () => {
        $("#ingredients").appendChild(ingredientRow());
    });

    $("#btn-clear-form").addEventListener("click", () => {
        $("#item-form").reset();
        $("#ingredients").innerHTML = "";
        $("#ingredients").appendChild(ingredientRow());
    });

    $("#item-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $("#item-name").value.trim();
        if (!name) return;
        const timeRaw = $("#item-time").value.trim();
        const timeSec = timeRaw === "" ? null : Number(timeRaw);
        const outQty = Math.max(1, Number($("#item-outqty").value || 1));
        const color = $("#item-color").value || null;
        const image = $("#item-image").value.trim() || null;

        // ingredients
        const ings = [];
        $$("#ingredients .ing-row").forEach(row => {
            const iname = row.querySelector(".ing-name").value.trim();
            const qty = Number(row.querySelector(".ing-qty").value);
            if (iname && qty > 0) ings.push({ name: iname, qty });
        });

        // upsert
        if (!items[name]) items[name] = { name, timeSec, outQty, color, image, ingredients: ings };
        else Object.assign(items[name], { timeSec, outQty, color, image, ingredients: ings });

        // placeholders for unknown ingredients
        ings.forEach(x => upsertPlaceholder(items, x.name));

        saveItems(items);
    });

    $("#btn-delete").addEventListener("click", () => {
        const name = $("#item-name").value.trim();
        if (!name || !items[name]) return;
        if (!confirm(`「${name}」を削除しますか？`)) return;

        // Also remove references from other recipes
        Object.values(items).forEach(it => {
            if (!it.ingredients) return;
            it.ingredients = it.ingredients.filter(ing => ing.name !== name);
        });
        delete items[name];
        saveItems(items);
        $("#btn-clear-form").click();
    });

    // 計算
    $("#calc-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const root = $("#goal-item").value.trim();
        const x = Number($("#goal-x").value);
        const n = Number($("#goal-n").value);
        if (!root || !items[root]) {
            toastWarn("最終アイテムが未登録です。まずはアイテム登録タブで作成してください。");
            return;
        }
        if (detectCycleFrom(root, items)) {
            toastWarn("レシピに循環参照があります（ループ）。解除してください。");
            return;
        }
        toastWarn("");

        const perSec = x / n;
        const rates = computeRates(root, perSec, items);

        // rates table
        const rtbody = $("#rates-table tbody");
        rtbody.innerHTML = Object.entries(rates)
            .sort((a, b) => b[1] - a[1])
            .map(([name, val]) => `<tr><td>${name}</td><td class="text-end">${val.toFixed(6)}</td></tr>`)
            .join("");

        // machines table
        const mach = computeMachines(rates, items);
        const mtbody = $("#machines-table tbody");
        mtbody.innerHTML = mach.map(r => {
            return `<tr>
        <td>${r.name}</td>
        <td class="text-end">${r.capacity.toFixed(6)}</td>
        <td class="text-end">${r.machines.toFixed(3)}</td>
        <td class="text-end fw-bold">${r.ceil}</td>
      </tr>`;
        }).join("") || `<tr><td colspan="4" class="text-body-secondary">加工時間が未設定のアイテムのみ（装置数は算出不可）</td></tr>`;

        // 図タブにもルートを反映
        $("#diagram-root").value = root;
        bootstrap.Tab.getOrCreateInstance(document.querySelector('#tab-calc')).show();
    });

    // Diagram
    $("#btn-build-diagram").addEventListener("click", async () => {
        const root = $("#diagram-root").value.trim();
        if (!root || !items[root]) {
            alert("ルート（最終アイテム）を入力してください。");
            return;
        }
        if (detectCycleFrom(root, items)) {
            alert("レシピに循環参照があります（ループ）。解除してください。");
            return;
        }
        const src = buildMermaid(root, items);
        $("#mermaid-src").textContent = src;
        $("#mermaid-src").classList.remove("d-none");
        $("#diagram").innerHTML = "";
        try {
            const { svg } = await mermaid.render(`m_${Date.now()}`, src);
            $("#diagram").innerHTML = svg;
        } catch (e) {
            $("#diagram").innerHTML = `<div class="alert alert-danger">Mermaid描画エラー: ${e}</div>`;
        }
    });

    $("#btn-copy-mermaid").addEventListener("click", () => {
        const code = $("#mermaid-src").textContent.trim();
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
            alert("Mermaidコードをコピーしました。");
        });
    });

    $("#btn-download-svg").addEventListener("click", () => {
        const svg = $("#diagram svg");
        if (!svg) { alert("まずダイアグラムを生成してください。"); return; }
        const serializer = new XMLSerializer();
        const src = serializer.serializeToString(svg);
        const blob = new Blob([src], { type: "image/svg+xml" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `diagram_${Date.now()}.svg`;
        a.click();
        URL.revokeObjectURL(a.href);
    });

    // Import / Export
    $("#btn-export").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "factory_planner_items.json";
        a.click();
        URL.revokeObjectURL(a.href);
    });
    $("#import-file").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (typeof data !== "object") throw new Error("JSON形式が不正です");
            // ざっくりマージ（同名は上書き）
            Object.entries(data).forEach(([k, v]) => items[k] = v);
            saveItems(items);
            alert("インポートしました。");
        } catch (err) {
            alert("インポート失敗: " + err.message);
        } finally {
            e.target.value = "";
        }
    });

    // デモデータ
    $("#btn-demo").addEventListener("click", () => {
        const demo = {
            "Iron Ore": { name: "Iron Ore", timeSec: null, outQty: 1, color: "#a8a8a8", image: null, ingredients: [] },
            "Copper Ore": { name: "Copper Ore", timeSec: null, outQty: 1, color: "#c28a5b", image: null, ingredients: [] },
            "Coal": { name: "Coal", timeSec: null, outQty: 1, color: "#242424", image: null, ingredients: [] },
            "Iron Ingot": { name: "Iron Ingot", timeSec: 3.2, outQty: 1, color: "#b9d4ff", image: null, ingredients: [{ name: "Iron Ore", qty: 1 }] },
            "Copper Ingot": { name: "Copper Ingot", timeSec: 3.2, outQty: 1, color: "#ffd1a6", image: null, ingredients: [{ name: "Copper Ore", qty: 1 }] },
            "Steel Ingot": { name: "Steel Ingot", timeSec: 8, outQty: 1, color: "#8aa0a8", image: null, ingredients: [{ name: "Iron Ingot", qty: 2 }, { name: "Coal", qty: 1 }] },
            "Iron Plate": { name: "Iron Plate", timeSec: 1.6, outQty: 1, color: "#e4eefc", image: null, ingredients: [{ name: "Iron Ingot", qty: 1 }] },
            "Copper Wire": { name: "Copper Wire", timeSec: 0.5, outQty: 2, color: "#ffe5cc", image: null, ingredients: [{ name: "Copper Ingot", qty: 1 }] },
            "Circuit": { name: "Circuit", timeSec: 4, outQty: 1, color: "#d7ffd9", image: null, ingredients: [{ name: "Iron Plate", qty: 1 }, { name: "Copper Wire", qty: 2 }] }
        };
        Object.assign(items, demo);
        saveItems(items);
    });
});
