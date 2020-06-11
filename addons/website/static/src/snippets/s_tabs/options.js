odoo.define('website.s_tabs_options', function (require) {
'use strict';

const snippetOptions = require('web_editor.snippets.options');

snippetOptions.registry.NavTabs = snippetOptions.SnippetOptionWidget.extend({
    isTopOption: true,

    /**
     * @override
     */
    start: function () {
        this._findLinksAndPanes();
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    onBuilt: function () {
        this._generateUniqueIDs();
    },
    /**
     * @override
     */
    onClone: function () {
        this._generateUniqueIDs();
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Creates a new tab and tab-pane.
     *
     * @see this.selectClass for parameters
     */
    addTab: function (previewMode, widgetValue, params) {
        var $activeItem = this.$navLinks.filter('.active').parent();
        var $activePane = this.$tabPanes.filter('.active');

        var $navItem = $activeItem.clone();
        var $navLink = $navItem.find('.nav-link').removeClass('active show');
        var $tabPane = $activePane.clone().removeClass('active show');
        $navItem.insertAfter($activeItem);
        $tabPane.insertAfter($activePane);
        this._findLinksAndPanes();
        this._generateUniqueIDs();

        $navLink.tab('show');
    },
    /**
     * Removes the current active tab and its content.
     *
     * @see this.selectClass for parameters
     */
    removeTab: function (previewMode, widgetValue, params) {
        var self = this;

        var $activeLink = this.$navLinks.filter('.active');
        var $activePane = this.$tabPanes.filter('.active');

        var $next = this.$navLinks.eq((this.$navLinks.index($activeLink) + 1) % this.$navLinks.length);

        return new Promise(resolve => {
            $next.one('shown.bs.tab', function () {
                $activeLink.parent().remove();
                $activePane.remove();
                self._findLinksAndPanes();
                resolve();
            });
            $next.tab('show');
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetVisibility: async function (widgetName, params) {
        if (widgetName === 'remove_tab_opt') {
            return (this.$tabPanes.length > 2);
        }
        return this._super(...arguments);
    },
    /**
     * @private
     */
    _findLinksAndPanes: function () {
        this.$navLinks = this.$target.find('.nav:first .nav-link');
        this.$tabPanes = this.$target.find('.tab-content:first .tab-pane');
    },
    /**
     * @private
     */
    _generateUniqueIDs: function () {
        this._findLinksAndPanes();
        for (var i = 0; i < this.$navLinks.length; i++) {
            var id = _.now() + '_' + _.uniqueId();
            var idLink = 'nav_tabs_link_' + id;
            var idContent = 'nav_tabs_content_' + id;
            this.$navLinks.eq(i).attr({
                'id': idLink,
                'href': '#' + idContent,
                'aria-controls': idContent,
            });
            this.$tabPanes.eq(i).attr({
                'id': idContent,
                'aria-labelledby': idLink,
            });
        }
    },
});
snippetOptions.registry.NavTabsStyle = snippetOptions.SnippetOptionWidget.extend({

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Set the style of the tabs.
     *
     * @see this.selectClass for parameters
     */
    setStyle: async function (previewMode, widgetValue, params) {
        await this.wysiwyg.execBatch(async ()=> {
            const $nav = this.$target.find('.s_tabs_nav:first .nav');
            const isPills = widgetValue === 'pills';
            const firstTab = this.$target.find('.s_tabs_nav:first')[0];
            if (isPills) {
                await this.editorDom.removeClass($nav, 'nav-tabs card-header-tabs');
                await this.editorDom.addClass($nav, 'nav-pills');
                await this.editorDom.removeClass(firstTab, 'card-header');
                await this.editorDom.addClass(firstTab, 'mb-3');
                await this.editorDom.removeClass(this.$target[0], 'card');
                await this.editorDom.removeClass(this.$target.find('.s_tabs_content:first')[0], 'card-body');
            } else {
                await this.editorDom.addClass($nav, 'nav-tabs card-header-tabs');
                await this.editorDom.removeClass($nav, 'nav-pills');
                await this.editorDom.addClass(firstTab, 'card-header');
                await this.editorDom.removeClass(firstTab, 'mb-3');
                await this.editorDom.addClass(this.$target[0], 'card');
                await this.editorDom.addClass(this.$target.find('.s_tabs_content:first')[0], 'card-body');
            }
        });
    },
    /**
     * Horizontal/vertical nav.
     *
     * @see this.selectClass for parameters
     */
    setDirection: function (previewMode, widgetValue, params) {
        const isVertical = widgetValue === 'vertical';
        this.$target.toggleClass('row s_col_no_resize s_col_no_bgcolor', isVertical);
        this.$target.find('.s_tabs_nav:first .nav').toggleClass('flex-column', isVertical);
        this.$target.find('.s_tabs_nav:first > .nav-link').toggleClass('py-2', isVertical);
        this.$target.find('.s_tabs_nav:first').toggleClass('col-md-3', isVertical);
        this.$target.find('.s_tabs_content:first').toggleClass('col-md-9', isVertical);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        switch (methodName) {
            case 'setStyle':
                return this.$target.find('.s_tabs_nav:first .nav').hasClass('nav-pills') ? 'pills' : 'tabs';
            case 'setDirection':
                return this.$target.find('.s_tabs_nav:first .nav').hasClass('flex-column') ? 'vertical' : 'horizontal';
        }
        return this._super(...arguments);
    },
});
});
