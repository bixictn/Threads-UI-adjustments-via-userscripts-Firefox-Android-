// ==UserScript==
// @name         Threads ID & Lee Su Threads
// @namespace    http://tampermonkey.net/
// @version      0.1.4
// @description  Show Date
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function doSmartMove() {
        // 抓取所有插件元素
        const badges = document.querySelectorAll('[class*="threads-"][title]');

        badges.forEach(badge => {
            const titleText = badge.title || "";

            // --- 判斷 1：如果沒日期（Get location 或 取得中），就只顯示按鈕 ---
            if (!titleText.includes("加入時間")) {
                badge.style.display = "";
                badge.style.visibility = "visible";
                return;
            }

            // --- 判斷 2：已經有日期了，準備搬移 ---
            const scope = badge.closest('article') || badge.closest('[data-pressable-container="true"]');
            if (!scope) return;

            // 嘗試從多個管道抓 Username，確保「原本就有資料」的也能抓到
            const fetchBtn = scope.querySelector('[class*="fetch-btn"]');
            let username = fetchBtn ? fetchBtn.getAttribute('data-username') : null;

            // 如果從按鈕抓不到，從連結抓
            if (!username) {
                const userLink = scope.querySelector('a[href*="/@"]');
                if (userLink) {
                    const href = userLink.getAttribute('href');
                    username = href.split('/@')[1].split(/[?\/]/)[0];
                }
            }

            if (!username) return;

            // 尋找 ID 連結位置
            const idLinks = Array.from(scope.querySelectorAll('a[href*="/@"]'));
            const target = idLinks.find(link =>
                link.innerText.trim().length > 0 &&
                !link.querySelector('img') &&
                link.getAttribute('href').includes(`/@${username}`)
            );

            if (target) {
                // 如果 ID 前面還沒插過 Cake，就插進去
                if (!target.previousElementSibling || !target.previousElementSibling.classList.contains("my-cake-plugin")) {
                    const p = document.createElement('div');
                    p.className = "my-cake-plugin";

                    let datePart = titleText.replace(/^.*•\s*/, '').replace(/加入時間[:：]\s*/, '').trim();
                    let icon = titleText.includes('未分享') ? "🫥 " : "🍰 ";
                    if ( titleText.includes('•')){
                        p.textContent = icon + datePart + (titleText.includes('未分享')?'':badge.innerText);
                    }
                    else{
                        p.textContent = titleText;
                    }

                    p.style.cssText = 'color: #808080; font-size: 13px; font-weight: 400; margin-bottom: 3px; display: block;';

                    target.before(p);
                }

                // 只要搬成功了，就把原處的按鈕隱藏
                badge.style.display = "none";
                badge.style.visibility = "hidden";
            }
        });
    }

    // 提高巡檢頻率，確保剛進頁面時原本就有資料的也能立刻被處理
    setInterval(doSmartMove, 500);

    // 監聽 DOM 變動與捲動
    const observer = new MutationObserver(doSmartMove);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', doSmartMove, { passive: true });

})();
