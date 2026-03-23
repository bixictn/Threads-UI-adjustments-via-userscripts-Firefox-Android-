// ==UserScript==
// @name         Threads PWA Gesture Adjustments
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @version      0.1.9
// @description  Threads PWA Gesture Adjustments
// @author       Gemini
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const TAG = "#pwa_guard";
    let isDeployed = false;
    let lastPath = window.location.pathname;
    let needCleanup = window.location.pathname.length > 5;

    function isHomePage() {
        return window.location.pathname === "/" || window.location.pathname === "/home";
    }

    // --- 核心清理工具：取代 Reload 的效能方案 ---
    function deepCleanup() {
        try {
            // 1. 強制銷毀影片節點，釋放硬體解碼資源
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                v.pause();
                v.src = "";
                v.removeAttribute('src');
                v.load();
                v.remove();
            });

            // 2. 停止所有掛載中的異步請求 (中斷持續傳輸的 .mp4)
            window.stop();

            // 3. 重置 Media Session (清理通知列殘留)
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'none';
                navigator.mediaSession.metadata = null;
            }

            // 4. 清理 UI 殘留 (如 Media 彈窗、大圖層)
            document.querySelectorAll('div[role="dialog"]').forEach(o => o.remove());

        } catch (e) {
            console.error("清理過程發生錯誤:", e);
        }
    }

    function doDeploy() {
        if (!isHomePage() || window.location.hash.includes(TAG)) return;
        try {
            const baseUrl = window.location.pathname + window.location.search;
            history.replaceState({pwa: "base"}, "", baseUrl);
            history.pushState({pwa: "guard"}, "", baseUrl + TAG);
            isDeployed = true;
        } catch (e) { console.error("佈署失敗:", e); }
    }

    // --- 監聽區 ---

    window.addEventListener('popstate', (e) => {
        const currentPath = window.location.pathname;

        if (isHomePage() && lastPath !== currentPath) {
            deepCleanup();
            window.scrollTo({ top: 0, behavior: 'instant' });

            // 補回 Guard 標籤，防止連續操作導致跳出
            const baseUrl = window.location.pathname + window.location.search;
            history.pushState({pwa: "guard"}, "", baseUrl + TAG);

            needCleanup = false;
            lastPath = currentPath;
            return;
        }

        // 偵測：在首頁觸發返回 -> 單純回頂端並補強連線中斷
        if (isHomePage() && lastPath === currentPath && !window.location.hash.includes(TAG)) {
            window.stop(); // 停止可能的預載
            window.scrollTo({ top: 0, behavior: 'smooth' });
            history.pushState({pwa: "guard"}, "", window.location.pathname + TAG);
        }

        lastPath = currentPath;
    }, true);

    window.addEventListener('touchstart', () => {
        if (!isDeployed) doDeploy();
    }, { passive: true });

    // 攔截換頁行為
    const _ps = history.pushState;
    history.pushState = function() {
        _ps.apply(this, arguments);
        const newPath = window.location.pathname;

        if (newPath.length > 5) {
            needCleanup = true;
        }

        lastPath = newPath;
        if (isHomePage()) isDeployed = false;
    };

})();
