const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const modeEl = document.getElementById('mode');
const copyButton = document.getElementById('copyButton');
const clearButton = document.getElementById('clearButton');
const swapButton = document.getElementById('swapButton');

function encodeToNumericReferences(text) {
    return Array.from(text).map((char) => {
        const codePoint = char.codePointAt(0);
        return `&#${codePoint};`;
    }).join('');
}

function decodeNumericReferences(text) {
    return text.replace(/&#(?:x([0-9a-fA-F]+)|(\d+));/g, (_, hex, dec) => {
        const codePoint = hex ? parseInt(hex, 16) : parseInt(dec, 10);

        if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
            return _;
        }

        try {
            return String.fromCodePoint(codePoint);
        } catch {
            return _;
        }
    });
}

function convert() {
    const input = inputEl.value;
    const mode = modeEl.value;

    outputEl.value = mode === 'encode'
        ? encodeToNumericReferences(input)
        : decodeNumericReferences(input);
}

async function copyOutput() {
    if (!outputEl.value) {
        return;
    }

    try {
        await navigator.clipboard.writeText(outputEl.value);
        copyButton.textContent = 'コピーしました';
        window.setTimeout(() => {
            copyButton.textContent = '出力をコピー';
        }, 1500);
    } catch {
        outputEl.select();
        document.execCommand('copy');
        copyButton.textContent = 'コピーしました';
        window.setTimeout(() => {
            copyButton.textContent = '出力をコピー';
        }, 1500);
    }
}

function clearAll() {
    inputEl.value = '';
    outputEl.value = '';
    inputEl.focus();
}

function swapInputOutput() {
    inputEl.value = outputEl.value;
    convert();
}

inputEl.addEventListener('input', convert);
modeEl.addEventListener('change', convert);
copyButton.addEventListener('click', copyOutput);
clearButton.addEventListener('click', clearAll);
swapButton.addEventListener('click', swapInputOutput);

convert();
