// ==UserScript==
// @name         Fix Threads Images
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Fix Threads images
// @author       bixictn
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* =========================
     * 圖片修正
     * ========================= */
    function fixImage(img) {
        if (img.dataset.fixed) return;

        const src = img.src || '';
        if (
            src.startsWith('blob:') ||
            src.includes('graph.facebook.com') ||
            /fbcdn\.net|cdninstagram\.com|profilecdn\.fb\.com/.test(src)
        ) {
            img.dataset.fixed = 'true';
            fetch(src)
                .then(r => r.blob())
                .then(b => {
                    img.src = URL.createObjectURL(b);
                })
                .catch(() => {});
        }
    }

    /* =========================
     * 處理文章
     * ========================= */
    function processArticle(article) {
        if (article.dataset.processed) return;
        article.dataset.processed = 'true';

        // 修正圖片
        article.querySelectorAll('img').forEach(fixImage);
    }

    // 初次掃描
    document.querySelectorAll('article, div[role="article"]').forEach(processArticle);

    /* =========================
     * MutationObserver：監控新增文章
     * ========================= */
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.matches?.('article, div[role="article"]')) {
                    processArticle(node);
                } else {
                    node.querySelectorAll?.('article, div[role="article"]')
                        .forEach(processArticle);
                    node.querySelectorAll?.('img')
                        .forEach(fixImage);
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
