// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.9.0
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

        /* --- 需求 1: Logo 樣式 --- */
        a[href="/"] svg[aria-label="Threads"],
        div[role="navigation"] svg[aria-label="Threads"],
        a[aria-label="首頁"] svg[aria-label="Threads"] {
            top: 13px !important;
            border: 2px solid #D4AF37 !important;
            border-radius: 50% !important;
            padding: 4px !important;
            box-shadow: 0 0 15px rgba(212, 175, 55, 0.6) !important;
            cursor: pointer !important;
            transition: transform 0.2s ease !important;
        }
        a[href="/"] svg[aria-label="Threads"]:active {
            transform: scale(0.9) !important;
        }

        /* --- 需求 2: 導覽列 Active 狀態 (金色) --- */
        /* 當 a 標籤被加上 data-active="true" 時，內部的 SVG 變色 */
        a[data-active="true"] svg,
        div[role="button"][data-active="true"] svg {
            color: #D4AF37 !important;
            fill: #D4AF37 !important;
        }

        /* 針對特定 SVG 屬性控制 */
        a[data-active="true"] svg path,
        div[role="button"][data-active="true"] svg path {
            fill: #D4AF37 !important;
            stroke: #D4AF37 !important;
        }

        /* 原有導覽列圖示縮小 (排除主 Logo) */
        nav svg:not([aria-label="Threads"]) {
            transform: scale(0.7) !important;
            transform-origin: center center !important;
        }

        /* 內文與佈局樣式 */
        div span > span { font-size: 18px !important; }
        .custom-stack-move {
            display: flex !important;
            justify-content: flex-end !important;
            width: 100% !important;
        }
    `;
    document.head.appendChild(style);

    // 處理導覽列 Active 狀態邏輯
    function updateNavActiveState() {
        const currentPath = window.location.pathname;

        // 尋找所有導覽連結
        const navLinks = document.querySelectorAll('a[role="link"], div[role="button"]');

        navLinks.forEach(link => {
            const href = link.getAttribute('href');

            // 判斷是否為當前頁面 (精確匹配或首頁特殊處理)
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

    // 2. 核心：ID、時間、主題標籤格式化
    function applyIdReformat(timeEl) {
        if (timeEl.dataset.processed === "done") return;

       let featureLayer = timeEl.parentElement;
        // 1. 改用 let 宣告，並修正選擇器括號
        let idElement = featureLayer.querySelector('a[href*="/@"]:not([href*="/post/"])');

        for (let i = 0; i < 8; i++) {
            if (idElement) {
                // 找到了就往上跳一層並結束迴圈
                featureLayer = featureLayer.parentElement;
                break;
            } else {
                featureLayer = featureLayer.parentElement;

                // 2. 防錯：如果爬到最頂端沒父節點了就停止
                if (!featureLayer) break;

                // 3. 重新在新的父層尋找 ID，同樣修正選擇器括號
                idElement = featureLayer.querySelector('a[href*="/@"]:not([href*="/post/"])');
            }
        }
       const postContainer = featureLayer;

            // 確保是該貼文的第一個時間標籤 (避免重複處理回覆內容)
            const firstTimeInPost = postContainer.querySelector('time');
            if (timeEl !== firstTimeInPost) {
                timeEl.dataset.processed = "done";
                return;
            }

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

    // 3. 核心：僅限首篇的內文縮排 (針對 /post/ 頁面)
    function handlePostPageIndent() {
        if (!window.location.href.includes('/post/')) return;

        // 1. 直接鎖定目標 Pagelet 節點 (這是詳情頁的主角區塊)
        const postPagelet = document.querySelector('[data-pagelet="threads_post_page_0"]');
        if (!postPagelet) return;

        // 2. 在這個 Pagelet 內抓取所有的 Header
        const headers = Array.from(postPagelet.querySelectorAll('div[style*="--x-columnGap"]')).filter(header => {
            return !!header.querySelector('a[href*="/@"]:not([href*="/post/"])');
        });

        headers.forEach((header, index) => {
            // 向上爬到足以看見左側「頭像與線條區」的容器
            const postArea = header.parentElement?.parentElement?.parentElement;
            if (!postArea) return;

            // 3. 動態找線：物理幾何特徵偵測 (寬度、背景色、絕對定位)
            const hasThreadLine = Array.from(postArea.querySelectorAll('div')).find(div => {
                const style = window.getComputedStyle(div);
                const hasBg = style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
                const isNarrow = parseInt(style.width) <= 5;
                const isAbsolute = style.position === 'absolute';
                return hasBg && isNarrow && isAbsolute;
            });

            // --- 核心邏輯修正 ---
            if (hasThreadLine) {
                // 【有線】：Meta 原生已縮排，依照要求：跳過不縮排
                // console.log(`Pagelet 內第 ${index} 篇有線，系統已處理，跳過`);
            } else {
                // 【沒線】：Meta 未縮排，依照要求：執行縮排
                // console.log(`Pagelet 內第 ${index} 篇沒線，執行腳本縮排`);
                applyIndent(header);
            }
        });
    }

    function applyIndent(header) {
        if (!header) return;
        const idWrapper = header.parentElement?.parentElement;
        let contentNode = idWrapper?.nextElementSibling;

        // 尋找真正的內文節點
        while (contentNode && contentNode.innerText.trim() === "" && contentNode.nextElementSibling) {
            contentNode = contentNode.nextElementSibling;
        }

        if (contentNode && !contentNode.dataset.indentDone) {
            contentNode.style.setProperty('margin-left', '50px', 'important');
            contentNode.style.setProperty('width', 'calc(100% - 50px)', 'important');
            contentNode.dataset.indentDone = "true";
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

    // 主執行迴圈
    function mainLoop() {
        updateNavActiveState(); // 更新導覽列金色狀態
        document.querySelectorAll('time').forEach(t => applyIdReformat(t));
        document.querySelectorAll('svg[aria-label="讚"]').forEach(i => applyButtonStyle(i));

        // 清理特殊字元
        cleanContent();
    }

    // 初始啟動
    mainLoop();

    // 監控網頁變化 (SPA 換頁時網址會變，所以需要持續監控)
    const observer = new MutationObserver(() => mainLoop());
    observer.observe(document.body, { childList: true, subtree: true });

})();
