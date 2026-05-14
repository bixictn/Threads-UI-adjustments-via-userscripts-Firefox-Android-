// ==UserScript==
// @name         Threads ID & Lee-Su-Threads
// @version      0.4.8.5
// @description  Threads ID & Lee-Su-Threads
// @match         https://www.threads.net/*
// @match         https://www.threads.com/*
// @grant         none
// @run-at        document-start
// ==/UserScript==

(function() {
    'use strict';
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

    // --- 3. 核心功能 ---
    function isInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (rect.top <= (window.innerHeight || document.documentElement.clientHeight) + 200 && rect.bottom >= -200);
    }

    async function doSmartSync() {
        if (!window.THREADS_PWA?.isStartTouch)return;
        const usePlguin=(window.THREADS_DB_CENTER)?false:true;

        const articles = document.querySelectorAll('[data-pressable-container="true"]');

        for (const scope of articles) {
            const img = scope.querySelector('img');
            if (!img || img.dataset.processed === "done") continue;

            const userLink = scope.querySelector('time')?.closest('a[href*="/"]');
            if (!userLink) continue;

            const href = userLink.getAttribute('href').split('?')[0];
            const userId = href.replace(/^\/@?/, '').split('/')[0];
            if(!isInViewport(userLink))continue;

            if(!usePlguin){
                const cached = await window.THREADS_DB_CENTER.getProfile(userId);

                const now = Date.now();
                const isFresh = cached && (now - cached.timestamp < ONE_WEEK);

                if (isFresh) {
                    renderUI(scope, cached,usePlguin);
                    hideBadge(scope);
                    continue;
                }

                if (cached && !isFresh) renderUI(scope, cached,usePlguin, true);
            }

            const badge = scope.querySelector('[class*="threads-"][title]');
            const container = img.parentElement?.parentElement;
            if (!container) continue;

            // 🎯 新增：處理 badge 尚未載入的情況
            if (!badge) {
                const firstSeen = parseInt(scope.dataset.cakeFirstSeen || 0);
                const now = Date.now();

                if (!firstSeen) {
                    // 第一次看到這則貼文，記錄時間
                    scope.dataset.cakeFirstSeen = now;
                    console.log(`[⏳] 等待按鈕載入... (${userId})`);
                } else if (now - firstSeen > 5000) {
                    // 已經等超過 5 秒了，放棄這則貼文
                    console.log(`[⏭️] 等待超時，跳過此貼文: ${userId}`);
                    img.dataset.processed = "done"; // 標記為完成，往後不再掃描
                }
                continue; // 這一輪先跳過，等下一輪掃描
            }

            // 如果 badge 出現了，清除計時標記 (可選)
            delete scope.dataset.cakeFirstSeen;

            const isWaiting = container.getAttribute('data-cake-date') === "⏳";
            const title = badge?.title || "";
            const content = badge?.innerText || "";

            if(!usePlguin){
                // 🎯 從 FetchMap 取資料
                if (window.THREADS_LST_FD.has(userId)) {
                    const fData = window.THREADS_LST_FD.getUserData(userId);
                    const location = fData.location;
                    const finalData = { userId, joined: fData.joined, location: `${location}`, timestamp: Date.now(),usernumber: fData.usernumber};
                    await window.THREADS_DB_CENTER.saveProfile(finalData);
                    window.THREADS_LST_FD.deleteUser(userId);
                    console.log(`[📦 移除Fetch暫存] 帳號: ${userId}`);
                    renderUI(scope, finalData,usePlguin);
                    hideBadge(scope);
                    continue;
                }
            }
            // 🎯 觸發點擊 (如果沒資料且不在等待中)
            if (!isWaiting) {
                if (container) {
                    container.classList.add("cake-avatar-anchor");
                    container.setAttribute('data-cake-date', "⏳");
                }
                handleCapture(scope, userId);
            }
        }
    }

    function handleCapture(scope, userId) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        const img = scope.querySelector('img');
        const container = img?.parentElement?.parentElement;
        const title = badge?.title || "";
        const content = badge?.innerText || "";

        if (!badge || !container || badge.dataset.cakeStatus === "loading") return;
        if (title.includes("加入時間") && !content.includes("⏳")) {
            console.log('plugin 已存資料，無法fetch，用plugin資料顯示。');
            const data = {
                userId,
                joined: title.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim(),
                location: content.replace("⏳", "").replace("[新帳號]", "").trim(),
                timestamp: Date.now()
            };
            renderUI(scope, data,true);
            return;
        }
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

    function renderUI(scope, data,usePlguin, isStale = false) {
        const img = scope.querySelector('img');
        const container = img?.parentElement?.parentElement;
        if (!container) return;

        let display = (getTimestampFromMonth("2025年12月") - getTimestampFromMonth(data.joined) <= 0) ? `🔍\n${data.joined}` : `${(usePlguin?"[📅]":"📅")}\n${data.joined}`;
        display += (data.location === "未分享") ? `\n🫥未分享` : `\n${window.THREADS_LST_FD.getFlagEmoji(data.location) +" "+ data.location}`;


        const now = Date.now();
        const joinedTs = getTimestampFromMonth(data.joined);
        const TWO_MONTHS = ONE_WEEK * 8; // 約兩個月

        let nTs='70px';
        // 如果 (現在時間 - 加入時間) 小於 8 星期，就是新帳號
        if (joinedTs > 0 && (now - joinedTs) < TWO_MONTHS) {
            display += "\n✨[新帳號]";
            nTs='80px';
        }
        container.classList.add("cake-avatar-anchor");
        container.setAttribute('data-cake-date', display);

        if (!container.querySelector('.cake-ig-link')) {
            const igLink = document.createElement('a');
            igLink.className = 'cake-ig-link';
            igLink.href = `https://www.instagram.com/${data.userId}/`;
            igLink.target = '_blank';
            igLink.innerText = '📸 IG';

            igLink.style.cssText = `
                position: absolute;
                top: ${nTs};
                left: 50%;
                transform: translateX(-50%); /* 水平居中 */
                font-size: 12px;
                z-index: 1000 !important;
                cursor: pointer !important;
                pointer-events: auto !important;
                text-decoration: none;
                padding: 2px 2px;
                border-radius: 5px;
                background: rgba(128, 128, 128, 0.1);
                color: #A0A0A0;
                white-space: nowrap;
                transition: all 0.2s ease;
                border: 1px solid transparent;
            `;

            // 💡 懸停效果：變彩色並加邊框
            igLink.onmouseenter = () => {
                igLink.style.background = 'rgba(214, 41, 118, 0.1)';
                igLink.style.color = '#E1306C';
                igLink.style.borderColor = 'rgba(214, 41, 118, 0.3)';
                igLink.style.transform = 'translateX(-50%) scale(1.1)';
            };
            igLink.onmouseleave = () => {
                igLink.style.background = 'rgba(128, 128, 128, 0.1)';
                igLink.style.color = '#A0A0A0';
                igLink.style.borderColor = 'transparent';
                igLink.style.transform = 'translateX(-50%) scale(1)';
            };

            // 阻斷冒泡
            igLink.onclick = (e) => e.stopPropagation();
            igLink.onmousedown = (e) => e.stopPropagation();

            container.appendChild(igLink);
        }

        if (!isStale) img.dataset.processed = "done";
    }

    function hideBadge(scope) {
        const badge = scope.querySelector('[class*="threads-"][title]');
        if (badge) badge.style.setProperty('display', 'none', 'important');
    }

    doSmartSync().then(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes hourglass-flip { 0%, 85% { transform: translateX(-50%) rotate(0deg); } 100% { transform: translateX(-50%) rotate(180deg); } }
            //[class*="threads-"][title] { opacity: 0.01 !important; position: absolute !important; pointer-events: auto !important; }
            .cake-avatar-anchor { position: relative !important; display: flex !important; justify-content: center !important; }
            .cake-avatar-anchor::after {
                content: attr(data-cake-date); position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
                margin-top: 6px; color: #A0A0A0; font-size: 10px; white-space: pre; line-height: 1.1;
                text-align: center; z-index: 10; pointer-events: none; width: max-content; display: block !important;
            }
            .cake-avatar-anchor[data-cake-date="⏳"]::after { animation: hourglass-flip 1s linear infinite !important; }
        `;
        document.head.appendChild(style);
        setTimeout(() => { setInterval(doSmartSync, 1500); doSmartSync(); }, 1500);
    });
})();
