// ==UserScript==
// @name         Lee-su-Threads save to IndexedDB
// @version      0.3.0
// @description  Lee-su-Threads save to IndexedDB
// @author       Gemini Adaptive AI
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const version='v0.3.0';
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
			border-radius:50%!important;
			display:flex!important;
			align-items:center!important;
			justify-content:center!important;
			font-size:18px!important;
			cursor:pointer!important;
			z-index:${ZIbtn} !important;
			backdrop-filter:blur(4px);
		}

		/* 當螢幕寬度小於 695px 時（自動判定為行動版） */
		@media screen and (max-width: 695px) {
			#threads-idb-mini-btn {
				top: 14px !important;
				left: 25% !important;
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
		.__fb-dark-mode #threads-idb-mini-btn {
			background-color: rgba(16,16,16,0.9) !important;
			border: 1.5px solid #D4AF37 !important;
			color: #D4AF37 !important;
		}

		/* --- 2. 亮色模式樣式 --- */
		.__fb-light-mode #threads-idb-data-panel {
			background: #FFFFFF !important;
			border: 2px solid #D4AF37 !important;
			color: #000000 !important;
			box-shadow: 0 0 12px rgba(212, 175, 55, 0.8) !important;
		}
		.__fb-light-mode #threads-idb-mini-btn {
			background-color: rgba(250, 250, 250, 0.9) !important;
			border: 1.5px solid #D4AF37 !important;
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
				grid-column:span 2;
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
    `;
    document.head.appendChild(style);

    const DB_NAME = 'ThreadsProfileDB';
    const STORE_NAME = 'profilecache';

    window.THREADS_DB_CENTER = {
        // 儲存資料
        saveProfile: async (data) => {
            const db = await getDB(); // 使用你現有的 getDB
            return new Promise((res, rej) => {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                const store = tx.objectStore(STORE_NAME);

                // 統一結構：userId 是文字帳號，usernumber 是數字 ID
                const entry = {
                    userId: data.userId,
                    usernumber: data.usernumber,
                    joined: data.joined,
                    location: data.location,
                    timestamp: Date.now()
                };

                const req = store.put(entry); // keyPath 已設為 userId
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

            // 1. 檢查 Store 是否存在
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                console.warn(`⚠️ 找不到 Store: ${STORE_NAME}`);
                return { count: 0, latest: [] };
            }

            return new Promise((res, rej) => {
                // 2. 建立交易，並加上 Transaction 級別的錯誤監聽
                const tx = db.transaction([STORE_NAME], 'readonly');

                tx.onerror = (e) => {
                    console.error("🔴 Transaction 交易失敗:", e.target.error);
                    rej(e.target.error);
                };

                const store = tx.objectStore(STORE_NAME);
                const index = store.indexNames.contains('timestamp') ? store.index('timestamp') : store;

                // 3. Count 請求
                const countReq = store.count();
                countReq.onerror = (e) => console.error("❌ Count 請求失敗:", e.target.error);

                countReq.onsuccess = () => {
                    const count = countReq.result;
                    const latest = [];

                    // 4. Cursor 請求
                    const cursorReq = index.openCursor(null, 'prev');

                    cursorReq.onerror = (e) => {
                        console.error("❌ Cursor 讀取失敗:", e.target.error);
                        res({ count, latest: [] }); // 即使讀取清單失敗，至少回傳數量
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
            // 5. 捕獲 await getDB() 或其他同步代碼產生的錯誤
            console.error("🔴 getStats 發生嚴重錯誤:", err);
            return { count: 0, latest: [] }; // 回傳空值防止 UI 報錯
        }
    };

    const deleteSingleData = async (uid) => {
        try {
            const db = await getDB();
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const req = store.delete(uid); // 執行刪除

            req.onsuccess = async () => {
                console.log(`✅ 已刪除: ${uid}`);
                // 重新讀取統計資訊並更新 UI
                const newStats = await getStats();
                updatePanelUI(newStats);
            };

            req.onerror = (err) => {
                console.error("❌ 刪除失敗:", err);
            };
        } catch (err) {
            console.error("🔴 刪除發生錯誤:", err);
        }
    };

    let panel = null;
    let overlay = null; // 新增遮罩層變數
    let importMode = 'normal';

    // --- 強力捲動鎖定函數 ---
    const preventDefault = (e) => {
        // 如果不是在 Panel 內部的捲動，就攔截
        if (!e.target.closest('#idb-list-content')) {
            e.preventDefault();
        }
    };

    const lockScroll = () => {
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = `${scrollBarWidth}px`;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // 電腦版關鍵：攔截滾輪與按鍵
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
            list.innerHTML = stats.latest.map(item => `
                <div style="padding:10px;border-radius:8px;margin-bottom:8px;">
                    <div style="font-weight:bold;font-size:12px;">
                        <a href="/@${item.userId}" style="text-decoration:none;" target="_blink">${item.userId}</a>

                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;">
                        <div><span style="color:#999;font-size:11px;">📅 ${item.joined}</span>
                         <button class="btn-delete-single" data-userid="${item.userId}"
                        style="background:transparent;color:#ff4d4d;border:1px solid #ff4d4d;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;">
                        🗑️
                    </button></div>
                        <span style="color:#FFF;font-size:11px;">📍 ${window.THREADS_LST_FD.getFlagEmoji(item.location)+" "+item.location}</span>
                    </div>
                </div>
            `).join('') || '<div style="color:#666;text-align:center;">暫無資料</div>';
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
        overlay.onclick = () => closePanel(); // 點擊背景關閉
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
                <span style="font-weight:bold;">📂</span><span> 資料中心 ${version}</span>
                <div style="text-align:center;padding:10px;border-radius:10px;margin-bottom:15px;">
                    <div style="font-size:11px;opacity:0.6;">目前總人數</div>
                    <div class="db-count" style="font-size:16px;font-weight:bold;">${stats.count.toLocaleString()}</div>
                </div>
                <span id="close-panel-x" style="font-size:16px;cursor:pointer;opacity:0.5;">✕</span>
            </div>

            <div id="idb-list-content" style="max-height:150px;overflow-y:auto;margin-bottom:15px;"></div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button id="btn-export" style="padding:8px;border-radius:6px;cursor:pointer;font-size:11px;">📤 匯出備份</button>
                <button id="btn-import-std" style="padding:8px;border-radius:6px;cursor:pointer;font-size:11px;">📥 標準匯入</button>
                <button id="btn-import-addon" style="padding:10px;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:bold;grid-column:span 2;">📥 匯入套件資料</button>
            </div>
            <button id="btn-clear-all" style="width:100%;margin-top:10px;padding:8px;background:#300;color:#ff4d4d;border:1px solid #ff4d4d;border-radius:6px;cursor:pointer;font-size:11px;">🗑️ 刪除所有資料</button>
            <input type="file" id="hidden-file-input" style="display:none;" accept=".json">
        `;
        document.body.appendChild(panel);
        updatePanelUI(stats);

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

            // 2. 執行清除指令
            const req = store.clear();

            req.onsuccess = () => {
                alert("✅ 所有資料已刪除");
                // 3. 更新 UI 介面
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
