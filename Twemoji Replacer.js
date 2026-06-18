// ==UserScript==
// @name          Twemoji Replacer
// @version       0.9.3.6
// @description   Twemoji Replacer
// @author        Gemini
// @match         *://*/*
// @grant         GM_xmlhttpRequest
// @connect       cdn.jsdelivr.net
// @run-at        document-start
// ==/UserScript==

(function() {
    'use strict';

    const EMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/";
    const DB_NAME = "LocalEmojiCache";
    const STORE_NAME = "svg_data";
    const NF_MARK = "NF";

    const EMOJI_REGEX = /(([\u{1F1E6}-\u{1F1FF}]{2})|[\u0030-\u0039]\uFE0F?\u20E3|(([\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1F000}-\u{1FAFF}][\u{1F3FB}-\u{1F3FF}]?\u{FE0F}?)(\u{200D}[\u{1F000}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{2100}-\u{2BFF}][\u{1F3FB}-\u{1F3FF}]?\u{FE0F}?)+)|[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1F000}-\u{1FAFF}][\u{1F3FB}-\u{1F3FF}]?\u{FE0F}?|[\u{2000}-\u{2BFF}]\u{FE0F}?)/gu;
    let db = null;
    let isInit = false;
    let isWorking = false;

    const originalNodeValueSetter = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeValue').set;
    Object.defineProperty(Node.prototype, 'nodeValue', {
        set: function(val) {
            originalNodeValueSetter.call(this, val);
            if (isWorking || typeof val !== 'string' || !EMOJI_REGEX.test(val)) return;
            if (this.parentNode && !this.parentNode.closest('.tw-p-lock')) {
                Promise.resolve().then(() => {
                    isWorking = true;
                    replaceEmojis(this.parentNode);
                    isWorking = false;
                });
            }
        },
        configurable: true
    });

    // --- 2. 資料庫邏輯 ---
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
        const code = toCodePoint(raw);
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
                }
            }
        });
    }

    function toCodePoint(unicode) {
        const r = []; let c = 0, p = 0, i = 0;
        while (i < unicode.length) {
            c = unicode.charCodeAt(i++);
            if (p) { r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16)); p = 0; }
            else if (0xD800 <= c && c <= 0xDBFF) { p = c; }
            else { r.push(c.toString(16)); }
        }
        // ❤️‍🔥 檔名修復：確保路徑包含 fe0f-200d
        if (r[0] === '2764' && r.includes('200d') && r[1] !== 'fe0f') r.splice(1, 0, 'fe0f');
        const forceFE0F = ['2194', '2195', '2640', '2642', '26a0', '2139', '1f198', '24c2', '2611', '2705'];
        if (r.includes('200d') || forceFE0F.includes(r[r.length-1])) {
            if (!r.includes('fe0f')) r.push('fe0f');
        }
        return r.filter((x, idx) => x !== 'fe0f' || idx === r.length - 1 || r[idx+1] === '20e3').join('-');
    }
    // --- 3. 核心置換邏輯 ---
    function replaceEmojis(target) {
        if (!target || (target.nodeType === 1 && target.closest('.tw-p-lock')) ) return;
        const EXCLUDE_SELECTOR = [
            '[aria-label="表情符號選擇工具"]',
            '[role="presentation"]', // 通常是背景遮罩或動畫層
            '.html-editor-placeholder', // 輸入框的提示文字
            '[contenteditable="true"]' // 正在編輯中的文字區域
        ].join(',');

        if (target.nodeType === 1 && target.closest(EXCLUDE_SELECTOR)) return;

        const parent = target.parentNode;
        if (!parent) return;

        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let n;

        while (n = walker.nextNode()) {
            // 2. 修正重點：文字節點必須透過 parentElement 檢查是否在排除區域內
            const parentEl = n.parentElement;
            if (!parentEl) continue;

            if (
                parentEl.closest('script, style, textarea, .tw-p-lock, .threads-profile-info-badge') ||
                parentEl.closest(EXCLUDE_SELECTOR)
            ) {
                continue;
            }

            EMOJI_REGEX.lastIndex = 0;
            if (EMOJI_REGEX.test(n.nodeValue || "")) {
                nodes.push(n);
            }
        }

        for (const node of nodes) {
            const parent = node.parentNode;
            if (!parent) continue;
            const text = node.nodeValue;
            const frag = document.createDocumentFragment();
            let lastIdx = 0, match, found = false;
            EMOJI_REGEX.lastIndex = 0;

            while ((match = EMOJI_REGEX.exec(text)) !== null) {
                found = true;
                // 修正：只有當匹配前有文字時才附加
                const preText = text.substring(lastIdx, match.index);
                if (preText) frag.appendChild(document.createTextNode(preText));

                let emoji = match[0];
                let nextIdx = EMOJI_REGEX.lastIndex;
                if (text.codePointAt(nextIdx) === 0xFE0F) {
                    emoji += '\uFE0F';
                    nextIdx++;
                    EMOJI_REGEX.lastIndex = nextIdx;
                }

                const lockSpan = document.createElement('span');
                lockSpan.className = "tw-p-lock";
                Object.assign(lockSpan.style, { display: "inline"});

                const img = document.createElement('img');
                img.className = "twemojified";
                img.alt = emoji;
                Object.assign(img.style, {
                    height: "1.1em", width: "1.1em", 
                    margin: "0 0 0 0",
                    display: "flex",
                    alignItems: "center"
                });
                lockSpan.appendChild(img);
                fetchEmoji(emoji, img);
                frag.appendChild(lockSpan);
                lastIdx = nextIdx;
            }

            if (found) {
                // 修正：只有當結尾真的有剩餘文字時才附加 (消除空白節點關鍵)
                const postText = text.substring(lastIdx);
                if (postText) frag.appendChild(document.createTextNode(postText));
                parent.replaceChild(frag, node);
            }
        }
    }

    // --- 4. 啟動與監測 ---
    let timer;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            isWorking = true;
            replaceEmojis(document.body);
            isWorking = false;
        }, 100);
    });

    const start = async () => {
        await initDB();
        replaceEmojis(document.body);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    document.addEventListener('twemoji-reset-request', (e) => {

        if (observer) {
            observer.disconnect();
            observer.takeRecords();
        }

        isWorking = false;

        setTimeout(() => {
            replaceEmojis(document.body);
            if (observer) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }
        }, 200);
    }, true);
})();
