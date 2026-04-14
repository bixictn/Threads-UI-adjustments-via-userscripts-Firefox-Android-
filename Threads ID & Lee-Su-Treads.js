// ==UserScript==
// @name          Threads ID & Lee-Su-Threads
// @version       0.4.6.6
// @description   Threads ID & Lee-Su-Threads
// @match         https://www.threads.net/*
// @match         https://www.threads.com/*
// @grant         none
// @run-at        document-start
// ==/UserScript==

(function() {
    'use strict';

    const DB_NAME = 'ThreadsProfileDB';
    const STORE_NAME = 'profilecache';
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    let db;

    // --- 1. Fetch 攔截器 ---
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
                            location: decode(countryMatch ? countryMatch[1] : "沒有地點資料"),
                            timestamp: Date.now()
                        };
                        const tx = db.transaction([STORE_NAME], 'readwrite');
                        tx.objectStore(STORE_NAME).put(data);
                        console.log(`[🚀 攔截成功] ${userId}`);
                        doSmartSync();
                    }
                }
            });
        }
        return response;
    };

    // --- 2. 工具函式 ---
    const initDB = () => {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME, 3);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
                if (!db.indexNames.contains('timestamp')) {db.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
            request.onsuccess = (e) => { db = e.target.result; resolve(); };
        });
    };

    function isInViewport(el) {
        const rect = el.getBoundingClientRect();
        const vHeight = window.innerHeight || document.documentElement.clientHeight;
        return (rect.top <= vHeight + 200 && rect.bottom >= -200);
    }

    // --- 3. 核心邏輯 ---
    async function doSmartSync() {
        if (!db) return;
        const articles = document.querySelectorAll('[data-pressable-container="true"]');

        for (const scope of articles) {
            const img = scope.querySelector('img');
            if (!img || img.dataset.processed === "done") continue;

            const timeElement = scope.querySelector('time');
            if (!timeElement) continue;

            const userLink = scope.querySelector('time')?.closest('a[href*="/"]');
            let userId;
            if (userLink) {
                const href = userLink.getAttribute('href').split('?')[0];
                userId = href.replace(/^\/@?/, '').split('/')[0];
                console.log("ID:", userId);
            }
            if (!userLink) continue;

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

            if (cached && !isFresh) renderUI(scope, cached, true);

            // 狀態判定與 5 秒超時重試
            const badge = scope.querySelector('[class*="threads-"][title]');
            const container = img.parentElement?.parentElement;
            if (container && container.getAttribute('data-cake-date') === "⏳" && badge) {
                const lastClick = parseInt(badge.dataset.lastClickTime || 0);
                if (now - lastClick > 5000) {
                    delete badge.dataset.cakeClicked;
                    delete badge.dataset.cakeStatus;
                    console.log(`[🔄] ${userId} 取資料中...`);
                }
            }

            if (isInViewport(scope)) {
                handleCapture(scope, userId);
            }
        }
    }

    function handleCapture(scope, userId) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        const img = scope.querySelector('img');
        const container = img?.parentElement?.parentElement;
        if (!badge || !container || badge.dataset.cakeStatus === "loading") return;

        container.classList.add("cake-avatar-anchor");
        container.setAttribute('data-cake-date', "⏳");

        const title = badge.title || "";
        const content = badge.innerText || "";

        if (title.includes("加入時間") && !content.includes("⏳")) {
            const data = {
                userId,
                joined: title.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim(),
                location: content.replace("⏳", "").replace("[新帳號]", "").trim(),
                timestamp: Date.now()
            };
            db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).put(data);
            renderUI(scope, data);
            hideBadge(scope);
        } else if (!badge.dataset.cakeClicked) {
            badge.dataset.cakeStatus = "loading";
            badge.dataset.cakeClicked = "true";
            badge.dataset.lastClickTime = Date.now(); // 記錄點擊時間戳
            const btn = badge.querySelector('button') || badge;

            // 💡 延遲 200ms 點擊，避開 UI 執行緒高峰
            setTimeout(() => {
                btn.click();
                setTimeout(() => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                    setTimeout(() => { if(badge) delete badge.dataset.cakeStatus; }, 3000);
                }, 200);
            }, 200);
        }
    }


    function getTimestampFromMonth(dateStr) {
        if (!dateStr || dateStr.includes("未知")) return 0;

        // 把 "2024年10月" 轉換成 "2024/10/01" 讓瀏覽器看得懂
        const cleanStr = dateStr.replace('年', '/').replace('月', '/01');
        const parsedDate = new Date(cleanStr);

        return parsedDate.getTime(); // 回傳毫秒數
    }

    function renderUI(scope, data, isStale = false) {
        const img = scope.querySelector('img');
        const container = img?.parentElement?.parentElement;
        if (!container) return;

        let display = `📅\n${data.joined}`;
        if(getTimestampFromMonth("2025年12月")-getTimestampFromMonth(data.joined)<=0){
            display = `🔍\n${data.joined}`;
        }
        if (data.location) display += (data.location === "未分享") ? `\n🫥未分享` : `\n${data.location}`;

        const now = Date.now();
        const joinedTs = getTimestampFromMonth(data.joined);
        const TWO_MONTHS = ONE_WEEK * 8; // 約兩個月

        // 如果 (現在時間 - 加入時間) 小於 8 星期，就是新帳號
        if (joinedTs > 0 && (now - joinedTs) < TWO_MONTHS) {
            display += "\n✨[新帳號]";
        }
        container.classList.add("cake-avatar-anchor");
        container.setAttribute('data-cake-date', display);
        if (!isStale) img.dataset.processed = "done";
    }

    function hideBadge(scope) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (badge) badge.style.setProperty('display', 'none', 'important');
    }

    function showBadgeForCapture(scope) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (badge) badge.classList.add('force-show-badge');
    }

    // --- 4. 啟動與 CSS ---
    initDB().then(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes hourglass-flip {
                0% { transform: translateX(-50%) rotate(0deg); }
                85% { transform: translateX(-50%) rotate(0deg); }
                100% { transform: translateX(-50%) rotate(180deg); }
            }
            [class*="threads-"][title] { display: none !important; }
            .force-show-badge { display: inline-flex !important; opacity: 0.01 !important; }
            .cake-avatar-anchor { position: relative !important; display: flex !important; justify-content: center !important; }
            .cake-avatar-anchor::after {
                content: attr(data-cake-date);
                position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
                margin-top: 6px; color: #A0A0A0; font-size: 10px;white-space: pre;line-height: 1.0 !important;
                text-align: center; z-index: 10; pointer-events: none; width: max-content;
                display: block !important;
            }
            .cake-avatar-anchor[data-cake-date="⏳"]::after {
                animation: hourglass-flip 1s linear infinite !important;
            }
        `;
        document.head.appendChild(style);

        // 💡 延遲 2.5 秒啟動，徹底避開開場 ID null 的混亂期
        setTimeout(() => {
            setInterval(doSmartSync, 1000); // 1秒一次，穩定掃描
            doSmartSync();
        }, 2500);
    });
})();
