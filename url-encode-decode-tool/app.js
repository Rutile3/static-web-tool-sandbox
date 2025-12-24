/* =========================================================
 * URLエンコード・デコードツール
 * (UTF-8 / SJIS / EUC-JP / JIS対応)
 * - Config一元化 + localStorage永続化 + JS標準互換プリセット対応版
 * =======================================================*/

(() => {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    // --- Config: 既定値をここで一元管理 ---
    const CONFIG = {
        // 既定の文字コード
        defaultEncoding: "UTF8",

        // 記号のエンコード既定（true=エンコード / false=そのまま）
        defaultEncodeSpecials: {
            "*": false,
            "-": false,
            ".": false,
            "_": false,
            "~": false,
            "/": true,   // 既定でエンコード
            "?": true    // 既定でエンコード
        }
    };

    // 記号 → DOM id 対応表
    const SPECIAL_ID = {
        "*": "#optAsterisk",
        "-": "#optHyphen",
        ".": "#optPeriod",
        "_": "#optUnderscore",
        "~": "#optTilde",
        "/": "#optSlash",
        "?": "#optQuestion"
    };

    // --- 初期設定をUIへ反映（CONFIG適用）
    function applyDefaultConfig() {
        // エンコーディング既定値を反映
        const encId = {
            "UTF8": "#encUtf8",
            "SJIS": "#encSjis",
            "EUCJP": "#encEuc",
            "JIS": "#encJis"
        }[CONFIG.defaultEncoding] ?? "#encUtf8";
        const encRadio = document.querySelector(encId);
        if (encRadio) encRadio.checked = true;

        // 記号チェックの既定
        for (const [ch, on] of Object.entries(CONFIG.defaultEncodeSpecials)) {
            const id = SPECIAL_ID[ch];
            if (id) {
                const el = document.querySelector(id);
                if (el) el.checked = !!on;
            }
        }
    }

    // --- localStorage: 設定保存/復元 ---
    const STORAGE_KEY = "uedt:prefs";

    function savePrefs() {
        try {
            const encEl = document.querySelector('input[name="enc"]:checked');
            const enc = encEl ? encEl.value : (CONFIG.defaultEncoding || "UTF8");
            const specials = {};
            for (const [ch, sel] of Object.entries(SPECIAL_ID)) {
                const el = $(sel);
                specials[ch] = !!(el && el.checked);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ enc, specials }));
        } catch {
            // 保存失敗時は黙ってスキップ（プライベートモード等）
        }
    }

    function loadPrefs() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const { enc, specials } = JSON.parse(raw);

            // encoding
            const encId = { UTF8: "#encUtf8", SJIS: "#encSjis", EUCJP: "#encEuc", JIS: "#encJis" }[enc];
            if (encId && $(encId)) $(encId).checked = true;

            // specials
            for (const [ch, sel] of Object.entries(SPECIAL_ID)) {
                const el = $(sel);
                if (el && specials && ch in specials) el.checked = !!specials[ch];
            }
            return true;
        } catch {
            return false;
        }
    }

    // --- Elements
    const input = $("#inputText");
    const output = $("#outputText");
    const btnEncode = $("#btnEncode");
    const btnDecode = $("#btnDecode");
    const btnSwap = $("#btnSwap");
    const btnClear = $("#btnClear");
    const btnCopy = $("#btnCopy");
    const btnPresetJS = $("#btnPresetJS"); // ← 追加

    const optChecks = $$(".opt-chk");

    // 初期設定：保存があれば復元、なければCONFIG適用
    if (!loadPrefs()) applyDefaultConfig();

    // --- Util: 選択エンコーディング
    function getEncoding() {
        const el = document.querySelector('input[name="enc"]:checked');
        return el ? el.value : (CONFIG.defaultEncoding || "UTF8");
    }

    // --- Util: ライブラリ存在チェック
    function ensureEncodingLib() {
        if (typeof Encoding === "undefined") {
            throw new Error("encoding-japanese の読み込みに失敗しました。ネットワーク状況をご確認ください。");
        }
    }

    // --- 文字列 -> バイト配列（選択エンコーディング）
    function strToBytes(str, enc) {
        if (enc === "UTF8") {
            return Array.from(new TextEncoder().encode(str));
        }
        ensureEncodingLib();
        return Encoding.convert(str, { to: enc, type: "array" });
    }

    // --- バイト配列 -> 文字列（選択エンコーディング）
    function bytesToStr(bytes, enc) {
        if (enc === "UTF8") {
            return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
        }
        ensureEncodingLib();
        return Encoding.convert(bytes, { from: enc, to: "UNICODE", type: "string" });
    }

    // --- エンコード許可テーブル生成
    function buildAllowedTable() {
        const allowed = new Set();
        // A-Z a-z 0-9
        for (let c = 0x30; c <= 0x39; c++) allowed.add(String.fromCharCode(c));
        for (let c = 0x41; c <= 0x5A; c++) allowed.add(String.fromCharCode(c));
        for (let c = 0x61; c <= 0x7A; c++) allowed.add(String.fromCharCode(c));
        // - _ . ~ は既定で許可（=エンコードしない）
        "-_.~".split("").forEach(ch => allowed.add(ch));

        // UIチェックを反映
        for (const [ch, sel] of Object.entries(SPECIAL_ID)) {
            const checked = $(sel)?.checked;
            if (checked) {
                allowed.delete(ch); // エンコードする
            } else {
                allowed.add(ch);    // そのまま残す
            }
        }
        return allowed;
    }

    // --- バイト列を %HH 展開
    function percentEncode(bytes, allowed) {
        let out = "";
        for (const b of bytes) {
            if (b < 0x80) {
                const ch = String.fromCharCode(b);
                if (allowed.has(ch)) {
                    out += ch;
                } else {
                    out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
                }
            } else {
                out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
            }
        }
        return out;
    }

    // --- テキストをエンコード
    function encodeText(text, enc) {
        const allowed = buildAllowedTable();
        const bytes = strToBytes(text, enc);
        return percentEncode(bytes, allowed);
    }

    // --- 入力をバイト列に復元
    function parseToBytesFromInput(text, enc) {
        const bytes = [];
        let i = 0;
        let buf = "";

        const flushBuf = () => {
            if (buf.length > 0) {
                const part = strToBytes(buf, enc);
                for (const b of part) bytes.push(b);
                buf = "";
            }
        };

        while (i < text.length) {
            const ch = text[i];
            if (ch === "%" && i + 2 < text.length) {
                const h1 = text[i + 1];
                const h2 = text[i + 2];
                const hex = h1 + h2;
                if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                    flushBuf();
                    bytes.push(parseInt(hex, 16));
                    i += 3;
                    continue;
                }
                buf += ch;
                i += 1;
            } else {
                buf += ch;
                i += 1;
            }
        }
        flushBuf();
        return bytes;
    }

    // --- テキストをデコード
    function decodeText(text, enc) {
        const bytes = parseToBytesFromInput(text, enc);
        try {
            return bytesToStr(bytes, enc);
        } catch (e) {
            try {
                return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
            } catch (_) {
                return text;
            }
        }
    }

    // --- イベントハンドラ
    btnEncode.addEventListener("click", () => {
        const enc = getEncoding();
        try {
            output.value = encodeText(input.value ?? "", enc);
        } catch (e) {
            output.value = `[エラー] ${e.message}`;
        }
    });

    btnDecode.addEventListener("click", () => {
        const enc = getEncoding();
        try {
            const src = input.value ?? "";
            const maybeBroken = /%(?![0-9A-Fa-f]{2})/.test(src);
            if (maybeBroken) {
                console.warn("不正な % エスケープが含まれる可能性があります。可能な限り復元を試みます。");
            }
            output.value = decodeText(src, enc);
        } catch (e) {
            output.value = `[エラー] ${e.message}`;
        }
    });

    btnSwap.addEventListener("click", () => {
        const a = input.value;
        input.value = output.value;
        output.value = a;
    });

    btnClear.addEventListener("click", () => {
        input.value = "";
        output.value = "";
        input.focus();
    });

    btnCopy.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(output.value ?? "");
            btnCopy.textContent = "コピーしました";
            setTimeout(() => (btnCopy.textContent = "コピー"), 1200);
        } catch {
            output.select();
            document.execCommand("copy");
        }
    });

    // Enter = エンコード / Ctrl+Enter = デコード
    input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
            btnDecode.click();
        } else if (ev.key === "Enter") {
            btnEncode.click();
        }
    });

    // --- 設定の自動保存トリガ
    $$('input[name="enc"]').forEach(r => r.addEventListener("change", savePrefs));
    $$('.opt-chk').forEach(c => c.addEventListener("change", savePrefs));

    // --- JS標準互換プリセットボタン（encodeURIComponent風）
    btnPresetJS?.addEventListener("click", () => {
        // 全部オフ
        for (const sel of Object.values(SPECIAL_ID)) $(sel).checked = false;
        // JS標準でエンコードされる記号：/と?をON
        $("#optSlash").checked = true;
        $("#optQuestion").checked = true;
        savePrefs();
    });
})();
