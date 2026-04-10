// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.9.6
// @description  Threads UI Adjustments
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let lastPath = "";

    // --- 1. 物理遮罩、毛玻璃與基礎 CSS ---
    const style = document.createElement('style');
    style.textContent = `
        [data-pagelet="threads_post_page_0"] { opacity: 0 !important; }

        a[href^="intent://"], a[href*="itunes.apple.com"], a[href*="play.google.com"] { display: none !important; }
        html, body { overflow-x: hidden !important; }
        .__fb-dark-mode a[href="/"] svg[aria-label="Threads"],
        .__fb-light-mode a[href="/"] svg[aria-label="Threads"],
        a[href="/"] div svg[aria-label="Threads"] {
            cursor: pointer !important; fill: #D4AF37 !important; transition: transform 0.2s ease !important;
        }
        nav svg:not([aria-label="Threads"]) {
            transform: scale(0.7) !important; transform-origin: center center !important;
        }
        div span > span {
            font-size: 18px !important;
        }
        .custom-stack-move {
            display: flex !important; justify-content: flex-end !important; width: 100% !important;
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
        // 如果 el 本身是容器，且它的父層也是容器，那它就是文中文
        return el.matches('[data-pressable-container="true"]') &&
            el.parentElement.closest('[data-pressable-container="true"]');
    }

    function handlePostPageIndentInPost(post){
        let inpost = post.querySelector('[data-pressable-container="true"]');
        if(!inpost)return;
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
    function handlePostPageIndent() {
        let nestedpost=0;
        if (!window.location.href.includes('/post/')) return;
        const pageZero = document.querySelector('[data-pagelet="threads_post_page_0"]');
        if (!pageZero || pageZero.dataset.processed) return;

        const hasContent = pageZero.querySelector('[dir="auto"]');
        const isSpinning = pageZero.querySelector('svg circle') || pageZero.querySelector('[role="progressbar"]');

        if (!hasContent || isSpinning) return;

        const posts = pageZero.querySelectorAll('[data-pressable-container="true"]');

        for (const [index, post] of posts.entries()) {
            // 剔除帶有 --x-height 的 div

            if(isNestedPost(post))nestedpost=1;//有引文
            else nestedpost=0;

            const lines = post.querySelectorAll('div[class*="html-div"]:not([style*="--x-height"])');

            if(nestedpost === 0 ){
                if (lines.length === 0) {

                    handlePostPageIndentInPost(post);

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

                                    hideBlackout(); // 完成，關閉黑幕
                                    return;
                                }
                            }
                            target = target.parentElement;
                            p++;
                        }
                    }
                }
            }
            else if(nestedpost === 1){
                let target=post.parentElement;
                if (target.className === '') {
                    if (!target.dataset.indentDone) {
                        target.style.setProperty('margin-left', '52px', 'important');
                        target.style.setProperty('width', 'calc(100% - 52px)', 'important');
                        target.dataset.indentDone = "true";
                        pageZero.dataset.processed = "true";

                        handlePostPageIndentInPost(post);

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

                        hideBlackout(); // 完成，關閉黑幕
                        return;
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

    function waitUntilDetached(btn, callback) {
        let attempts = 0;
        const check = setInterval(() => {
            attempts++;

            // 關鍵判定：檢查這個按鈕是否還連接在網頁 document 上
            if (!btn.isConnected || attempts > 20) {
                clearInterval(check);
                if (!btn.isConnected) {
                    callback(); // 按鈕真的從網頁消失了，執行上色
                }
            }
        }, 100);
    }


    function autoClickSpoilers() {
        // 1. 文字劇透：維持原有邏輯
        document.querySelectorAll('span[data-text-fragment="spoiler"]').forEach(el => {
            const btn = el.closest('div[role="button"]');
            const spoilerText = el.innerText.trim();
            const parent = btn?.parentElement; // 先抓好父層，因為點擊後 btn 會斷開

            if (btn && !btn.dataset.autoClicked) {
                btn.dataset.autoClicked = "true";
                btn.click();

                // 等到這個「舊按鈕」真正斷開連結
                waitUntilDetached(btn, () => {
                    // 這時候 parent 裡面的內容應該已經被 React 換成新的純文字 span 了
                    const newSpans = parent.querySelectorAll('span');
                    newSpans.forEach(s => {
                        // 找到文字符合且沒有邊框的新 span
                        if (s.innerText.trim() === spoilerText && !s.dataset.revealedBorder) {
                            s.style.setProperty('border', '1.5px solid #D4AF37', 'important');
                            s.style.setProperty('border-radius', '6px', 'important');
                            s.style.setProperty('padding', '0 4px', 'important');
                            s.style.setProperty('display', 'inline-block', 'important');
                            s.style.setProperty('vertical-align', 'middle', 'important');
                            s.dataset.revealedBorder = "true";
                        }
                    });
                });
            }
        });

        // 2. 影音劇透：搜尋所有內容為「劇透」的 span
        document.querySelectorAll('span').forEach(span => {
            // 偵測文字內容是否為劇透或敏感內容
            const isSpoilerText = span.innerText === '劇透' || span.innerText === '敏感內容';

            if (isSpoilerText) {
                const btn = span.closest('div[role="button"]');

                if (btn && !btn.dataset.autoClicked) {
                    btn.click();
                    btn.dataset.autoClicked = "true";
                    const parent=btn.parentElement;
                    waitUntilDetached(btn, () => {
                        if (!parent) return;

                        const mediaElements = parent.querySelectorAll('img, video');

                        mediaElements.forEach(s => {
                            if (!s.dataset.revealedBorder) {
                                // 加上金色邊框
                                s.style.setProperty('border', '2px solid #D4AF37', 'important');
                                s.style.setProperty('border-radius', '12px', 'important'); // 影音通常圓角大一點比較好看

                                // 修正：針對影音建議加上這行，防止邊框把圖片擠小
                                s.style.setProperty('box-sizing', 'border-box', 'important');

                                // 雖然影音可以加 padding，但通常設為 0 或直接貼齊比較俐落
                                s.style.setProperty('padding', '2px', 'important');
                                s.style.setProperty('margin', '5px 0', 'important');
                                s.style.setProperty('display', 'block', 'important'); // 影音建議用 block 比較好置中排版

                                s.dataset.revealedBorder = "true";
                            }
                        });
                    });
                }
            }
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
                showBlackout(); // 顯示黑幕
            }
            handlePostPageIndent();
        } else {
            lastPath = currentPath;
            hideBlackout();
        }

        document.querySelectorAll('time').forEach(t => applyIdReformat(t));
        document.querySelectorAll('svg[aria-label="讚"]').forEach(i => applyButtonStyle(i));

        // 導覽列 Active 狀態
        document.querySelectorAll('a[role="link"], div[role="button"]').forEach(link => {
            const href = link.getAttribute('href');
            const isActive = (href === currentPath) || (currentPath === '/' && href === '/') || (href && href !== '/' && currentPath.startsWith(href));
            isActive ? link.setAttribute('data-active', 'true') : link.removeAttribute('data-active');
        });
        autoClickSpoilers();
    }

    const observer = new MutationObserver(mainLoop);
    observer.observe(document.documentElement, { childList: true, subtree: true });

})();
