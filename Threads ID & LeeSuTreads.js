// ==UserScript==
// @name  Threads ID & Lee Su Threads
// @namespace    http://tampermonkey.net/
// @version      0.1.2
// @description  Show Date
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function addPluginData(timeEl) {

        if (timeEl.dataset.processedPlugin === "done") return;

        let postContainer = timeEl.parentElement;
        for(let i=0; i<8; i++) {
            if(postContainer && (postContainer.tagName === 'ARTICLE' || postContainer.getAttribute('data-testid') === 'post-container')) break;
            if(postContainer) postContainer = postContainer.parentElement;
        }
        if (!postContainer) return;

        const allLinks = Array.from(postContainer.querySelectorAll('a[href*="/@"]'));
        const idEl = allLinks.find(link => {
            return link.innerText.trim().length > 0 && !link.querySelector('img') && !link.closest('[dir="auto"]');
        });

        const pluginBadge = postContainer.querySelector('.threads-profile-info-badge[title]');
        if (!idEl || !pluginBadge) return;

        if (idEl.previousElementSibling && idEl.previousElementSibling.textContent.includes("🍰")) {
            timeEl.dataset.processedPlugin = "done";
            return;
        }

        const p = document.createElement('div');
        p.className = "my-cake-plugin";
        p.textContent = "🍰 " + pluginBadge.title.replace(/^.*•\s*/, '').replace(/加入時間[:：]\s*/, '').trim();
        p.style.cssText = 'margin-bottom: 2px; font-size: 13px; line-height: 1.3em;';

        idEl.before(p);

        timeEl.dataset.processedPlugin = "done";
    }

    function mainLoop() {
        document.querySelectorAll('time').forEach(t => addPluginData(t));
    }

    mainLoop();
    const observer = new MutationObserver(mainLoop);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(mainLoop, 500);
})();
