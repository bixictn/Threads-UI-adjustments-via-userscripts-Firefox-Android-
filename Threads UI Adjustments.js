// ==UserScript==
// @name         Threads UI Adjustments
// @namespace    http://tampermonkey.net/
// @version      0.7.7
// @description  Threads UI Adjustments
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1.  CSS
    const style = document.createElement('style');
    style.textContent = `
        a[href^="intent://"], a[href*="itunes.apple.com"], a[href*="play.google.com"] { display: none !important; }
        html, body { overflow-x: hidden !important; }
        nav svg { transform: scale(0.5) !important; transform-origin: center center !important; }
        div span > span { font-size: 18px !important; }

        .custom-stack-2x2 {
            display: grid !important;
            grid-template-columns: repeat(2, 85px) !important;
            gap: 8px 15px !important;
            width: fit-content !important;
            margin-top: 10px !important;
            align-items: center !important;
        }
    `;
    document.head.appendChild(style);

    // 2.  ID
    function applyIdReformat(timeEl) {
        if (timeEl.dataset.processed === "done") return;

        let postContainer = timeEl.parentElement;
        for(let i=0; i<8; i++) {
            if(postContainer && (postContainer.tagName === 'ARTICLE' || postContainer.getAttribute('data-testid') === 'post-container')) break;
            if(postContainer) postContainer = postContainer.parentElement;
        }
        if (!postContainer) return;

        // time label
        const firstTimeInPost = postContainer.querySelector('time');
        if (timeEl !== firstTimeInPost) {
            timeEl.dataset.processed = "done";
            return;
        }

        const idElement = postContainer.querySelector('a[href*="/@"]');
        const subjectLink = postContainer.querySelector('a[href*="/search?q="]');

        if (idElement) {
            const infoLine = document.createElement('div');
            infoLine.style.cssText = 'display: flex; gap: 6px; align-items: center; margin-bottom: 2px; font-size: 13px; width: 100%;';

            const t = document.createElement('span');
            const rawTime = timeEl.textContent.trim();

            // Date check
            const isDateForm = rawTime.includes('-');
            t.textContent = isDateForm ? rawTime : (rawTime + "前");

            t.style.cssText = 'color: #777;';
            infoLine.appendChild(t);

            let hasSubject = false;
            if (subjectLink) {
                const s = document.createElement('a');
                s.href = subjectLink.href;
                s.textContent = `<${subjectLink.innerText.trim()}>`;
                s.style.cssText = 'color: #0095f6; font-size:16px;font-weight: bold; text-decoration: none;';
                s.onmouseover = () => { s.style.textDecoration = 'underline'; };
                s.onmouseout = () => { s.style.textDecoration = 'none'; };
                infoLine.appendChild(s);
                subjectLink.style.display = 'none';
                hasSubject = true;
            }
            const br = document.createElement('br');
            idElement.after(br);
            idElement.after(infoLine);

            timeEl.dataset.processed = "done";
            timeEl.style.visibility = 'hidden';
            timeEl.style.height = '0';
            timeEl.style.position = 'absolute';
        }
    }

    // 3. 2x2 button
    function applyButtonStyle(likeIcon) {
        let container = likeIcon.parentElement;
        let depth = 0;
        while (container && depth < 6) {
            if (container.children.length >= 3 && container.children.length <= 5) {
                if (container.dataset.styled) return;
                container.dataset.styled = '1';
                container.classList.add('custom-stack-2x2');

                Array.from(container.children).forEach((wrapper, index) => {
                    wrapper.style.display = 'flex';
                    wrapper.style.alignItems = 'center';
                    wrapper.style.justifyContent = 'flex-start';
                    wrapper.style.minHeight = '32px';

                    const btn = wrapper.querySelector('[role="button"]');
                    if (!btn) return;
                    btn.style.display = 'flex';
                    btn.style.alignItems = 'center';
                    btn.style.gap = '5px';

                    const svg = btn.querySelector('svg');
                    const countSpan = btn.querySelector('span');
                    if (svg) {
                        svg.style.transform = 'scale(1.2)';
                        const label = svg.getAttribute('aria-label');
                        if (btn.textContent.includes('轉發') || (label && label.includes('轉貼')) || index === 2) {
                            btn.style.transform = 'translateX(-0.3em)';
                        }
                    }
                    if (countSpan && countSpan.innerText.trim() !== "") {
                        countSpan.style.display = 'inline-flex';
                        countSpan.style.alignItems = 'center';
                        countSpan.style.transform = 'translate(5px, 4.2px)';
                    } else if (countSpan) {
                        countSpan.style.display = 'none';
                    }
                });
                break;
            }
            container = container.parentElement;
            depth++;
        }
    }

    function mainLoop() {
        document.querySelectorAll('time').forEach(t => applyIdReformat(t));
        document.querySelectorAll('svg[aria-label="讚"]').forEach(i => applyButtonStyle(i));
    }

    mainLoop();
    const observer = new MutationObserver(() => mainLoop());
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(mainLoop, 500);

})();
