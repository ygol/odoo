odoo.define('web.WebClient', function (require) {
    "use strict";


    const { ActionContainer } = require('web.ActionContainer');
    const ActionManager = require('web.ActionManager');
    const { useListener } = require('web.custom_hooks');
    const { ComponentAdapter } = require('web.OwlCompatibility');
    const DialogAction = require('web.DialogAction');
    const LoadingWidget = require('web.Loading');
    const Menu = require('web.Menu');
    const RainbowMan = require('web.RainbowMan');
    const LegacyDialog = require('web.Dialog');
    const WarningDialog = require('web.CrashManager').WarningDialog;
    const KeyboardNavigation = require('web.KeyboardNavigation');

    const { hooks } = owl;
    const { useRef, useExternalListener } = hooks;

    class WebClient extends KeyboardNavigation {
        // TODO:
        // Move URL stuff elsewhere
        // then updateState may be moved too !
        constructor() {
            super();
            this.LoadingWidget = LoadingWidget;
            //useExternalListener(window, 'hashchange', this._onHashchange);
            useExternalListener(window, 'popstate', this._onHashchange);
            useListener('click', this._onGenericClick);

            this.mainRef = useRef('mainRef');
            this.menu = useRef('menu');
            ActionManager.useActionManager();

            // the state of the webclient contains information like the current
            // menu id, action id, view type (for act_window actions)...
            this.ignoreHashchange = false;
            this.urlState = {};
            this._titleParts = {};

            // FIXME: get rid of bus event, or manage them as they should
            // in particular, remove at destroy
            this.env.bus.on('show-effect', this, this._onShowEffect);
            this.env.bus.on('connection_lost', this, this._onConnectionLost);
            this.env.bus.on('connection_restored', this, this._onConnectionRestored);
            this.env.bus.on('set_title_part', this, payload => this._onSetTitlePart({ detail: payload }));

            this.controllerComponentMap = new Map();
            this.allComponents = this.constructor.components;
        }
        get actionManager() {
            return this.env.actionManager;
        }
        get menuID() {
            const localStack = this.actionManager.currentStack.slice().reverse();
            let menuID;
            for (const ctID of localStack) {
                const { controller } = this.actionManager.getFullDescriptorsFromControllerID(ctID); 
                menuID = controller.options && controller.options.menuID;
                if (menuID) {
                    break;
                }
            }
            if (!menuID) {
                const { main } = this.actionManager.activeDescriptors;
                if (this.urlState.menu_id) {
                    menuID = this.urlState.menu_id;
                } else if (main) {
                    const menu = Object.values(this.menus).find(menu => {
                        return menu.actionID === main.action.id;
                    });
                    menuID = menu && menu.id;
                }
            }
            return menuID;
        }
        //--------------------------------------------------------------------------
        // OWL Overrides
        //--------------------------------------------------------------------------
        catchError(e) {
            if (e && e.name) {
                // Real runtime error
                throw e;
            }
            // Errors that have been handled before
            console.warn(e);
        }
        mounted() {
            super.mounted();
            this._wcUpdated();
            odoo.isReady = true;
            this.env.bus.trigger('web-client-mounted');
        }
        patched() {
            super.patched();
            this._wcUpdated();
        }
        willPatch() {
            super.willPatch();
            /* const scrollPosition = this._getScrollPosition();
            this._storeScrollPosition(scrollPosition);*/
        }
        async willStart() {
            await this._loadMenus();
            this.urlState = this._getUrlState();
            this._determineCompanyIds(this.urlState);
            // LPE decision: make this at mounted to allow visual feedback that odoo is loading ?
            return this._loadState(this.urlState);
        }

        getBodyClass() {
            return {
                o_fullscreen: this.actionManager.isFullScreen,
                o_rtl: this.env._t.database.parameters.direction === 'rtl',
                o_touch_device: this.env.device.touch,
            };
        }
        get isRendering() {
            // TODO: this thing is meant to prevent DOM event or bus events
            // to actually do anything *during* our rendering
            // i.e.: before the webClient is fully in the dom and fully patched
            const { isMounted , currentFiber } = this.__owl__;
            return isMounted && currentFiber && !currentFiber.isCompleted;
        }

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
        _computeTitle() {
            const parts = Object.keys(this._titleParts).sort();
            let tmp = "";
            for (let part of parts) {
                const title = this._titleParts[part];
                if (title) {
                    tmp = tmp ? tmp + " - " + title : title;
                }
            }
            return tmp;
        }
        _determineCompanyIds(state) {
            const userCompanies = this.env.session.user_companies;
            const currentCompanyId = userCompanies.current_company[0];
            if (!state.cids) {
                state.cids = this.env.services.getCookie('cids') || currentCompanyId;
            }
            let stateCompanyIds = state.cids.toString().split(',').map(id => parseInt(id, 10));
            const userCompanyIds = userCompanies.allowed_companies.map(company => company[0]);
            // Check that the user has access to all the companies
            if (!_.isEmpty(_.difference(stateCompanyIds, userCompanyIds))) {
                state.cids = String(currentCompanyId);
                stateCompanyIds = [currentCompanyId];
            }
            this.env.session.user_context.allowed_company_ids = stateCompanyIds;
        }
        _displayNotification(params) {
            const notifService = this.env.services.notification;
            return notifService.notify(params);
        }
        _domCleaning() {
            const body = document.body;
            // multiple bodies in tests
            const tooltips = body.querySelectorAll('body .tooltip');
            for (let tt of tooltips) {
                tt.parentNode.removeChild(tt);
            }
        }
        _getHomeAction() {
            let menuID = this.menus ? this.menus.root.children[0] : null;
            let actionID =  menuID ? this.menus[menuID].actionID : null;
            if (this.env.session.home_action_id) {
                actionID = this.env.session.home_action_id;
                menuID = null;
            }
            return { actionID , menuID };
        }
        /**
         * Returns the left and top scroll positions of the main scrolling area
         * (i.e. the '.o_content' div in desktop).
         *
         * @private
         * @returns {Object} with keys left and top
         */
        _getScrollPosition() {
            var scrollingEl = this.el.getElementsByClassName('o_content')[0];
            return {
                left: scrollingEl ? scrollingEl.scrollLeft : 0,
                top: scrollingEl ? scrollingEl.scrollTop : 0,
            };
        }
        /**
         * @private
         * @returns {Object}
         */
        _getUrlState(hash) {
            hash = hash || this._getWindowHash();
            hash = hash.startsWith('#') ? hash.substring(1) : hash;
            const hashParams = new URLSearchParams(hash);
            const state = {};
            for (let [key, val] of hashParams.entries()) {
                state[key] = isNaN(val) ? val : parseInt(val, 10);
            }
            return state;
        }
        _getWindowHash() {
            return window.location.hash;
        }
        _getWindowTitle() {
            return document.title;
        }
        /**
         * FIXME: consider moving this to menu.js
         * Loads and sanitizes the menu data
         *
         * @private
         * @returns {Promise<Object>}
         */
        _loadMenus(force) {
            if (!odoo.loadMenusPromise && !force) {
                throw new Error('can we get here? tell aab if so');
            }
            const loadMenusPromise = odoo.loadMenusPromise || odoo.reloadMenus();
            return loadMenusPromise.then(menuData => {
                // set action if not defined on top menu items
                for (let app of menuData.children) {
                    let child = app;
                    while (app.action === false && child.children.length) {
                        child = child.children[0];
                        app.action = child.action;
                    }
                }
                this.menus = null;
                this._processMenu(menuData);
                odoo.loadMenusPromise = null;
            });
        }
        async _loadState(state) {
            const stateLoaded = await this.actionManager.dispatch('LOAD_STATE',
                state, { menuID: state.menu_id }
            );
            if (!stateLoaded) {
                if ('menu_id' in state) {
                    const action = this.menus[state.menu_id].actionID;
                    return this.actionManager.dispatch('doAction', action, state);
                } else {
                    const {actionID , menuID} = this._getHomeAction();
                    if (actionID) {
                        return this.actionManager.dispatch('doAction',
                            actionID,
                            {menuID, clear_breadcrumbs: true}
                        );
                    } else {
                        // TODO: clean me: just signals to WebClient
                        // that the AM did not handle the state
                        // We should re-render anyway
                        return 'render';
                    }
                }
            }
            return stateLoaded;
        }
        _processMenu(menu, appID) {
            this.menus = this.menus || {};
            appID = appID || menu.id;
            const children = [];
            for (let submenu of menu.children) {
                children.push(this._processMenu(submenu, appID).id);
            }
            const action = menu.action && menu.action.split(',');
            const menuID = menu.id || 'root';
            const _menu = {
                id: menuID,
                appID: appID,
                name: menu.name,
                children: children,
                actionModel: action ? action[0] : false,
                actionID: action ? parseInt(action[1], 10) : false,
                xmlid: menu.xmlid,
            };
            this.menus[menuID] = _menu;
            return _menu;
        }
        _scrollTo(scrollPosition) {
            const scrollingEl = this.el.getElementsByClassName('o_content')[0];
            if (!scrollingEl) {
                return;
            }
            scrollingEl.scrollTop = scrollPosition.top || 0;
            scrollingEl.scrollLeft = scrollPosition.left || 0;
        }
        _setTitlePart(part, title) {
            this._titleParts[part] = title;
        }
        _setWindowHash(newHash) {
            if (newHash === null) {
                return;
            }
            let url = new URL(window.location);
            url.hash = newHash;
            url = url.toString();
            window.history.pushState({ path: url }, '', url);
        }
        _setWindowTitle(title) {
            document.title = title;
        }
        _storeScrollPosition(scrollPosition) {
            const cStack = this.actionManager.state.controllerStack;
            const { controller } = cStack[cStack.length-2] || {};
            if (controller) {
                controller.scrollPosition = scrollPosition;
            }
        }
        /**
         * @private
         * @param {Object} state
         */
        _updateState(state) {
            // the action and menu_id may not have changed
            // LPE FIXME: when click on m2o, action is undefined
            // in master: url removes action, here: url keeps previous action
            state.action = state.action || this.urlState.action || null;
            const menuID = state.menu_id || this.urlState.menu_id || '';
            if (menuID) {
                state.menu_id = menuID;
            }
            if ('title' in state) {
                this._setTitlePart('action', state.title);
                delete state.title
            }
            this.urlState = state;
            const hashParams = new URLSearchParams();
            for (const key in state) {
                if (state[key] !== null) {
                    hashParams.append(key, state[key]);
                }
            }
            const hash = "#" + hashParams.toString();
            if (hash !== this._getWindowHash()) {
                this._setWindowHash(hash);
            }
            this._setWindowTitle(this._computeTitle());
        }
        _wcUpdated() {
            const state = {};
            const { main, dialog } = this.actionManager.activeDescriptors;
            if (main) {
                const mainComponent = this.mainRef.comp.actionRef.comp;
                Object.assign(state, mainComponent.getState());
                state.action = main.action.id;
                let active_id = null;
                let active_ids = null;
                if (main.action.context) {
                    active_id = main.action.context.active_id || null;
                    active_ids = main.action.context.active_ids;
                    if (active_ids && !(active_ids.length === 1 && active_ids[0] === active_id)) {
                        active_ids = active_ids.join(',');
                    } else {
                        active_ids = null;
                    }
                }
                if (active_id) {
                    state.active_id = active_id;
                }
                if (active_ids) {
                    state.active_ids = active_ids;
                }
                if (!('title' in state)) {
                    state.title = mainComponent.title;
                }
                // keep cids in hash
                //this._determineCompanyIds(state);
                const scrollPosition = main.controller.scrollPosition;
                if (scrollPosition) {
                    this._scrollTo(scrollPosition);
                }
            }
            const menuID = this.menuID;
            if (menuID) {
                state.menu_id = menuID;
            }
            if (!dialog && main) {
                this._updateState(state);
            }
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         * @param {OdooEvent} ev
         * @param {integer} ev.detail.controllerID
         */
        _onBreadcrumbClicked(ev) {
            // TODO: it is pôssible now to put this in action_adapter
            this.actionManager.dispatch('RESTORE_CONTROLLER', ev.detail.controllerID);
        }
        /**
         * Whenever the connection is lost, we need to notify the user.
         *
         * @private
         */
        _onConnectionLost() {
            this.connectionNotificationID = this._displayNotification({
                title: this.env._t('Connection lost'),
                message: this.env._t('Trying to reconnect...'),
                sticky: true
            });
        }
        /**
         * Whenever the connection is restored, we need to notify the user.
         *
         * @private
         */
        _onConnectionRestored() {
            if (this.connectionNotificationID) {
                this.env.services.notification.close(this.connectionNotificationID);
                this._displayNotification({
                    type: 'info',
                    title: this.env._t('Connection restored'),
                    message: this.env._t('You are back online'),
                    sticky: false
                });
                this.connectionNotificationID = false;
            }
        }
        /**
         * Displays a warning in a dialog or with the notification service
         *
         * @private
         * @param {OdooEvent} ev
         * @param {string} ev.data.message the warning's message
         * @param {string} ev.data.title the warning's title
         * @param {string} [ev.data.type] 'dialog' to display in a dialog
         * @param {boolean} [ev.data.sticky] whether or not the warning should be
         *   sticky (if displayed with the Notification)
         */
        _onDisplayWarning(ev) {
            var data = ev.detail;
            if (data.type === 'dialog') {
                const warningDialog = new LegacyDialog.DialogAdapter(this,
                    {
                        Component: WarningDialog,
                        widgetArgs: {
                            options: {title: data.title},
                            error: data
                        },
                    }
                );
                warningDialog.mount(this.el.querySelector('.o_dialogs'));
            } else {
                data.type = 'warning';
                this._displayNotification(data);
            }
        }
        /**
         * @private
         * @param {OdooEvent} ev
         * @param {Object} ev.detail
         */
        _onExecuteAction(ev) {
            this.actionManager.dispatch('EXECUTE_IN_FLOW', ev.detail);
        }
        _onGenericClick(ev) {
            this._domCleaning();
            const target = ev.target;
            if (target.tagName.toUpperCase() !== 'A') {
                return;
            }
            const disable_anchor = target.attributes.disable_anchor;
            if (disable_anchor && disable_anchor.value === "true") {
                return;
            }

            var href = target.attributes.href;
            if (href) {
                if (href.value[0] === '#') {
                    ev.preventDefault();
                    if (href.value.length === 1) {
                        return;
                    }
                    let matchingEl = null;
                    try {
                        matchingEl = this.el.querySelector(`.o_content #${href.value.substr(1)}`);
                    } catch (e) {} // Invalid selector: not an anchor anyway
                    if (matchingEl) {
                        const {top, left} = matchingEl.getBoundingClientRect();
                        this._scrollTo({top, left});
                    }
                }
            }
        }
        async _onHashchange(ev) {
            let popped;
            if ((ev.state && ev.state.path)) {
                popped = new URL(ev.state.path).hash;
            }
            const state = this._getUrlState(popped);
            const loaded = await this._loadState(state);
            if (loaded === 'render') {
                this.render();
            }
            // TODO: reset oldURL in case of failure?
        }
        /**
         * @private
         */
        _onOpenMenu(ev) {
            const action = this.menus[ev.detail.menuID].actionID;
            this.actionManager.dispatch('doAction', action, {
                clear_breadcrumbs: true,
                menuID: ev.detail.menuID,
            });
        }
        /**
         * @private
         * @param {OdooEvent} ev
         * @param {Object} ev.detail.state
         */
        _onPushState(ev) {
            if (!this.isRendering) {
                // Deal with that event only if we are not in a rendering cycle
                // i.e.: the rendering cycle will update the state at its end
                // Any event hapening in the meantime would be irrelevant
                this._updateState(ev.detail.state);
            }
        }
        _onSetTitlePart(ev) {
            const part = ev.detail.part;
            const title = ev.detail.title;
            this._setTitlePart(part, title);
            if (!this.isRendering) {
                this._setWindowTitle(this._computeTitle());
            }
        }
        /**
         * Displays a visual effect (for example, a rainbowMan0
         *
         * @private
         * @param {Object} payload
         * @param {Object} [ev.detail] - key-value options to decide rainbowMan
         *   behavior / appearance
         */
        _onShowEffect(payload) {
            if (this.isRendering && !payload.force) {return;}
            const type = payload.type || 'rainbow_man';
            if (type === 'rainbow_man') {
                if (this.env.session.show_effect) {
                    RainbowMan.display(payload, {target: this.el, parent: this});
                } else {
                    // For instance keep title blank, as we don't have title in data
                    this._displayNotification({
                        title: "",
                        message: payload.message,
                        sticky: false
                    });
                }
            } else {
                throw new Error('Unknown effect type: ' + type);
            }
        }
    }
    WebClient.components = { Menu, DialogAction, ComponentAdapter , ActionContainer };
    WebClient.template = 'web.WebClient';

    return WebClient;

});
