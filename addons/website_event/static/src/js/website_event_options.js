odoo.define('website.event_options', function (require) {
'use strict';

const { _t, qweb } = require('web.core');
const Dialog = require('web.Dialog');
const editor = require('web_editor.snippet.editor');
const { EditMenuDialog } = require('website.contentMenu');

editor.Class.include({

    start() {
        $('#o_wevent_event_submenu').find('[href]').bind('click', this._onCLickEventMenu.bind(this));
        return this._super.apply(this, arguments);
    },

    _onCLickEventMenu(ev) {
        const menuId = Number($(ev.currentTarget).closest('[data-content_menu_id]').attr('data-content_menu_id'));
        (new Dialog(this, {
            title: _t("Confirmation"),
            $content: $(qweb.render('website.leaving_current_page_edition')),
            buttons: [
                {text: _t("Go to Link"), classes: 'btn-primary', click: () => {
                    this.trigger_up('request_save', {
                        reload: false,
                        onSuccess: function () {
                            window.location.href = $(ev.currentTarget).attr('href');
                        },
                    });
                }},
                {text: _t("Edit the menu"), classes: 'btn-primary', click: () => {
                    this._openMenuEdition(menuId);
                }, close: true},
                {text: _t("Stay on this page"), close: true}
            ]
        })).open();

    },

    _openMenuEdition(menuId) {
        const dialog = new EditMenuDialog(this, {}, menuId);
        dialog.on('save', this, function () {
            this.trigger_up('request_save', {
                reloadEditor: true,
            });
        });
        dialog.open();
    },
});

});