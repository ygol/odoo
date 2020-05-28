odoo.define('website.s_popup', function (require) {
'use strict';

const config = require('web.config');
const publicWidget = require('web.public.widget');
const utils = require('web.utils');

const PopupWidget = publicWidget.Widget.extend({
    disabledInEditableMode: false,
    selector: '.s_popup',
    events: {
        'click .js_close_popup': '_onCloseClick',
        'hide.bs.modal': '_onHideModal',
    },

    /**
     * @override
     */
    start: function () {
        const $main = this.$target.find('.modal');

        this.display = $main.data('display');
        this.delay = $main.data('showAfter');

        this._popupAlreadyShown = !!utils.get_cookie(this.$el.attr('id'));
        if (!this._popupAlreadyShown || this.display === 'onClick') {
            this._bindPopup();
        }
        return this._super(...arguments);
    },
    /**
     * @override
     */
    destroy: function () {
        this._super.apply(this, arguments);
        $(document).off('mouseleave.open_popup');
        clearTimeout(this.timeout);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _bindPopup: function () {

        if (config.device.isMobile) {
            if (this.display === 'mouseExit') {
                this.display = 'afterDelay';
                this.delay = 5000;
            }
            this.$('.modal').removeClass('s_popup_middle').addClass('s_popup_bottom');
        }

        if (this.display === 'afterDelay') {
            this.timeout = setTimeout(() => this._showPopup(), this.delay);
        } else if (this.display === 'onClick') {
            let anchor = $.escapeSelector(this.$target.find('.modal').attr('id'));

            const classesToAdd = {
                'data-toggle': this.editableMode ? null : 'modal',
                'data-target': this.editableMode ? null : '#' + anchor,
            };
            const $linkSelector = "a[href*='" + anchor + "']";
            const $link = $($linkSelector);
            $link.attr(classesToAdd);
        } else {
            $(document).on('mouseleave.open_popup', () => this._showPopup());
        }
    },
    /**
     * @private
     */
    _hidePopup: function () {
        this.$target.find('.modal').modal('hide');
    },
    /**
     * @private
     */
    _showPopup: function () {
        if (this._popupAlreadyShown) {
            return;
        }
        this.$target.find('.modal').modal('show');
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onCloseClick: function () {
        this._hidePopup();
    },
    /**
     * @private
     */
    _onHideModal: function () {
        const nbDays = this.$el.find('.modal').data('consentsDuration');
        utils.set_cookie(this.$el.attr('id'), true, nbDays * 24 * 60 * 60);
        this._popupAlreadyShown = true;
    },
});

publicWidget.registry.popup = PopupWidget;

// Prevent bootstrap to prevent scrolling and to add the strange body
// padding-right they add if the popup does not use a backdrop (especially
// important for default cookie bar).
const _baseSetScrollbar = $.fn.modal.Constructor.prototype._setScrollbar;
$.fn.modal.Constructor.prototype._setScrollbar = function () {
    if (this._element.classList.contains('s_popup_no_backdrop')) {
        return;
    }
    return _baseSetScrollbar.apply(this, ...arguments);
};
const _baseGetScrollbarWidth = $.fn.modal.Constructor.prototype._getScrollbarWidth;
$.fn.modal.Constructor.prototype._getScrollbarWidth = function () {
    if (this._element.classList.contains('s_popup_no_backdrop')) {
        return 0;
    }
    return _baseGetScrollbarWidth.apply(this, ...arguments);
};

return PopupWidget;
});
