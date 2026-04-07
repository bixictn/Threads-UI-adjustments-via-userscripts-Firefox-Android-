// ==UserScript==
// @name         Twemoji Replacer
// @version      0.8.2
// @description  Twemoji Replacer
// @author       Gemini
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const EXCLUDE = ['github.com', 'stackoverflow.com', 'jsfiddle.net'];
    if (EXCLUDE.some(d => location.hostname.includes(d))) return;

    const EMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/";
    const DB_NAME = "LocalEmojiCache";
    const STORE_NAME = "svg_data";
    const NF_MARK = "NF";

    const processedNodes = new WeakSet();
    let isWorking = false;

    // 終極正規表達式：優先匹配含 ZWJ (\u200D) 的長序列，再匹配膚色組合與單一符號
    const EMOJI_REGEX = /([\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1FA70}-\u{1FAFF}](\u{FE0F}?\u{200D}\u{FE0F}?[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1FA70}-\u{1FAFF}])*[\u{1F3FB}-\u{1F3FF}]?|(\u{1F1E6}-\u{1F1FF}){2})/gu;

    let db = null;
    let isInit = false;

    function toCodePoint(unicode) {
        const r = []; let c = 0, p = 0, i = 0;
        while (i < unicode.length) {
            c = unicode.charCodeAt(i++);
            if (p) {
                r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
                p = 0;
            } else if (0xD800 <= c && c <= 0xDBFF) { p = c; }
            else { r.push(c.toString(16)); }
        }

        // 如果是組合符號 (包含 ZWJ)
        if (r.includes('200d')) {
            // 修正：如果結尾是性別符號 (2642 男 / 2640 女) 且漏了 fe0f
            // 根據你實測的伺服器規則，這裡必須補上 fe0f
            const last = r[r.length - 1];
            if ((last === '2642' || last === '2640') && !r.includes('fe0f')) {
                r.push('fe0f');
            }
            return r.join('-');
        }

        // 一般單一符號，則移除 fe0f (如數字鍵)
        return r.filter(x => x !== 'fe0f').join('-');
    }

    async function initDB() {
        if (db) return db;
        if (isInit) return new Promise(res => {
            const t = setInterval(() => { if(db){ clearInterval(t); res(db); }}, 30);
        });
        isInit = true;
        return new Promise(res => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = e => {
                if (!e.target.result.objectStoreNames.contains(STORE_NAME))
                    e.target.result.createObjectStore(STORE_NAME, { keyPath: "code" });
            };
            req.onsuccess = e => { db = e.target.result; isInit = false; res(db); };
            req.onerror = () => { isInit = false; res(null); };
        });
    }

    async function fetchValidEmojiData(raw) {
        const code = toCodePoint(raw);
        const _db = await initDB();
        if (_db) {
            const tx = _db.transaction(STORE_NAME, "readonly");
            const cached = await new Promise(r => {
                const req = tx.objectStore(STORE_NAME).get(code);
                req.onsuccess = () => r(req.result);
                req.onerror = () => r(null);
            });
            if (cached) return (cached.data === NF_MARK) ? null : cached.data;
        }

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET", url: `${EMOJI_BASE}${code}.svg`, responseType: "blob", timeout: 4000,
                onload: (res) => {
                    if (res.status === 200) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const b64 = reader.result;
                            initDB().then(d => { if(d) d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ code, data: b64 }); });
                            resolve(b64);
                        };
                        reader.readAsDataURL(res.response);
                    } else {
                        initDB().then(d => { if(d) d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ code, data: NF_MARK }); });
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    function createEmojiImg(raw, b64) {
        const img = document.createElement('img');
        img.src = b64; img.alt = raw;
        img.className = "twemojified";
        img.draggable = false;
        Object.assign(img.style, {
            height: "1.1em", width: "1.1em", verticalAlign: "text-bottom",
            margin: "0 0.05em", display: "inline-block"
        });
        return img;
    }

   async function fixText(target) {
        if (!target || !db) return;
        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null, false);
        const tasks = [];
        let n;
        while (n = walker.nextNode()) {
            if (processedNodes.has(n)) continue;
            if (n.parentElement?.closest('script, style, textarea, pre, code, .twemojified')) continue;

            // 使用重置過的 Regex 進行測試
            EMOJI_REGEX.lastIndex = 0;
            if (EMOJI_REGEX.test(n.nodeValue || "")) {
                processedNodes.add(n);
                tasks.push(n);
            }
        }

        for (const node of tasks) {
            const parent = node.parentNode;
            if (!parent) continue;

            const text = node.nodeValue;
            const frag = document.createDocumentFragment();
            let lastIdx = 0, match;
            EMOJI_REGEX.lastIndex = 0;
            let hasValidEmoji = false;

            while ((match = EMOJI_REGEX.exec(text)) !== null) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
                const b64Data = await fetchValidEmojiData(match[0]);
                if (b64Data) {
                    frag.appendChild(createEmojiImg(match[0], b64Data));
                    hasValidEmoji = true;
                } else {
                    frag.appendChild(document.createTextNode(match[0]));
                }
                lastIdx = EMOJI_REGEX.lastIndex;
            }

            if (hasValidEmoji) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx)));
                if (parent.contains(node)) {
                    parent.replaceChild(frag, node);
                }
            }
        }
   }

    const observer = new MutationObserver(() => {
        if (isWorking) return;
        isWorking = true;
        setTimeout(async () => {
            await fixText(document.body);
            isWorking = false;
        }, 200);
    });

    const start = async () => {
        await initDB();
        await fixText(document.body);
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
