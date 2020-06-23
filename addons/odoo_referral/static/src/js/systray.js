odoo.define('usermenu.usermenu_odoo_referral', function (require) {
    "use strict";
    var core = require('web.core');
    var menu = require('web.UserMenu');

    var _t = core._t;

    var userMenu = menu.include({
        _onMenuReferral: function() {
            var self = this;
            this._rpc({
                route: '/odoo_referral/go/'
            }).then(function (result) {
                window.open(result.link, '_blank', 'noreferrer noopener');
                // Cannot check if the window is open or blocked since we use noopener
            });
        },
    });

    return userMenu;
});
