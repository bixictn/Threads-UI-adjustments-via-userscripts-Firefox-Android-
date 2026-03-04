// ==UserScript==
// @name         Threads Post Content De-duplicator
// @namespace    http://tampermonkey.net/
// @version      0.3.9
// @description  Automatically detect and hide duplicate replies caused by Pinned posts or Paginated threads (e.g., 1/2, 2/2) on the Threads post page.
// @author       Gemini, bixictn
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const getPagination = (node) => {
        if (!node) return null;
        const allSpans = node.querySelectorAll('span');
        for (let span of allSpans) {
            const text = span.innerText?.replace(/\s+/g, '');
            if (text && /^\d+\/\d+$/.test(text) && text.length <= 7) return text;
        }
        return null;
    };

    const isPinnedNode = (node) => {
        if (!node) return false;
        const text = node.innerText || "";
        const hasPinText = text.includes("已釘選") || text.includes("Pinned");
        const hasPinIcon = !!(node.querySelector('svg title')?.innerHTML?.includes('Pinned') ||
                             node.querySelector('svg')?.getAttribute('aria-label')?.includes('Pinned'));
        return hasPinText || hasPinIcon;
    };

    const hideContainer = (node) => {
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
        if (nodes.length < 2) return;

        // --- 1. 釘選去重邏輯 (優先處理) ---
        let pinnedKey = null;
        for (let i = 0; i < Math.min(nodes.length, 4); i++) {
            if (isPinnedNode(nodes[i])) {
                const author = nodes[i].querySelector('a[href^="/@"]')?.getAttribute('href');
                const text = nodes[i].innerText?.trim().substring(0, 60).replace(/\s+/g, '');
                if (author && text) {
                    pinnedKey = { author, text, index: i };
                    break;
                }
            }
        }

        if (pinnedKey) {
            for (let i = 0; i < Math.min(nodes.length, 12); i++) {
                if (i === pinnedKey.index) continue;
                const author = nodes[i].querySelector('a[href^="/@"]')?.getAttribute('href');
                const text = nodes[i].innerText?.trim().substring(0, 60).replace(/\s+/g, '');
                if (author === pinnedKey.author && text === pinnedKey.text) hideContainer(nodes[i]);
            }
        }

        // --- 2. 分頁去重邏輯 (以 Index 1 為基準) ---
        if (nodes.length >= 3) {
            const keyAuthor = nodes[1].querySelector('a[href^="/@"]')?.getAttribute('href');
            const keyText = nodes[1].innerText?.trim().substring(0, 60).replace(/\s+/g, '');
            const keyPage = getPagination(nodes[1]);

            if (keyAuthor && keyText) {
                for (let i = 2; i < Math.min(nodes.length, 6); i++) {
                    const curAuthor = nodes[i].querySelector('a[href^="/@"]')?.getAttribute('href');
                    const curText = nodes[i].innerText?.trim().substring(0, 60).replace(/\s+/g, '');
                    const curPage = getPagination(nodes[i]);
                    if (curAuthor === keyAuthor && curText === keyText && curPage === keyPage) hideContainer(nodes[i]);
                }
            }
        }
    };

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
