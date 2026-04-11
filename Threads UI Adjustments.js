// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.9.7.2
// @description  Threads UI Adjustments
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let lastPath = "";

    const style = document.createElement('style');
    style.textContent = `
        [data-pagelet="threads_post_page_0"] { opacity: 0 !important; }

        /* 隱藏廣告與跳轉連結 */
        a[href^="intent://"], a[href*="itunes.apple.com"], a[href*="play.google.com"] { display: none !important; }
        html, body { overflow-x: hidden !important; }

        /* 深色模式 & 亮色模式通用：針對 Threads Logo SVG 進行處理 */
        .__fb-dark-mode a[href="/"] svg[aria-label="Threads"],
        .__fb-light-mode a[href="/"] svg[aria-label="Threads"],
        a[href="/"] div svg[aria-label="Threads"],
        div[role="navigation"] a[href="/"] svg[aria-label="Threads"] {
            cursor: pointer !important;
            fill: #D4AF37 !important;
            transition: transform 0.2s ease !important;
        }

        /* 點擊時的縮放效果 */
        a[href="/"]:active svg[aria-label="Threads"] {
            width:22px;
            height:22px;
            border: 2px solid #D4AF37 !important;
            border-radius: 50% !important;
            padding: 4px !important;
            box-shadow: 0 0 15px rgba(212, 175, 55, 0.6) !important;
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

        #ultimate-blackout {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 2147483647 !important;
            display: none;

            /* --- 毛玻璃核心設定 --- */
            background: rgba(77, 77, 77, 0.4) !important; /* 半透明背景 */
            backdrop-filter: blur(8px) !important;        /* 模糊效果 */
            -webkit-backdrop-filter: blur(8px) !important; /* 針對 Safari 相容 */
        }

        /* 2. 子層：沙漏（用絕對定位強行釘在中心） */
        #aligntime {
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;

            font-size: 50px !important;
            width: 1em !important;   /* 強制寬度等於一個字 */
            height: 1em !important;  /* 強制高度等於一個字 */
            line-height: 1 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            margin: 0 !important;
            padding: 0 !important;

            animation: hourglass-flip-perfect 1s linear infinite !important;
        }

        /* 3. 動畫：包含位移確保旋轉不跑位 */
        @keyframes hourglass-flip-perfect {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            85% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(180deg); }
        }
    `;
    (document.head || document.documentElement).appendChild(style);

    // 建立黑幕與沙漏 DOM
    const blackoutDiv = document.createElement('div');
    blackoutDiv.id = 'ultimate-blackout';
    blackoutDiv.innerHTML = '<div id="aligntime">⏳</div>';
    (document.body || document.documentElement).appendChild(blackoutDiv);

    function showBlackout() {
        blackoutDiv.style.display = 'flex'; // 啟動居中佈局
    }

    function hideBlackout() {
        const pageZero = document.querySelector('[data-pagelet="threads_post_page_0"]');
        if (pageZero) {
            void pageZero.offsetHeight; // 強制重繪
            pageZero.style.setProperty('opacity', '1', 'important');
        }
        blackoutDiv.style.display = 'none';
    }

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

    function isNestedPost(el) {
        // 如果 el 本身是容器，且它的子層也有容器，那它就是文中文
        return el.matches('[data-pressable-container="true"]') &&
            el.querySelector('[data-pressable-container="true"]');
    }

    function handleMainPageindent(){
        const posts = document.querySelectorAll('[data-pressable-container="true"]');
        if (!posts) return;
        for (const [index, post] of posts.entries()) {
            const inpost = post.querySelector('[data-pressable-container="true"]')
            if(isNestedPost(post) && inpost){
                handleInPostPageIndent(inpost);//有引文
                inpost.dataset.processed=true;
            }
        }
    }

    function handleInPostPageIndent(inpost){
        const anchors = inpost.querySelectorAll('[dir="auto"]');
        let check=0;
        for(const [index,anchor] of anchors.entries()){
            if (anchor.querySelector('time') || anchor.closest('a[href*="/@"]:not([href*="/post/"])') || anchor.closest('[role="button"]')) continue;
            check++;
            anchor.style.setProperty('margin-left', '52px', 'important');
            anchor.style.setProperty('width', 'calc(100% - 52px)', 'important');
            anchor.dataset.indentDone = "true";

            if(check>2)break;
        }
    }

    function handleAllInPostPageIndent(){
        const pages = document.querySelectorAll('[data-pagelet*="threads_post_page"]');
        for (const [index, page] of pages.entries()) {
            const posts=page.querySelectorAll('[data-pressable-container="true"]');
            for(const [pageindex, post] of posts.entries()){
                const inpost = post.querySelector('[data-pressable-container="true"]')
                if(isNestedPost(post) && inpost){
                    handleInPostPageIndent(inpost);//有引文
                    inpost.dataset.processed=true;
                }
            }
        }
    }

    function handlePostPageIndent() {
        let nestedpost=0;
        if (!window.location.href.includes('/post/')) return;

        handleAllInPostPageIndent();//單獨處理所有引文

        const pageZero = document.querySelector('[data-pagelet="threads_post_page_0"]');
        if (!pageZero || pageZero.dataset.processed) return;

        const hasContent = pageZero.querySelector('[dir="auto"]');
        const isSpinning = pageZero.querySelector('svg circle') || pageZero.querySelector('[role="progressbar"]');

        if (!hasContent || isSpinning) return;

        const posts = pageZero.querySelectorAll('[data-pressable-container="true"]');

        for (const [index, post] of posts.entries()) {

            if(isNestedPost(post))nestedpost=1;//有引文
            else nestedpost=0;
            // 剔除帶有 --x-height 的 div
            const lines = post.querySelectorAll('div[class*="html-div"]:not([style*="--x-height"])');

            if(nestedpost === 1 ){//有引文

                let checkdiv = post.querySelector('[data-pressable-container="true"]').parentElement;//單有引文父層只為<div>

                if(lines.length===0 && checkdiv.className != ''){//無線
                    const anchors = post.querySelectorAll('[dir="auto"]');
                    for(let anchor of anchors){
                        if (anchor.querySelector('time') || anchor.closest('a[href*="/@"]:not([href*="/post/"])') || anchor.closest('[role="button"]')) continue;
                        let target = anchor.parentElement;
                        let p = 0;
                        while (target && target.tagName === 'DIV' && p < 3) {
                            if (target.className === '') {
                                if (!target.dataset.indentDone) {
                                    target.style.setProperty('margin-left', '52px', 'important');
                                    target.style.setProperty('width', 'calc(100% - 52px)', 'important');
                                    target.dataset.indentDone = "true";
                                    pageZero.dataset.processed = "true";

                                    if (index === 0) {
                                        window.scrollTo({ top: 0, behavior: 'instant' });
                                        [0, 50, 150, 300].forEach(delay => {
                                            setTimeout(() => {
                                                window.scrollTo(0, 0);
                                                document.documentElement.scrollTop = 0;
                                                document.body.scrollTop = 0;
                                            }, delay);
                                        });
                                    }

                                    hideBlackout(); // 完成，關閉毛玻璃背景
                                    return;
                                }
                            }
                            target = target.parentElement;
                            p++;
                        }
                    }
                }
                else if(lines.length===0 && checkdiv.className === ''){//單有引文

                    let target = checkdiv;
                    if (!target.dataset.indentDone) {
                        target.style.setProperty('margin-left', '52px', 'important');
                        target.style.setProperty('width', 'calc(100% - 52px)', 'important');
                        target.dataset.indentDone = "true";
                        pageZero.dataset.processed = "true";

                        if (index === 0) {
                            window.scrollTo({ top: 0, behavior: 'instant' });
                            [0, 50, 150, 300].forEach(delay => {
                                setTimeout(() => {
                                    window.scrollTo(0, 0);
                                    document.documentElement.scrollTop = 0;
                                    document.body.scrollTop = 0;
                                }, delay);
                            });
                        }

                        hideBlackout(); // 完成，關閉毛玻璃背景
                        return;
                    }
                }
                //else 文旁有線->跳過
            }
            else if(nestedpost === 0 && lines.length === 0){//內文無引文, 或是引文本身
                if (!post.parentElement.closest('[data-pressable-container="true"]')) {//沒有上層文章就是本文
                    const anchors = post.querySelectorAll('[dir="auto"]');
                    for(let anchor of anchors){
                        if (anchor.querySelector('time') || anchor.closest('a[href*="/@"]:not([href*="/post/"])') || anchor.closest('[role="button"]')) continue;
                        let target = anchor.parentElement;
                        let p = 0;
                        while (target && target.tagName === 'DIV' && p < 3) {
                            if (target.className === '') {
                                if (!target.dataset.indentDone) {
                                    target.style.setProperty('margin-left', '52px', 'important');
                                    target.style.setProperty('width', 'calc(100% - 52px)', 'important');
                                    target.dataset.indentDone = "true";
                                    pageZero.dataset.processed = "true";

                                    if (index === 0) {
                                        window.scrollTo({ top: 0, behavior: 'instant' });
                                        [0, 50, 150, 300].forEach(delay => {
                                            setTimeout(() => {
                                                window.scrollTo(0, 0);
                                                document.documentElement.scrollTop = 0;
                                                document.body.scrollTop = 0;
                                            }, delay);
                                        });
                                    }

                                    hideBlackout(); // 完成，關閉毛玻璃背景
                                    return;
                                }
                            }
                            target = target.parentElement;
                            p++;
                        }
                    }
                }
            }
        }

        hideBlackout();
    }

    function applyButtonStyle(likeIcon) {
        let container = likeIcon.parentElement;
        for(let i=0; i<6; i++) {
            if (container && container.children.length >= 3) {
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


    // --- 3. 監聽與 SPA 導航控制 ---
    function mainLoop() {
        const currentPath = window.location.pathname;

        if (currentPath.includes('/post/') && !currentPath.includes('/media')) {
            if (lastPath !== currentPath) {
                lastPath = currentPath;
                const pageZero = document.querySelector('[data-pagelet="threads_post_page_0"]');
                if (pageZero) {
                    pageZero.removeAttribute('data-processed');
                    pageZero.style.setProperty('opacity', '0', 'important');
                }
                showBlackout(); // 顯示毛玻璃背景
            }
            handlePostPageIndent();
        } else {
            handleMainPageindent();
            lastPath = currentPath;
            hideBlackout();
        }

        document.querySelectorAll('time').forEach(t => applyIdReformat(t));
        document.querySelectorAll('svg[aria-label="讚"]').forEach(i => applyButtonStyle(i));
        updateNavActiveState();

        cleanContent();
    }

    const observer = new MutationObserver(mainLoop);
    observer.observe(document.documentElement, { childList: true, subtree: true });

})();
