// ==UserScript==
// @name         Threads Image Gesture & Media Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.0.3
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

    // --- 2. 介面調整功能 (Media Adjustments) ---
    const repositionElements = () => {
        if (!window.location.pathname.endsWith('/media')) return;

        // A. 關閉按鈕 (0,0)
        const closeIcon = document.querySelector('svg[aria-label="關閉"]');
        if (closeIcon) {
            const closeBtn = closeIcon.parentElement?.parentElement;
            if (closeBtn && closeBtn.getAttribute('role') === 'button') {
                Object.assign(closeBtn.style, {
                    position: 'fixed',
                    top: '0px',
                    left: '0px',
                    margin: '0px',
                    zIndex: '9999'
                });
                closeBtn.style.setProperty('position', 'fixed', 'important');
                closeBtn.style.setProperty('top', '10px', 'important');
                closeBtn.style.setProperty('left', '10px', 'important');
            }
        }

        // B. 音量按鈕 (右下角)
        const muteIcon = document.querySelector('svg[aria-label="已靜音"], svg[aria-label="切換音量設定"], svg[aria-label="音量"]');
        if (muteIcon) {
            const muteBtn = muteIcon.parentElement?.parentElement;
            if (muteBtn && muteBtn.getAttribute('role') === 'button') {
                // 核心修正：除了 fixed，還要強制取消 transform 以免位移失效
                muteBtn.style.setProperty('position', 'fixed', 'important');
                muteBtn.style.setProperty('bottom', 'auto', 'important'); // 留20px避免蓋到控制列
                muteBtn.style.setProperty('right', '-50px', 'important');
                muteBtn.style.setProperty('top', 'auto', 'important');
                muteBtn.style.setProperty('left', 'auto', 'important');
                muteBtn.style.setProperty('transform', 'none', 'important'); // 防止被 Threads 原生位移蓋過
                muteBtn.style.setProperty('zIndex', '9999', 'important');

            }
        }
    };

    // --- 3. 圖片縮放手勢功能 (Image Gesture) ---
    function zoom(img) {
        let scale = 1, pointX = 0, pointY = 0, startX = 0, startY = 0, initialDist = 0;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

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
                const maxScrollX = Math.max(0, (img.offsetWidth * scale - viewportW) / 2);
                const maxScrollY = Math.max(0, (img.offsetHeight * scale - viewportH) / 2);
                pointX = Math.max(-maxScrollX, Math.min(maxScrollX, targetX));
                pointY = Math.max(-maxScrollY, Math.min(maxScrollY, targetY));
                updateTransform();
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const currentDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                const zoomFactor = currentDist / initialDist;
                scale = Math.min(Math.max(1, scale * zoomFactor), 5);
                const maxScrollX = Math.max(0, (img.offsetWidth * scale - viewportW) / 2);
                const maxScrollY = Math.max(0, (img.offsetHeight * scale - viewportH) / 2);
                pointX = Math.max(-maxScrollX, Math.min(maxScrollX, pointX));
                pointY = Math.max(-maxScrollY, Math.min(maxScrollY, pointY));
                updateTransform();
                initialDist = currentDist;
            }
        });

        img.addEventListener('touchend', (e) => {
            if (e.touches.length === 0 && scale < 1.1) {
                scale = 1; pointX = 0; pointY = 0;
                img.style.transition = "transform 0.3s ease";
                updateTransform();
                setTimeout(() => img.classList.remove('zoom-active'), 300);
            }
        });

        function updateTransform() {
            img.style.transform = `translate3d(${pointX}px, ${pointY}px, 0) scale(${scale})`;
        }
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

    window.addEventListener('popstate', repositionElements);
    repositionElements();
    setupZoom();
})();
