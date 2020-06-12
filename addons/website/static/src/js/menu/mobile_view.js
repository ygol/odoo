odoo.define('website.mobile', function (require) {
'use strict';

var core = require('web.core');
var utils = require('web.utils');
var websiteNavbarData = require('website.navbar');

var _t = core._t;

var PREVIEW_VIEW_COOKIE = 'mobile_view_cookie';

var MobileMenu = websiteNavbarData.WebsiteNavbarActionWidget.extend({
    events: {
        'click a': '_onMobilePreviewClick',
    },

    _bootstrapBreakpoints: [
        { size: 576, infix:'xs'},
        { size: 768, infix:'sm'},
        { size: 992, infix:'md'},
        { size: 1200, infix:'lg'},
    ],

    /**
     * @constructor
     */
    init: function () {
        this._super.apply(this, arguments);
        this.selectedViewIndex = utils.get_cookie(PREVIEW_VIEW_COOKIE) || 0;
},
    /**
     * @override
     */
    start: function() {
        return this._super.apply(this, arguments).then(
            () => {
                this.$preview_buttons = this.$el.children();
                if (this.selectedViewIndex >= this.$preview_buttons.length)
                    this.selectedViewIndex = this.$preview_buttons.length;
                this._setPreviewMode(this.$preview_buttons.eq(this.selectedViewIndex))
            }
        );
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {jQuery}
     */
    _setPreviewMode: function ($button) {
        const width = $button.attr('data-width');
        const maxHeight = $button.attr('data-height');
        let css = {};
        let bootstrapBreakpoint = '';
        const nbOfBootstrapBreakpoints = this._bootstrapBreakpoints.length;
        if (width) {
            for (let index = nbOfBootstrapBreakpoints - 1; index >= 0; index--) {
                if (width < this._bootstrapBreakpoints[index].size) {
                    bootstrapBreakpoint = this._bootstrapBreakpoints[index].infix;
                }
            }
            css['width'] = width + 'px';
            css['min-width'] = width + 'px';
            css['max-width'] = width + 'px';
            css['margin'] = 'auto';
        }

        if (!bootstrapBreakpoint) {
            bootstrapBreakpoint = 'xl'
        }

        if (maxHeight) {
            css['height'] = maxHeight + 'px';
            css['min-height'] = maxHeight + 'px';
            css['max-height'] = maxHeight + 'px';
            css['overflow'] = 'auto';
        }

        $('#wrapwrap').toggleClass('border rounded mt-5 mb-5', !_.isEmpty(css));

        $('#wrapwrap').removeAttr('style');
        $('#wrapwrap').css(css);

        $('#wrapwrap').removeClass('xs sm md lg xl');
        $('#wrapwrap').addClass(bootstrapBreakpoint);

        this.$preview_buttons.removeClass('selected');
        $button.addClass('selected');
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when a preview button is clicked.
     *
     * @private
     */
    _onMobilePreviewClick: function (e) {
        let $button = this.$(e.target);
        if ($button.is('span')) {
            $button = $button.parent();
        }
        utils.set_cookie(PREVIEW_VIEW_COOKIE, $button.index());
        this._setPreviewMode($button);
    },
});

websiteNavbarData.websiteNavbarRegistry.add(MobileMenu, '#website-preview-menu');

return {
    MobileMenu: MobileMenu,
};
});
