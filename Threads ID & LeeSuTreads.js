// ==UserScript==
// @name         Threads ID & Lee Su Threads
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  Threads ID & Lee Su Thread
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        .cake-avatar-anchor { position: relative !important; }
        .cake-avatar-anchor::after {
            content: attr(data-cake-date) !important;
            white-space: pre !important;
            line-height: 1.1 !important;
            text-align: center !important;
            position: absolute !important;
            top: 100% !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            margin-top: 4px !important;
            color: #999999 !important;
            font-size: 9px !important;
            font-weight: 400 !important;
            pointer-events: none !important;
            z-index: 5 !important;
            display: block !important;
        }
    `;
    document.head.appendChild(style);

    function doSmartSync() {
        const containers = document.querySelectorAll('article, [data-pressable-container="true"]');

        containers.forEach(scope => {
            const badge = scope.querySelector('[class*="threads-"][title]');

            if (!badge) return;

            const titleText = badge.title || "";
            const content = badge.innerText || "";

            // --- 核心改動：如果發現插件在那但沒資料 (長 ID 情況)，就直接點它 ---
            if (content.includes("⏳") || !titleText.includes("加入時間")) {
                // 找尋插件內部的按鈕節點
                const innerBtn = badge.querySelector('button, [role="button"]') || badge;

                if (innerBtn && !badge.dataset.cakeClicked) {
                    badge.dataset.cakeClicked = "true"; // 標記已點擊

                    // 執行模擬點擊，強制插件更新 title
                    innerBtn.click();

                    // 點擊後極速嘗試關閉可能彈出的視窗
                    setTimeout(() => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                    }, 5);
                }
                return;
            }

            // --- 解析日期與多行內容 ([新帳號] 換行) ---
            let datePart = titleText.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim();
            let icon = titleText.includes('未分享') ? "🫥" : "📅";
            let cleanContent = content.replace("⏳", "").trim();

            let finalData = icon + datePart;
            if (cleanContent) {
                let formattedContent = cleanContent.replace("[新帳號]", "\n[新帳號]").trim();
                finalData += "\n" + formattedContent;
            }

            // --- 投影到頭貼 ---
            const avatarImg = scope.querySelector('img');
            if (avatarImg) {
                const avatarContainer = avatarImg.parentElement?.parentElement;
                if (avatarContainer) {
                    if (!avatarContainer.classList.contains("cake-avatar-anchor")) {
                        avatarContainer.classList.add("cake-avatar-anchor");
                    }
                    if (avatarContainer.getAttribute('data-cake-date') !== finalData) {
                        avatarContainer.setAttribute('data-cake-date', finalData);
                    }
                }
            }

            // 隱藏原始插件 (確保不影響高度，解決回跳位移)
            badge.style.setProperty('display', 'none', 'important');
        });
    }

    const observer = new MutationObserver(() => window.requestAnimationFrame(doSmartSync));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
    window.addEventListener('scroll', doSmartSync, { passive: true });

    setInterval(doSmartSync, 1500); // 縮短檢查時間，讓長 ID 偵測更快
    doSmartSync();
})();
