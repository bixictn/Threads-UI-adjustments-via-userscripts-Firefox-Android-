// ==UserScript==
// @name        Threads PWA Gesture Adjustments
// @match       https://www.threads.com/*
// @match       https://www.threads.net/*
// @version     0.1.0
// @description Threads PWA Gesture Adjustments
// @grant       none
// @run-at      document-start
// ==/UserScript==

(function() {
    const TAG = "#pwa_guard";
    const SESSION_KEY = "pwa_guard_session_alerted";
    let isDeployed = false;

    // 檢查是否為首頁
    function isHomePage() {
        return window.location.pathname === "/" ||
               window.location.pathname === "/home";
    }

    // 執行佈署邏輯
    function doDeploy(source) {
        if (!isHomePage()) return;
        if (window.location.hash.includes(TAG)) return;

        // 檢查此 Session (分頁) 是否已經 alert 過
        const hasAlerted = sessionStorage.getItem(SESSION_KEY);

        if (!hasAlerted) {
            // 第一次開啟分頁時跳出，協助 Firefox 取得網址變更權限
            alert("強化返回,避免跳出Threads.");
            sessionStorage.setItem(SESSION_KEY, "true");
        }

        try {
            const baseUrl = window.location.pathname + window.location.search;

            // 產生歷史節點：[Base] -> [Guard]
            history.replaceState({pwa: "base"}, "", baseUrl);
            history.pushState({pwa: "guard"}, "", baseUrl + TAG);

            // 強制檢查網址變更狀況
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

    // 偵測返回鍵：執行重新整理 (Reload)
    window.addEventListener('popstate', (e) => {
        if (isHomePage() && !window.location.hash.includes(TAG)) {
            // 當偵測到試圖跳離首頁時，強制重新整理
            window.location.reload();
        }
    }, true);

    // 畫面載入檢查
    window.addEventListener('load', () => {
        setTimeout(() => {
            const logo = document.querySelector('a[href="/"], a[href="/home"]');
            if (logo && isHomePage() && !window.location.hash.includes(TAG)) {
                logo.click();
            }
        }, 1000);
    });

    // 偵測觸碰行為 (Firefox 權限觸發點)
    window.addEventListener('touchstart', () => {
        if (!isDeployed) doDeploy("touchstart");
    }, { passive: true });

    // 攔截 Threads 內部的 SPA 換頁邏輯
    const _ps = history.pushState;
    history.pushState = function() {
        _ps.apply(this, arguments);
        if (isHomePage()) {
            isDeployed = false; // 回到首頁時標記為未佈署，以便下次 touch 時重新觸發
        }
    };

})();
