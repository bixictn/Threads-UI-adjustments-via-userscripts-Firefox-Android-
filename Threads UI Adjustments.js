// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.7.7.3
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

        let postContainer = timeEl.parentElement;
        for(let i=0; i<8; i++) {
            if(postContainer && (postContainer.tagName === 'ARTICLE' || postContainer.getAttribute('data-testid') === 'post-container')) break;
            if(postContainer) postContainer = postContainer.parentElement;
        }
        if (!postContainer) return;

        // time label
        const firstTimeInPost = postContainer.querySelector('time');
        if (timeEl !== firstTimeInPost) {
            timeEl.dataset.processed = "done";
            return;
        }

        const idElement = postContainer.querySelector('a[href*="/@"]:not(:has(img))');
        const subjectLink = postContainer.querySelector('a[href*="/search?q="]');

        if (idElement) {
            const infoLine = document.createElement('div');
            infoLine.style.cssText = 'top: 0 !important;left: 0 !important; font-size: 13px !important;color: #777 !important;   font-weight: normal !important;overflow: hidden !important;max-width: 250px !important;display: block !important;white-space: normal !important;    line-height: 1.5 !important;    pointer-events: auto !important; padding: 2px 4px !important;';
            const t = document.createElement('span');
            const rawTime = timeEl.textContent.trim();

            // Date check
            const isDateForm = rawTime.includes('-');
            t.textContent = isDateForm ? rawTime : (rawTime + "前");

            t.style.cssText = 'color: #777;';
            infoLine.appendChild(t);

            let hasSubject = false;
            if (subjectLink) {
                const s = document.createElement('a');
                s.href = subjectLink.href;
                s.textContent = `<${subjectLink.innerText.trim()}>`;
                s.style.cssText = 'color: #0095f6; font-size:16px;font-weight: bold; text-decoration: none;';
                s.onmouseover = () => { s.style.textDecoration = 'underline'; };
                s.onmouseout = () => { s.style.textDecoration = 'none'; };
                infoLine.appendChild(s);
                subjectLink.style.display = 'none';
                hasSubject = true;
            }
            const br = document.createElement('br');
            idElement.after(br);
            idElement.after(infoLine);

            timeEl.dataset.processed = "done";
            timeEl.style.visibility = 'hidden';
            timeEl.style.height = '0';
            timeEl.style.position = 'absolute';
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
    function mainLoop() {
        document.querySelectorAll('time').forEach(t => applyIdReformat(t));
        document.querySelectorAll('svg[aria-label="讚"]').forEach(i => applyButtonStyle(i));
    }

    mainLoop();
    const observer = new MutationObserver(() => mainLoop());
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(mainLoop, 500);

})();
