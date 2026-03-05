// ==UserScript==
// @name         Threads Post Content De-duplicator
// @namespace    http://tampermonkey.net/
// @version      0.4.5
// @description  Automatically detect and hide duplicate replies caused by Pinned posts or Paginated threads (e.g., 1/2, 2/2) on the Threads post page.
// @author       Gemini, bixictn
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const getFingerprint = (node) => {
        if (!node) return null;
        const author = node.querySelector('a[href^="/@"]')?.getAttribute('href');
        const text = node.innerText?.trim().substring(0, 60).replace(/\s+/g, '');
        return author && text ? `${author}_${text}` : null;
    };

    const isPinned = (node) => {
        const text = node.innerText || "";
        return text.includes("已釘選") || text.includes("Pinned") ||
               !!(node.querySelector('svg title')?.innerHTML?.includes('Pinned'));
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

        // --- 1. 建立雙基準 ---
        // 基準 A: 固定 Index 1 (處理分頁重複)
        const baseAFingerprint = getFingerprint(nodes[1]);

        // 基準 B: 動態搜尋釘選 (處理釘選重複)
        let baseBFingerprint = null;
        let pinnedIndex = -1;
        for (let i = 0; i < Math.min(nodes.length, 4); i++) {
            if (isPinned(nodes[i])) {
                baseBFingerprint = getFingerprint(nodes[i]);
                pinnedIndex = i;
                break;
            }
        }

        // --- 2. 執行掃描與去除重複 ---
        // 為了安全，我們只對 Index 2 之後且非釘選正本的節點動手
        for (let i = 2; i < nodes.length; i++) {
            if (i === pinnedIndex) continue; // 絕對不要隱藏釘選正本

            const curFingerprint = getFingerprint(nodes[i]);
            if (!curFingerprint) continue;

            // 比對基準 A 或 基準 B
            if (curFingerprint === baseAFingerprint || curFingerprint === baseBFingerprint) {
                // 發現重複！直接隱藏
                hideNode(nodes[i]);
            }
        }
    };

    // 監控與換頁邏輯
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
