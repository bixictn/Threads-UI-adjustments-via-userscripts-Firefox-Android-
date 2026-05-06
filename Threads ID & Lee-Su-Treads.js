// ==UserScript==
// @name         Threads ID & Lee-Su-Threads
// @version      0.4.8
// @description  Threads ID & Lee-Su-Threads (Fixed Logic & Selectors)
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
    const db_version = 1;

    const fetchMap = new Map();
    const originalFetch = window.fetch;

    // --- 1. Fetch 攔截器 ---
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = (typeof args[0] === 'string') ? args[0] : args[0].url;

        if (url && url.includes("about_this_profile_async_action")) {
            const clone = response.clone();
            clone.text().then(async (rawText) => {
                const decode = (s) => s ? s.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))) : null;

                const countryMatch = rawText.match(/"about_this_profile_country".*?"initial"\s*:\s*"([^"]+)"/);
                let country = "未分享";
                if (countryMatch) {
                    const cName = decode(countryMatch[1]);
                }

                const dateMatch = rawText.match(/"text"\s*:\s*"(\d{4}\\u5e74\d{1,2}\\u6708[^"]*)"/);
                let joinedDate = "未知日期";
                if (dateMatch) {
                    const rawDate = decode(dateMatch[1]);
                    joinedDate = rawDate.split(/\s[·•]\s/)[0].trim();
                }

                const uMatch = rawText.match(/"bk\.components\.TextSpan".*?"text"\s*:\s*"([^"]+)"/);
                let finalUserId = uMatch ? decode(uMatch[1]) : null;
                if (finalUserId && finalUserId.includes('@')) {
                    finalUserId = finalUserId.split('@')[1].split(/[）)]/)[0].trim();
                }

                if (finalUserId) {
                    fetchMap.set(finalUserId, { joined: joinedDate, location: country });
                    console.log(`[📦 Fetch 暫存] 帳號: ${finalUserId}`);
                }
            });
        }
        return response;
    };

    // --- 2. DB 初始化 ---
    const initDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, db_version);
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
            request.onerror = (e) => reject(e.target.error);
        });
    };

    // --- 3. 核心功能 ---
    function isInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (rect.top <= (window.innerHeight || document.documentElement.clientHeight) + 200 && rect.bottom >= -200);
    }

    async function doSmartSync() {
        if (!db) return;
        const articles = document.querySelectorAll('[data-pressable-container="true"]');

        for (const scope of articles) {
            const img = scope.querySelector('img');
            if (!img || img.dataset.processed === "done") continue;

            const userLink = scope.querySelector('time')?.closest('a[href*="/"]');
            if (!userLink) continue;

            const href = userLink.getAttribute('href').split('?')[0];
            const userId = href.replace(/^\/@?/, '').split('/')[0];

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

            const badge = scope.querySelector('[class*="threads-"][title]');
            const container = img.parentElement?.parentElement;
            if (!container) continue;

            const isWaiting = container.getAttribute('data-cake-date') === "⏳";
            const title = badge?.title || "";
            const content = badge?.innerText || "";

            // 🎯 A：從Lee-Su-Threads取資料
            if (title.includes("加入時間") && !content.includes("⏳")) {
                const data = {
                    userId,
                    joined: title.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim(),
                    location: content.replace("⏳", "").replace("[新帳號]", "").trim(),
                    timestamp: Date.now()
                };
                db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).put(data);
                fetchMap.delete(userId);
                console.log(`[📦 移除Fetch暫存] 帳號: ${userId}`);
                renderUI(scope, data);
                hideBadge(scope);
                continue;
            }

            // 🎯 B：從 FetchMap 取資料 (救援)
            if (isWaiting && fetchMap.has(userId)) {
                const fData = fetchMap.get(userId);
                const locFix = {"台灣":"🇹🇼 台灣","日本":"🇯🇵 日本","韓國":"🇰🇷 韓國","美國":"🇺🇸 美國","加拿大":"🇨🇦 加拿大","澳洲":"🇦🇺 澳洲","英國":"🇬🇧 英國","香港":"🇭🇰 香港","澳門":"🇲🇴 澳門","中國":"🇨🇳 中國"};
                const location = locFix[fData.location] || fData.location;
                const finalData = { userId, joined: fData.joined, location: `${location}`, timestamp: Date.now() };
                db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).put(finalData);
                fetchMap.delete(userId);
                console.log(`[📦 移除Fetch暫存] 帳號: ${userId}`);
                renderUI(scope, finalData);
                hideBadge(scope);
                continue;
            }

            // 🎯 觸發點擊 (如果沒資料且不在等待中)
            if (!isWaiting && isInViewport(scope)) {
                handleCapture(scope, userId);
            }
        }
    }

    function handleCapture(scope, userId) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        const img = scope.querySelector('img');
        const container = img?.parentElement?.parentElement;
        if (!badge || !container || badge.dataset.cakeStatus === "loading") return;

        console.log(`[🚀] 觸發點擊獲取: ${userId}`);
        container.setAttribute('data-cake-date', "⏳");
        badge.dataset.cakeStatus = "loading";
        badge.dataset.cakeClicked = "true";
        badge.dataset.lastClickTime = Date.now();

        setTimeout(() => {
            badge.click();
            setTimeout(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                setTimeout(() => { if (badge) delete badge.dataset.cakeStatus; }, 3000);
            }, 300);
        }, 200);
    }

    // --- UI 渲染與樣式 ---
    function getTimestampFromMonth(dateStr) {
        if (!dateStr || dateStr.includes("未知")) return 0;
        const cleanStr = dateStr.replace('年', '/').replace('月', '/01');
        return new Date(cleanStr).getTime();
    }

    function renderUI(scope, data, isStale = false) {
        const img = scope.querySelector('img');
        const container = img?.parentElement?.parentElement;
        if (!container) return;

        let display = (getTimestampFromMonth("2025年12月") - getTimestampFromMonth(data.joined) <= 0) ? `🔍\n${data.joined}` : `📅\n${data.joined}`;
        display += (data.location === "未分享") ? `\n🫥未分享` : `\n${data.location}`;

        if (getTimestampFromMonth(data.joined) > 0 && (Date.now() - getTimestampFromMonth(data.joined)) < (ONE_WEEK * 8)) {
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

    initDB().then(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes hourglass-flip { 0%, 85% { transform: translateX(-50%) rotate(0deg); } 100% { transform: translateX(-50%) rotate(180deg); } }
            [class*="threads-"][title] { opacity: 0.01 !important; position: absolute !important; pointer-events: auto !important; }
            .cake-avatar-anchor { position: relative !important; display: flex !important; justify-content: center !important; }
            .cake-avatar-anchor::after {
                content: attr(data-cake-date); position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
                margin-top: 6px; color: #A0A0A0; font-size: 10px; white-space: pre; line-height: 1.1;
                text-align: center; z-index: 10; pointer-events: none; width: max-content; display: block !important;
            }
            .cake-avatar-anchor[data-cake-date="⏳"]::after { animation: hourglass-flip 1s linear infinite !important; }
        `;
        document.head.appendChild(style);
        setTimeout(() => { setInterval(doSmartSync, 1500); doSmartSync(); }, 2500);
    });
})();
