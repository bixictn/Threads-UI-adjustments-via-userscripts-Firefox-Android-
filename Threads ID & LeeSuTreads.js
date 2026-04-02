// ==UserScript==
// @name          Threads ID & Lee Su Threads
// @version       0.3.3
// @description   Threads ID & Lee Su Threads
// @author        Gemini Adaptive AI
// @match         https://www.threads.net/*
// @match         https://www.threads.com/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const DB_NAME = 'ThreadsProfileDB';
    const STORE_NAME = 'profilecache';
    let db;

    // --- 初始化資料庫 (版本 3) ---
    const initDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 3);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                let store;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    store = db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
                } else {
                    store = e.target.transaction.objectStore(STORE_NAME);
                }
                if (!store.indexNames.contains('createdAt')) {
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                db = e.target.result;
                resolve();
            };

            request.onerror = (e) => {
                console.error("[IDB] 初始化失敗:", e.target.error);
                reject();
            };
        });
    };

    // --- 核心邏輯 ---
    async function doSmartSync() {
        if (!db) return;
        const articles = document.querySelectorAll('article, [data-pressable-container="true"]');

        for (const scope of articles) {
            const userLink = scope.querySelector('a[href*="/@"]');
            if (!userLink) continue;
            const userId = userLink.getAttribute('href').split('?')[0];

            // A. 從 IDB 讀取快取
            const cached = await new Promise(res => {
                try {
                    const tx = db.transaction([STORE_NAME], 'readonly');
                    const req = tx.objectStore(STORE_NAME).get(userId);
                    req.onsuccess = () => res(req.result);
                    req.onerror = () => res(null);
                } catch (e) { res(null); }
            });

            if (cached) {
                renderUI(scope, cached);
                // 確定有快取，確保隱藏原始 Badge
                hideBadge(scope, true);
                continue;
            }

            // B. 沒快取資料，這時候才把原始 Badge 顯示出來以便「」
            showBadgeForCapture(scope);
            handleCapture(scope, userId);
        }
    }

    function handleCapture(scope, userId) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (!badge) return;

        const title = badge.title || "";
        const content = badge.innerText || "";

        if (title.includes("加入時間") && !content.includes("⏳")) {
            let joined = title.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim();
            let location = content.replace("⏳", "").replace("[新帳號]", "").trim();

            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                tx.objectStore(STORE_NAME).put({
                    userId,
                    joined,
                    location,
                    createdAt: Date.now()
                });
                // 成功後立即隱藏
                hideBadge(scope, true);
            } catch (e) { console.error("[IDB 寫入錯誤]", e); }
        }
        else if (!badge.dataset.cakeClicked) {
            badge.dataset.cakeClicked = "true";
            const btn = badge.querySelector('button') || badge;
            btn.click();
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })), 10);
        }
    }

    // --- UI 功能 ---
    function renderUI(scope, data) {
        let display = `📅\n${data.joined}`;
        if (data.location) {
            display += (data.location === "未分享") ? `\n🫥未分享` : `\n${data.location}`;
        }
        const img = scope.querySelector('img');
        if (img) {
            const container = img.parentElement?.parentElement;
            if (container) {
                container.classList.add("cake-avatar-anchor");
                if (container.getAttribute('data-cake-date') !== display) {
                    container.setAttribute('data-cake-date', display);
                }
            }
        }
    }

    // 強制隱藏原始 Badge
    function hideBadge(scope, force) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (badge) {
            badge.style.setProperty('display', 'none', 'important');
            badge.classList.remove('force-show-badge');
        }
    }

    // 只有沒資料時，才短暫顯示原始 Badge 讓套件運作
    function showBadgeForCapture(scope) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (badge) {
            badge.classList.add('force-show-badge');
        }
    }

    // --- 啟動與樣式 ---
    initDB().then(() => {
        const style = document.createElement('style');
        style.textContent = `
            /* 預設隱藏所有原始資料標籤，避免閃爍 */
            [class*="threads-"][title] {
                display: none !important;
            }

            /* 只有在需要時才顯示 */
            .force-show-badge {
                display: inline-flex !important;
                opacity: 0.1; /* 設為近乎透明，時使用者幾乎無感 */
            }

            .cake-avatar-anchor {
                position: relative !important;
                overflow: visible !important;
                display: flex !important;
                justify-content: center !important;
            }

            .cake-avatar-anchor::after {
                content: attr(data-cake-date) !important;
                white-space: pre !important;
                line-height: 1.1 !important;
                text-align: center !important;
                position: absolute !important;
                top: 100% !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                margin-top: 6px !important;
                color: #A0A0A0 !important;
                font-size: 10px !important;
                pointer-events: none !important;
                z-index: 5 !important;
                display: block !important;
                width: max-content !important;
            }
        `;
        document.head.appendChild(style);

        setInterval(doSmartSync, 1500);
        doSmartSync();
    }).catch(() => console.error("腳本啟動失敗"));

})();
