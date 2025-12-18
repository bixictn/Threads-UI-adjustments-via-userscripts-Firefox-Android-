// ==UserScript==
// @name         Threads ID & LeeSuThreads
// @namespace    http://tampermonkey.net/
// @version      0.1.2
// @description   ID & Date 
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

        const idEl = postContainer.querySelector('a[href*="/@"]');
        const pluginBadge = postContainer.querySelector('.threads-profile-info-badge[title]');

        if (!idEl || !pluginBadge) return;

        const p = document.createElement('div');
        p.textContent = pluginBadge.title;
        p.style.marginBottom = '2px';
        p.style.fontSize = '13px';
        p.style.lineHeight = '1.3em';

        idEl.before(p);
        //alert("plugin data: " + pluginBadge.title); // debug alert

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
