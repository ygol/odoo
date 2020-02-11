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
            var self = this;
            ajax.jsonRpc('/referral/notifications_internal').then(function (data) {
                if('updates_count' in data) {
                    self.$('.o_notification_counter').text(data.updates_count);
                }
            });
            return this._super.apply(this, arguments);
        },
        onclick_gifticon:function(){
            var self = this;
            ajax.jsonRpc('/referral/go/', 'call', {})
            .then(function (data) {
                self.$('.o_notification_counter').text(0);
                window.open(data.link);
            });
        },
    });

    SystrayMenu.Items.push(ActionMenu);
    return ActionMenu;
});
