// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.9.3
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

        /* 深色模式 & 亮色模式通用：針對 Threads Logo SVG 進行處理 */
        .__fb-dark-mode a[href="/"] svg[aria-label="Threads"],
        .__fb-light-mode a[href="/"] svg[aria-label="Threads"],
        a[href="/"] div svg[aria-label="Threads"],
        div[role="navigation"] a[href="/"] svg[aria-label="Threads"] {
           top: 13px !important;
            border: 2px solid #D4AF37 !important;
            border-radius: 50% !important;
            padding: 4px !important;
            box-shadow: 0 0 15px rgba(212, 175, 55, 0.6) !important;
            cursor: pointer !important;
            transition: transform 0.2s ease !important;
        }

        a[href="/"] svg[aria-label="Threads"] path {
            fill: #D4AF37 !important;
        }

        /* 點擊時的縮放效果 */
        a[href="/"]:active svg[aria-label="Threads"] {
            transform: scale(0.9) !important;
        }

        /* 針對亮色模式的陰影微調 (選用：讓金色在白底更明顯) */
        .__fb-light-mode a[href="/"] svg[aria-label="Threads"] {
            box-shadow: 0 0 12px rgba(212, 175, 55, 0.8) !important;
        }
        /* --- 導覽列 Active 狀態 (需求 2) --- */
        a[data-active="true"] svg,
        div[role="button"][data-active="true"] svg {
            color: #D4AF37 !important;
            fill: #D4AF37 !important;
        }
        a[data-active="true"] svg path,
        div[role="button"][data-active="true"] svg path {
            fill: #D4AF37 !important;
            stroke: #D4AF37 !important;
        }

        /* 導覽列圖示縮小 (排除主 Logo) */
        nav svg:not([aria-label="Threads"]) {
            transform: scale(0.7) !important;
            transform-origin: center center !important;
        }

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

    // 2. 處理導覽列 Active 狀態邏輯
    function updateNavActiveState() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('a[role="link"], div[role="button"]');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            const isActive = (href === currentPath) ||
                             (currentPath === '/' && href === '/') ||
                             (href && href !== '/' && currentPath.startsWith(href));
            if (isActive) {
                link.setAttribute('data-active', 'true');
            } else {
                link.removeAttribute('data-active');
            }
        });
    }

    // 3. 核心：ID、時間、主題標籤格式化
    function applyIdReformat(timeEl) {
        if (timeEl.dataset.processed === "done") return;
        let featureLayer = timeEl.parentElement;
        let idElement = featureLayer.querySelector('a[href*="/@"]:not([href*="/post/"])');

        for (let i = 0; i < 8; i++) {
            if (idElement) {
                featureLayer = featureLayer.parentElement;
                break;
            } else {
                featureLayer = featureLayer.parentElement;
                if (!featureLayer) break;
                idElement = featureLayer.querySelector('a[href*="/@"]:not([href*="/post/"])');
            }
        }
        const postContainer = featureLayer;
        if (!postContainer) return;

        const firstTimeInPost = postContainer.querySelector('time');
        if (timeEl !== firstTimeInPost) {
            timeEl.dataset.processed = "done";
            return;
        }

        if (idElement) {
            idElement.style.setProperty('color', '#D4AF37', 'important');
            idElement.style.setProperty('font-size', '14px' ,'important');
            idElement.style.setProperty('font-weight', 'bold' ,'important');
            idElement.style.setProperty('text-decoration', 'none', 'important');
            if (!idElement.dataset.formatted) {
                idElement.innerText = idElement.innerText.trim().replace(/[<>]/g, '');
                idElement.dataset.formatted = "true";
            }
        }

        // 時間自動補「前」
        timeEl.style.setProperty('color', '#A0A0A0', 'important');
        if (!timeEl.dataset.formatted) {
            const rawTime = timeEl.textContent.trim();
            if (!rawTime.includes('-') && !rawTime.includes('前')) {
                timeEl.innerText = rawTime + "前";
            }
            timeEl.dataset.formatted = "true";
        }

        // 主題標籤變藍
        const subjectLink = postContainer.querySelector('a[href*="/search?q="]:not([href*="timely"])');
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

    // 4. 找回的功能：僅限首篇的內文縮排 (針對 /post/ 頁面)
function handlePostPageIndent() {
    if (!window.location.href.includes('/post/')) return;

    // --- 第一步：鎖定 page_0 ---
    const pageZero = document.querySelector('[data-pagelet="threads_post_page_0"]');
    if (!pageZero) return;

    // --- 第二步：在 page_0 內掃描所有貼文塊 ---
    const posts = pageZero.querySelectorAll('[data-pressable-container="true"]');

    posts.forEach((post) => {
        // 1. 物理連線偵測：找看看有沒有那條垂直線
        const threadLine = Array.from(post.querySelectorAll('div')).find(div => {
            const s = window.getComputedStyle(div);
            return s.position === 'absolute' &&
                   parseInt(s.width) > 0 && parseInt(s.width) <= 4 &&
                   s.backgroundColor !== 'transparent' &&
                   div.offsetHeight > 20;
        });

        // 2. 邏輯核心：只有「無線」的文才需要手動縮排
        if (!threadLine) {
            // 抓取內文文字 (dir="auto") 與 媒體連結 (href 包含 /media)
            const contentNodes = post.querySelectorAll('[dir="auto"], a[href*="/media"]');

            contentNodes.forEach(node => {
                // --- 排除 Header/Footer ---
                if (node.tagName === 'TIME' || node.closest('time')) return;
                if (node.closest('a[href*="/@"]:not([href*="/post/"])')) return;
                if (node.closest('[role="button"]') || node.closest('.x4vbgl9')) return;

                // --- 執行右移 52px ---
                if (!node.dataset.indentDone) {
                    // 如果是 <a> (媒體)，直接移自己；如果是 <span> (文字)，移父容器
                    let target = (node.tagName === 'A') ? node : node.parentElement;

                    // 確保位移對象在貼文容器內
                    if (target !== post && post.contains(target)) {
                        target.style.setProperty('margin-left', '52px', 'important');
                        target.style.setProperty('width', 'calc(100% - 52px)', 'important');

                        // 修正媒體容器負 Margin 補償 (這對 media 連結特別重要)
                        const negMargin = target.querySelector('div[style*="margin-inline-start"]');
                        if (negMargin) {
                            negMargin.style.setProperty('margin-inline-start', '0px', 'important');
                        }

                        node.dataset.indentDone = "true";
                    }
                }
            });
        }
    });
}
    // 5. 按鈕列靠右邏輯
    function applyButtonStyle(likeIcon) {
        let container = likeIcon.parentElement;
        for(let i=0; i<6; i++) {
            if (container && container.children.length >= 3 && container.children.length <= 5) {
                if (container.dataset.styled) break;
                container.dataset.styled = '1';
                container.classList.add('custom-stack-move');
                let plusdistance = 3;
                Array.from(container.children).forEach((wrapper) => {
                    const btn = wrapper.querySelector('[role="button"]');
                    if (btn) {
                        const svg = btn.querySelector('svg');
                        if (svg) svg.style.transform = 'scale(0.8)';
                        btn.style.transform = 'translateX(' + (1.2 * plusdistance) + 'em)';
                        plusdistance--;
                    }
                });
                break;
            }
            if(container) container = container.parentElement;
        }
    }

    // 6. 清理特殊字元
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

    // 主執行迴圈
    function mainLoop() {
        updateNavActiveState();
        document.querySelectorAll('time').forEach(t => applyIdReformat(t));
        handlePostPageIndent();
        document.querySelectorAll('svg[aria-label="讚"]').forEach(i => applyButtonStyle(i));
        cleanContent();
    }

    mainLoop();
    const observer = new MutationObserver(() => mainLoop());
    observer.observe(document.body, { childList: true, subtree: true });
})();
