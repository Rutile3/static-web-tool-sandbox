const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const modeEl = document.getElementById('mode');
const copyButton = document.getElementById('copyButton');
const clearButton = document.getElementById('clearButton');
const swapButton = document.getElementById('swapButton');

function encodeToNamedEntities(text) {
    return he.encode(text, {
        useNamedReferences: true,
        encodeEverything: false,
        decimal: false,
        allowUnsafeSymbols: false,
    });
}

function decodeEntities(text) {
    return he.decode(text, {
        isAttributeValue: false,
        strict: false,
    });
}

function convert() {
    const input = inputEl.value;
    const mode = modeEl.value;

    outputEl.value = mode === 'encode'
        ? encodeToNamedEntities(input)
        : decodeEntities(input);
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
