// ==UserScript==
// @name         Threads ID & Lee Su Threads
// @version      0.3.2
// @description  Threads ID & Lee Su Threads
// @author       Gemini Adaptive AI
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const DB_NAME = 'ThreadsProfileDB';
    const STORE_NAME = 'profilecache';
    let db;

    // --- 初始化資料庫 (版本 3) ---
    const initDB = () => {
        return new Promise((resolve, reject) => {
            // 升級到版本 3 以支援索引
            const request = indexedDB.open(DB_NAME, 3);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                let store;

                // 1. 檢查資料表是否存在，不存在則建立
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    store = db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
                    console.log("[IDB] 已建立新資料表:", STORE_NAME);
                } else {
                    // 如果已存在，則取得現有的 Store 以進行後續索引操作
                    store = e.target.transaction.objectStore(STORE_NAME);
                }

                // 2. 建立時間索引 (createdAt)，這才是實現「最新 20 筆」排序的關鍵
                if (!store.indexNames.contains('createdAt')) {
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    console.log("[IDB] 已成功建立 createdAt 索引");
                }
            };

            request.onsuccess = (e) => {
                db = e.target.result;
                resolve();
            };

            request.onerror = (e) => {
                console.error("[IDB] 初始化失敗 (可能是版本號衝突):", e.target.error);
                reject();
            };
        });
    };

    // --- 核心邏輯：自動檢查 ---
    async function doSmartSync() {
        if (!db) return;
        // 擴大掃描範圍，確保包含轉發與回覆
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
                hideBadge(scope);
                continue;
            }

            // B. 沒快取資料 (解析原有的 Badge 插件)
            handleCapture(scope, userId);
        }
    }

    function handleCapture(scope, userId) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (!badge) return;

        const title = badge.title || "";
        const content = badge.innerText || "";

        // 如果已經有資料（不是等待中的時鐘圖標）
        if (title.includes("加入時間") && !content.includes("⏳")) {
            let joined = title.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim();
            let location = content.replace("⏳", "").replace("[新帳號]", "").trim();

            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                tx.objectStore(STORE_NAME).put({
    userId,
    joined,
    location,
    createdAt: Date.now() // 加入這行：毫秒時間
});
                console.log(`[IDB 存入] ${userId}: ${joined} | ${location}`);
            } catch (e) { console.error("[IDB 寫入錯誤]", e); }
        }
        else if (!badge.dataset.cakeClicked) {
            // 模擬點擊觸發原始插件抓取資料
            badge.dataset.cakeClicked = "true";
            const btn = badge.querySelector('button') || badge;
            btn.click();
            // 快速關閉彈出的視窗（如果有）
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })), 10);
        }
    }

    // --- UI 輔助功能 ---
    function checkIsNew(joinedStr) {
        if (!joinedStr) return false;
        const match = joinedStr.match(/(\d+)年(\d+)月/);
        if (!match) return false;
        const joinedDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1);
        const now = new Date();
        const diffMonths = (now.getFullYear() - joinedDate.getFullYear()) * 12 + (now.getMonth() - joinedDate.getMonth());
        return diffMonths <= 2;
    }

    function renderUI(scope, data) {
        let display = `📅\n${data.joined}`;
       if (data.location) {
            display += (data.location === "未分享") ? `\n🫥未分享` : `\n${data.location}`;
       }
        if (checkIsNew(data.joined)) {
            display += `\n✨[新帳號]`;
        }

        const img = scope.querySelector('img');
        if (img) {

            const container = img.parentElement?.parentElement;
            if (container) {
                if (!container.classList.contains("cake-avatar-anchor")) {
                    container.classList.add("cake-avatar-anchor");
                }
                if (container.getAttribute('data-cake-date') !== display) {
                    container.setAttribute('data-cake-date', display);
                }
            }
        }
    }

    function hideBadge(scope) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (badge) badge.style.setProperty('display', 'none', 'important');
    }

    // --- 啟動與樣式注入 ---
    initDB().then(() => {
        const style = document.createElement('style');
        style.textContent = `
            /* 讓頭像容器成為定位基準 */
            .cake-avatar-anchor {
                position: relative !important;
                overflow: visible !important;
                display: flex !important;
                justify-content: center !important;
            }

            /* 利用 ::after 渲染日期文字 */
            .cake-avatar-anchor::after {
                content: attr(data-cake-date) !important;
                white-space: pre !important;      /* 支援 \\n 換行 */
                line-height: 1.1 !important;
                text-align: center !important;
                position: absolute !important;
                top: 100% !important;             /* 對齊頭像底部 */
                left: 50% !important;
                transform: translateX(-50%) !important;
                margin-top: 6px !important;       /* 與頭像拉開距離 */
                color: #A0A0A0 !important;        /* 使用與 Threads 次要資訊相近的灰色 */
                font-size: 10px !important;
                pointer-events: none !important;
                z-index: 5 !important;
                display: block !important;
                width: max-content !important;    /* 寬度隨文字長度調整 */
            }
        `;
        document.head.appendChild(style);

        // 持續掃描新載入的貼文
        setInterval(doSmartSync, 1500);
        doSmartSync();
    }).catch(() => console.error("腳本啟動失敗"));

})();
