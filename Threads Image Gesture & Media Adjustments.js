// ==UserScript==
// @name         Threads Image Gesture & Media Icons Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.2.1
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
    function setupImageZoom( img,closeViewer) {

        let scale = 1;

        let pointX = 0;
        let pointY = 0;

        let startX = 0;
        let startY = 0;

        let initialDist = 0;

        let dragging = false;
        let touchMode = false;

        let lastTap = 0, touches=1;
        img.style.transformOrigin = "center center";

        function lockScroll() {
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
            document.body.style.touchAction = "none";
            document.documentElement.style.touchAction = "none";
            document.body.style.overscrollBehavior = "none";
            document.documentElement.style.overscrollBehavior = "none";
        }

        function unlockScroll() {
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
            document.body.style.touchAction = "";
            document.documentElement.style.touchAction = "";
            document.body.style.overscrollBehavior = "";
            document.documentElement.style.overscrollBehavior = "";
        }

        function clampPosition() {
            const scaledWidth = img.offsetWidth * scale;
            const scaledHeight = img.offsetHeight * scale;
            const maxScrollX = Math.max(0, (scaledWidth - window.innerWidth ) / 2 );
            const maxScrollY = Math.max(0, (scaledHeight - window.innerHeight) / 2);

            pointX = Math.max(-maxScrollX, Math.min( maxScrollX, pointX ));

            pointY = Math.max(-maxScrollY, Math.min( maxScrollY, pointY ));
        }

        function updateTransform() {
            clampPosition();
            img.style.transform = `translate3d(${pointX}px,${pointY}px,0) scale(${scale})`;
            if (scale > 1) {
                lockScroll();
            }
            else {
                unlockScroll();
            }
        }

        img.addEventListener("touchstart", e => {
            touchMode = true;
            img.style.transition = "none";
            if ( e.touches.length === 1 ) {
                touches=1;
                startX = e.touches[0].pageX - pointX;
                startY = e.touches[0].pageY - pointY;
            }
            else if ( e.touches.length === 2 ) {
                touches=2;
                initialDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY );
            }
        }, { passive:true });

        img.addEventListener( "touchmove", e => {
            if ( e.touches.length === 1 && scale > 1 ) {
                touches=1;
                e.preventDefault();
                pointX = e.touches[0].pageX - startX;
                pointY = e.touches[0].pageY - startY;
                updateTransform();
            }
            else if ( e.touches.length === 2) {
                touches=2;
                e.preventDefault();
                const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX,
                                        e.touches[0].pageY - e.touches[1].pageY);
                scale *= dist / initialDist;
                scale = Math.max( 1, Math.min( 5, scale ) );
                initialDist = dist;
                updateTransform();
            }

        },{ passive:false });

        img.addEventListener("touchend",() => {
            const now = Date.now();
            if ( (now - lastTap < 300) && touches === 1) {
                if ( scale === 1 ) {
                    scale = 2;
                } else {
                    scale = 1;
                    pointX = 0;
                    pointY = 0;
                }
                updateTransform();
            }
            lastTap = now;

            if ( scale <= 1.05) {
                scale = 1;
                pointX = 0; pointY = 0;
                img.style.transition = "transform .25s ease";
                img.style.transform = "translate3d(0,0,0) scale(1)";
                unlockScroll();
            }

            setTimeout( () => { touchMode = false; }, 50);	});

        img.addEventListener("wheel", e => {
            e.preventDefault();
            const rect = img.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const oldScale = scale;
            scale += e.deltaY > 0 ? -0.2: 0.2;
            scale = Math.max( 1, Math.min( 5, scale )	);

            const ratio = scale / oldScale;
            pointX -= ( mouseX - rect.width / 2	) * ( ratio - 1	);
            pointY -= ( mouseY - rect.height / 2) * ( ratio - 1	);
            updateTransform();
        },{ passive:false });

        img.addEventListener("pointerdown",	e => {
            if ( touchMode || scale <= 1) return;
            dragging = true;
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
            img.style.cursor = "grabbing";
            e.preventDefault();
        });

        img.addEventListener("pointermove",	e => {
            if ( touchMode || !dragging || scale <= 1) return;
            e.preventDefault();
            pointX =e.clientX - startX;
            pointY = e.clientY - startY;
            updateTransform();
        },	{ passive:false });

        const stopDrag = () => {
            dragging = false;
            img.style.cursor = "";
        };

        img.addEventListener( "pointerup", stopDrag	);
        img.addEventListener( "pointercancel",stopDrag);
        img.addEventListener("lostpointercapture",stopDrag);

        updateTransform();
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

})();
