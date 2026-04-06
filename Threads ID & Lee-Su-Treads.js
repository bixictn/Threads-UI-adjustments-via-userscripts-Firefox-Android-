// ==UserScript==
// @name          Threads ID & Lee-Su-Threads
// @version       0.3.8
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
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000; // 七天的毫秒數
    let db;

    // --- 1. Fetch 攔截救援 (解決 JSON 截斷與背景更新) ---
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (args[0] && args[0].includes("about_this_profile_async_action")) {
            const clone = response.clone();
            clone.text().then(async (rawText) => {
                const countryMatch = rawText.match(/"about_this_profile_country".*?"initial"\s*:\s*"([^"]+)"/);
                const dateMatch = rawText.match(/"about_this_profile_joined_date".*?"initial"\s*:\s*"([^"]+)"/);

                if (countryMatch || dateMatch) {
                    const userId = window.location.href.split('/@')[1]?.split('/')[0]?.split('?')[0];
                    if (userId && db) {
                        const decode = (s) => s ? s.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))) : null;
                        const data = {
                            userId: userId.trim(),
                            joined: decode(dateMatch ? dateMatch[1] : "未知日期"),
                            location: decode(countryMatch ? countryMatch[1] : "未知地點"),
                            timestamp: Date.now()
                        };
                        const tx = db.transaction([STORE_NAME], 'readwrite');
                        tx.objectStore(STORE_NAME).put(data);
                        console.log(`[🚀 攔截成功] 存入快取: ${userId}`);
                    }
                }
            });
        }
        return response;
    };

    // --- 2. 初始化資料庫 ---
    const initDB = () => {
        return new Promise((resolve) => {
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
            request.onsuccess = (e) => { db = e.target.result; resolve(); };
        });
    };

    // 新增：判斷元素是否在視窗內
    function isInViewport(el) {
        const rect = el.getBoundingClientRect();
        const vHeight = (window.innerHeight || document.documentElement.clientHeight);

        return (
            rect.top <= vHeight + 200 && // 頂部還沒超過螢幕底部（下方預載）
            rect.bottom >= -200         // 底部還沒超過螢幕頂部（上方緩衝）
        );
    }

    // --- 3. 核心同步邏輯 ---
    async function doSmartSync() {
        if (!db) return;
        const articles = document.querySelectorAll('article, [data-pressable-container="true"]');

        let clickDelay = 0; // 用來累加延遲時間

        for (const scope of articles) {
            const img = scope.querySelector('img');
            if (!img || img.dataset.processed === "done") continue;

            const container = img.parentElement?.parentElement;
            if (container && !container.getAttribute('data-cake-date')) {
                container.classList.add("cake-avatar-anchor");
            }

            const userLink = scope.querySelector('a[href*="/@"]');
            if (!userLink) continue;

            const rawHref = userLink.getAttribute('href').split('?')[0];
            const userId = rawHref.split('/@')[1].replace(/\/$/, '');

            // 讀取快取
            const cached = await new Promise(res => {
                const tx = db.transaction([STORE_NAME], 'readonly');
                const req = tx.objectStore(STORE_NAME).get(userId);
                req.onsuccess = () => res(req.result);
                req.onerror = () => res(null);
            });


            const now = Date.now();
            const isFresh = cached && (now - cached.timestamp < ONE_WEEK);

            if (isFresh) {
                renderUI(scope, cached);
                hideBadge(scope);
                continue;
            }

            // 過期時先顯示舊資料墊檔
            if (cached && !isFresh) {
                renderUI(scope, cached, true);
            }

            if (isInViewport(scope)) {
                showBadgeForCapture(scope);
                handleCapture(scope, userId,container);
            }

            if (container.getAttribute('data-cake-date') === "⏳") {
                const lastClick = badge.dataset.lastClickTime || 0;
                if (Date.now() - lastClick > 10000) { // 10秒沒反應就重置
                delete badge.dataset.cakeClicked;
                delete badge.dataset.cakeStatus;
            }
}
        }
    }

    function handleCapture(scope, userId,container) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (!badge) return;

        if (badge.dataset.cakeStatus === "loading") return;
        container.setAttribute('data-cake-date', "⏳");

        const title = badge.title || "";
        const content = badge.innerText || "";

        // A. 偵測到原套件已解析完成
        if (title.includes("加入時間") && !content.includes("⏳")) {
            let joined = title.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim();
            let location = content.replace("⏳", "").replace("[新帳號]", "").trim();

            const tx = db.transaction([STORE_NAME], 'readwrite');
            tx.objectStore(STORE_NAME).put({
                userId, joined, location, timestamp: Date.now()
            });
            hideBadge(scope);
            badge.dataset.cakeStatus = "done";
        }
        // B. 尚未解析，觸發點擊 (為了誘發 Fetch)
        else if (!badge.dataset.cakeClicked) {
            badge.dataset.cakeStatus = "loading"; // 上鎖
            badge.dataset.cakeClicked = "true";

            const btn = badge.querySelector('button') || badge;
            btn.click();

            // 快速關閉彈窗並在 3 秒後解除鎖定（防止網路卡死）
            setTimeout(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                setTimeout(() => { if(badge) delete badge.dataset.cakeStatus; }, 3000);
            }, 100);
        }
    }

    function renderUI(scope, data, isStale = false) {
        const img = scope.querySelector('img');
        if (!img) return;

        let display = `📅\n${data.joined}`;
        if (data.location) {
             display += (data.location === "未分享") ? `\n🫥未分享` : `\n${data.location}`;
        }

        const container = img.parentElement?.parentElement;
        if (container) {
            container.setAttribute('data-cake-date', display);
        }

        if (!isStale) {
            img.dataset.processed = "done";
        }
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
            .force-show-badge { display: inline-flex !important; opacity: 0.05; } /* 降低透明度減少視覺干擾 */
            .cake-avatar-anchor { position: relative !important; display: flex !important; justify-content: center !important; }
            .cake-avatar-anchor::after {
                content: attr(data-cake-date) !important;
                white-space: pre !important; line-height: 1.1 !important; text-align: center !important;
                position: absolute !important; top: 100% !important; left: 50% !important;
                transform: translateX(-50%) !important; margin-top: 6px !important;
                color: #A0A0A0 !important; font-size: 10px !important; z-index: 5 !important;
                width: max-content !important; pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
        setInterval(doSmartSync, 1500);
        doSmartSync();
    });
})();
