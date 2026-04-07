// ==UserScript==
// @name         Twemoji Replacer
// @version      0.8.5
// @description  Twemoji Replacer
// @author       Gemini
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const EXCLUDE = ['github.com', 'stackoverflow.com', 'jsfiddle.net', 'google.com'];
    if (EXCLUDE.some(d => location.hostname.includes(d))) return;

    const EMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/";
    const DB_NAME = "LocalEmojiCache";
    const STORE_NAME = "svg_data";
    const NF_MARK = "NF";

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

        // 核心修正：組合符號 (ZWJ) 保留所有字元（包含 fe0f），避免男警/親吻等破圖
        if (r.includes('200d')) {
            const last = r[r.length - 1];
            // 針對特定性別符號自動補全 fe0f
            if ((last === '2642' || last === '2640') && !r.includes('fe0f')) {
                r.push('fe0f');
            }
            return r.join('-');
        }
        // 非組合符號則剔除 fe0f (如數字鍵 3)
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

    // --- 最佳化 2：具備重試機制的抓取邏輯 ---
    async function fetchEmoji(raw) {
        let code = toCodePoint(raw);
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

        const tryFetch = (c) => new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "GET", url: `${EMOJI_BASE}${c}.svg`, responseType: "blob", timeout: 4000,
                onload: (res) => resolve(res.status === 200 ? res : null),
                onerror: () => resolve(null)
            });
        });

        // 第一次嘗試
        let response = await tryFetch(code);

        // 第二次嘗試：若失敗且含有 fe0f，嘗試「瘦身版」
        if (!response && code.includes('fe0f')) {
            const slimCode = code.replace(/-fe0f/g, '');
            response = await tryFetch(slimCode);
            if (response) code = slimCode;
        }
        // 第三次嘗試：若失敗且不含 fe0f 的 ZWJ 序列，嘗試「加長版」
        else if (!response && !code.includes('fe0f') && code.includes('200d')) {
            const longCode = code + '-fe0f';
            response = await tryFetch(longCode);
            if (response) code = longCode;
        }

        return new Promise((resolve) => {
            if (response) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const b64 = reader.result;
                    initDB().then(d => { if(d) d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ code, data: b64 }); });
                    resolve(b64);
                };
                reader.readAsDataURL(response.response);
            } else {
                initDB().then(d => { if(d) d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ code, data: NF_MARK }); });
                resolve(null);
            }
        });
    }

    async function replaceEmojis(target) {
        if (!target || !db) return;

        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let n;
        while (n = walker.nextNode()) {
            if (n.parentElement?.closest('script, style, textarea, pre, code, .twemojified')) continue;
            if (n.parentElement?.hasAttribute('data-emoji-locking')) continue;

            EMOJI_REGEX.lastIndex = 0;
            if (EMOJI_REGEX.test(n.nodeValue || "")) nodes.push(n);
        }

        for (const node of nodes) {
            const parent = node.parentNode;
            if (!parent) continue;

            parent.setAttribute('data-emoji-locking', 'true');

            const text = node.nodeValue;
            const frag = document.createDocumentFragment();
            let lastIdx = 0, match;
            EMOJI_REGEX.lastIndex = 0;
            let success = false;

            while ((match = EMOJI_REGEX.exec(text)) !== null) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
                const b64 = await fetchEmoji(match[0]);
                if (b64) {
                    const img = document.createElement('img');
                    img.src = b64; img.alt = match[0]; img.className = "twemojified";
                    img.draggable = false;
                    // 最佳化 3：修正對齊樣式
                    Object.assign(img.style, {
                        height: "1.1em", width: "1.1em",
                        verticalAlign: "middle", margin: "0 0.05em 0.1em 0.05em",
                        display: "inline-block"
                    });
                    frag.appendChild(img);
                    success = true;
                } else {
                    frag.appendChild(document.createTextNode(match[0]));
                }
                lastIdx = EMOJI_REGEX.lastIndex;
            }

            if (success) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx)));
                if (parent.contains(node)) parent.replaceChild(frag, node);
            }
            parent.removeAttribute('data-emoji-locking');
            parent.setAttribute('data-emoji-done', 'true');
        }
    }

    let timer;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => replaceEmojis(document.body), 150);
    });

    const start = async () => {
        await initDB();
        await replaceEmojis(document.body);
        observer.observe(document.body, { childList: true, subtree: true });

        // 最佳化 4：針對 Threads 虛擬列表捲動的最佳化補償
        window.addEventListener('scroll', () => {
            clearTimeout(timer);
            timer = setTimeout(() => replaceEmojis(document.body), 250);
        }, { passive: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
