// ==UserScript==
// @name         Threads Post Content De-duplicator
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @description  Automatically detect and hide duplicate replies caused by Pinned posts or Paginated threads (e.g., 1/2, 2/2) on the Threads post page.
// @author       Gemini, bixictn
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const findPaginationDetailed = (rootNode) => {
        if (!rootNode) return 0;

        let found = null;
        const allElements = rootNode.querySelectorAll('span, div');

        // 1. 直接匹配模式 (1/2)
        for (let el of allElements) {
            const text = el.innerText?.replace(/\s+/g, '');
            if (text && /^\d+\/\d+$/.test(text) && text.length <= 7) {
                found = text;
                break;
            }
        }

        // 2. 拆散型偵測
        if (!found) {
            const spans = Array.from(rootNode.querySelectorAll('span'));
            const slashIndex = spans.findIndex(s => s.innerText.trim() === '/');
            if (slashIndex > 0 && slashIndex < spans.length - 1) {
                const prev = spans[slashIndex - 1].innerText.trim();
                const next = spans[slashIndex + 1].innerText.trim();
                if (!isNaN(prev) && !isNaN(next)) found = `${prev}/${next}`;
            }
        }

        // 3. 轉為 Integer: 抓取斜線後的總頁數
        const match = found && found.match(/\/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    };

    const isPinnedNode = (node) => {
        if (!node) return false;
        const text = node.innerText || "";
        const hasPinText = text.includes("已釘選") || text.includes("Pinned");
        const hasPinIcon = node.querySelector('svg title')?.innerHTML?.includes('Pinned') ||
                           node.querySelector('svg')?.getAttribute('aria-label')?.includes('Pinned');
        return hasPinText || !!hasPinIcon;
    };

    const hideNode = (node) => {
        let container = node;
        while (container && container.parentElement && !container.parentElement.hasAttribute('data-virtualized')) {
            container = container.parentElement;
        }
        if (container && container.style.display !== 'none') {
            container.style.setProperty('display', 'none', 'important');
        }
    };

    const doCleanup = () => {
        if (!window.location.pathname.includes('/post/')) return;

        const nodes = document.querySelectorAll('div[data-pressable-container="true"]');
        if (nodes.length < 3) return;

        // 1. 動態取得總頁數作為搜尋邊界
        const totalPages = findPaginationDetailed(nodes[0]);
        const searchLimit = totalPages > 0 ? Math.min(nodes.length - 1, totalPages + 2) : 5;

        // 2. 分頁去重 (以 nodes[1] 為基準)
        const keyAuthor = nodes[1].querySelector('a[href^="/@"]')?.getAttribute('href');
        const keyText = nodes[1].innerText?.trim().substring(0, 50).replace(/\s+/g, '');

        if (keyAuthor && keyText) {
            for (let i = 2; i <= searchLimit; i++) {
                if (!nodes[i]) break;
                const curAuthor = nodes[i].querySelector('a[href^="/@"]')?.getAttribute('href');
                const curText = nodes[i].innerText?.trim().substring(0, 50).replace(/\s+/g, '');

                if (curAuthor === keyAuthor && curText === keyText) {
                    hideNode(nodes[i]);
                }
            }
        }

        // 3. 釘選去重
        fixPinnedDuplicates(nodes, searchLimit);
    };

    const fixPinnedDuplicates = (nodes, limit) => {
        let pinnedKey = null;

        // 搜尋釘選正本
        for (let i = 0; i <= limit; i++) {
            if (!nodes[i]) break;
            if (isPinnedNode(nodes[i])) {
                const author = nodes[i].querySelector('a[href^="/@"]')?.getAttribute('href');
                const text = nodes[i].innerText?.trim().substring(0, 60).replace(/\s+/g, '');
                if (author && text) {
                    pinnedKey = { author, text, originalIndex: i };
                    break;
                }
            }
        }

        // 隱藏副本
        if (pinnedKey) {
            for (let i = 0; i <= Math.min(nodes.length - 1, 12); i++) {
                if (i === pinnedKey.originalIndex) continue;
                const curAuthor = nodes[i].querySelector('a[href^="/@"]')?.getAttribute('href');
                const curText = nodes[i].innerText?.trim().substring(0, 60).replace(/\s+/g, '');
                if (curAuthor === pinnedKey.author && curText === pinnedKey.text) {
                    hideNode(nodes[i]);
                }
            }
        }
    };

    // --- 核心監控區 ---
    const observer = new MutationObserver(() => window.requestAnimationFrame(doCleanup));
    observer.observe(document.body, { childList: true, subtree: true });

    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            doCleanup();
        }
    }, 1000);

    doCleanup();
})();
