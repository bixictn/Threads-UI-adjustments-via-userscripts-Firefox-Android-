// ==UserScript==
// @name         Threads PWA Gesture Adjustments
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @version      0.2.1
// @description  Threads PWA Gesture Adjustments
// @author       Gemini
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const TAG = "#pwa_guard";
    const SESSION_KEY = "pwa_guard_session_alerted";
    let isDeployed = false;
    let lastPath = window.location.pathname;

    // 讓瀏覽器處理原生的滾動記憶
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto';
    }

    // --- 核心：精準 popstate 邏輯 ---
    window.addEventListener('popstate', (e) => {
        let cPath = window.location.pathname;
        const isCurrentlyHome = (cPath === "/" || cPath === "/home");

        // 情況 A：從文章頁面返回首頁 (路徑改變)
        if (isCurrentlyHome && lastPath !== cPath) {
            console.log("🔙 返回首頁：保留原始位置");
            // 補回 Guard 標籤，但不觸發捲動，讓瀏覽器自動回到原位
            if (!window.location.hash.includes(TAG)) {
                history.pushState({pwa: "guard"}, "", cPath + TAG);
            }
        }
        else if (isCurrentlyHome && lastPath === cPath) {
            e.stopImmediatePropagation();
            // 重新補上 Guard 標籤，防止直接跳出 PWA
             if(window.scrollY>0){
                console.log("🔝 首頁再次返回：捲動回頂端");
                window.scrollTo({ top: 0, behavior: 'instant' });
                history.pushState({pwa: "guard"}, "", cPath + TAG);

            }
            else{
                const logo = document.querySelector('[aria-label="Threads"]');
                const alink = logo.closest('a[href]');
                
                if(alink){
                    alert(alink);
                    alink.click();
                    history.pushState({pwa: "guard"}, "", cPath + TAG);
                }



            }
            cPath=cPath + TAG;

        }

        lastPath = cPath;
    }, true);

    // 部署 Guard 標籤
    function doDeploy() {
        // 只在根目錄且沒標籤時部署
        if (window.location.pathname !== "/" && window.location.pathname !== "/home") return;
        if (window.location.hash.includes(TAG)) return;

        if (!sessionStorage.getItem(SESSION_KEY)) {
            alert("強化返回機制。");
            sessionStorage.setItem(SESSION_KEY, "true");
        }

        try {
            // 建立基礎狀態與 Guard 狀態
            history.replaceState({pwa: "base"}, "", window.location.pathname);
            history.pushState({pwa: "guard"}, "", window.location.pathname + TAG);
            isDeployed = true;
            console.log("✅ PWA Guard 已部署");
        } catch (e) {}
    }

    // 觸碰螢幕時啟動部署
    ['touchstart', 'wheel'].forEach(evt => {
        window.addEventListener(evt, (e) => {
            if (!isDeployed) doDeploy();
        }, { passive: true });
    });
    // 攔截 SPA 內部的 pushState (換頁時更新路徑)
    const _ps = history.pushState;
    history.pushState = function() {
        _ps.apply(this, arguments);
        lastPath = window.location.pathname;
        // 換頁後標記為未部署，以便回到首頁時重新觸發
        isDeployed = false;
    };

})();
