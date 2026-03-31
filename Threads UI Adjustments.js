// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.8.2
// @description  Threads UI Adjustments
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. CSS 基礎樣式注入
    const style = document.createElement('style');
    style.textContent = `
        /* 隱藏廣告與跳轉連結 */
        a[href^="intent://"], a[href*="itunes.apple.com"], a[href*="play.google.com"] { display: none !important; }
        html, body { overflow-x: hidden !important; }

        /* 導覽列圖示縮小 */
        nav svg { transform: scale(0.5) !important; transform-origin: center center !important; }

        /* 內文放大 */
        div span > span { font-size: 18px !important; }

        /* 按鈕列靠右容器樣式 */
        .custom-stack-move {
            display: flex !important;
            justify-content: flex-end !important;
            width: 100% !important;
        }
    `;
    document.head.appendChild(style);

    // 2. 核心：ID、時間、主題標籤格式化
    function applyIdReformat(timeEl) {
        if (timeEl.dataset.processed === "done") return;

        let featureLayer = timeEl.parentElement;
        for (let i = 0; i < 8; i++) {
            if (featureLayer && featureLayer.getAttribute('style')?.includes('--x-columnGap')) {
                featureLayer = featureLayer.parentElement;
                break;
            }
            featureLayer = featureLayer.parentElement;
        }


       const postContainer = featureLayer;

            // 確保是該貼文的第一個時間標籤 (避免重複處理回覆內容)
            const firstTimeInPost = postContainer.querySelector('time');
            if (timeEl !== firstTimeInPost) {
                timeEl.dataset.processed = "done";
                return;
            }
            const idElement = postContainer.querySelector('a[href*="/@"]:not(:has(img))');
            idElement.style.setProperty('color', '#D4AF37', 'important');
            idElement.style.setProperty('font-size', '14px' ,'important');
            idElement.style.setProperty('font-weight', 'bold' ,'important');
            idElement.style.setProperty('text-decoration', 'none', 'important');

            if (!idElement.dataset.formatted) {
                    const tagText = idElement.innerText.trim().replace(/[<>]/g, '');
                    idElement.innerText = `${tagText}`;
                    idElement.dataset.formatted = "true";
            }

            // A. 時間樣式修正與自動補「前」字
            timeEl.style.setProperty('color', '#A0A0A0', 'important');
            timeEl.style.setProperty('font-size', '12px', 'important');
            timeEl.style.setProperty('font-weight', 'normal', 'important');
            timeEl.style.setProperty('visibility', 'visible', 'important');
            timeEl.style.setProperty('display', 'inline', 'important');

            if (!timeEl.dataset.formatted) {
                const rawTime = timeEl.textContent.trim();
                if (!rawTime.includes('-') && !rawTime.includes('前')) {
                    timeEl.innerText = rawTime + "前";
                }
                timeEl.dataset.formatted = "true";
            }

            // B. 主題標籤 (Hashtag / Search Link) 改藍色加粗
            const subjectLink = postContainer.querySelector('a[href*="/search?q="]');
            if (subjectLink) {
                subjectLink.style.setProperty('color', '#0095f6', 'important');
                subjectLink.style.setProperty('font-size', '15px', 'important');
                subjectLink.style.setProperty('font-weight', 'bold', 'important');
                subjectLink.style.setProperty('text-decoration', 'none', 'important');

                if (!subjectLink.dataset.formatted) {
                    const tagText = subjectLink.innerText.trim().replace(/[<>]/g, '');
                    subjectLink.innerText = `${tagText}`;
                    subjectLink.dataset.formatted = "true";
                }
            }

            timeEl.dataset.processed = "done";

    }

    // 3. 核心：僅限首篇的內文縮排 (針對 /post/ 頁面)
    function handleFirstPostIndent() {
        if (!window.location.href.includes('/post/')) return;

        // 利用 CSS 特徵 (--x-columnGap) 抓取頁面上所有 ID/時間列的特徵層
        const allHeaders = Array.from(document.querySelectorAll('div[style*="--x-columnGap"]'));
        if (allHeaders.length === 0) return;

        // 物理位置上的第一個 Header 必定是主貼文
        const firstHeader = allHeaders[0];
        const idWrapper = firstHeader.parentElement?.parentElement;

        if (idWrapper) {
            // 內文通常是 ID 容器的下一個兄弟節點
            let contentNode = idWrapper.nextElementSibling;

            // 跳過空節點，直到抓到真正的內容區
            while (contentNode && contentNode.innerText.trim() === "" && contentNode.nextElementSibling) {
                contentNode = contentNode.nextElementSibling;
            }

            if (contentNode && !contentNode.dataset.indentDone) {
                // 執行縮排 50px 並重新計算寬度
                contentNode.style.setProperty('margin-left', '50px', 'important');
                contentNode.style.setProperty('width', 'calc(100% - 50px)', 'important');
                contentNode.dataset.indentDone = "true";
            }
        }
    }

    // 4. 按鈕列靠右邏輯 (讚、回覆、轉發)
    function applyButtonStyle(likeIcon) {
        let container = likeIcon.parentElement;
        for(let i=0; i<6; i++) {
            // 尋找包含 3-5 個子元素的按鈕群組容器
            if (container && container.children.length >= 3 && container.children.length <= 5) {
                if (container.dataset.styled) break;
                container.dataset.styled = '1';
                container.classList.add('custom-stack-move');

                let plusdistance = 3;
                Array.from(container.children).forEach((wrapper) => {
                    wrapper.style.display = 'flex';
                    wrapper.style.justifyContent = 'flex-end';
                    const btn = wrapper.querySelector('[role="button"]');
                    if (btn) {
                        const svg = btn.querySelector('svg');
                        if (svg) {
                            svg.style.transform = 'scale(0.8)';
                            // 根據按鈕順序進行微調位移
                            btn.style.transform = 'translateX(' + (1.2 * plusdistance) + 'em)';
                            plusdistance--;
                        }
                    }
                });
                break;
            }
            if(container) container = container.parentElement;
        }
    }

    // 5. 清理內容中的特殊字元 (如 \uFFFC)
    function cleanContent() {
        document.querySelectorAll('span:not([data-obj-cleaned])').forEach(span => {
            let hasObj = false;
            span.childNodes.forEach(node => {
                if (node.nodeType === 3 && node.nodeValue.includes('\uFFFC')) {
                    node.nodeValue = node.nodeValue.replace(/\uFFFC/g, '');
                    hasObj = true;
                }
            });
            if (hasObj) span.setAttribute('data-obj-cleaned', 'true');
        });
    }

    // 主執行迴圈：整合所有處理邏輯
    function mainLoop() {
        // 1. 處理 ID 與時間格式
        document.querySelectorAll('time').forEach(t => applyIdReformat(t));

        // 2. 處理詳細頁首篇縮排 (獨立執行，解決 SPA 切換問題)
        handleFirstPostIndent();

        // 3. 處理按鈕靠右
        document.querySelectorAll('svg[aria-label="讚"]').forEach(i => applyButtonStyle(i));

        // 4. 清理特殊字元
        cleanContent();
    }

    // 初始啟動
    mainLoop();

    // 監控網頁 DOM 變化，自動處理動態載入的內容
    const observer = new MutationObserver(() => mainLoop());
    observer.observe(document.body, { childList: true, subtree: true });

})();
