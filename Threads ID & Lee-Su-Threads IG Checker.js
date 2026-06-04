// ==UserScript==
// @name         Threads ID & Lee-Su-Threads IG Checker
// @version      0.0.1
// @description  Threads ID & Lee-Su-Threads IG Checker
// @match        https://www.threads.com/*
// @grant        GM_xmlhttpRequest
// @connect      instagram.com
// ==/UserScript==

// === 請更新【連線特權腳本】的核心盲測邏輯 ===
window.addEventListener('REQUEST_IG_VERIFY', (e) => {
    const { username } = e.detail;
    const targetIgUrl = `https://www.instagram.com/${username}/`;

    GM_xmlhttpRequest({
        method: "GET",
        url: targetIgUrl,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8"
        },
        timeout: 4000,
        onload: function(response) {
            const html = response.responseText || "";

            // 1. 利用正則表達式，把網頁原始碼裡的 <title> 文字精準挖出來
            const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1].trim() : "";

            const isDeadPage = (response.status === 404) ||
                               pageTitle === "頁面找不到" ||
                               pageTitle === "Page Not Found" ||
                               pageTitle === "Instagram" ||
                               pageTitle === "";

            const isValid = !isDeadPage;

            if (isValid) {
                console.log(`[🟢 驗證成功] 帳號 @${username} ，標題為: ${pageTitle}`);
            } else {
                console.log(`[🚫 找不到] 帳號 @${username}`);
            }

            // 回傳千真萬確的結果給 UI 腳本
            const resultEvent = new CustomEvent('IG_VALID_RESULT', {
                detail: { username, isValid, targetUrl: targetIgUrl }
            });
            window.dispatchEvent(resultEvent);
        },
        onerror: function() {
            const resultEvent = new CustomEvent('IG_VALID_RESULT', {
                detail: { username, isValid: false, targetUrl: targetIgUrl }
            });
            window.dispatchEvent(resultEvent);
        }
    });
});
