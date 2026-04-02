// ==UserScript==
// @name         Threads-LeeSuThreads-IndexedDB
// @version      0.1.9.0
// @description  LeeSuThreads data save into IndexedDB
// @author       Gemini Adaptive AI
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const DB_NAME = 'ThreadsProfileDB';
    const STORE_NAME = 'profilecache';
    let panel = null;
    let miniBtn = null;
    let hasAutoOpened = false;

    // --- 高效能資料讀取 (依據 createdAt 索引) ---
    const getStats = () => {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME, 3); // 確保與核心腳本版本一致
            request.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) return resolve({ count: 0, latest: [] });

                const tx = db.transaction([STORE_NAME], 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const index = store.indexNames.contains('createdAt') ? store.index('createdAt') : store;

                const countReq = store.count();
                countReq.onsuccess = () => {
                    const totalCount = countReq.result;
                    const latest = [];
                    const cursorReq = index.openCursor(null, 'prev');
                    cursorReq.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && latest.length < 20) {
                            latest.push(cursor.value);
                            cursor.continue();
                        } else {
                            resolve({ count: totalCount, latest });
                        }
                    };
                };
            };
            request.onerror = () => resolve({ count: 0, latest: [] });
        });
    };

    // --- 建立常駐縮小按鈕 ---
    const createMiniBtn = () => {
        if (miniBtn) return;
        miniBtn = document.createElement('div');
        miniBtn.id = 'threads-idb-mini-btn';
        miniBtn.innerHTML = '📊';
        miniBtn.style.cssText = `
            position: fixed !important;
            top: 13px !important;
            right: 70px !important;
            width: 31px !important;
            height: 31px !important;
            background-color: rgba(16, 16, 16, 0.9) !important;
            color: #D4AF37 !important;
            border: 1.5px solid #D4AF37 !important;
            border-radius: 50% !important;
            display: none;
            align-items: center !important;
            justify-content: center !important;
            font-size: 18px !important;
            cursor: pointer !important;
            z-index: 2147483647 !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important;
            user-select: none !important;
            backdrop-filter: blur(4px);
        `;
        miniBtn.onclick = () => {
            miniBtn.style.display = 'none';
            showPanel();
        };
        (document.body || document.documentElement).appendChild(miniBtn);
    };

    // --- 顯示資料面板 (核心功能) ---
    const showPanel = async () => {
        if (panel) return;
        const { count, latest } = await getStats();

        // 【關鍵】推入虛擬歷史紀錄，搶佔返回鍵順位
        window.history.pushState({ idbPanelOpen: true }, "");

        panel = document.createElement('div');
        panel.id = 'threads-idb-data-panel';
        panel.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 80% !important;
            max-width: 400px !important;
            max-height: 80vh !important;
            background-color: #101010 !important;
            border: 2px solid #D4AF37 !important;
            border-radius: 16px !important;
            padding: 20px !important;
            z-index: 2147483647 !important;
            color: #FFFFFF !important;
            overflow-y: auto !important;
            box-shadow: 0 0 50px rgba(0,0,0,0.9) !important;
            font-family: system-ui, -apple-system, sans-serif !important;
        `;

        const listHTML = latest.map(item => `
            <div style="padding:10px; background:#1a1a1a; border:1px solid #333; border-radius:8px; margin-bottom:8px; border-left:3px solid #D4AF37;">
                <div style="color:#D4AF37; font-weight:bold; font-size:12px;">${item.userId.replace('/@','@')}</div>
                <div style="color:#EEE; font-size:11px; margin-top:4px;">📅 ${item.joined || '未知'}</div>
                <div style="color:#999; font-size:11px;">📍 ${item.location || '未分享'}</div>
            </div>
        `).join('');

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                <span style="color:#D4AF37; font-weight:bold; font-size:15px;">📂 資料管理中心</span>
                <span id="close-idb-panel" style="cursor:pointer; font-size:26px; color:#666;">×</span>
            </div>
            <div style="background:#1a1a1a; padding:12px; border-radius:10px; margin-bottom:15px; text-align:center; border: 1px solid #333;">
                <div style="font-size:11px; color:#999; margin-bottom:4px;">資料庫建檔人數</div>
                <div style="font-size:30px; font-weight:bold; color:#D4AF37;">${count.toLocaleString()}</div>
            </div>
            <div style="font-size:11px; color:#888; margin-bottom:8px;">最新建檔資料 (20 筆)：</div>
            <div id="idb-list-content">${listHTML || '<div style="text-align:center;color:#666;">暫無資料</div>'}</div>
            <button id="refresh-idb" style="width:100%; margin-top:15px; padding:10px; background:#222; color:#D4AF37; border:1px solid #D4AF37; border-radius:8px; cursor:pointer; font-size:13px; font-weight:bold;">🔄 刷新資料內容</button>
        `;

        document.body.appendChild(panel);

        // 定義關閉動作
        const closePanel = (isPopState = false) => {
            if (panel) {
                panel.remove();
                panel = null;
                if (miniBtn) miniBtn.style.display = 'flex';
                // 如果不是按返回鍵關閉的，就要手動把推入的 history 退回去
                if (!isPopState) {
                    window.history.back();
                }
            }
        };

        document.getElementById('close-idb-panel').onclick = () => closePanel();
        document.getElementById('refresh-idb').onclick = () => {
            panel.remove();
            panel = null;
            showPanel();
        };

        // 【關鍵】攔截返回鍵
        window.onpopstate = function(event) {
            if (panel) {
                closePanel(true);
            }
        };
    };

    // --- 啟動與滾動監聽 ---
    const handleScroll = () => {
        createMiniBtn();
        if (miniBtn && !panel) miniBtn.style.display = 'flex';

        if (!hasAutoOpened && window.scrollY > 100) {
            hasAutoOpened = true;
            showPanel();
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // 補強機制：確保 SPA 換頁後功能依然運作
    setInterval(() => {
        if (!hasAutoOpened) {
            window.removeEventListener('scroll', handleScroll);
            window.addEventListener('scroll', handleScroll, { passive: true });
        }
    }, 3000);

})();
