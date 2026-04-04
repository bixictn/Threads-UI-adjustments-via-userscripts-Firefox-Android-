// ==UserScript==
// @name         Twemoji Replacer
// @version      0.7.2
// @description  Replace Emoji char to <img> source
// @author       Gemini
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

   // if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) return;
    const EXCLUDE = ['github.com', 'stackoverflow.com', 'jsfiddle.net'];
    if (EXCLUDE.some(d => location.hostname.includes(d))) return;

    const EMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/";
    const DB_NAME = "LocalEmojiCache";
    const STORE_NAME = "svg_data";
    const NF_MARK = "NF";

    const EMOJI_REGEX = /([\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1FA70}-\u{1FAFF}][\u{1F3FB}-\u{1F3FF}]?|(\u{1F1E6}-\u{1F1FF}){2})/gu;

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
        return r.join('-');
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
                onerror: () => resolve(null),
                ontimeout: () => resolve(null)
            });
        });
    }

    function createEmojiImg(raw, b64) {
        const img = document.createElement('img');
        img.src = b64;
        img.setAttribute('data-raw', raw);
        img.className = "twemojified";
        Object.assign(img.style, {
            height: "1.2em", width: "1.2em", verticalAlign: "text-bottom",
            margin: "0 0.05em 0 0.1em", display: "inline-block"
        });
        return img;
    }

    async function fixText(target) {
        if (!target || !db) return;
        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let n;
        while (n = walker.nextNode()) {
            if (n.parentElement?.closest('script, style, textarea, pre, code, .twemojified')) continue;
            if (EMOJI_REGEX.test(n.nodeValue || "")) textNodes.push(n);
        }

        for (const node of textNodes) {
            const parent = node.parentNode;
            if (!parent) continue;
            const text = node.nodeValue;
            const frag = document.createDocumentFragment();
            let lastIdx = 0, match;
            EMOJI_REGEX.lastIndex = 0;
            let hasValidEmoji = false;

            while ((match = EMOJI_REGEX.exec(text)) !== null) {
                const raw = match[0];
                frag.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
                const b64Data = await fetchValidEmojiData(raw);
                if (b64Data) {
                    frag.appendChild(createEmojiImg(raw, b64Data));
                    hasValidEmoji = true;
                } else {
                    frag.appendChild(document.createTextNode(raw));
                }
                lastIdx = EMOJI_REGEX.lastIndex;
            }

            if (hasValidEmoji) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx)));
                if (parent.contains(node)) parent.replaceChild(frag, node);
            }
        }
    }

    let timer;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => fixText(document.body), 300);
    });

    const start = async () => {
        await initDB();
        fixText(document.body);
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
