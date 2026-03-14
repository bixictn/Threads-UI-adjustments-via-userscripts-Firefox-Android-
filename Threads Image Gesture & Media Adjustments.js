// ==UserScript==
// @name         Threads Image Gesture & Media Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.0.4
// @description  整合圖片縮放手勢、關閉按鈕移至左上、音量按鈕移至右下
// @author       Gemini
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==


(function() {
    'use strict';

    // --- 1. 樣式注入 ---
    const style = document.createElement('style');
    style.textContent = `
        .zoom-active {
            position: relative !important;
            z-index: 9998 !important;
            touch-action: none !important;
            transition: none !important;
        }
    `;
    document.head.appendChild(style);

    // --- 2. 介面動態調整邏輯 ---
    const repositionElements = () => {
        if (!window.location.pathname.endsWith('/media')) return;

        // A. 關閉按鈕 (0,0)
        const closeIcon = document.querySelector('svg[aria-label="關閉"]');
        if (closeIcon) {
            const closeBtn = closeIcon.parentElement?.parentElement;
            if (closeBtn && closeBtn.getAttribute('role') === 'button') {
                closeBtn.style.setProperty('position', 'fixed', 'important');
                closeBtn.style.setProperty('top', '0px', 'important');
                closeBtn.style.setProperty('left', '0px', 'important');
                closeBtn.style.setProperty('margin', '0px', 'important');
                closeBtn.style.setProperty('z-index', '9999', 'important');
            }
        }

        // B. 音量按鈕 (根據視窗比例判斷)
        const muteIcon = document.querySelector('svg[aria-label="已靜音"], svg[aria-label="切換音量設定"], svg[aria-label="音量"]');
        if (muteIcon) {
            const muteBtn = muteIcon.parentElement?.parentElement;
            if (muteBtn && muteBtn.getAttribute('role') === 'button') {
                muteBtn.style.setProperty('position', 'fixed', 'important');
                muteBtn.style.setProperty('z-index', '9999', 'important');
                muteBtn.style.setProperty('transform', 'none', 'important');

                // --- 核心判斷：視窗寬度 vs 視窗高度 ---
                const isScreenPortrait = window.innerWidth < window.innerHeight;

                if (isScreenPortrait) {
                    // 螢幕直向 (一般手機拿法)：音量鈕靠右下角，留一點點邊距
                    muteBtn.style.setProperty('bottom', '-50px', 'important');
                    muteBtn.style.setProperty('right', '0px', 'important');
                    muteBtn.style.setProperty('top', 'auto', 'important');
                    muteBtn.style.setProperty('left', 'auto', 'important');
                } else {
                    // 螢幕橫向 (手機橫拿或電腦螢幕)：音量鈕移到最右側，中間偏下
                    muteBtn.style.setProperty('bottom', '0px', 'important');
                    muteBtn.style.setProperty('right', '-50px', 'important');
                    muteBtn.style.setProperty('top', 'auto', 'important');
                    muteBtn.style.setProperty('left', 'auto', 'important');
                }
            }
        }
    };

    // --- 3. 圖片縮放手勢功能 ---
    function zoom(img) {
        let scale = 1, pointX = 0, pointY = 0, startX = 0, startY = 0, initialDist = 0;

        img.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].pageX - pointX;
                startY = e.touches[0].pageY - pointY;
            } else if (e.touches.length === 2) {
                initialDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            }
            img.style.transition = "none";
            img.classList.add('zoom-active');
        });

        img.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && scale > 1) {
                e.preventDefault();
                let targetX = e.touches[0].pageX - startX;
                let targetY = e.touches[0].pageY - startY;
                const maxScrollX = Math.max(0, (img.offsetWidth * scale - window.innerWidth) / 2);
                const maxScrollY = Math.max(0, (img.offsetHeight * scale - window.innerHeight) / 2);
                pointX = Math.max(-maxScrollX, Math.min(maxScrollX, targetX));
                pointY = Math.max(-maxScrollY, Math.min(maxScrollY, targetY));
                img.style.transform = `translate3d(${pointX}px, ${pointY}px, 0) scale(${scale})`;
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const currentDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                const zoomFactor = currentDist / initialDist;
                scale = Math.min(Math.max(1, scale * zoomFactor), 5);
                img.style.transform = `translate3d(${pointX}px, ${pointY}px, 0) scale(${scale})`;
                initialDist = currentDist;
            }
        });

        img.addEventListener('touchend', (e) => {
            if (e.touches.length === 0 && scale < 1.1) {
                scale = 1; pointX = 0; pointY = 0;
                img.style.transition = "transform 0.3s ease";
                img.style.transform = `translate3d(0, 0, 0) scale(1)`;
                setTimeout(() => img.classList.remove('zoom-active'), 300);
            }
        });
    }

    function setupZoom() {
        document.querySelectorAll('img:not([data-zoom-setup])').forEach(img => {
            if (img.offsetWidth < 50) return;
            img.dataset.zoomSetup = "true";
            zoom(img);
        });
    }

    // --- 4. 監控與執行 ---
    const observer = new MutationObserver(() => {
        repositionElements();
        setupZoom();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 監聽視窗尺寸改變 (旋轉手機時即時觸發)
    window.addEventListener('resize', repositionElements);
    window.addEventListener('popstate', repositionElements);

    repositionElements();
    setupZoom();
})();
