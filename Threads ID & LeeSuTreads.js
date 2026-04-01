// ==UserScript==
// @name         Threads ID & Lee Su Threads
// @version      0.3.0
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const DB_NAME = 'ThreadsProfileDB';
    const STORE_NAME = 'profilecache';
    let db;

    // --- 初始化資料庫 (加入版本控制) ---
    const initDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 2);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
                    console.log("[IDB] 已建立資料表:", STORE_NAME);
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

    // --- 核心邏輯：自動檢查與收割 ---
    async function doSmartSync() {
        if (!db) return;
        const articles = document.querySelectorAll('article, [data-pressable-container="true"]');

        for (const scope of articles) {
            const userLink = scope.querySelector('a[href*="/@"]');
            if (!userLink) continue;
            const userId = userLink.getAttribute('href').split('?')[0];

            // A. 從 IDB 讀取
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

            // B. 沒資料，執行收割 (解析插件)
            handleCapture(scope, userId);
        }
    }

    function handleCapture(scope, userId) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (!badge) return;

        const title = badge.title || "";
        const content = badge.innerText || "";

        if (title.includes("加入時間") && !content.includes("⏳")) {
            // 解析：只留純日期與純地點
            let joined = title.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim();
            let location = content.replace("⏳", "").replace("[新帳號]", "").trim();

            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                tx.objectStore(STORE_NAME).put({ userId, joined, location });
                console.log(`[IDB 存入] ${userId}: ${joined} | ${location}`);
            } catch (e) { console.error("[IDB 寫入錯誤]", e); }
        }
        else if (!badge.dataset.cakeClicked) {
            badge.dataset.cakeClicked = "true";
            const btn = badge.querySelector('button') || badge;
            btn.click();
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
        let display = `📅${data.joined}`;
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
                container.classList.add("cake-avatar-anchor");
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

    // --- 啟動流程 ---
    initDB().then(() => {
        const style = document.createElement('style');
        style.textContent = `.cake-avatar-anchor{position:relative!important}.cake-avatar-anchor::after{content:attr(data-cake-date)!important;white-space:pre!important;line-height:1.1!important;text-align:center!important;position:absolute!important;top:100%!important;left:50%!important;transform:translateX(-50%)!important;margin-top:4px!important;color:#999!important;font-size:9px!important;pointer-events:none!important;z-index:5!important;display:block!important}`;
        document.head.appendChild(style);

        setInterval(doSmartSync, 1500);
        doSmartSync();
    }).catch(() => console.error("腳本啟動失敗"));

})();
