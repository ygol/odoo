odoo.define('systray.systray_odoo_referral', function(require) {
    "use strict";
    var SystrayMenu = require('web.SystrayMenu');
    var Widget = require('web.Widget');
    var ajax = require('web.ajax');

    var ActionMenu = Widget.extend({
        template: 'systray_odoo_referral.gift_icon',
        events: {
            'click .gift_icon': 'onclick_gifticon',
        },
        start:function(parent) {
            this._super.apply(this, arguments);
            ajax.jsonRpc('/referral/notifications', 'call', {})
            .then(function (data) {
                var output_data = data['referral_notif_count']
                self.$('.o_notification_counter').text(output_data);
            })
        },
        onclick_gifticon:function(){
        ajax.jsonRpc('/referral/notifications/clear', 'call', {})
        window.open('http://odoo.com/referral')
        },
    });

    SystrayMenu.Items.push(ActionMenu);
    return ActionMenu;
});