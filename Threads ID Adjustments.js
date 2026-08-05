// ==UserScript==
// @name         Threads ID Adjustments
// @version      0.5.2
// @description  Threads ID Adjustments
// @match         https://www.threads.net/*
// @match         https://www.threads.com/*
// @grant         none
// @run-at        document-start
// @updateURL    https://raw.githubusercontent.com/bixictn/Threads-UI-adjustments-via-userscripts-Firefox-Android-/main/Threads%20ID%20Adjustments.js
// @downloadURL  https://raw.githubusercontent.com/bixictn/Threads-UI-adjustments-via-userscripts-Firefox-Android-/main/Threads%20ID%20Adjustments.js
// ==/UserScript==

(function() {
    'use strict';
    const style = document.createElement('style');
    style.textContent = `
        @keyframes hourglass-flip { 0% { transform: translateX(-50%) rotate(0deg); }  50% { transform: translateX(-50%) rotate(180deg); } 100% { transform: translateX(-50%) rotate(350deg); } }
        .cake-avatar-anchor { position: relative !important; display: flex !important; justify-content: center !important; }
        .cake-avatar-anchor::after {
            content: attr(data-cake-date); position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
            margin-top: 6px; color: #A0A0A0; font-size: 10px; white-space: pre; line-height: 1.1;
            text-align: center; z-index: 10; pointer-events: none; width: max-content; display: block !important;
        }
        .cake-avatar-anchor[data-cake-date="💿"]::after { animation: hourglass-flip 1s linear infinite !important; }
    `;
    (document.head || document.documentElement).appendChild(style);

    const days = 6 * 24 * 60 * 60 * 1000;

    // --- 3. 核心功能 ---
    function isInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (rect.top <= (window.innerHeight || document.documentElement.clientHeight) + 200 && rect.bottom >= -200);
    }

    async function doSmartSync() {
        if (!window.THREADS_PWA?.isStartTouch)return;

        const articles = document.querySelectorAll('[data-pressable-container="true"]');

        for (const scope of articles) {
            const img = scope.querySelector('img');
            if (!img || img.dataset.processed === "done") continue;

            const userLink = scope.querySelector('time')?.closest('a[href*="/"]');
            if (!userLink) continue;

            const href = userLink.getAttribute('href').split('?')[0];
            const userId = href.replace(/^\/@?/, '').split('/')[0];
            if(!isInViewport(userLink))continue;

            const cached = await window.THREADS_DB_CENTER.getProfile(userId);
            const now = Date.now();
            const isFresh = cached && (now - cached.timestamp < days);


            const container = img.parentElement?.parentElement;
            if (!container) continue;

            if (isFresh) {
                container.classList.add("cake-avatar-anchor");
                if(cached)renderUI(scope, cached);
                continue;
            }
            else{

                container.classList.add("cake-avatar-anchor");
                container.setAttribute('data-cake-username',userId);
                if(container.getAttribute('data-cake-date') === "🚫"){
                    if(cached)renderUI(scope, cached);
                    continue;
                }
                const isWaiting = container.getAttribute('data-cake-date') === "💿";
                if (!isWaiting) {
                    container.setAttribute('data-cake-date', "💿");
                    console.log("getProfile:"+userId);
                    setTimeout(getProfile(userId),2000);
                }

            }





        }
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
        display += (data.location === "未分享") ? `\n🫥未分享` : `\n${window.THREADS_LST_FD.getFlagEmoji(data.location) +" "+ data.location}`;


        const now = Date.now();
        const joinedTs = getTimestampFromMonth(data.joined);
        const TWO_MONTHS = days * 10; // 約兩個月

        let nTs='70px';
        // 如果 (現在時間 - 加入時間) 小於 8 星期，就是新帳號
        if (joinedTs > 0 && (now - joinedTs) < TWO_MONTHS) {
            display += "\n✨[新帳號]";
            nTs='80px';
        }
        container.classList.add("cake-avatar-anchor");
        container.setAttribute('data-cake-date', display);
        container.setAttribute('data-cake-uid', data.userId);
        container.setAttribute('data-cake-nts', nTs);
        container.setAttribute('data-cake-d',data.joined);
        //VerifyIG(data.userId);


        if (!isStale) img.dataset.processed = "done";
    }

    function VerifyIG(username) {
        const event = new CustomEvent('REQUEST_IG_VERIFY', { detail: { username } });
        window.dispatchEvent(event);
    }

    function getProfile(username){
        const event = new CustomEvent('REQUEST_PROFILE', { detail: { username } });
        window.dispatchEvent(event);
    }

    window.addEventListener('REQUEST_PROFILE_TIMEOUT', (e) => {
        const { username } = e.detail;
        const container = document.querySelector(`.cake-avatar-anchor[data-cake-username="${username}"]`);
        if (!container) return;

        let display = "🚫";

        container.classList.add("cake-avatar-anchor");
        container.setAttribute('data-cake-date', display);

    });

    window.addEventListener('IG_VALID_RESULT', (e) => {
        const { username, isValid, targetUrl } = e.detail;

        const container = document.querySelector(`.cake-avatar-anchor[data-cake-uid="${username}"]`);
        if (!container) return;
        const currentNts = container.getAttribute('data-cake-nts');
        if (isValid) {
            if (!container.querySelector('.cake-ig-link')) {
                const igLink = document.createElement('a');
                igLink.className = 'cake-ig-link';
                igLink.href = targetUrl;
                igLink.target = '_blank';
                igLink.innerText = '📸 IG';

                igLink.style.cssText = `
                    position: absolute;
                    top: ${currentNts}; /* 使用專屬高度，不會被其他人蓋掉 */
                    left: 50%;
                    transform: translateX(-50%);
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

                // 懸停與阻斷冒泡效果保持不變...
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

                igLink.onclick = (e) => e.stopPropagation();
                igLink.onmousedown = (e) => e.stopPropagation();

                container.appendChild(igLink);
                container.removeAttribute('data-cake-uid');
                container.removeAttribute('data-cake-nts');
            }
        }
        else{
            if (!container.querySelector('.cake-ig-link')) {
                const igLink = document.createElement('div');
                igLink.className = 'cake-ig-link';
                const checkdate=container.getAttribute('data-cake-d');

                if((getTimestampFromMonth("2026年06月")-getTimestampFromMonth(checkdate)) > 0){
                    igLink.innerText = '解除綁定IG';
                }
                else{
                    igLink.innerText = '未連結IG';
                }

                igLink.style.cssText = `
                    position: absolute;
                    top: ${currentNts};
                    left: 50%;
                    transform: translateX(-50%);
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

                container.appendChild(igLink);
                container.removeAttribute('data-cake-uid');
                container.removeAttribute('data-cake-nts');
            }
        }
    });

    try {
        doSmartSync().catch(err => console.log("背景預載入提示:", err));
    } catch(e) {}

    setTimeout(() => {
        setInterval(() => {
            try {
                doSmartSync();
            } catch(e) {
                console.error("定時器執行衝突:", e);
            }
        }, 1500);

        try { doSmartSync(); } catch(e) {}
    }, 1500);
})();
