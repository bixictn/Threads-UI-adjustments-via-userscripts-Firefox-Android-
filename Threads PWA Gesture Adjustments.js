// ==UserScript==
// @name         Threads PWA Gesture Adjustments
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @version      0.1.4
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
    let lastPath = window.location.pathname; // 記錄上一個路徑

    function isHomePage() {
        return window.location.pathname === "/" ||
               window.location.pathname === "/home";
    }

    function doDeploy() {
        if (!isHomePage()) return;
        if (window.location.hash.includes(TAG)) return;

        const hasAlerted = sessionStorage.getItem(SESSION_KEY);
        if (!hasAlerted) {
            alert("強化返回機制已啟動，避免跳出 Threads。");
            sessionStorage.setItem(SESSION_KEY, "true");
        }

        try {
            const baseUrl = window.location.pathname + window.location.search;
            history.replaceState({pwa: "base"}, "", baseUrl);
            history.pushState({pwa: "guard"}, "", baseUrl + TAG);

            setTimeout(() => {
                if (!window.location.hash.includes(TAG)) {
                    window.location.assign(baseUrl + TAG);
                } else {
                    isDeployed = true;
                }
            }, 100);
        } catch (e) {
            console.error("佈署失敗:", e);
        }
    }

    // --- 監聽區 ---

    window.addEventListener('popstate', (e) => {
        const currentPath = window.location.pathname;

        // 只有當「前一個頁面是首頁」且「現在也是首頁」且「沒有 Guard 標籤」時才重整
        // 這樣從 /post/... 返回首頁時，就不會觸發重整
        if (isHomePage() && lastPath === currentPath && !window.location.hash.includes(TAG)) {
            window.location.reload();
        }

        lastPath = currentPath; // 更新路徑記錄
    }, true);

    window.addEventListener('touchstart', () => {
        if (!isDeployed) doDeploy();
    }, { passive: true });

    const _ps = history.pushState;
    history.pushState = function() {
        _ps.apply(this, arguments);
        lastPath = window.location.pathname; // 換頁時同步更新路徑
        if (isHomePage()) {
            isDeployed = false;
        }
    };

})();
