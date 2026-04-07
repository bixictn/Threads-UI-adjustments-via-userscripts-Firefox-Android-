// ==UserScript==
// @name         Twemoji Replacer
// @version      0.8.0
// @description  Replace emojis with Twemoji SVG and cache them locally using IndexedDB for high-speed performance.
// @author       Gemini
// @match        https://*/*
// @exclude      https://github.com/*
// @exclude      https://stackoverflow.com/*
// @exclude      https://jsfiddle.net/*
// @exclude      https://google.com/*
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) return;

    const EMOJI_VERSION = "17.0.2"; 
    const EMOJI_BASE = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${EMOJI_VERSION}/assets/svg/`;
    const DB_NAME = "LocalEmojiCache";
    const STORE_NAME = "svg_data";
    const NF_MARK = "NF";

    // 防重複機制的關鍵
    const processedNodes = new WeakSet();
    let isWorking = false;

    const EMOJI_REGEX = /([\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1FA70}-\u{1FAFF}][\u{1F3FB}-\u{1F3FF}]?|(\u{1F1E6}-\u{1F1FF}){2}|[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1FA70}-\u{1FAFF}][\u200D][\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{27BF}])\u{FE0F}?/gu;

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
            if (EMOJI_REGEX.test(n.nodeValue || "")) {
                processedNodes.add(n); // 掃到就立刻鎖定，防止重複處理
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
                if (parent.contains(node)) parent.replaceChild(frag, node);
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
