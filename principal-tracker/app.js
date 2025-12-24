// === ユーティリティ ==========================================

const el = (id) => document.getElementById(id);
const csvFile = el("csvFile");
const btnParse = el("btnParse");
const btnExport = el("btnExport");
const alertBox = el("alert");
const summaryRow = el("summaryRow");
const tableCard = el("tableCard");
const chartCard = el("chartCard");

const fmtJPY = (n) =>
    n.toLocaleString("ja-JP", {
        style: "currency",
        currency: "JPY",
        maximumFractionDigits: 0,
    });
const fmtInt = (n) => n.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
const toNumber = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    return Number(String(v).replaceAll(",", "").trim() || 0);
};
const toDate = (s) => {
    if (!s) return null;
    // s like "2020/3/4" or "2020-03-04"
    const t = String(s).trim().replaceAll("-", "/");
    const [Y, M, D] = t.split("/").map(Number);
    const d = new Date(Y, (M || 1) - 1, D || 1);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
};
const showAlert = (kind, msg) => {
    alertBox.innerHTML = `<div class="alert alert-${kind}" role="alert">${msg}</div>`;
};
const clearAlert = () => (alertBox.innerHTML = "");

// Parse CSV (simple, RFC4180-ish). For large files you may swap to PapaParse, but here we keep deps minimal.
function parseCSV(text) {
    const rows = [];
    let cur = "",
        inQuotes = false;
    const pushCell = (arr) => {
        arr.push(cur);
        cur = "";
    };
    const pushRow = (arr) => {
        rows.push(arr);
    };
    let row = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') {
                cur += '"';
                i++;
                continue;
            }
            if (ch === '"') {
                inQuotes = false;
                continue;
            }
            cur += ch;
        } else {
            if (ch === '"') {
                inQuotes = true;
                continue;
            }
            if (ch === ",") {
                pushCell(row);
                continue;
            }
            if (ch === "\n") {
                pushCell(row);
                pushRow(row);
                row = [];
                continue;
            }
            if (ch === "\r") {
                continue;
            }
            cur += ch;
        }
    }
    // last cell
    pushCell(row);
    pushRow(row);
    // drop empty last row if needed
    if (rows.length && rows[rows.length - 1].every((c) => c.trim() === ""))
        rows.pop();
    return rows;
}

// Try mapping Rakuten columns by common header text
function mapHeaders(headers) {
    const idx = {};
    const find = (cands) => {
        const i = headers.findIndex((h) => cands.some((c) => h.includes(c)));
        return i >= 0 ? i : -1;
    };
    idx.date_settle = find(["受渡日"]);
    idx.date_trade = find(["約定日"]);
    idx.side = find(["売買区分"]);
    idx.qty = find(["数量［株］", "数量[株]", "数量"]);
    idx.price = find(["単価［円］", "約定単価", "約定単価［円］", "単価"]);
    idx.amount_settle = find(["受渡金額［円］", "受渡金額"]);
    idx.fee = find(["手数料［円］", "手数料"]);
    idx.tax = find(["税金等［円］", "消費税", "消費税等"]);
    idx.code = find(["銘柄コード"]);
    idx.name = find(["銘柄名"]);
    return idx;
}

function requiredPresent(idx) {
    const required = ["side", "qty", "amount_settle"];
    return (
        required.every((k) => idx[k] >= 0) &&
        (idx.date_settle >= 0 || idx.date_trade >= 0)
    );
}

// Compute principal (元本) time series using moving-average method per symbol
function computePrincipal(rows, idx) {
    // Normalize rows into objects
    const txs = rows
        .map((r) => ({
            dSettle: idx.date_settle >= 0 ? toDate(r[idx.date_settle]) : null,
            dTrade: idx.date_trade >= 0 ? toDate(r[idx.date_trade]) : null,
            date:
                idx.date_settle >= 0
                    ? toDate(r[idx.date_settle])
                    : idx.date_trade >= 0
                        ? toDate(r[idx.date_trade])
                        : null,
            side: r[idx.side]?.trim(),
            qty: toNumber(r[idx.qty]),
            amountSettle: toNumber(r[idx.amount_settle]),
            fee: idx.fee >= 0 ? toNumber(r[idx.fee]) : 0,
            tax: idx.tax >= 0 ? toNumber(r[idx.tax]) : 0,
            code: idx.code >= 0 ? String(r[idx.code]).trim() : "",
            name: idx.name >= 0 ? String(r[idx.name]).trim() : "",
        }))
        .filter((t) => t.date && t.side && (t.qty || 0) > 0 && t.amountSettle > 0);

    // Sort by date asc, then stable by original order
    txs.sort((a, b) => a.date - b.date);

    // Per-symbol rolling positions
    const pos = new Map(); // key => { qty, cost } where cost is current principal for that symbol
    const rowsOut = [];
    const principalSeries = []; // { date, principal }

    function ensure(sym) {
        if (!pos.has(sym)) pos.set(sym, { qty: 0, cost: 0 });
        return pos.get(sym);
    }
    function totalPrincipal() {
        let s = 0;
        for (const { cost } of pos.values()) s += cost;
        return s;
    }

    for (const t of txs) {
        const sym = t.code || t.name || "(unknown)";
        const p = ensure(sym);

        let sellCost = 0; // reduction of principal on sell
        if (t.side.includes("買")) {
            // Buy: add full settlement (fees/taxesを含む) to cost basis
            p.cost += t.amountSettle;
            p.qty += t.qty;
        } else if (t.side.includes("売")) {
            const avg = p.qty > 0 ? p.cost / p.qty : 0;
            sellCost = Math.min(p.cost, avg * t.qty); // guard against negative
            p.cost -= sellCost;
            p.qty -= t.qty;
            if (p.qty < 0) p.qty = 0; // guard
            if (p.cost < 0) p.cost = 0;
        }
        const total = totalPrincipal();
        rowsOut.push({
            dateSettle: t.dSettle ? t.dSettle.toISOString().slice(0, 10) : "",
            dateTrade: t.dTrade ? t.dTrade.toISOString().slice(0, 10) : "",
            symbol: sym,
            name: t.name,
            side: t.side,
            qty: t.qty,
            price: t.amountSettle && t.qty ? Math.round(t.amountSettle / t.qty) : 0,
            amountSettle: t.amountSettle,
            sellCost: Math.round(sellCost),
            principalAfter: Math.round(total),
        });
        principalSeries.push({ date: t.date, value: total });
    }

    // Collapse to daily (end-of-day principal)
    const dayMap = new Map();
    for (const p of principalSeries) {
        const key = p.date.toISOString().slice(0, 10);
        dayMap.set(key, p.value); // last one of the day wins
    }
    const daily = Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value }));

    return { txRows: rowsOut, daily };
}

