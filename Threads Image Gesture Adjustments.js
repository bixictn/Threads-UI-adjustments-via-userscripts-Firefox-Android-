// ==UserScript==
// @name         Threads Image Gesture Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  Threads Image Gesture Adjustments
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const style = document.createElement('style');
    style.textContent = `
        .zoom-active {
            position: relative !important;
            z-index: 9999 !important;
            touch-action: none !important;
            /* 確保縮放與移動以圖片中心為基準 */
            transform-origin: center center !important;
            transition: none !important;
         }
     `;
    document.head.appendChild(style);

    function setupUniversalZoomAndPan() {
    const images = document.querySelectorAll('img:not([data-zoom-setup])');

    images.forEach(img => {
        if (img.offsetWidth < 50) return;
        img.dataset.zoomSetup = "true";

        // 狀態紀錄
        let scale = 1;
        let pointX = 0; // 當前位移 X
        let pointY = 0; // 當前位移 Y
        let startX = 0; // 觸碰起始 X
        let startY = 0; // 觸碰起始 Y
        let initialDist = 0;

        img.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                // 記錄單指起始座標，扣除已有的位移量
                startX = e.touches[0].pageX - pointX;
                startY = e.touches[0].pageY - pointY;
            } else if (e.touches.length === 2) {
                initialDist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
            }
            img.classList.add('zoom-active');
        });

        img.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && scale > 1) {
                // 單指平移：只有在放大狀態下才允許移動
                e.preventDefault();
                pointX = e.touches[0].pageX - startX;
                pointY = e.touches[0].pageY - startY;

                img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
            }
            else if (e.touches.length === 2) {
                // 兩指縮放
                e.preventDefault();
                const currentDist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );

                const zoomFactor = currentDist / initialDist;
                scale = Math.min(Math.max(1, scale * zoomFactor), 5);

                // 縮放時同步保持位移
                img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
                initialDist = currentDist;
            }
        });


    });
}

setInterval(setupUniversalZoomAndPan, 1000);
})();