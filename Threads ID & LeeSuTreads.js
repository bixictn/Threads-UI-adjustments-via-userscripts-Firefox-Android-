// ==UserScript==
// @name         Threads ID & Lee Su Threads
// @namespace    http://tampermonkey.net/
// @version      0.1.6
// @description  Show Date
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const globalUserCache = new Map();

    function doSmartMove() {
        const badges = document.querySelectorAll('[class*="threads-"][title]');

        badges.forEach(badge => {
            const titleText = badge.title || "";
            const content = badge.innerText || "";

            // --- 狀況 A：正在載入中 (出現⏳) ---
            if (content.includes("⏳")) {
                badge.style.opacity = "0"; // 讓漏斗透明，但繼續跑
                badge.style.pointerEvents = "none";
                return;
            }

            // --- 狀況 B：沒日期 (Get location) -> 顯示按鈕 ---
            if (!titleText.includes("加入時間")) {
                badge.style.display = "";
                badge.style.visibility = "visible";
                badge.style.opacity = "1";
                badge.style.pointerEvents = "auto";
                return;
            }

            // --- 狀況 C：已有日期 (不論是剛按完還是原本就有) -> 執行搬移 ---
            const scope = badge.closest('article') || badge.closest('[data-pressable-container="true"]');
            if (!scope) return;

            // 抓取 Username (優先從屬性，次之從連結)
            let username = badge.getAttribute('data-username');
            if (!username) {
                const userLink = scope.querySelector('a[href*="/@"]');
                if (userLink) {
                    username = userLink.getAttribute('href').split('/@')[1].split(/[?\/]/)[0];
                }
            }
            if (!username) return;
            if(globalUserCache.has(username)) hideAllButtonsByUsername(username);

            // 尋找上方 ID 連結位置
            const idLinks = Array.from(scope.querySelectorAll('a[href*="/@"]'));
            const target = idLinks.find(link =>
                link.innerText.trim().length > 0 &&
                !link.querySelector('img') &&
                link.getAttribute('href').includes(`/@${username}`)
            );

            if (target) {
                // 執行搬移標註
                if (!target.previousElementSibling || !target.previousElementSibling.classList.contains("my-cake-plugin")) {
                    const p = document.createElement('div');
                    p.className = "my-cake-plugin";

                    let datePart = titleText.replace(/^.*•\s*|加入時間[:：]\s*|\(.*\)/g, '').trim();
                    let icon = titleText.includes('未分享') ? "🫥" : "📅";

                    if (titleText.includes('•')) {
                        p.textContent = icon + datePart + content.replace("⏳", "").trim();
                    } else {
                        p.textContent = titleText;
                    }

                    p.style.cssText = 'color: #808080; font-size: 13px; font-weight: 400; margin-bottom: 3px; display: block;';
                    target.before(p);
                }
                hideAllButtonsByUsername(username);
                globalUserCache.set(username);
                badge.style.display = "none";
                badge.style.visibility = "hidden";
                badge.style.height = '0';
                badge.style.position = 'absolute';
            }
        });
    }

    function hideAllButtonsByUsername(username) {
        const allPossibleButtons = document.querySelectorAll(`button[data-username="${username}"]`);
        allPossibleButtons.forEach(btn => {
            btn.style.display = "none";
            btn.style.visibility = "hidden";
            btn.style.height = '0';
        });
    }

    // 提高巡檢頻率
    setInterval(doSmartMove, 500);

    // 監聽 DOM 變動與捲動
    const observer = new MutationObserver(doSmartMove);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', doSmartMove, { passive: true });

})();
