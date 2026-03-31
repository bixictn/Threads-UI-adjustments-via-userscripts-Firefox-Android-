// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.8.0.0
// @description  Threads UI Adjustments
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1.  CSS
    const style = document.createElement('style');
    style.textContent = `
        a[href^="intent://"], a[href*="itunes.apple.com"], a[href*="play.google.com"] { display: none !important; }
        html, body { overflow-x: hidden !important; }
        nav svg { transform: scale(0.5) !important; transform-origin: center center !important; }
        div span > span { font-size: 18px !important; }

        a[href*="/@"],
        a[href*="/@"] span {
            color: #D4AF37 !important;
            font-size: 14px !important;
            font-weight: bold !important;
            text-decoration: none !important;
        }

        .custom-stack-move {
            display: flex !important;
            justify-content: flex-end !important;
            width: 100% !important;
            margin-top: 0px !important;
        }

        /* 假設鎖定該 SVG 的父容器 */
        div[role="button"]:has(svg[aria-label="展開撰寫工具"]) {
            position: absolute !important;
            bottom: 8px !important;  /* 距離底部 */
            right: 8px !important;   /* 距離右側 */
            z-index: 999;             /* 確保在最上層 */
         }
    `;
    document.head.appendChild(style);

    // 2.  ID
    function applyIdReformat(timeEl) {
        if (timeEl.dataset.processed === "done") return;

        // 1. 尋找容器 (維持你原本的 parentElement 迴圈邏輯)
        let postContainer = timeEl.parentElement;
        for(let i=0; i<8; i++) {
            if(postContainer && (postContainer.tagName === 'ARTICLE' || postContainer.getAttribute('data-testid') === 'post-container')) break;
            if(postContainer) postContainer = postContainer.parentElement;
        }
        if (!postContainer) return;

        // 2. 確保只處理第一筆時間標籤
        const firstTimeInPost = postContainer.querySelector('time');
        if (timeEl !== firstTimeInPost) {
            timeEl.dataset.processed = "done";
            return;
        }

        // 3. 抓取三個關鍵節點
        const idElement = postContainer.querySelector('a[href*="/@"]:not(:has(img))');
        const subjectLink = postContainer.querySelector('a[href*="/search?q="]');

        // --- 核心樣式修改 (位置不動，僅改顏色與字體) ---
        if (idElement) {

            // B. 時間改灰色 (維持在原位，不隱藏)
            timeEl.style.setProperty('color', '#A0A0A0', 'important');
            timeEl.style.setProperty('font-size', '12px', 'important');
            timeEl.style.setProperty('font-weight', 'normal', 'important');
            timeEl.style.setProperty('visibility', 'visible', 'important');
            timeEl.style.setProperty('display', 'inline', 'important');

            // 加上「前」字 (如果需要)
            if (!timeEl.dataset.formatted) {
                const rawTime = timeEl.textContent.trim();
                if (!rawTime.includes('-') && !rawTime.includes('前')) {
                    timeEl.innerText = rawTime + "前";
                }
                timeEl.dataset.formatted = "true";
            }

            // C. Subject 改藍色 (維持在原位，僅改樣式)
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
    }

    // button move
    function applyButtonStyle(likeIcon) {

            let container = likeIcon.parentElement;
            let depth = 0;
            while (container && depth < 6) {
               if (container.children.length >= 3 && container.children.length <= 5) {
                   if (container.dataset.styled) return;
                   container.dataset.styled = '1';
                   container.classList.add('custom-stack-move');

                   var plusdistance=3;
                   Array.from(container.children).forEach((wrapper, index) => {
                       wrapper.style.display = 'flex';
                       wrapper.style.alignItems = 'end';
                       wrapper.style.justifyContent = 'flex-end';
                       wrapper.style.minHeight = '14px';


                       const btn = wrapper.querySelector('[role="button"]');
                       if (!btn) return;

                       const svg = btn.querySelector('svg');
                       const countSpan = btn.querySelector('span');
                        if (svg) {
                            svg.style.transform = 'scale(0.8)';
                            const label = svg.getAttribute('aria-label');
                            btn.style.transform = 'translateX('+(1.2*plusdistance)+'em)';
                            plusdistance=plusdistance-1;
                       }


                    });
                    break;
                }
                container = container.parentElement;
                depth++;
            }
        adjustButtonGroupPosition(likeIcon);
    }

    function adjustButtonGroupPosition(likeIcon) {
    if (window.location.href.includes('/post/')) return;
    let potentialGroup = likeIcon.parentElement;
    for (let i = 0; i < 5; i++) {
        if (potentialGroup && potentialGroup.querySelectorAll('button, [role="button"]').length >= 3) {
           break;
        }
        potentialGroup = potentialGroup.parentElement;
    }


    // 1. 定位讚按鈕，再找它的群組容器 (role="group")

    const btnGroup = potentialGroup;
    if (!btnGroup) return;
    const parent = btnGroup.parentElement;
    if (!parent) return;
    // 找到 Group 的上層

    // 強制讓 Parent 變為 Flex 容器並靠右對齊
    parent.style.display = "flex !important";
    parent.style.justifyContent = "flex-end !important";

    btnGroup.style.display = "flex !important";
    btnGroup.style.justifyContent = "flex-end !important";

    }

    function cleanThreadsContent() {
    // 抓取所有還沒被處理過且包含 OBJ 的 span
    const spans = document.querySelectorAll('span:not([data-obj-cleaned])');

    spans.forEach(span => {
        let hasObj = false;
        span.childNodes.forEach(node => {
            if (node.nodeType === 3 && node.nodeValue.includes('\uFFFC')) {
                node.nodeValue = node.nodeValue.replace(/\uFFFC/g, '');
                hasObj = true;
            }
        });
        // 標記已處理，避免反覆跑迴圈耗能
        if (hasObj) {
            span.setAttribute('data-obj-cleaned', 'true');
        }
    });
}

    function mainLoop() {
        document.querySelectorAll('time').forEach(t => applyIdReformat(t));
        document.querySelectorAll('svg[aria-label="讚"]').forEach(i => applyButtonStyle(i));
        cleanThreadsContent();
    }

    mainLoop();
    const observer = new MutationObserver(() => mainLoop());
    observer.observe(document.body, { childList: true, subtree: true });

})();
