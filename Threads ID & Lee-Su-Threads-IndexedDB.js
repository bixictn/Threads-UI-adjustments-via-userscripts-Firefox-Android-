// ==UserScript==
// @name         Lee-su-Threads save to IndexedDB
// @version      0.2.0
// @description  Lee-su-Threads save to IndexedDB
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

    // --- 1. 核心巡邏：確保按鈕存在 ---
    const patrolBtn = () => {
        const url = window.location.href;
        const isMedia = url.includes('/media');
        let btn = document.getElementById('threads-idb-mini-btn');

        if (isMedia) {
            if (btn) btn.style.display = 'none';
            if (panel) closePanel(true);
            return;
        }

        const logo = document.querySelector('a[href="/"] svg, div[role="navigation"] svg');
        if (logo && !btn) {
            btn = document.createElement('div');
            btn.id = 'threads-idb-mini-btn';
            btn.innerHTML = '📊';
            btn.style.cssText = `
                position: fixed !important; top: 13px !important; left: 70px !important;
                width: 30px !important; height: 30px !important;
                background-color: rgba(16, 16, 16, 0.9) !important; color: #D4AF37 !important;
                border: 1.5px solid #D4AF37 !important; border-radius: 50% !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                font-size: 18px !important; cursor: pointer !important;
                z-index: 2147483647 !important; box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important;
                user-select: none !important; backdrop-filter: blur(4px);
                transition: all 0.2s ease;
            `;
            btn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                panel ? closePanel() : showPanel();
            };
            (document.body || document.documentElement).appendChild(btn);
        } else if (btn) {
            btn.style.display = 'flex';
        }
    };

    // --- 2. 資料庫操作 (索引改為 timestamp) ---
    const getDB = () => new Promise(res => {
        const req = indexedDB.open(DB_NAME, 3);
        req.onsuccess = () => res(req.result);
    });

    const getStats = async () => {
        const db = await getDB();
        if (!db.objectStoreNames.contains(STORE_NAME)) return { count: 0, latest: [] };
        return new Promise(res => {
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);

            // --- 關鍵：指向新的 timestamp 索引 ---
            const indexName = 'timestamp';
            const index = store.indexNames.contains(indexName) ? store.index(indexName) : store;

            const countReq = store.count();
            countReq.onsuccess = () => {
                const count = countReq.result;
                const latest = [];
                index.openCursor(null, 'prev').onsuccess = e => {
                    const cursor = e.target.result;
                    if (cursor && latest.length < 20) {
                        latest.push(cursor.value);
                        cursor.continue();
                    } else { res({ count, latest }); }
                };
            };
        });
    };

    // --- 3. 面板 UI 更新 ---
    const updatePanelUI = (stats) => {
        if (!panel) return;
        const countEl = panel.querySelector('.db-count-display');
        const listEl = document.getElementById('idb-list-content');
        if (countEl) countEl.innerText = stats.count.toLocaleString();
        if (listEl) {
            listEl.innerHTML = stats.latest.map(item => `
                <div style="padding:10px; background:#1a1a1a; border:1px solid #333; border-radius:8px; margin-bottom:8px; border-left:3px solid #D4AF37;">
                    <div style="color:#D4AF37; font-weight:bold; font-size:12px;">${item.userId.replace('/@','@')}</div>
                    <div style="color:#EEE; font-size:11px; margin-top:4px;">📅 ${item.joined || '未知'}</div>
                </div>
            `).join('') || '<div style="text-align:center;color:#666;padding:20px;">暫無資料</div>';
        }
    };

    // --- 4. 顯示資料面板 ---
    const showPanel = async () => {
        if (panel) return;
        const stats = await getStats();
        const btn = document.getElementById('threads-idb-mini-btn');
        if (btn) { btn.style.borderColor = "#FFFFFF"; btn.style.boxShadow = "0 0 15px #D4AF37"; }

        window.history.pushState({ idbPanelOpen: true }, "");

        panel = document.createElement('div');
        panel.id = 'threads-idb-data-panel';
        panel.style.cssText = `
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%, -50%) !important; width: 80% !important;
            max-width: 400px !important; max-height: 80vh !important;
            background-color: #101010 !important; border: 2px solid #D4AF37 !important;
            border-radius: 16px !important; padding: 20px !important;
            z-index: 2147483646 !important; color: #FFFFFF !important; overflow-y: auto !important;
            box-shadow: 0 0 50px rgba(0,0,0,0.9) !important; font-family: system-ui, sans-serif !important;
        `;

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                <span style="color:#D4AF37; font-weight:bold;">📂 資料監控中心</span>
                <span style="color:#444; font-size:10px;">再次點擊 📊 圖示關閉</span>
            </div>
            <div style="text-align:center; margin-bottom:15px; background:#1a1a1a; padding:10px; border-radius:10px; border: 1px solid #333;">
                <div style="font-size:11px; color:#999; margin-bottom:4px;">總建檔人數</div>
                <div class="db-count-display" style="font-size:28px; font-weight:bold; color:#D4AF37;">${stats.count.toLocaleString()}</div>
            </div>
            <div id="idb-list-content" style="max-height:280px; overflow-y:auto;"></div>
            <div style="margin-top:20px; padding-top:15px; border-top:1px dashed #444;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                    <button id="export-btn" style="padding:10px; background:#222; color:#D4AF37; border:1px solid #D4AF37; border-radius:8px; cursor:pointer; font-size:12px;">📤 匯出備份</button>
                    <button id="import-trigger" style="padding:10px; background:#222; color:#D4AF37; border:1px solid #D4AF37; border-radius:8px; cursor:pointer; font-size:12px;">📥 匯入資料</button>
                </div>
                <button id="clear-db-btn" style="width:100%; margin-top:8px; padding:10px; background:#300; color:#ff4d4d; border:1px solid #ff4d4d; border-radius:8px; cursor:pointer; font-size:12px; font-weight:bold;">🗑️ 清空所有資料庫</button>
                <input type="file" id="import-file" style="display:none;" accept=".json">
            </div>
        `;

        document.body.appendChild(panel);
        updatePanelUI(stats);

        // --- 匯出功能 ---
        document.getElementById('export-btn').onclick = async () => {
            const db = await getDB();
            const data = await new Promise(res => {
                const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
                req.onsuccess = () => res(req.result);
            });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `Modify-Lee-su-Threads-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        };

        // --- 匯入功能 (確保資料格式正確) ---
        document.getElementById('import-trigger').onclick = () => document.getElementById('import-file').click();
        document.getElementById('import-file').onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async ev => {
                try {
                    const json = JSON.parse(ev.target.result);
                    const db = await getDB();
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);

                    const now = Date.now();
                    json.forEach((item, index) => {
                        // 確保每一筆都有 timestamp 以供排序
                        if (!item.timestamp) item.timestamp = now + index;
                        store.put(item);
                    });

                    tx.oncomplete = async () => {
                        updatePanelUI(await getStats());
                        alert(`成功匯入 ${json.length} 筆資料！`);
                    };
                } catch (err) { alert("格式錯誤"); }
            };
            reader.readAsText(file);
        };

        // --- 清空功能 ---
        document.getElementById('clear-db-btn').onclick = async () => {
            if (confirm("確定要清空所有資料嗎？")) {
                const db = await getDB();
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear();
                tx.oncomplete = () => {
                    updatePanelUI({ count: 0, latest: [] });
                    alert("已清空");
                };
            }
        };
    };

    const closePanel = (isPopState = false) => {
        if (panel) {
            panel.remove(); panel = null;
            const btn = document.getElementById('threads-idb-mini-btn');
            if (btn) { btn.style.borderColor = "#D4AF37"; btn.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)"; }
            if (!isPopState) window.history.back();
        }
    };

    window.onpopstate = () => closePanel(true);
    setInterval(patrolBtn, 1500);
    patrolBtn();

})();
