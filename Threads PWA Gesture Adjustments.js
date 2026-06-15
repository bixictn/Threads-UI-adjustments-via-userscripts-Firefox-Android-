// ==UserScript==
// @name         Threads PWA Gesture Adjustments
// @match        https://www.threads.com/*
// @match        https://www.threads.net/*
// @version      0.3.4.1
// @description  Threads PWA Gesture Adjustments
// @author       Gemini
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    let lastPath = window.location.pathname;
    let targetScrollY = 0;
    let scrollHistory = {}, replylist= new Set(),replylength=0;
    const TAG = "#pwa_guard";
    const SESSION_KEY = "pwa_guard_session_console.loged";
    let isDeployed = false,debug=false;
    let isPanelVisible = false, dialogthenpopmenu=false;
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
        setDMAction: (dma) =>{if(debug)console.log('other js have to '+dma+' DMAction');state.isDMAction=false;state.userDMAction=dma},
        get getLastPath() { return lastPath; },
        get isBackAction() { return state.isBackAction; },
        get isStartTouch() { return state.isStartTouch; },
        checkIsMobile: () =>{checkIsMobile();}
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

    function pwaGuard(currentPath){
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
        //state.userDMAction=state.isBackAction && state.isInterval;
        if(debug) console.log('modify popstate:PageChange -> '+state.isPageChange+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction+' : is Media -> '+state.isMediaAction);

        if (state.userDMAction) {

            if(debug)console.log('user DM Action!!!');
            setScrollLocation(currentPath,e);

            return;

        }

        const menu = document.querySelector('[role="menu"]');

        const replay = document.querySelector('[aria-hidden="false"]');
        if(replay && state.isBackAction){
            if(debug)console.log(checkIsMobile());

            if(dialogthenpopmenu){
                closeDialogPopupMenu();
                if(debug) console.log('攔截：關閉 PopupMenu');
                dialogthenpopmenu=false;
                e.stopImmediatePropagation();
                return;
            }

            if (closeReplyDialog(e)) {
                if(debug) console.log('攔截：關閉 Dialog=====:'+replylist.size);
                e.stopImmediatePropagation();
                return;
            }
        }
        else{
            if (state.isDMAction && state.isBackAction) {
                if (menu) {
                    if(!checkIsMobile()) closeDialogPopupMenu();
                    if(debug) console.log('攔截：關閉 PopupMenu');
                    isPanelVisible=false;
                    e.stopImmediatePropagation();
                    return;
                }
            }

            if (window.THREADS_UI && (!menu && !replay)) window.THREADS_UI.ActiveShowBlackout();
            if(checkPath(currentPath,e)){
                pwaGuard(currentPath);
                return;
            }

            deepCleanEmojiMemory()
            setScrollLocation(currentPath,e);

        }
    },true);

    function setScrollLocation(currentPath,e){


        const savedPos = scrollHistory[currentPath];
        if(savedPos === undefined){
            pwaGuard(currentPath);
            return;
        }

        const targetY = (state.isPageChange || state.isBackAction || state.isDMAction || state.isMediaAction || state.isInterval) ? savedPos : 0;
        //state.isBackAction = true;
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

            pwaGuard(currentPath);
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
            return false;
        }
        else if (isCurrentlyHome && !state.isPageChange ) {
            if(debug)console.log("check path:"+cPath+": BackAction:"+state.isBackAction+" DMAction:"+state.isDMAction+": MeidaAction:"+state.isMediaAction);
            if(window.scrollY>100){
                if(debug)console.log("🔝 首頁再次返回：捲動回頂端");
                window.scrollTo(10,0);
                scrollHistory[cPath]=0;
                return true;
            }
            else{
                if(debug)console.log('click Logo');
                window.scrollTo(0,0);
                clickLogo();
                return true;
            }
        }
        return false;
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

        if(checkIsMobile()) {
            if(el.includes('reply')){
                history.pushState({ type: `${el}_open` }, '');
                if(debug) console.log(`📱 [手機版] 推入虛擬紀錄: ${el}`);
            }
            else{
                history.replaceState({ type: `${el}_open` }, '');
                if(debug) console.log(`📱 [手機版] 僅標記當前狀態，不推入新紀錄: ${el}`);
            }
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
        if(debug) console.log('click esc 關閉選單');
    }

    function closeReplyDialog(e) {
        const other = document.querySelector('[aria-hidden="false"]');
        const checkother = other.querySelector('[aria-label="返回"]');
        const cancelButton = checkother?checkother:Array.from(other.querySelectorAll('div[role="button"]'))
        .find(el => el.innerText === '取消' || el.textContent === '取消');

        if (cancelButton) {
            toClick(cancelButton);
            replylist.delete(cancelButton);
            if(replylist.size===0)isPanelVisible=false;
            e.stopImmediatePropagation();
            return true;
        }
        else{
            closeDialogPopupMenu();
            e.stopImmediatePropagation();
            return true;
        }
        return false;
    }

    function clickLogo(){
        const logos = document.querySelectorAll('[aria-label="Threads"');;
        const logo = (logos.length>1)?logos[1]:logos[0];
        if (!logo) return;
        const alink = logo.closest('a[href="/"][role="link"]');
        if(alink && !state.isInterval){
            if(debug) console.log('嘗試點擊 Logo 觸發首頁刷新...');
            const targetElement = alink.querySelector('svg');
            toClick(targetElement);
        }
    }

    function toClick(el){
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
            const event = new MouseEvent(evtType, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: evtType.includes('down') ? 1 : 0
            });
            el.dispatchEvent(event);
        });
        if(debug) console.log(el.innerHTML+'clicked');
    }

    function doDeploy() {
        if (window.location.pathname !== "/") return;
        if (window.location.hash.includes(TAG)) return;
        if (!sessionStorage.getItem(SESSION_KEY)) {
            if(checkIsMobile())alert('加強返回鍵!!!');

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
        }, { passive: true, capture: true });
    });

    window.addEventListener('mousemove', () => {
        state.isStartTouch = true;
    }, { passive: true, capture: true });

    const rawBack = history.back;
    history.back = function() {
        state.isDMAction=true;
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
            if (window.THREADS_UI && !isPanelVisible) window.THREADS_UI.ActiveShowBlackout();
            if(currentPath.endsWith('/'))delete scrollHistory[currentPath];
            lastPath = currentPath;
            state.isPageChange=true;
            state.isDMAction=true;
        }
        else{
            state.isInterval = true;
            state.isPageChange=false;
        }
        if(debug) console.log('modify pushstate:PageChange:'+state.isPageChange+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction+':'+state.isStartTouch);
        isDeployed = false;
        if(isPanelVisible)state.isStartTouch=true;
    };

    const pwaObserver = new MutationObserver((mutations) => {
        if(window.THREADS_UI){
            const savedScroll = scrollHistory[window.location.pathname];
            const isScrollMatch = savedScroll === undefined || Math.abs(savedScroll - window.scrollY) < 5;

            if (isScrollMatch && window.THREADS_UI.blackoutstatus) {
                let loading=document.querySelector('[data-visualcompletion="loading-state"]');
                const checks = document.querySelectorAll('[data-pagelet^="threads_feed"],[data-pagelet^="threads_post_page"]');
                for (const check of checks) {
                    if (check.textContent.trim().length > 50 && loading && window.THREADS_UI.blackoutstatus) {
                        setTimeout(() => {
                            window.THREADS_UI.ActiveHideBlackout();
                        },1500);
                        break;
                    }
                }
            }
        }
        const currentPath = window.location.pathname;
        const reply = document.querySelector('[aria-hidden="false"]');
        isPanelVisible=reply?true:false;
        if(isPanelVisible)state.isStartTouch=true;
        else replylist.clear();

        if (!state.isStartTouch || state.isMediaAction ) {
            return;
        }

        if (currentPath.endsWith('/media')) {
            state.isMediaAction = true;
            return;
        }


        let activePanelType = null;

        if (reply) {
            if(debug)console.log('reply showing');

            const node = document.querySelectorAll('[class*="__fb"]');
            if(node.length<=1)return;

            const popmenu = node[1].querySelector('[role="menu"]')
            if(popmenu){
                if (!popmenu.dataset.backButtonHandled) {
                    popmenu.dataset.backButtonHandled = "true";
                    const type = 'popupmenu';
                    if(debug) console.log(`🎯 成功攔截顯示中的選單: ${type} `);
                    dialogthenpopmenu = true;
                    activePanelType = type;
                }
            }
            else{

                activePanelType = 'reply'+reply.querySelectorAll('*').length;
                const other = document.querySelector('[aria-hidden="false"]');
                const checkother = other.querySelector('[aria-label="返回"]');
                const cancelButton = checkother?checkother:Array.from(other.querySelectorAll('div[role="button"]'))
                .find(el => el.innerText === '取消' || el.textContent === '取消');

                if(!replylist.has(cancelButton) && cancelButton){
                    replylist.add(cancelButton);
                }

                if(replylength!==replylist.size){
                    replylength=replylist.size;
                    state.isDMAction = false;
                }
            }
        }
        else{   

            const node = document.querySelectorAll('[class*="__fb"]');
            if(node.length<=1)return;
            const uiElements = node[1].querySelectorAll(`
                [role="menu"],
                [role="dialog"]
            `);
            if(!uiElements)return;


            const mode = (checkIsMobile)?1:2;
            if(debug) if(node.length>mode)console.log("DM node:"+(node.length-1)+'***'+uiElements.length+' Back Active ->'+state.isBackAction+' DM Active ->'+state.isDMAction+' : Interval Active -> '+state.isInterval+': User DMActive -> '+state.userDMAction);

            if (!state.isDMAction) {
                console.log('no reply');

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



                    if (!el.dataset.backButtonHandled) {
                        el.dataset.backButtonHandled = "true";
                        const type = role === 'menu' ? 'popupmenu' : 'dialog';
                        if(debug) console.log(`🎯 成功攔截顯示中的選單: ${type} (高度: ${hasHeight}, Modal: ${isMobileModal})`);
                        isPanelVisible = true;
                        activePanelType = type;
                        dialogthenpopmenu = true;
                    }
                }
            }
        }

        if (isPanelVisible ) {
            if(!activePanelType)return;
            // 狀況 A：畫面上【有】面板，且腳本還沒記錄過 (剛打開)
            // panel visible, isDMAction, dialog then popmenu
            // 1              0           0
            // 1              1           0
            // 1              1           1
            if (!state.isDMAction) {
                if (debug) console.log(`🎯 偵測到面板開啟: ${activePanelType}`);
                state.isDMAction = true;
                state.isInterval = true;
                DialogPopupMenuOpen(activePanelType);
            }

            if(state.isDMAction && dialogthenpopmenu){
                if (debug) console.log(`🎯 偵測到面板開啟: ${activePanelType}`);
                state.isDMAction = true;
                state.isInterval = true;
                DialogPopupMenuOpen(activePanelType);
            }
        } else {
            // 2. 同步清理：如果畫面選單消失了，重設狀態
            if (state.isDMAction) {
                if(debug) console.log('not visible, 準備同步清理紀錄');
                if (history.state?.type?.endsWith('_open')) {
                    if(debug) console.log('_close 觸發');

                    if (!state.isBackAction && !checkIsMobile()) {
                        history.back();
                    }
                }

                state.isDMAction = false;
                state.isBackAction = false;
                state.userDMAction = false;
            }
        }

    });

    // 啟動監控
    pwaObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true
    }, { passive: true, capture: true });
})();
