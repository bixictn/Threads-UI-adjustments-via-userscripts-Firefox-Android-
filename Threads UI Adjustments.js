// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.9.8
// @description  Threads UI Adjustments
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let lastPath = "";
    let isBackAction = false;
    let targetScrollY = 0;
    let scrollLockActive = false;
    const ZImenu=8,ZIdialog=7,ZIbg=5;
    let scrollHistory = {}, replylist=[];
    // --- 1. 物理遮罩、毛玻璃與基礎 CSS ---
    const style = document.createElement('style');
    style.textContent = `

        [data-pagelet="threads_post_page_0"] { opacity: 0 !important; }

        /* 隱藏廣告與跳轉連結 */
        a[href^="intent://"], a[href*="itunes.apple.com"], a[href*="play.google.com"] { display: none !important; }
        html, body { overflow-x: hidden !important; }

        div[role="region"]{
            width:640px !important;
        }

        a[aria-label] span[dir="auto"] {
            color: #808080 !important;
        }

        a[aria-label][data-active="true"] span[dir="auto"] {
            color: #D4AF37 !important;
        }

        /* 深色模式 & 亮色模式通用：針對 Threads Logo SVG 進行處理 */
        .__fb-dark-mode a[href="/"] svg[aria-label="Threads"],
        .__fb-light-mode a[href="/"] svg[aria-label="Threads"],
        a[href="/"] div svg[aria-label="Threads"],
        div[role="navigation"] a[href="/"] svg[aria-label="Threads"] {
            cursor: pointer !important;
            fill: #D4AF37 !important;
            transition: transform 0.2s ease !important;
        }

        div[class*="-mode"]{
            z-index:${ZIdialog} !important;
        }

        div[class*="-mode"] div[style*="transform"]{
            z-index:${ZImenu} !important;
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
        @media screen and (max-width: 695px){
            nav svg:not([aria-label="Threads"]) {
                transform: scale(0.7) !important;
                transform-origin: center center !important;
            }
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
            z-index: ${ZIbg} !important;
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

    const blackoutDiv = document.createElement('div');
    blackoutDiv.id = 'ultimate-blackout';
    blackoutDiv.innerHTML = '<div id="aligntime">⏳</div>';
    (document.body || document.documentElement).appendChild(blackoutDiv);

    function showBlackout() {
        blackoutDiv.style.display = 'flex';
    }

    function hideBlackout() {
        const pageZero = document.querySelector('[data-pagelet="threads_post_page_0"]');
        if (pageZero) {
            void pageZero.offsetHeight;
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

    function emojiSize(){
        const spans = document.querySelectorAll('span');
        for ( const span of spans){
            if(span.className !== '') continue;
            if(span.dataset.processed) continue;
            const twlock=span.querySelectorAll('span[class="tw-p-lock"]');
            if(!twlock)continue;
            const emojis = span.querySelectorAll('img[class*="twemoji"]');
            // 取得容器內的純文字（去除空白）
            const textContent = span.textContent.trim();
            const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'grapheme' });
            const segments = segmenter.segment(textContent);
            // 條件：純文字長度為 0 且 emoji 數量在 1~3 個之間
            if ([...segments].length === (twlock.length-emojis.length) && emojis.length > 0 && emojis.length <= 3) {
                span.dataset.processed=true;
                span.style.setProperty('display', 'flex','important');
                span.style.setProperty('line-height', '58px','important');

                twlock.forEach(twspan => {
                    twspan.style.setProperty('display', 'flex','important');
                    twspan.style.setProperty('height', '60px', 'important');
                    twspan.style.setProperty('width', '60px', 'important');
                    twspan.style.setProperty('font-size','49px','important');
                    twspan.style.setProperty('margin', '0px 5px 0px 0px', 'important');
                    twspan.style.setProperty('line-height', '58px','important');
                    twspan.style.setProperty('align-items', 'center','important');
                    twspan.style.setProperty('justify-content','center','important');
                    const emoji = twspan.querySelector('img[class*="twemoji"]');
                    if(emoji){
                        emoji.style.setProperty('display', 'flex','important');
                        emoji.style.setProperty('line-height', '58px','important');
                        emoji.style.setProperty('display', 'flex','important');
                        emoji.style.setProperty('height', '54px', 'important');
                        emoji.style.setProperty('width', '54px', 'important');
                        emoji.style.setProperty('font-size','48px','important');
                        emoji.style.setProperty('align-items', 'center','important');
                        emoji.style.setProperty('justify-content','center','important');
                    }
                });
            }

        }
    }

     function isNestedPost(el) {
        // 如果 el 本身是容器，且它的子層也有容器，文章有引文
        return el.matches('[data-pressable-container="true"]') &&
            el.querySelector('[data-pressable-container="true"]');
    }


    function handleMainPageindent(){//主頁
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

    function handleInPostPageIndent(inpost){//引文
        const anchors = inpost.querySelectorAll('[dir="auto"]');
        let check=0;
        for(const [index,anchor] of anchors.entries()){
            if (anchor.querySelector('time') || anchor.closest('a[href*="/@"]:not([href*="/post/"])') || anchor.closest('[role="button"]')) continue;
            check++;
            anchor.style.setProperty('margin-left', '52px', 'important');
            anchor.style.setProperty('width', 'calc(100% - 52px)', 'important');
            anchor.dataset.indentDone = "true";
            const pd = anchor.closest('[data-pressable-container="true"]');
            const spp = pd.querySelector('span').parentElement;
            spp.style.setProperty('align-items', 'center','important');
            spp.style.setProperty('flex-wrap','wrap','important');
            spp.style.setProperty('justify-content', 'center','important');
            if(check>2)break;
        }
    }

    function handleAllInPostPageIndent(){//所有文章檢查引文
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

                let checkdiv = post.querySelector('[data-pressable-container="true"]').parentElement;//單有引文父層為<div>

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
                                    toTop(index);

                                    hideBlackout(); 
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
                        toTop(index);

                        hideBlackout(); 
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
                                    toTop(index);

                                    hideBlackout();
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

    function toTop(index){

        if (index === 0) {
            if (!isBackAction && !scrollLockActive) {

                window.scrollTo({ top: 0, behavior: 'instant' });
                [0, 150, 300, 500].forEach(delay => {
                    setTimeout(() => {
                        window.scrollTo(0, 0);
                        document.documentElement.scrollTop = 0;
                        document.body.scrollTop = 0;
                    }, delay);
                });
            }
        }
    }

    function applyButtonStyle(likeIcon) {
        let container = likeIcon.parentElement;
        for(let i=0; i<6; i++) {
            if (container && container.children.length >= 3) {
                if (container.dataset.styled) break;
                container.dataset.styled = '1';
                container.classList.add('custom-stack-move');
                Array.from(container.children).forEach((wrapper) => {
                    const btn = wrapper.querySelector('[role="button"]');
                    if (btn) {
                        const svg = btn.querySelector('svg');
                        if (svg) svg.style.transform = 'scale(0.8)';
                        btn.parentElement.style.setProperty('min-width','fit-content','important');
                        btn.parentElement.style.setProperty('justify-conten', 'flex-start','important');
                        svg.parentElement?.parentElement.style.setProperty("padding-left",'0px','important');
                        svg.parentElement?.parentElement.style.setProperty("padding-right",'3px','important');
                        svg.parentElement?.parentElement.style.setProperty('width','fit-content','important');

                        const popup = btn.closest('div[aria-haspopup="dialog"]');
                        if(popup){
                            popup.style.setProperty("padding-left",'0px','important');
                            popup.style.setProperty("padding-right",'0px','important');
                        }

                    }
                });
                break;
            }
            if(container) container = container.parentElement;
        }
    }

    function updateNavActiveState() {


        const windowWidth = window.innerWidth;
        if(windowWidth > 695){
            const firsthtmldiv = document.querySelector('div[class*="html-div"');
            if(firsthtmldiv){
                const headerbar=firsthtmldiv.parentElement?.parentElement;
                headerbar.style.setProperty("width","fit-content","important");
            }
        }

        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('a[role="link"], div[role="button"]');
        navLinks.forEach(link => {
            if(link.getAttribute('aria-label') === '串文'){
                const about=link.closest('div[class*="html-div"]').parentElement;
                about.style.setProperty("width", "auto", "important");
                about.style.setProperty("justify-content", "space-around", "important");

                const mods=about.querySelectorAll('a[href]');
                for(const mod of mods){
                    const modp=mod.parentElement;
                    modp.style.setProperty("padding-inline-start", "2px","important");
                    modp.style.setProperty("padding-inline-end", "2px","important");
                }
            }

            const href = link.getAttribute('href');
            if(!href)return;
            const hrefnode=href.split('/'),currentPathnode=currentPath.split('/');
            const isActive = (href === currentPath) ||
                  (currentPath === '/' && href === '/') ||
                  (href && href !== '/' && currentPath.startsWith(href) && hrefnode.length===currentPathnode.length);
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

    function hrstyle() {
        const hrs = document.querySelectorAll('hr[class*="html-hr"]');

        if(!hrs)return;

        for(const [index, hr] of hrs.entries()){
            const hrpp = hr.parentElement?.parentElement;

            const reply = hrpp.querySelector('svg[aria-label=""][role="img"]');
            if(!reply) continue;
            if(reply.parentElement?.parentElement.tagName !== 'DIV') continue;
            const ahref=reply.parentElement?.parentElement.querySelector('a[href]');

            if(ahref)continue;


            const hrp = hr.parentElement;
            hrp.style.setProperty("flex-grow", "1", "important");
            hrp.style.setProperty("display", "flex", "important");

            const currentPath = window.location.pathname;
            const currentPathnode = currentPath.split('/');
            if(!currentPath.includes('/@') && currentPathnode.length==2) hrp.style.setProperty("align-items", "center", "important");


            hrpp.style.setProperty("display", "flex", "important");
            hrpp.style.setProperty("flex-direction", "column", "important");
            hrobserver.observe(hrpp);
            updateHrppHeight(hrpp);
            hrpp.style.setProperty("height", "auto", "important");
        }
    }

    function updateHrppHeight(target) {

        const rect = target.getBoundingClientRect();
        const hasDecimal = rect.top % 1 !== 0; // 如果有餘數，代表有小數
        if (hasDecimal && rect.top > 0 && rect.top < window.innerHeight && !replylist.includes(target)) {
            let h = window.innerHeight - rect.top - 20;
            target.style.setProperty("min-height", `${h}px`, "important");
            if(h>50) {
                replylist.push(target);
                history.pushState({ type: 'reply_open' }, '');
            }
        }
    }

    function closeReplyDialog() {
        const cancelButton = Array.from(document.querySelectorAll('div[role="button"]'))
        .find(el => el.innerText === '取消' || el.textContent === '取消');

        if (cancelButton) {
            cancelButton.click();
        }
    }
    // --- 3. 監聽與 SPA 導航控制 ---
    function mainLoop() {
        const currentPath = window.location.pathname;

        // 1. 路徑變更偵測
        if (lastPath !== currentPath) {
            if (isBackAction) {
                // 如果是返回動作，只更新路徑紀錄，不准執行任何重置或捲動
                lastPath = currentPath;
            } else {
                // 只有「主動點擊進入」才執行的重置
                lastPath = currentPath;
                const pageZero = document.querySelector('[data-pagelet="threads_post_page_0"]');
                if (pageZero) {
                    pageZero.removeAttribute('data-processed');
                    pageZero.style.setProperty('opacity', '0', 'important');
                }
                showBlackout();
            }
        }

        if (currentPath.includes('/post/')) {
            handlePostPageIndent();
        } else {
            handleMainPageindent();
            if (!isBackAction) hideBlackout();
        }

        document.querySelectorAll('time').forEach(t => applyIdReformat(t));
        document.querySelectorAll('svg[aria-label="讚"], svg[aria-label="收回讚"]').forEach(i => applyButtonStyle(i));
        updateNavActiveState();

        cleanContent();
        hrstyle();
        emojiSize();

    }

    function deepCleanEmojiMemory() {
        console.log("Threads UI Adj: 執行記憶體清理...");

        // 1. 移除所有已被置換的 Emoji 容器，強迫釋放 DOM 引用
        const locks = document.querySelectorAll('.tw-p-lock');
        locks.forEach(el => {
            // 還原為原始 alt 文字（Emoji 原型），這有助於垃圾回收
            const img = el.querySelector('img');
            if (img && img.alt) {
                el.replaceWith(document.createTextNode(img.alt));
            } else {
                el.remove();
            }
        });

        console.log("Threads UI Adj: 發送重置信號...");
        const resetEvent = new CustomEvent('twemoji-reset-request', {
            detail: { timestamp: Date.now() },
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(resetEvent);
    }

    const observer = new MutationObserver(mainLoop);
    observer.observe(document.documentElement, { childList: true, subtree: true });


    // 1. 隨時記錄每個路徑的捲軸位置
    window.addEventListener('scroll', () => {
        if (!isBackAction) {
            scrollHistory[window.location.pathname] = window.scrollY;
        }
    }, { passive: true });


    window.addEventListener('popstate', () => {

        const currentPath = window.location.pathname;
        if ( lastPath === currentPath) {
            closeReplyDialog();
            return;
        }

        if(window.scrollY === 0) return;
        const targetPath = window.location.pathname;
        const savedPos = scrollHistory[targetPath];

        deepCleanEmojiMemory();

        if (savedPos !== undefined) {
            isBackAction = true;
            showBlackout();

            targetScrollY = window.scrollY;
            if (targetScrollY < 10) {
                isBackAction = false; 
                hideBlackout();
                return;
            }

            scrollLockActive = true;
            let attempts = 0;
            const recoverScroll = setInterval(() => {
                window.scrollTo(0, savedPos);
                attempts++;

                // 嘗試多次，直到 Threads 渲染完成或是嘗試過久
                if (attempts > 30 || Math.abs(window.scrollY - savedPos) < 2) {
                    clearInterval(recoverScroll);
                    setTimeout(() => {
                        hideBlackout();
                        isBackAction = false;
                    }, 200);
                }
            }, 30); 
        }
    });

    const hrobserver = new IntersectionObserver(entries => {
        for (let entry of entries) {
            updateHrppHeight(entry.target);
        }
    }, { threshold: 0.3});
})();
