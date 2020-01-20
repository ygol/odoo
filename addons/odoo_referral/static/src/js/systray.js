odoo.define('systray.systray_odoo_regerral', function(require) {
    "use strict";
 var SystrayMenu = require('web.SystrayMenu');
 var Widget = require('web.Widget');
 var ActionMenu = Widget.extend({
      template: 'systray_odoo_referral.gift_icon',
      events: {
          'click .gift_icon': 'onclick_gifticon',
      },
     onclick_gifticon:function(){
      window.open('http://odoo.com/referral')
   },
    });
    SystrayMenu.Items.push(ActionMenu);
    return ActionMenu;
 });