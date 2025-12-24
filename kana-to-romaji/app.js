/* Kana → Romaji converter supporting: Nihon-shiki, Kunrei-shiki, MOFA-Hepburn, Station-Hepburn */

(() => {
    const $ = (sel) => document.querySelector(sel);
    const inputEl = $('#input');
    const btnConvert = $('#convert');
    const btnClear = $('#clear');
    const autoDetect = $('#autoDetect');
    const useApostrophe = $('#useApostrophe');

    // Helpers
    const HIRA_START = 0x3041, HIRA_END = 0x3096;
    const KATA_START = 0x30A1, KATA_END = 0x30FA;
    const PROLONG = 'ー';

    const isHiragana = (s) => [...s].some(ch => ch.codePointAt(0) >= HIRA_START && ch.codePointAt(0) <= HIRA_END);
    const isKatakana = (s) => [...s].some(ch => ch.codePointAt(0) >= KATA_START && ch.codePointAt(0) <= KATA_END || ch === PROLONG);

    const kataToHira = (s) => {
        return s.replace(/[\u30A1-\u30FA]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
    };

    // Base maps (monographs)
    const baseNihon = {
        'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
        'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
        'さ': 'sa', 'し': 'si', 'す': 'su', 'せ': 'se', 'そ': 'so',
        'た': 'ta', 'ち': 'ti', 'つ': 'tu', 'て': 'te', 'と': 'to',
        'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
        'は': 'ha', 'ひ': 'hi', 'ふ': 'hu', 'へ': 'he', 'ほ': 'ho',
        'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
        'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
        'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
        'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'wo',
        'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
        'ざ': 'za', 'じ': 'zi', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
        'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
        'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
        'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
        'ゔ': 'vu',
        'ぁ': 'xa', 'ぃ': 'xi', 'ぅ': 'xu', 'ぇ': 'xe', 'ぉ': 'xo',
        'ゃ': 'xya', 'ゅ': 'xyu', 'ょ': 'xyo', 'ゎ': 'xwa',
        'っ': '*sokuon*', 'ん': '*n*',
        'ー': '*prolong*'
    };

    // Kunrei differs in a few places vs Nihon (ji/zu, di/du)
    const baseKunrei = Object.assign({}, baseNihon, {
        'ぢ': 'zi', 'づ': 'zu'
    });

    // Hepburn (phonemic). We'll start from Kunrei, then patch shi/chi/tsu/ji/fu, ji/zu, etc.
    const baseHepburn = Object.assign({}, baseKunrei, {
        'し': 'shi', 'ち': 'chi', 'つ': 'tsu', 'じ': 'ji', 'ぢ': 'ji', 'づ': 'zu', 'ふ': 'fu', 'ゔ': 'vu', 'を': 'o' // modern
    });

    // Youon (digraphs)
    function youonFrom(base) {
        const map = Object.assign({}, base);
        const rows = [
            ['き', 'k'], ['ぎ', 'g'], ['し', base === baseHepburn ? 'sh' : 's'],
            ['じ', base === baseHepburn ? 'j' : (base === baseKunrei ? 'z' : 'z')],
            ['ち', base === baseHepburn ? 'ch' : 't'], ['ぢ', base === baseHepburn ? 'j' : (base === baseKunrei ? 'z' : 'd')],
            ['に', 'n'], ['ひ', 'h'], ['び', 'b'], ['ぴ', 'p'], ['み', 'm'], ['り', 'r'], ['ぎ', 'g'], ['ゔ', 'v']
        ];
        const tails = { 'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo' };
        for (const [hi, cons] of rows) {
            for (const [small, yv] of Object.entries(tails)) {
                const key = hi + small;
                let val;
                if (hi === 'ち' && base === baseHepburn) { // cha/chu/cho
                    val = cons + yv.replace('y', ''); // 'cha','chu','cho'
                } else if ((hi === 'ぢ' && base !== baseNihon)) {
                    // Kunrei treats ぢゃ/ぢゅ/ぢょ as zya/zyu/zyo; Hepburn as ja/ju/jo
                    if (base === baseKunrei) val = 'zy' + yv.slice(1);
                    else val = 'j' + yv.slice(1);
                } else if (hi === 'じ') {
                    if (base === baseHepburn) val = 'j' + yv.slice(1);
                    else val = 'zy' + yv.slice(1);
                } else if (hi === 'し') {
                    if (base === baseHepburn) val = 'sh' + yv.slice(1);
                    else val = 'sy' + yv.slice(1);
                } else {
                    val = cons + yv.slice(1); // kya, gya, nya...
                }
                map[key] = val;
            }
        }
        // Special cases
        if (base === baseNihon) {
            map['ゐゃ'] = 'wya'; map['ゑゃ'] = 'wya'; // rare
        }
        return map;
    }

    const nihonMap = youonFrom(baseNihon);
    const kunreiMap = youonFrom(baseKunrei);
    const hepburnMap = youonFrom(baseHepburn);

    // Consonant doubling rules for sokuon
    function applySokuon(token) {
        if (!token) return token;
        const special = token.startsWith('ch'); // っ + ち → tch
        if (special) return 't' + token;
        // First letter consonant
        const m = token.match(/^([bcdfghjklmnpqrstvwxyz])/);
        if (m) return m[1] + token;
        return token; // vowels etc.
    }

    // Long vowel helper (katakana PROLONG or vowel sequences). Policy: keep or collapse to 1 char.
    function handleProlong(out, policy) {
        if (policy === 'collapse') {
            // Collapse any aa/ii/uu/ee/oo to a/i/u/e/o
            return out.replace(/([aiueo])\1+/g, '$1');
        }
        return out;
    }

    // Post-process for styles
    function hepburnPassportPost(s) {
        // No macrons; also simplify doubled vowels typical for signage/passport when desired by radio (handled by policy)
        // Keep apostrophes to disambiguate n (handled earlier).
        return s;
    }

    function hepburnStationPost(s) {
        // Station style: no macrons, no apostrophe for n, and do not use m-assimilation.
        // We'll remove apostrophes and convert any "m" from n-assimilation back to n.
        return s.replace(/m(?=[bmp])/g, 'n').replace(/n'/g, 'n');
    }

    function buildConverter(map, options) {
        const { useApo, stationMode = false, mAssimilate = false, longVowelPolicy = 'keep' } = options;
        return function convert(hira, original) {
            let out = '';
            let i = 0;
            let geminate = false;
            while (i < hira.length) {
                const ch = hira[i];

                // Prolong from Katakana 'ー' if present in original
                if (ch === 'ー') {
                    // Extend previous vowel by repeating last vowel char once
                    const v = out.match(/[aiueo](?!.*[aiueo])/);
                    if (v) out += v[0];
                    i++; continue;
                }

                // Sokuon
                if (ch === 'っ') {
                    geminate = true; i++; continue;
                }

                // 'n' syllabic
                if (ch === 'ん') {
                    const next = hira[i + 1] || '';
                    const nextRomaji = map[next] || map[hira.substring(i + 1, i + 3)] || '';
                    // Decide n/m
                    let nRoman = 'n';
                    const nextInitial = nextRomaji ? nextRomaji[0] : '';
                    if (mAssimilate && /[bmp]/.test(nextInitial)) nRoman = 'm';
                    // Apostrophe to disambiguate (n + vowel/ y)
                    const needsApo = /[aiueoyn]/.test(nextInitial);
                    out += nRoman + (useApo && needsApo ? "'" : '');
                    i++; continue;
                }

                // Try digraph (youon)
                const two = hira.substring(i, i + 2);
                if (map[two]) {
                    const token = geminate ? applySokuon(map[two]) : map[two];
                    out += token;
                    geminate = false;
                    i += 2; continue;
                }

                // Monograph
                if (map[ch]) {
                    let token = map[ch];
                    if (geminate) token = applySokuon(token);
                    out += token;
                    geminate = false;
                    i++; continue;
                }

                // Non-kana (punctuation, spaces, kanji) => pass-through
                out += original[i];
                i++;
            }

            out = handleProlong(out, longVowelPolicy);
            return out;
        };
    }

    function convertAll(src, options) {
        const original = src;
        // Normalize to hiragana, but keep original for non-kana passthrough and prolonged sound
        let hira = src;
        if (isKatakana(src)) {
            // Keep PROLONG; map others
            hira = kataToHira(src.replace(/ー/g, PROLONG));
        }
        // Build converters
        const convNihon = buildConverter(nihonMap, { useApo: options.useApo, mAssimilate: false, longVowelPolicy: options.longVowelPolicy });
        const convKunrei = buildConverter(kunreiMap, { useApo: options.useApo, mAssimilate: false, longVowelPolicy: options.longVowelPolicy });
        const convHep = buildConverter(hepburnMap, { useApo: options.useApo, mAssimilate: true, longVowelPolicy: options.longVowelPolicy });
        const convStation = buildConverter(hepburnMap, { useApo: false, mAssimilate: false, longVowelPolicy: 'collapse' });

        let nihon = convNihon(hira, original);
        let kunrei = convKunrei(hira, original);
        let hepburn = convHep(hira, original);
        let station = convStation(hira, original);

        // Passport Hepburn post (here we avoid macrons by design; keeping doubled vowels as per policy)
        hepburn = hepburnPassportPost(hepburn);
        station = hepburnStationPost(station);

        return { nihon, kunrei, hepburn, station };
    }

    function doConvert() {
        const src = inputEl.value;
        const longVowelPolicy = document.querySelector('input[name="longVowelPolicy"]:checked').value;
        const res = convertAll(src, { useApo: useApostrophe.checked, longVowelPolicy });

        $('#nihon').textContent = res.nihon;
        $('#kunrei').textContent = res.kunrei;
        $('#hepburn_mofa').textContent = res.hepburn;
        $('#hepburn_station').textContent = res.station;
    }

    btnConvert.addEventListener('click', doConvert);
    inputEl.addEventListener('input', doConvert);
    btnClear.addEventListener('click', () => {
        inputEl.value = '';
        doConvert();
    });

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const target = btn.getAttribute('data-target');
            const text = document.querySelector(target).textContent;
            try {
                await navigator.clipboard.writeText(text);
                btn.textContent = 'コピーしました';
                setTimeout(() => btn.textContent = 'コピー', 1200);
            } catch (_) {
                btn.textContent = '失敗…';
                setTimeout(() => btn.textContent = 'コピー', 1200);
            }
        });
    });

    // Demo text
    inputEl.value = 'とうきょう　しんじゅくえき／トウキョウ　シンジュクエキ／きょうと・おおさか・えいご';
    doConvert();
})();
