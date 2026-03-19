// ==UserScript==
// @name         Threads Image Gesture & Media Icons Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Threads Image Gesture & Media Icons Adjustments
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
        }
        /* 透明度類別 */
        .ts-opaque, .ts-opaque svg, .ts-opaque * { opacity: 1 !important; fill-opacity: 1 !important; }
        .ts-half, .ts-half svg, .ts-half * { opacity: 0.5 !important; fill-opacity: 0.5 !important; }
    `;
    document.head.appendChild(style);

    // --- 2. 介面調整邏輯 (固定位置) ---
    const repositionElements = () => {
        if (!window.location.pathname.endsWith('/media')) return;
        const allTitles = document.querySelectorAll('svg title');

        allTitles.forEach(title => {
            const text = title.textContent.trim();
            const btn = title.closest('div[role="button"]');
            if (!btn) return;


            // A. 處理「關閉」：左上角 (0,0) + 不透明
            if (text === "關閉") {

                btn.style.setProperty('position', 'fixed', 'important');
                btn.style.setProperty('z-index', '9999', 'important');
                btn.style.setProperty('top', '0px', 'important');
                btn.style.setProperty('left', '0px', 'important');
                btn.classList.add('ts-opaque');
                btn.classList.remove('ts-half');
            }

            // B. 處理「音量/靜音」：固定右下角 + 動態透明度
            if (text.includes("靜音") || text.includes("播放")){
                btn.style.setProperty('position', 'fixed', 'important');
                btn.style.setProperty('z-index', '9999', 'important');
                btn.style.setProperty('bottom', '0px', 'important');
                btn.style.setProperty('right', '0px', 'important');
                btn.style.setProperty('top', 'auto', 'important');
                btn.style.setProperty('left', 'auto', 'important');
                btn.style.setProperty('transform', 'none', 'important');

                // 判斷透明度：只有「已靜音」才不透明
                if (text === "已靜音") {

                    btn.classList.add('ts-opaque');
                    btn.classList.remove('ts-half');
                } else {
                    btn.classList.add('ts-half');
                    btn.classList.remove('ts-opaque');

                }
            }
        });
    };

    // --- 3. 圖片縮放功能 (維持嚴格邊界限制) ---
    function setupImageZoom(img) {
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
                const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                scale = Math.min(Math.max(1, scale * (dist / initialDist)), 5);
                const maxScrollX = Math.max(0, (img.offsetWidth * scale - window.innerWidth) / 2);
                const maxScrollY = Math.max(0, (img.offsetHeight * scale - window.innerHeight) / 2);
                pointX = Math.max(-maxScrollX, Math.min(maxScrollX, pointX));
                pointY = Math.max(-maxScrollY, Math.min(maxScrollY, pointY));
                img.style.transform = `translate3d(${pointX}px, ${pointY}px, 0) scale(${scale})`;
                initialDist = dist;
            }
        });
        img.addEventListener('touchend', () => {
            if (scale < 1.1) {
                scale = 1; pointX = 0; pointY = 0;
                img.style.transition = "transform 0.3s ease";
                img.style.transform = `translate3d(0, 0, 0) scale(1)`;
                setTimeout(() => img.classList.remove('zoom-active'), 300);
            }
        });
    }

    // --- 4. 監控與執行 ---
    const runAll = () => {
        repositionElements();
        document.querySelectorAll('img:not([data-zoom-setup])').forEach(img => {
            if (img.offsetWidth > 50) {
                img.dataset.zoomSetup = "true";
                setupImageZoom(img);
            }
        });
    };

    const observer = new MutationObserver(runAll);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', runAll);
    window.addEventListener('click', () => {
        setTimeout(runAll, 200);
        setTimeout(runAll, 800);
    });

    runAll();
})();