function renderSummary(daily) {
    if (!daily.length) return;
    summaryRow.hidden = false;
    el("mStart").textContent = daily[0].date;
    el("mEnd").textContent = daily[daily.length - 1].date;
    const cur = daily[daily.length - 1].value;
    el("mCurrent").textContent = fmtJPY(cur);
    const peak = daily.reduce((m, d) => Math.max(m, d.value), 0);
    el("mPeak").textContent = fmtJPY(peak);
}

function renderTable(txRows) {
    tableCard.hidden = false;
    const tbody = el("txBody");
    tbody.innerHTML = txRows
        .map(
            (r) => `
    <tr>
      <td>${r.dateSettle}</td>
      <td>${r.dateTrade}</td>
      <td>${r.symbol}</td>
      <td>${r.side}</td>
      <td class="text-end">${fmtInt(r.qty)}</td>
      <td class="text-end">${r.price ? fmtJPY(r.price) : "-"}</td>
      <td class="text-end">${fmtJPY(r.amountSettle)}</td>
      <td class="text-end">${r.sellCost ? "-" + fmtJPY(r.sellCost).replace("￥", "") : "-"
                }</td>
      <td class="text-end fw-semibold">${fmtJPY(r.principalAfter)}</td>
    </tr>
  `
        )
        .join("");
}

let chart;
function renderChart(daily) {
    chartCard.hidden = false;
    const ctx = document.getElementById("principalChart").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: daily.map((d) => d.date),
            datasets: [
                {
                    label: "取得額（元本）合計",
                    data: daily.map((d) => d.value),
                    tension: 0.2,
                    pointRadius: 0,
                    borderWidth: 2,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                x: { ticks: { maxTicksLimit: 10 } },
                y: { ticks: { callback: (v) => fmtJPY(v) } },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => fmtJPY(ctx.parsed.y),
                    },
                },
            },
        },
    });
}

function exportCSV(daily) {
    const header = "date,principal\n";
    const body = daily.map((d) => `${d.date},${d.value}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "principal_timeseries.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// === イベント ==========================================
csvFile.addEventListener("change", () => {
    btnParse.disabled = !csvFile.files?.length;
    btnExport.disabled = true;
    clearAlert();
});

btnParse.addEventListener("click", async () => {
    clearAlert();
    if (!csvFile.files?.length) return;
    const file = csvFile.files[0];
    const text = await file.text();

    const rows = parseCSV(text);
    if (!rows.length) return showAlert("danger", "CSVの内容が空のようです。");
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const idx = mapHeaders(headers);
    if (!requiredPresent(idx)) {
        return showAlert(
            "danger",
            "必要なカラムが見つかりませんでした。ファイルが楽天証券（国内株式）の取引履歴CSVか確認してください。"
        );
    }

    const { txRows, daily } = computePrincipal(dataRows, idx);
    if (!daily.length) {
        return showAlert("warning", "読める取引がありませんでした。");
    }

    renderSummary(daily);
    renderTable(txRows);
    renderChart(daily);
    btnExport.disabled = false;
    showAlert(
        "success",
        `読み込み完了：${fmtInt(txRows.length)} 件の取引を処理しました。`
    );
});

btnExport.addEventListener("click", () => {
    // Read the last computed daily from the chart
    if (!chart) return;
    const labels = chart.data.labels;
    const data = chart.data.datasets[0].data;
    const daily = labels.map((d, i) => ({ date: d, value: data[i] }));
    exportCSV(daily);
});
