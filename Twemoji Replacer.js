// ==UserScript==
// @name          Twemoji Replacer
// @version       0.9.0
// @description   Twemoji Replacer
// @author        Gemini
// @match         https://*/*
// @grant         GM_xmlhttpRequest
// @connect       cdn.jsdelivr.net
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const EXCLUDE = ['github.com', 'stackoverflow.com', 'jsfiddle.net', 'google.com', 'facebook.com'];
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
            if (p) { r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16)); p = 0; }
            else if (0xD800 <= c && c <= 0xDBFF) { p = c; }
            else { r.push(c.toString(16)); }
        }
        if (r.includes('200d')) {
            const last = r[r.length - 1];
            if ((last === '2642' || last === '2640') && !r.includes('fe0f')) r.push('fe0f');
            return r.join('-');
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

    async function fetchEmoji(raw, imgElement) {
        let code = toCodePoint(raw);
        const _db = await initDB();

        const applyImg = (data) => {
            if (data && data !== NF_MARK) {
                imgElement.src = data;
                imgElement.style.opacity = "1";
            } else {
                imgElement.replaceWith(document.createTextNode(raw));
            }
        };

        if (_db) {
            const tx = _db.transaction(STORE_NAME, "readonly");
            const cached = await new Promise(r => {
                const req = tx.objectStore(STORE_NAME).get(code);
                req.onsuccess = () => r(req.result);
                req.onerror = () => r(null);
            });
            if (cached) return applyImg(cached.data);
        }

        GM_xmlhttpRequest({
            method: "GET", url: `${EMOJI_BASE}${code}.svg`, responseType: "blob", timeout: 4000,
            onload: (res) => {
                if (res.status === 200) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const b64 = reader.result;
                        initDB().then(d => { if(d) d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ code, data: b64 }); });
                        applyImg(b64);
                    };
                    reader.readAsDataURL(res.response);
                } else {
                    initDB().then(d => { if(d) d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ code, data: NF_MARK }); });
                    applyImg(null);
                }
            },
            onerror: () => applyImg(null)
        });
    }

    function replaceEmojis(target) {
        if (!target) return;

        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let n;
        while (n = walker.nextNode()) {
            if (n.parentElement?.closest('script, style, textarea, .tw-p-lock')) continue;
            EMOJI_REGEX.lastIndex = 0;
            if (EMOJI_REGEX.test(n.nodeValue || "")) nodes.push(n);
        }

        for (const node of nodes) {
            const parent = node.parentNode;
            if (!parent) continue;

            const text = node.nodeValue;
            const frag = document.createDocumentFragment();
            let lastIdx = 0, match;
            EMOJI_REGEX.lastIndex = 0;
            let found = false;

            while ((match = EMOJI_REGEX.exec(text)) !== null) {
                found = true;
                frag.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));

                const lockSpan = document.createElement('span');
                lockSpan.className = "tw-p-lock";
                lockSpan.style.display = "inline-block";

                const img = document.createElement('img');
                img.className = "twemojified";
                img.alt = match[0];
                Object.assign(img.style, {
                    height: "1.1em", width: "1.1em", verticalAlign: "middle",
                    margin: "0 0.05em 0.1em 0.05em", display: "inline-block",
                    opacity: "0", transition: "opacity 0.1s"
                });

                lockSpan.appendChild(img);
                frag.appendChild(lockSpan);
                fetchEmoji(match[0], img);
                lastIdx = EMOJI_REGEX.lastIndex;
            }

            if (found) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx)));
                parent.replaceChild(frag, node);
            }
        }
    }

    let timer;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => replaceEmojis(document.body), 50);
    });

    const start = async () => {
        await initDB();
        replaceEmojis(document.body);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });

        window.addEventListener('scroll', () => {
            clearTimeout(timer);
            timer = setTimeout(() => replaceEmojis(document.body), 150);
        }, { passive: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
