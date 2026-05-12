// ==UserScript==
// @name         Threads PWA Gesture Adjustments
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @version      0.2.9
// @description  Threads PWA Gesture Adjustments
// @author       Gemini
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    let lastPath = window.location.pathname;
    let targetScrollY = 0;
    let scrollHistory = {}, replylist=[];
    const TAG = "#pwa_guard";
    const SESSION_KEY = "pwa_guard_session_console.loged";
    let isDeployed = false,debug=false;

    const state = {
        isPageChange: false,
        isBackAction: false,
        isStartTouch: false,
        isInterval: false,
        isDMAction: false,
        isMediaAction: false,
        userDMAction: false
    };



    window.THREADS_PWA = {
        toTopActive: () => { if(debug)console.log('other js have to top');toTop(); },
        setLastPath: (path) => {lastPath=path;},
        setDMAction: (dma) =>{if(debug)console.log('other js have to '+dma+' DMAction');state.isDMAction=dma;state.userDMAction=dma},
        get getLastPath() { return lastPath; }, 
        get isBackAction() { return state.isBackAction; } 
    };

    function toTop(){
        if (!state.isBackAction) {
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

    window.addEventListener('scroll', () => {
        if (state.isStartTouch) {
            scrollHistory[window.location.pathname] = window.scrollY;
        }
    }, { passive: true });

    window.addEventListener('popstate', (e) => {
        state.isStartTouch=false;

        if(state.isMediaAction){
            state.isMediaAction=false;
            return;
        }
        if(!state.isBackAction)state.isBackAction=true;
        const currentPath = window.location.pathname;
        if(debug)console.log('======================================');
        if(debug)console.log(lastPath+"\n"+currentPath);
        if(debug)console.log('popstate:PageChange -> '+state.isPageChange+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction+' : is Media -> '+state.isMediaAction);
        if(lastPath!==currentPath){
            lastPath=currentPath;
            state.isPageChange=true;
        }
        state.userDMAction=state.isBackAction && state.isInterval;
        if(debug) console.log('modify popstate:PageChange -> '+state.isPageChange+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction+' : is Media -> '+state.isMediaAction);

        if (state.userDMAction && !state.isDMAction) {
            if(debug)console.log('user DM Action!!!');
            setScrollLocation(currentPath,e);

            if (window.THREADS_UI) window.THREADS_UI.ActiveHideBlackout();
            return;

        }


        window.THREADS_UI.ActiveShowBlackout();

        const menu = document.querySelector('[role="menu"]');
        const dialog = document.querySelector('[role="dialog"]');

        if (state.isDMAction) {
            window.THREADS_UI.ActiveHideBlackout();
            if (menu) {
                closeDialogPopupMenu();
                if(debug) console.log('攔截：關閉 PopupMenu');
                state.isDMAction=false;
                return;
            }

            if (dialog) {
                if (closeReplyDialog()) {
                    if(debug) console.log('攔截：關閉 Dialog');
                    state.isDMAction=false;
                    return; 
                }
            }
        }
        else{
            checkPath(currentPath,e);
            deepCleanEmojiMemory()
        }

        setScrollLocation(currentPath,e);

    },true);

    function setScrollLocation(currentPath,e){


        const savedPos = scrollHistory[currentPath];
        if(savedPos === undefined){
            setTimeout(() => {
                if (currentPath === "/") {
                    if (!window.location.hash.includes(TAG)) {
                        if(debug)console.log("🛡️ 抵達首頁，部署 PWA 防護罩");
                        history.pushState({ pwa: "guard" }, "", currentPath + TAG);
                    }
                }
                state.isBackAction = false;
                state.isInterval=false;
                state.isDMAction=false;
                state.userDMAction=false;
                state.isMediaAction=false;
                state.isPageChange = false;
            }, 300);
            return;
        }
        const targetY = (state.isBackAction || state.isDMAction || state.isMediaAction || state.isInterval) ? savedPos : 0;
        state.isBackAction = true;
        state.isInterval = true;

        if(debug)console.log(`[Start] 準備捲動至: ${targetY} (Path: ${currentPath})`);

        executeAfterScroll(targetY, () => {

            targetScrollY = window.scrollY;
            let attempts = 0;
            const recoverScroll = setInterval(() => {
                window.scrollTo(0, targetY);
                attempts++;
                if(debug)console.log("setLocation:"+currentPath+":"+targetY+'Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction);

                if (attempts > 30 || Math.abs(window.scrollY - savedPos) < 2) {
                    clearInterval(recoverScroll);
                    setTimeout(() => {
                        state.isBackAction = false;
                    }, 200);
                }
            }, 30);

            setTimeout(() => {
                if (currentPath === "/") {
                    if (!window.location.hash.includes(TAG)) {
                        if(debug)console.log("🛡️ 抵達首頁，部署 PWA 防護罩");
                        history.pushState({ pwa: "guard" }, "", currentPath + TAG);
                    }
                }
                state.isBackAction = false;
                state.isInterval=false;
                state.isDMAction=false;
                state.userDMAction=false;
                state.isMediaAction=false;
                state.isPageChange = false;
            }, 300);
        });

    }

    function executeAfterScroll(targetY, callback) {
        let attempts = 0;
        const maxAttempts = 60; 

        const check = () => {
            const currentY = window.scrollY;
            attempts++;

            if (Math.abs(currentY - targetY) <= 2 || attempts >= maxAttempts) {
                requestAnimationFrame(() => {
                    if(debug)console.log(`[ScrollFix] 已到位: ${window.scrollY}, 耗時: ${attempts} 畫格`);
                    callback();
                });
            } else {
                requestAnimationFrame(check);
            }
        };

        window.scrollTo(0, targetY);
        requestAnimationFrame(check);
    }


    function checkPath(cPath,e){

        const isCurrentlyHome = (cPath === "/");

        if (isCurrentlyHome && state.isPageChange) {
            if(debug)console.log("🔙 返回首頁：保留原始位置");
            state.userDMAction=true;
            state.isInterval=false;
        }
        else if (isCurrentlyHome && !state.isPageChange ) {
            if(debug)console.log("check path:"+cPath+": BackAction:"+state.isBackAction+" DMAction:"+state.isDMAction+": MeidaAction:"+state.isMediaAction);
            if(window.scrollY>100){
                if(debug)console.log("🔝 首頁再次返回：捲動回頂端");
                scrollHistory[cPath]=0;
                toTop();
                e.stopImmediatePropagation();
            }
            else{
                if(debug)console.log('to Logo');
                clickLogo();

            }
            window.THREADS_UI.ActiveHideBlackout();
        }
    }

    function clickLogo(){
        const logo = document.getElementById('barcelona-header');
        const alink = logo.querySelector('a[href="/"][role="link"]');

        if(alink && state.isInterval){
            toClick(alink);
        }
    }
    function deepCleanEmojiMemory() {
        if(debug)console.log("Threads UI Adj: 執行深層記憶體清理...");

        const locks = document.querySelectorAll('.tw-p-lock');
        locks.forEach(el => {
            const img = el.querySelector('img');
            if (img && img.alt) {
                el.replaceWith(document.createTextNode(img.alt));
            } else {
                el.remove();
            }
        });

        const resetEvent = new CustomEvent('twemoji-reset-request', {
            detail: { timestamp: Date.now() },
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(resetEvent);
    }


    function DialogPopupMenuOpen(el) {
        if (history.state?.type === `${el}_open`) return;
        const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

        if(checkIsMobile()) {
            history.replaceState({ type: `${el}_open` }, '');
            if(debug) console.log(`📱 [手機版] 僅標記當前狀態，不推入新紀錄: ${el}`);
        }
        else {
            history.pushState({ type: `${el}_open` }, '');
            if(debug) console.log(`🖥️ [桌面版] 推入虛擬紀錄: ${el}`);
        }
        if(debug) console.log('推入虛擬紀錄');
    }

    function checkIsMobile() {
        const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
        const isMobileUA = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

        return hasCoarsePointer || isMobileUA;
    }

    function closeDialogPopupMenu() {
        const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
            view: window
        });

        document.dispatchEvent(escEvent);
        if(debug) console.log('關閉選單');
    }

    function closeReplyDialog() {
        const cancelButton = Array.from(document.querySelectorAll('div[role="button"]'))
        .find(el => el.innerText === '取消' || el.textContent === '取消');

        if (cancelButton) {
            toClick(cancelButton);
            return true;
        }

        const sv = document.getElementById('scrollview');
        if (sv) {
            const backdrop = document.elementFromPoint(10, 10);
            if (backdrop) {
                toClick(backdrop);
                return true;
            }
        }
        return false;
    }

    function toClick(el){
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        el.dispatchEvent(clickEvent);
        if(debug) console.log(el.innerHTML+'clicked');
    }

    function doDeploy() {
        if (window.location.pathname !== "/") return;
        if (window.location.hash.includes(TAG)) return;
        if (!sessionStorage.getItem(SESSION_KEY)) {
            if(checkIsMobile())alert('加強返回鍵!!!')
            sessionStorage.setItem(SESSION_KEY, "true");
        };

        try {
            history.replaceState({pwa: "base"}, "", window.location.pathname);
            history.pushState({pwa: "guard"}, "", window.location.pathname + TAG);
            isDeployed = true;
            if(debug) console.log("✅ PWA Guard 已部署");
        } catch (e) {if(debug) console.log('deploy failed');}
    }

    ['touchstart', 'wheel'].forEach(evt => {
        window.addEventListener(evt, () => {
            state.isStartTouch = true;
            if (!isDeployed) doDeploy();
        }, { passive: true });
    });

    const rawBack = history.back;
    history.back = function() {
        state.userDMAction=true;
        if(debug) console.log('check back action: Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction);

        return rawBack.apply(this, arguments);
    };

    const _ps = history.pushState;
    history.pushState = function() {
        state.isStartTouch=false;
        _ps.apply(this, arguments);
        const currentPath = window.location.pathname;
        if(debug) console.log('nowpage:'+currentPath+'\nlastpage:'+lastPath);
        if(lastPath !== currentPath){
            window.THREADS_UI.ActiveShowBlackout();
            if(currentPath.endsWith('/'))delete scrollHistory[currentPath];
            lastPath = currentPath;
            state.isPageChange=true;
            state.userDMAction=true;
        }
        else{
            state.isInterval = true;
            state.isPageChange=false;
        }
        if(debug) console.log('modify pushstate:PageChange:'+state.isPageChange+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction+':'+state.isStartTouch);
        isDeployed = false;
    };

    const pwaObserver = new MutationObserver((mutations) => {

        const currentPath=window.location.pathname;
        if(!state.isStartTouch || state.isMediaAction)return;
        if(currentPath.endsWith('/media')){
            state.isMediaAction=true;
            return;
        }

        const uiElements = document.querySelectorAll('[role="menu"], [role="dialog"]');
        const node = document.querySelectorAll('[class*="__fb"]');
        const mode = (checkIsMobile)?1:2;
        if(debug) if(node.length>mode)console.log("DM node:"+(node.length-1)+'***'+uiElements.length+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction);

        if (!state.isDMAction) {
            for (const el of uiElements) {
                const style = window.getComputedStyle(el);
                if(debug) console.log("check DM node:"+(node.length-1)+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction);
                const role = el.getAttribute('role');

                const isVisible = style.opacity !== "0" && style.visibility !== "hidden" && style.display !== "none";
                if (!isVisible) continue;

                const hasHeight = el.offsetHeight > 0 || el.getBoundingClientRect().height > 0;
                const isMobileModal = role === 'dialog' && el.getAttribute('aria-modal') === 'true';

                if (!hasHeight && !isMobileModal) continue;

                // --- 條件 C：過濾空殼提示框 ---
                const isRealMenu = el.querySelector('[role="menuitem"]') || el.innerText.length > 2;
                if (!isRealMenu) continue;

                // --- 執行區：確定是「有效選單」 ---
                state.isDMAction = true;
                state.isInterval = true;

                if (!el.dataset.backButtonHandled) {
                    el.dataset.backButtonHandled = "true";
                    const type = role === 'menu' ? 'popupmenu' : 'dialog';
                    if(debug) console.log(`🎯 成功攔截顯示中的選單: ${type} (高度: ${hasHeight}, Modal: ${isMobileModal})`);
                    DialogPopupMenuOpen(type);
                }
                break;
            }
        }

        // 2. 同步清理：如果畫面選單消失了，重設狀態
        if (state.isDMAction && !state.userDMAction && uiElements.length === 0) {
            if(debug) console.log('DM dis:PageChange:'+state.isPageChange+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction);
            if (history.state?.type?.endsWith('_open')) {
                if(debug) console.log('_close');
                history.back();
            }
        }
    });

    // 啟動監控
    pwaObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true, 
        attributeFilter: ['class', 'style']
    });
})();
