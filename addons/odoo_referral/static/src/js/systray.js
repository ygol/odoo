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
            ajax.jsonRpc('/referral/generate_token', 'call', {})
            .then(function (data) {
                ajax.jsonRpc('/referral/notifications/'.concat(data['token'])) //TODO query odoo.com instead
                .then(function (data) {
                    if('updates_count' in data) {
                        var output_data = data['updates_count']
                        self.$('.o_notification_counter').text(output_data);
                    }
                })

            })
        },
        onclick_gifticon:function(){
            // ajax.jsonRpc('/referral/notifications/clear', 'call', {})
            ajax.jsonRpc('/referral/generate_token/', 'call', {})
            .then(function (data) {
                window.open(string.concat('https://odoo.com/referral/', d['link']))
            })
        },
    });

    SystrayMenu.Items.push(ActionMenu);
    return ActionMenu;
});