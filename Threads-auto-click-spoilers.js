// ==UserScript==
// @name         Threads auto click spoilers
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  Threads auto click spoilers
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function waitUntilDetached(btn, callback) {
        let attempts = 0;
        const check = setInterval(() => {
            attempts++;

            // 檢查這個按鈕是否還連接在網頁 document 上
            if (!btn.isConnected || attempts > 20) {
                clearInterval(check);
                if (!btn.isConnected) {
                    callback(); 
                }
            }
        }, 100);
    }

    function autoClickSpoilers() {
        // 1. 文字劇透
        document.querySelectorAll('span[data-text-fragment="spoiler"]').forEach(el => {
            const btn = el.closest('div[role="button"]');
            const spoilerText = el.innerText.trim();
            const parent = btn?.parentElement; // 先抓好父層，因為點擊後 btn 會斷開

            if (btn && !btn.dataset.autoClicked) {
                btn.dataset.autoClicked = "true";
                btn.click();

                // 等到這個「舊按鈕」真正斷開連結
                waitUntilDetached(btn, () => {
                    // 這時候 parent 裡面的內容應該已經被 React 換成新的純文字 span 了
                    const newSpans = parent.querySelectorAll('span');
                    newSpans.forEach(s => {
                        // 找到文字符合且沒有邊框的新 span
                        if (s.innerText.trim() === spoilerText && !s.dataset.revealedBorder) {
                            s.style.setProperty('border', '1.5px solid #D4AF37', 'important');
                            s.style.setProperty('border-radius', '6px', 'important');
                            s.style.setProperty('padding', '0 4px', 'important');
                            s.style.setProperty('display', 'inline-block', 'important');
                            s.style.setProperty('vertical-align', 'middle', 'important');
                            s.dataset.revealedBorder = "true";
                        }
                    });
                });
            }
        });

        // 2. 影音劇透：搜尋所有內容為「劇透」的 span
        document.querySelectorAll('span').forEach(span => {
            // 偵測文字內容是否為劇透
            const isSpoilerText = span.innerText === '劇透' ;

            if (isSpoilerText) {
                const btn = span.closest('div[role="button"]');

                if (btn && !btn.dataset.autoClicked) {
                    btn.click();
                    btn.dataset.autoClicked = "true";
                    const parent=btn.parentElement;
                    waitUntilDetached(btn, () => {
                        if (!parent) return;

                        const mediaElements = parent.querySelectorAll('img, video');

                        mediaElements.forEach(s => {
                            if (!s.dataset.revealedBorder) {
                                // 加上金色邊框
                                s.style.setProperty('border', '2px solid #D4AF37', 'important');
                                s.style.setProperty('border-radius', '12px', 'important');
                                s.style.setProperty('box-sizing', 'border-box', 'important');
                                s.style.setProperty('display', 'block', 'important');
                                s.dataset.revealedBorder = "true";
                            }
                        });
                    });
                }
            }
        });
    }
     const observer = new MutationObserver(autoClickSpoilers);
    observer.observe(document.documentElement, { childList: true, subtree: true });

})();
