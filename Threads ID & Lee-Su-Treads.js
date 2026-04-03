// ==UserScript==
// @name          Threads ID & Lee-Su-Threads 
// @version       0.3.6
// @description   Threads ID & Lee-Su-Threads 
// @author        Gemini Adaptive AI
// @match         https://www.threads.net/*
// @match         https://www.threads.com/*
// @grant         none
// @run-at        document-start
// ==/UserScript==

(function() {
    'use strict';

    const DB_NAME = 'ThreadsProfileDB';
    const STORE_NAME = 'profilecache';
    let db;

    // --- 1. 核心：Fetch 攔截監聽 (放在最前面確保攔截) ---
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);

        // 針對「關於此個人檔案」的 API 請求
        if (args[0] && args[0].includes("about_this_profile_async_action")) {
            const clone = response.clone();
            
            clone.text().then(async (rawText) => {
                // 暴力 Regex 搜尋 (解決 JSON 截斷問題)
                const countryMatch = rawText.match(/"about_this_profile_country".*?"initial"\s*:\s*"([^"]+)"/);
                const dateMatch = rawText.match(/"about_this_profile_joined_date".*?"initial"\s*:\s*"([^"]+)"/);

                if (countryMatch || dateMatch) {
                    // 從網址或內容嘗試抓取目前的 userId
                    const userId = window.location.href.split('/@')[1]?.split('/')[0]?.split('?')[0];
                    if (userId && db) {
                        // Unicode 解碼函式
                        const decode = (s) => s ? s.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))) : null;

                        const data = {
                            userId: userId.trim(),
                            joined: decode(dateMatch ? dateMatch[1] : "未知日期"),
                            location: decode(countryMatch ? countryMatch[1] : "未知地點"),
                            timestamp: Date.now()
                        };

                        // 強制存入資料庫，幫原套件「補位」
                        const tx = db.transaction([STORE_NAME], 'readwrite');
                        tx.objectStore(STORE_NAME).put(data);
                        console.log(`[🚀 攔截救援成功] 已存入: ${userId}`);
                    }
                }
            });
        }
        return response;
    };

    // --- 2. 初始化資料庫 ---
    const initDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 3);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                let store = db.objectStoreNames.contains(STORE_NAME) ?
                    e.target.transaction.objectStore(STORE_NAME) :
                    db.createObjectStore(STORE_NAME, { keyPath: 'userId' });

                if (!store.indexNames.contains('timestamp')) {
                    store.createIndex('timestamp', 'timestamp', { unique: false });
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

    // --- 3. 渲染與同步邏輯 ---
    async function doSmartSync() {
        if (!db) return;
        const articles = document.querySelectorAll('article, [data-pressable-container="true"]');

        for (const scope of articles) {
            const img = scope.querySelector('img');
            if (!img || img.dataset.processed === "done") continue;

            const container = img.parentElement?.parentElement;
            if (container && !container.getAttribute('data-cake-date')) {
                container.classList.add("cake-avatar-anchor");
                container.setAttribute('data-cake-date', "⏳");
            }

            const userLink = scope.querySelector('a[href*="/@"]');
            if (!userLink) continue;

            // 強化 ID 抓取：確保包含點號的 ID (如 guyver.1989.6.4) 不會被切斷
            const rawHref = userLink.getAttribute('href').split('?')[0];
            const userId = rawHref.split('/@')[1].replace(/\/$/, '');

            // A. 從 IDB 讀取快取 (包含攔截器剛剛存入的資料)
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

            // B. 沒快取，啟動擷取邏輯
            showBadgeForCapture(scope);
            handleCapture(scope, userId);
        }
    }

    function handleCapture(scope, userId) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (!badge) return;

        const title = badge.title || "";
        const content = badge.innerText || "";

        // 如果原套件已經抓到正常資料
        if (title.includes("加入時間") && !content.includes("⏳")) {
            let joined = title.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim();
            let location = content.replace("⏳", "").replace("[新帳號]", "").trim();

            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                tx.objectStore(STORE_NAME).put({
                    userId, joined, location, timestamp: Date.now()
                });
                hideBadge(scope);
            } catch (e) { console.error("[IDB 寫入錯誤]", e); }
        }
        // 如果原套件還沒抓到，模擬點擊來誘發 Fetch 請求 (交給攔截器救援)
        else if (!badge.dataset.cakeClicked) {
            badge.dataset.cakeClicked = "true";
            const btn = badge.querySelector('button') || badge;
            btn.click();
            // 快速關閉彈窗
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })), 100);
        }
    }

    function renderUI(scope, data) {
        const img = scope.querySelector('img');
        if (!img) return;

        let display = `📅\n${data.joined}`;
        if (data.location) {
            display += (data.location === "未分享") ? `\n🫥未分享` : `\n${data.location}`;
        }

        const container = img.parentElement?.parentElement;
        if (container) {
            container.classList.add("cake-avatar-anchor");
            container.setAttribute('data-cake-date', display);
        }
        img.dataset.processed = "done";
    }

    function hideBadge(scope) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (badge) {
            badge.style.setProperty('display', 'none', 'important');
            badge.classList.remove('force-show-badge');
        }
    }

    function showBadgeForCapture(scope) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (badge) {
            badge.classList.add('force-show-badge');
        }
    }

    // --- 啟動 ---
    initDB().then(() => {
        const style = document.createElement('style');
        style.textContent = `
            [class*="threads-"][title] { display: none !important; }
            .force-show-badge { display: inline-flex !important; opacity: 0.1; }
            .cake-avatar-anchor {
                position: relative !important;
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
                width: max-content !important;
            }
        `;
        document.head.appendChild(style);
        setInterval(doSmartSync, 1500);
        doSmartSync();
    }).catch(() => console.error("腳本啟動失敗"));

})();
