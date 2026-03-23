// ==UserScript==
// @name         Threads PWA Gesture Adjustments
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @version      0.2.0
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
    let needCleanup = window.location.pathname.length > 5;

    function isHomePage() {
        return window.location.pathname === "/" || window.location.pathname === "/home";
    }

    // --- 核心清理工具：中斷媒體請求與釋放資源 ---
    function deepCleanup() {
        try {
            console.log("=== 執行深度清理 (中斷背景請求) ===");
            
            // 1. 銷毀影片節點
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                v.pause();
                v.src = "";
                v.removeAttribute('src');
                v.load();
                v.remove();
            });

            // 2. 停止所有掛載中的異步請求 (處理 NS_BINDING_ABORTED)
            window.stop();

            // 3. 重置 Media Session
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'none';
                navigator.mediaSession.metadata = null;
            }

            // 4. 清理彈窗層
            document.querySelectorAll('div[role="dialog"]').forEach(o => o.remove());

        } catch (e) {
            console.error("清理過程發生錯誤:", e);
        }
    }

    // --- 佈署 Guard 邏輯 (含 Alert) ---
    function doDeploy() {
        if (!isHomePage() || window.location.hash.includes(TAG)) return;

        // 【保留項目】檢查此 Session 是否已經 alert 過
        const hasAlerted = sessionStorage.getItem(SESSION_KEY);
        if (!hasAlerted) {
            alert("強化返回機制已啟動，避免跳出 Threads。");
            sessionStorage.setItem(SESSION_KEY, "true");
        }

        try {
            const baseUrl = window.location.pathname + window.location.search;
            history.replaceState({pwa: "base"}, "", baseUrl);
            history.pushState({pwa: "guard"}, "", baseUrl + TAG);
            isDeployed = true;
        } catch (e) { 
            console.error("佈署失敗:", e); 
        }
    }

    // --- 監聽區 ---

    window.addEventListener('popstate', (e) => {
        const currentPath = window.location.pathname;

        // 1. 從子頁面(Post/Media)返回首頁時 -> 深度清理且回頂端
        if (isHomePage() && lastPath !== currentPath) {
            deepCleanup();
            window.scrollTo({ top: 0, behavior: 'instant' });

            // 補回 Guard 標籤
            const baseUrl = window.location.pathname + window.location.search;
            history.pushState({pwa: "guard"}, "", baseUrl + TAG);

            needCleanup = false;
            lastPath = currentPath;
            return;
        }

        // 2. 在首頁觸發返回鍵 (Guard 標籤消失) -> 停止預載並平滑回頂端
        if (isHomePage() && lastPath === currentPath && !window.location.hash.includes(TAG)) {
            window.stop(); 
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // 補回 Guard 標籤
            const baseUrl = window.location.pathname + window.location.search;
            history.pushState({pwa: "guard"}, "", baseUrl + TAG);
        }
        
        lastPath = currentPath;
    }, true);

    // 觸控即佈署
    window.addEventListener('touchstart', () => {
        if (!isDeployed) doDeploy();
    }, { passive: true });

    // 攔截 Threads SPA 換頁
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
