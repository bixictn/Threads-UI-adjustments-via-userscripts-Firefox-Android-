// ==UserScript==
// @name         Threads ID Profiles save to IndexedDB
// @version      0.5.1
// @description  Threads ID Profiles save to IndexedDB
// @author       Gemini Adaptive AI
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const version='v0.5.1';
    const db_version=1;
    const ZIpanel=3,ZIbtn=4,ZIpgb=2;
    let caller=false;
    // 判斷當寬度小於高度時（直向螢幕/手機模式），開啟水平居中校正
    let modeadd = (window.innerWidth < window.innerHeight)
    ? "transform: translateX(-50%) !important;"
    : "";
    //css
    const style = document.createElement('style');
    style.textContent = `
		/* 遮罩層：阻斷所有底層點擊 */

		#threads-idb-data-panel{
			position: fixed !important;
			top: 5% !important;
			left: 5% !important;
			transform-origin: top center !important;
			width: 90% !important;
            height: 85% !important;
			border-radius: 16px !important;
			padding: 20px !important;
			z-index: ${ZIpanel} !important;
			animation: panelFadeIn 0.2s ease-out;
			touch-action: auto;
            display: flex;
            flex-direction: column;
		}

		@media screen and (max-width: 695px) {
			#threads-idb-data-panel {
				top: 32px !important;
				left: 2% !important;
                width: 80% !important;
			}
		}

		/* 預設為桌面版樣式 */
		#threads-idb-mini-btn {
			top: 55px !important;
			left: 20px !important;
			width: 24px !important;
			height: 24px !important;
			position:fixed!important;
			display:flex!important;
			align-items:center!important;
			justify-content:center!important;
			font-size:18px!important;
			cursor:pointer!important;
			z-index:${ZIbtn} !important;
            filter: sepia(1) saturate(5) hue-rotate(10deg);
		}

		/* 當螢幕寬度小於 695px 時（自動判定為行動版） */
		@media screen and (max-width: 695px) {
			#threads-idb-mini-btn {
				top: 14px !important;
				left: 63% !important;
				width: 32px !important;
				height: 32px !important;
			}
		}

		#threads-idb-overlay {
			position: fixed !important;
			top: 0 !important;
			left: 0 !important;
			width: 100vw !important;
			height: 100vh !important;
			z-index: ${ZIpgb} !important;
			backdrop-filter: blur(2px);
			transition: opacity 0.2s;
		}
		.__fb-dark-mode #threads-idb-overlay { background: rgba(0,0,0,0.6) !important; }
		.__fb-light-mode #threads-idb-overlay { background: rgba(255,255,255,0.4) !important; }

		/* --- 1. 深色模式樣式 (預設) --- */
		.__fb-dark-mode #threads-idb-data-panel {
			background: #101010 !important;
			border: 2px solid #D4AF37 !important;
			color: #FFFFFF !important;
			box-shadow: 0 15px 50px rgba(0,0,0,0.9) !important;
		}

		/* --- 2. 亮色模式樣式 --- */
		.__fb-light-mode #threads-idb-data-panel {
			background: #FFFFFF !important;
			border: 2px solid #D4AF37 !important;
			color: #000000 !important;
			box-shadow: 0 0 12px rgba(212, 175, 55, 0.8) !important;
		}

		/* 暗色模式下的清單項目微調 */
		.__fb-dark-mode #idb-list-content > div {
			background-color: rgba(16,16,16,0.9) !important;
			border: 2px solid #D4AF37 !important;
			border-left: 3px solid #8f7213 !important;
		}
		.__fb-dark-mode #idb-list-content a {
			color: #D4AF37 !important;
		}

		/* 亮色模式下的清單項目微調 */
		.__fb-light-mode #idb-list-content > div {
			background: #f5f5f5 !important;
			border: 1px solid #ddd !important;
			border-left: 3px solid #D4AF37 !important;
		}
		.__fb-light-mode #idb-list-content a {
			color: #0056b3 !important;
		}

		.__fb-dark-mode #btn-export, .__fb-dark-mode #btn-import-std {
			padding:8px;
			background:#222;
			color:#D4AF37;
			border:1px solid #D4AF37;
			border-radius:6px;
			cursor:pointer;
			font-size:11px;
		}

		.__fb-dark-mode #btn-import-addon {
				padding:10px;
				background:#D4AF37;
				color:#000;
				border:none;
				border-radius:6px;
				cursor:pointer;
				font-size:11px;
				font-weight:bold;
		}

		.__fb-light-mode #btn-export, .__fb-light-mode #btn-import-std {
			background: #eee !important;
			color: #333 !important;
			border: 1px solid #ccc !important;
		}
		.__fb-light-mode #btn-import-addon {
			background: #D4AF37 !important;
			color: #fff !important;
		}
		a[href="/"] svg[aria-label="Threads"] path {
			fill: #D4AF37 !important;
		}

        /* 搜尋框樣式微調 */
        .idb-search-input {           
            padding: 8px 12px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-sizing: border-box;
            font-size: 13px;
        }
        .__fb-dark-mode .idb-search-input {
            background: #222 !important;
            border: 1px solid #D4AF37 !important;
            color: #fff !important;
        }
        .__fb-light-mode .idb-search-input {
            background: #fff !important;
            border: 1px solid #ccc !important;
            color: #333 !important;
        }
    `;
    document.head.appendChild(style);

    const DB_NAME = 'ThreadsProfileDB';
    const STORE_NAME = 'profilecache';

    window.THREADS_DB_CENTER = {
        // 儲存資料
        saveProfile: async (data) => {
            const db = await getDB();
            return new Promise((res, rej) => {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                const store = tx.objectStore(STORE_NAME);

                const entry = {
                    userId: data.userId,
                    usernumber: data.usernumber,
                    joined: data.joined,
                    location: data.location,
                    timestamp: Date.now()
                };

                const req = store.put(entry);
                req.onsuccess = () => res(true);
                req.onerror = () => rej(req.error);
            });
        },

        // 讀取資料
        getProfile: async (userId) => {
            const db = await getDB();
            return new Promise((res) => {
                const tx = db.transaction([STORE_NAME], 'readonly');
                const req = tx.objectStore(STORE_NAME).get(userId);
                req.onsuccess = () => res(req.result);
                req.onerror = () => res(null);
            });
        }
    };

    const getDB = () => {
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
            request.onsuccess = () => { resolve(request.result); };
            request.onerror= () => console.error("DB Open Error");
        });
    };

    const getStats = async () => {
        try {
            const db = await getDB();

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                console.warn(`⚠️ 找不到 Store: ${STORE_NAME}`);
                return { count: 0, latest: [] };
            }

            return new Promise((res, rej) => {
                const tx = db.transaction([STORE_NAME], 'readonly');

                tx.onerror = (e) => {
                    console.error("🔴 Transaction 交易失敗:", e.target.error);
                    rej(e.target.error);
                };

                const store = tx.objectStore(STORE_NAME);
                const index = store.indexNames.contains('timestamp') ? store.index('timestamp') : store;

                const countReq = store.count();
                countReq.onerror = (e) => console.error("❌ Count 請求失敗:", e.target.error);

                countReq.onsuccess = () => {
                    const count = countReq.result;
                    const latest = [];

                    const cursorReq = index.openCursor(null, 'prev');

                    cursorReq.onerror = (e) => {
                        console.error("❌ Cursor 讀取失敗:", e.target.error);
                        res({ count, latest: [] });
                    };

                    cursorReq.onsuccess = e => {
                        const cursor = e.target.result;
                        if (cursor && latest.length < 20) {
                            latest.push(cursor.value);
                            cursor.continue();
                        } else {
                            res({ count, latest });
                        }
                    };
                };
            });
        } catch (err) {
            console.error("🔴 getStats 發生嚴重錯誤:", err);
            return { count: 0, latest: [] };
        }
    };

    // 🔍 新增模糊搜尋功能 (依據部分 userId 關鍵字)
    const searchProfiles = async (keyword) => {
        try {
            const db = await getDB();
            if (!db.objectStoreNames.contains(STORE_NAME)) return [];

            return new Promise((res) => {
                const tx = db.transaction([STORE_NAME], 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const results = [];
                const lowerKeyword = keyword.toLowerCase();

                // 使用 cursor 走訪資料進行部分比對
                const cursorReq = store.openCursor();
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const item = cursor.value;
                        // 支援大小寫不敏感的包含比對

                        if(lowerKeyword.length === 0){
                         results.push(item);
                        }
                        else if (item.userId && item.userId.toLowerCase().includes(lowerKeyword)) {
                            results.push(item);
                        }

                        // 限制搜尋結果最大數量（例如 50 筆），避免極端狀況效能卡頓
                        if (results.length >= 50) {
                            res(results);
                            return;
                        }
                        cursor.continue();
                    } else {
                        // 搜尋完成，依照時間戳記降序排列 (新到舊)
                        results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                        res(results);
                    }
                };
                cursorReq.onerror = () => res([]);
            });
        } catch (err) {
            console.error("🔴 搜尋發生錯誤:", err);
            return [];
        }
    };

    const searchLocation = async (keyword) => {
        try {
            const db = await getDB();
            if (!db.objectStoreNames.contains(STORE_NAME)) return [];

            return new Promise((res) => {
                const tx = db.transaction([STORE_NAME], 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const results = [];
                const lowerKeyword = keyword.toLowerCase();

                // 使用 cursor 走訪資料進行部分比對
                const cursorReq = store.openCursor();
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const item = cursor.value;
                        // 支援大小寫不敏感的包含比對

                        if(lowerKeyword.length === 0){
                         results.push(item);
                        }
                        else if (item.location && item.location.toLowerCase().includes(lowerKeyword)) {
                            results.push(item);
                        }

                        // 限制搜尋結果最大數量（例如 50 筆），避免極端狀況效能卡頓
                        if (results.length >= 50) {
                            res(results);
                            return;
                        }
                        cursor.continue();
                    } else {
                        // 搜尋完成，依照時間戳記降序排列 (新到舊)
                        results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                        res(results);
                    }
                };
                cursorReq.onerror = () => res([]);
            });
        } catch (err) {
            console.error("🔴 搜尋發生錯誤:", err);
            return [];
        }
    };

    const deleteSingleData = async (uid) => {
        try {
            const db = await getDB();
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const req = store.delete(uid);

            req.onsuccess = async () => {
                console.log(`✅ 已刪除: ${uid}`);
                // 檢查目前搜尋框有沒有字，決定刷新搜尋還是預設清單
                const searchInput = document.getElementById('idb-search-user');
                if (searchInput && searchInput.value.trim()) {
                    const filtered = await searchProfiles(searchInput.value.trim());
                    const stats = await getStats();
                    updatePanelUI({ count: stats.count, latest: filtered });
                } else {
                    const newStats = await getStats();
                    updatePanelUI(newStats);
                }
            };

            req.onerror = (err) => {
                console.error("❌ 刪除失敗:", err);
            };
        } catch (err) {
            console.error("🔴 刪除發生錯誤:", err);
        }
    };

    let panel = null;
    let overlay = null;
    let importMode = 'normal';

    // --- 強力捲動鎖定函數 ---
    const preventDefault = (e) => {
        if (!e.target.closest('#idb-list-content')) {
            e.preventDefault();
        }
    };

    const lockScroll = () => {
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = `${scrollBarWidth}px`;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        window.addEventListener('wheel', preventDefault, { passive: false });
        window.addEventListener('touchmove', preventDefault, { passive: false });
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code)) {
                preventDefault(e);
            }
        }, { passive: false });
    };

    const unlockScroll = () => {
        document.body.style.paddingRight = '';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        window.removeEventListener('wheel', preventDefault);
        window.removeEventListener('touchmove', preventDefault);
    };

    const updatePanelUI = (stats) => {
        if (!panel) return;
        const countEl = panel.querySelector('.db-count');
        if (countEl) countEl.innerText = stats.count.toLocaleString();
        const list = document.getElementById('idb-list-content');
        if (list) {
            list.innerHTML = stats.latest.map(item => {
                let flagStr = "";
                if(window.THREADS_LST_FD && typeof window.THREADS_LST_FD.getFlagEmoji === 'function') {
                    flagStr = window.THREADS_LST_FD.getFlagEmoji(item.location) + " " + item.location;
                } else {
                    flagStr = "📍 " + item.location;
                }
                return `
                <div style="padding:10px;border-radius:8px;margin-bottom:8px;">
                    <div style="font-weight:bold;font-size:12px;">
                        <a href="/@${item.userId}" style="text-decoration:none;" target="_blank">${item.userId}</a>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;">
                        <div><span style="color:#999;font-size:11px;">📅 ${item.joined}</span>
                         <button class="btn-delete-single" data-userid="${item.userId}"
                        style="background:transparent;color:#ff4d4d;border:1px solid #ff4d4d;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;">
                        🗑️
                    </button></div>
                        <span style="color:#FFF;font-size:11px;">${flagStr}</span>
                    </div>
                </div>
            `}).join('') || '<div style="color:#666;text-align:center;">暫無資料</div>';
        }

        list.querySelectorAll('.btn-delete-single').forEach(btn => {
            btn.onclick = async (e) => {
                const uid = e.currentTarget.getAttribute('data-userid');
                if (confirm(`確定要刪除 ${uid} 的快取嗎？`)) {
                    await deleteSingleData(uid);
                }
            };
        });
    };

    const showPanel = async () => {
        if(!caller){
            caller=true;
            setDMAction(true);
        }
        if (panel) return;
        const stats = await getStats();
        window.history.pushState({ idbPanelOpen: true }, "");

        lockScroll();

        // 建立遮罩層
        overlay = document.createElement('div');
        overlay.id = 'threads-idb-overlay';
        overlay.onclick = () => closePanel();
        document.body.appendChild(overlay);

        const logo = document.querySelector('a[href="/"] svg[aria-label="Threads"]') || document.querySelector('div[role="navigation"] svg');
        let targetLeft = "50%";
        if (logo) {
            const rect = logo.getBoundingClientRect();
            targetLeft = `${rect.left + (rect.width / 2)}px`;
        }

        panel = document.createElement('div');
        panel.id = 'threads-idb-data-panel';

        if (!document.getElementById('panel-anim')) {
            const s = document.createElement('style');
            s.id = 'panel-anim';
            s.textContent = `@keyframes panelFadeIn { from { opacity:0; transform: translateX(-50%) scale(0.95); } to { opacity:1; transform: translateX(-50%) scale(1); } }`;
            document.head.appendChild(s);
        }

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:15px;border-bottom:1px solid rgba(128,128,128,0.2);padding-bottom:10px;">
                <span style="font-weight:bold;"> 📂資料中心 ${version}</span>
                <span id="close-panel-x" style="font-size:16px;cursor:pointer;opacity:0.5;">[✕]</span>
            </div>
            <div style="text-align:center;padding:10px;border-radius:10px;margin-bottom:10px; display:flex; justify-content:space-around; align-items:center; background: rgba(128,128,128,0.05);">
                <span style="font-size:11px;opacity:0.6;">目前總人數：<strong class="db-count" style="font-size:14px;color:#D4AF37;">${stats.count.toLocaleString()}</strong></span>
            </div>

            <div style="display: flex; gap: 8px;">
                <input style="width: 70%;" type="text" id="idb-search-user" class="idb-search-input" placeholder="輸入帳號關鍵字搜尋...">
                <input style="width: 30%;" type="text" id="idb-search-location" class="idb-search-input" placeholder="輸入位置搜尋...">
            </div>

            <div id="idb-list-content" style="flex: 1; min-height:150px; overflow-y:auto; margin-bottom:15px;"></div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button id="btn-export" style="padding:8px;border-radius:6px;cursor:pointer;font-size:11px;">📤 匯出備份</button>
                <button id="btn-import-std" style="padding:8px;border-radius:6px;cursor:pointer;font-size:11px;">📥 標準匯入</button>
                <button id="btn-import-addon" style="padding:8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:bold;">📥 匯入套件資料</button>
                <button id="btn-clear-all" style="padding:8px;background:#300;color:#ff4d4d;border:1px solid #ff4d4d;border-radius:6px;cursor:pointer;font-size:11px;">🗑️ 刪除所有資料</button>
            </div>

            <input type="file" id="hidden-file-input" style="display:none;" accept=".json">
        `;
        document.body.appendChild(panel);
        updatePanelUI(stats);

        // 綁定搜尋事件 (Input 輸入時即時過濾)
        const searchInput = document.getElementById('idb-search-user');
        searchInput.oninput = async (e) => {
            const val = e.target.value.trim();
            if (val === '') {
                // 如果搜尋清空，還原回預設的最新 20 筆
                const defaultStats = await getStats();
                updatePanelUI(defaultStats);
            } else {
                // 執行模糊搜尋
                const filteredList = await searchProfiles(val);
                updatePanelUI({ count: stats.count, latest: filteredList });
            }
        };

        const searchLocationInput = document.getElementById('idb-search-location');
        searchLocationInput.oninput = async (e) => {
            const val = e.target.value.trim();
            if (val === '') {
                // 如果搜尋清空，還原回預設的最新 20 筆
                const defaultStats = await getStats();
                updatePanelUI(defaultStats);
            } else {
                // 執行模糊搜尋
                const filteredList = await searchLocation(val);
                updatePanelUI({ count: stats.count, latest: filteredList });
            }
        };

        panel.addEventListener('touchmove', (e) => {
            const isScrollable = e.target.closest('#idb-list-content');
            if (!isScrollable) e.preventDefault();
        }, { passive: false });

        document.getElementById('btn-export').onclick = async () => {
            const db = await getDB();
            const data = await new Promise(res => {
                db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll().onsuccess = e => res(e.target.result);
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            a.download = `Modify-Lee-su-Threads-Backup-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        };

        document.getElementById('btn-import-std').onclick = () => { importMode = 'normal'; document.getElementById('hidden-file-input').click(); };
        document.getElementById('btn-import-addon').onclick = () => { importMode = 'addon'; document.getElementById('hidden-file-input').click(); };
        document.getElementById('btn-clear-all').onclick = async () => {
            if (!confirm("⚠️ 確定要刪除資料庫內所有快取資料嗎？\n此動作無法還原！")) return;

            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const req = store.clear();

            req.onsuccess = () => {
                alert("✅ 所有資料已刪除");
                updatePanelUI({ count: 0, latest: [] });
            };

            req.onerror = (err) => {
                console.error("清除失敗:", err);
                alert("❌ 刪除失敗，請查看主控台報錯");
            };
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
                    if (importMode === 'addon') {
                        Object.entries(json).forEach(([uid, val], index) => {
                            existingKeys.has(uid) ? updatedItems++ : newItems++;
                            let loc = val.location;
                            store.put({ userId: uid, joined: val.joined, location: loc, timestamp: val.timestamp || (Date.now() + index) });
                        });
                    } else {
                        json.forEach(item => {
                            existingKeys.has(item.userId) ? updatedItems++ : newItems++;
                            store.put(item);
                        });
                    }
                    tx.oncomplete = async () => {
                        const s = await getStats(); updatePanelUI(s);
                        alert(`📊 匯入報告\n新增：${newItems}\n更新：${updatedItems}`);
                    };
                } catch (err) { alert("格式錯誤"); }
            };
            reader.readAsText(file);
        };
    };

    const patrolBtn = () => {
        const url = window.location.href;
        const spans = Array.from(document.querySelectorAll('span'));
        const hasNewPostText = spans.some(s => s.innerText === "新串文");
        const hasDraftIcon = !!document.querySelector('svg[aria-label="草稿"]');
        const hasCancelBtn = spans.some(s => s.innerText === "取消");
        const isCreatingPost = (hasNewPostText && (hasDraftIcon || hasCancelBtn));
        const shouldHide = url.includes('/media') || url.includes('/intent/post') || isCreatingPost;

        if (shouldHide) {
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
            btn.onclick = () => panel ? closePanel() : showPanel();
            (document.body || document.documentElement).appendChild(btn);
        } else {
            btn.style.display = 'flex';
        }
    };

    const closePanel = (isPop = false) => {
        if (panel) {
            panel.remove();
            panel = null;
        }
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
        unlockScroll();
        if (!isPop) {
            window.history.back();
        }
        else{
            if(caller){
                caller=false;
                setDMAction(false);
            }
        }
    }

    function setDMAction(tf){
        if (window.THREADS_PWA && window.THREADS_PWA.setDMAction) {
            window.THREADS_PWA.setDMAction(tf);
        }
    }

    window.onpopstate = (e) => {
        closePanel(true);
    };
    setInterval(patrolBtn, 1000);
    patrolBtn();
})();
