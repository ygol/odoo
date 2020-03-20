odoo.define('pos_reprint.BillScreen', function(require) {
    'use strict';

    const Registry = require('point_of_sale.ComponentsRegistry');

    const ReprintScreen = ReceiptScreen =>
        class extends ReceiptScreen {
            static template = 'ReprintScreen';
            confirm() {
                this.trigger('close-temp-screen');
            }
        };

    Registry.addByExtending('ReprintScreen', 'ReceiptScreen', ReprintScreen);
});
