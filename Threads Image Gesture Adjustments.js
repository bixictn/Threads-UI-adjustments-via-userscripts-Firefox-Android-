// ==UserScript==
// @name         Threads Image Gesture Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.0.2
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
            transition: none !important;
         }
     `;
    document.head.appendChild(style);

    function setupUniversalZoomAndPan(images,type) {
        if(!images) return;

        images.forEach(img => {
            if (img.offsetWidth < 50) return;
            img.dataset.zoomSetup = "true";
            zoom(img)
        });

    }

    function zoom(img) {
        let scale = 1;
        let pointX = 0;
        let pointY = 0;
        let startX = 0;
        let startY = 0;
        let initialDist = 0;

        // 取得容器或視窗寬高（用來決定邊界）
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        img.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].pageX - pointX;
                startY = e.touches[0].pageY - pointY;
            } else if (e.touches.length === 2) {
                initialDist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
            }
            img.style.transition = "none"; // 移動時取消過渡，確保跟手
            img.classList.add('zoom-active');
        });

        img.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && scale > 1) {
                e.preventDefault();

                let targetX = e.touches[0].pageX - startX;
                let targetY = e.touches[0].pageY - startY;

                // --- 嚴格邊界限制邏輯 ---
                // 1. 取得圖片原始佔用的空間（不含 scale）
                // 注意：這裡假設圖片預設是置中的
                const rect = img.getBoundingClientRect();

                // 2. 計算放大後，左右兩邊溢出的最大距離
                // 公式：(圖片寬度 * 放大倍率 - 視窗寬度) / 2
                // 如果結果小於 0，代表圖片比螢幕窄，不允許左右移動
                const maxScrollX = Math.max(0, (img.offsetWidth * scale - viewportW) / 2);
                const maxScrollY = Math.max(0, (img.offsetHeight * scale - viewportH) / 2);

                // 3. 限制位移量在範圍內 [-maxScroll, maxScroll]
                pointX = Math.max(-maxScrollX, Math.min(maxScrollX, targetX));
                pointY = Math.max(-maxScrollY, Math.min(maxScrollY, targetY));

                updateTransform();

            } else if (e.touches.length === 2) {
                e.preventDefault();
                const currentDist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );

                const zoomFactor = currentDist / initialDist;
                scale = Math.min(Math.max(1, scale * zoomFactor), 5);

                // 縮放後也要同步修正位移，防止縮小時圖片飄走
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
                resetImage();
            }
        });

        function resetImage() {
            scale = 1;
            pointX = 0;
            pointY = 0;
            img.style.transition = "transform 0.3s ease";
            updateTransform();
            setTimeout(() => img.classList.remove('zoom-active'), 300);
        }

        function updateTransform() {
            img.style.transform = `translate3d(${pointX}px, ${pointY}px, 0) scale(${scale})`;
        }
    }
    function setup(){
        setupUniversalZoomAndPan(document.querySelectorAll('img:not([data-zoom-setup])'),'img');
    }

    setInterval(setup, 1000);
})();                img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
                initialDist = currentDist;
            }
        });


    });
}

setInterval(setupUniversalZoomAndPan, 1000);
})();
