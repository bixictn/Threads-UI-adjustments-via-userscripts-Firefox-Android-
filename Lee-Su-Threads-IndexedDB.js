// ==UserScript==
// @name         Lee-su-Threads save to IndexedDB
// @version      0.2.6
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
    let importMode = 'normal';

    const locFix = {"台灣":"🇹🇼 台灣","香港":"🇭🇰 香港","澳門":"🇲🇴 澳門","中國":"🇨🇳 中國","日本":"🇯🇵 日本","韓國":"🇰🇷 韓國","美國":"🇺🇸 美國","加拿大":"🇨🇦 加拿大","澳洲":"🇦🇺 澳洲","英國":"🇬🇧 英國"};

    const getDB = () => new Promise(res => {
        const req = indexedDB.open(DB_NAME, 3);
        req.onsuccess = () => res(req.result);
        req.onerror = () => console.error("DB Open Error");
    });

    const getStats = async () => {
        const db = await getDB();
        if (!db.objectStoreNames.contains(STORE_NAME)) return { count: 0, latest: [] };
        return new Promise(res => {
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.indexNames.contains('timestamp') ? store.index('timestamp') : store;
            const countReq = store.count();
            countReq.onsuccess = () => {
                const count = countReq.result;
                const latest = [];
                index.openCursor(null, 'prev').onsuccess = e => {
                    const cursor = e.target.result;
                    if (cursor && latest.length < 20) { latest.push(cursor.value); cursor.continue(); }
                    else { res({ count, latest }); }
                };
            };
        });
    };

    const updatePanelUI = (stats) => {
        if (!panel) return;
        const countEl = panel.querySelector('.db-count');
        if (countEl) countEl.innerText = stats.count.toLocaleString();
        const list = document.getElementById('idb-list-content');
        if (list) {
            list.innerHTML = stats.latest.map(item => `
                <div style="padding:10px;background:#1a1a1a;border:1px solid #333;border-radius:8px;margin-bottom:8px;border-left:3px solid #D4AF37;">
                    <div style="color:#D4AF37;font-weight:bold;font-size:12px;">
                        <a href="/@${item.userId}" style="color:#D4AF37;text-decoration:none;" target="_blink">${item.userId}</a>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;">
                        <span style="color:#999;font-size:11px;">📅 ${item.joined}</span>
                        <span style="color:#FFF;font-size:11px;">📍 ${item.location}</span>
                    </div>
                </div>
            `).join('') || '<div style="color:#666;text-align:center;">暫無資料</div>';
        }
    };

    const showPanel = async () => {
        if (panel) return;
        const stats = await getStats();
        window.history.pushState({ idbPanelOpen: true }, "");

        panel = document.createElement('div');
        panel.id = 'threads-idb-data-panel';
        panel.style.cssText = `position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;width:80%!important;max-width:350px!important;background:#101010!important;border:2px solid #D4AF37!important;border-radius:16px!important;padding:20px!important;z-index:2147483646!important;color:white!important;box-shadow:0 0 30px rgba(0,0,0,0.8);`;

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:15px;border-bottom:1px solid #333;padding-bottom:10px;">
                <span style="color:#D4AF37;font-weight:bold;">📂 資料中心 v0.2.6</span>
                <span id="close-panel-x" style="color:#444;font-size:16px;cursor:pointer;">✕</span>
            </div>
            <div style="text-align:center;background:#1a1a1a;padding:10px;border-radius:10px;margin-bottom:15px;">
                <div style="font-size:11px;color:#999;">目前總人數</div>
                <div class="db-count" style="font-size:16px;font-weight:bold;color:#D4AF37;">${stats.count.toLocaleString()}</div>
            </div>
            <div id="idb-list-content" style="max-height:150px;overflow-y:auto;margin-bottom:15px;"></div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button id="btn-export" style="padding:8px;background:#222;color:#D4AF37;border:1px solid #D4AF37;border-radius:6px;cursor:pointer;font-size:11px;">📤 匯出備份</button>
                <button id="btn-import-std" style="padding:8px;background:#222;color:#D4AF37;border:1px solid #D4AF37;border-radius:6px;cursor:pointer;font-size:11px;">📥 標準匯入</button>
                <button id="btn-import-addon" style="padding:10px;background:#D4AF37;color:#000;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:bold;grid-column:span 2;">📥 匯入套件資料</button>
            </div>
            <button id="btn-clear-all" style="width:100%;margin-top:10px;padding:8px;background:#300;color:#ff4d4d;border:1px solid #ff4d4d;border-radius:6px;cursor:pointer;font-size:11px;">🗑️ 刪除所有資料</button>
            <input type="file" id="hidden-file-input" style="display:none;" accept=".json">
        `;
        document.body.appendChild(panel);
        updatePanelUI(stats);

        // 綁定按鈕事件
        document.getElementById('btn-export').onclick = async () => {
            const db = await getDB();
            const data = await new Promise(res => {
                db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll().onsuccess = e => res(e.target.result);
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            a.download = `Lee-su-Threads-Backup-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        };

        document.getElementById('btn-import-std').onclick = () => { importMode = 'normal'; document.getElementById('hidden-file-input').click(); };
        document.getElementById('btn-import-addon').onclick = () => { importMode = 'addon'; document.getElementById('hidden-file-input').click(); };

        document.getElementById('btn-clear-all').onclick = async () => {
            if (confirm("確定要刪除所有資料嗎？")) {
                const db = await getDB();
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear();
                tx.oncomplete = () => { updatePanelUI({ count: 0, latest: [] }); alert("已清空"); };
            }
        };

        document.getElementById('close-panel-x').onclick = () => closePanel();

        document.getElementById('hidden-file-input').onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async ev => {
                try {
                    const json = JSON.parse(ev.target.result);
                    const db = await getDB();
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);

                    let newItems = 0, updatedItems = 0;
                    const existingKeys = new Set(await new Promise(res => {
                        store.getAllKeys().onsuccess = (e) => res(e.target.result);
                    }));

                    const now = Date.now();
                    if (importMode === 'addon') {
                        Object.entries(json).forEach(([uid, val], index) => {
                            existingKeys.has(uid) ? updatedItems++ : newItems++;
                            let loc = val.location;
                            if (locFix[loc]) loc = locFix[loc];
                            store.put({ userId: uid, joined: val.joined, location: loc, timestamp: val.timestamp || (now + index) });
                        });
                    } else {
                        // 標準匯入邏輯修正
                        json.forEach(item => {
                            existingKeys.has(item.userId) ? updatedItems++ : newItems++;
                            store.put(item);
                        });
                    }

                    tx.oncomplete = async () => {
                        const s = await getStats(); updatePanelUI(s);
                        alert(`📊 匯入報告\n模式：${importMode === 'addon' ? '套件資料' : '標準備份'}\n新增：${newItems}\n更新：${updatedItems}`);
                    };
                } catch (err) { alert("格式錯誤"); }
            };
            reader.readAsText(file);
        };
    };

    const patrolBtn = () => {
        if (window.location.href.includes('/media')) {
            if (panel) closePanel(true);
            const b = document.getElementById('threads-idb-mini-btn');
            if (b) b.style.display = 'none';
            return;
        }
        let btn = document.getElementById('threads-idb-mini-btn');
        if (!btn) {
            btn = document.createElement('div');
            btn.id = 'threads-idb-mini-btn';
            btn.innerHTML = '📊';
            btn.style.cssText = `position:fixed!important;top:13px!important;left:70px!important;width:30px!important;height:30px!important;background-color:rgba(16,16,16,0.9)!important;color:#D4AF37!important;border:1.5px solid #D4AF37!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:18px!important;cursor:pointer!important;z-index:2147483647!important;box-shadow:0 4px 10px rgba(0,0,0,0.5)!important;backdrop-filter:blur(4px);`;
            btn.onclick = () => panel ? closePanel() : showPanel();
            (document.body || document.documentElement).appendChild(btn);
        } else { btn.style.display = 'flex'; }
    };

    const closePanel = (isPop = false) => {
        if (panel) { panel.remove(); panel = null; if (!isPop) window.history.back(); }
    };

    window.onpopstate = () => closePanel(true);
    setInterval(patrolBtn, 1500);
    patrolBtn();
})();
