odoo.define('pos_coupon.ProductScreen', function (require) {
    'use strict';

    const ProductScreen = require('point_of_sale.ProductScreen');
    const Registries = require('point_of_sale.Registries');
    const { useBarcodeReader } = require('point_of_sale.custom_hooks');

    const PosCouponProductScreen = (ProductScreen) =>
        class extends ProductScreen {
            constructor() {
                super(...arguments);
                useBarcodeReader({
                    coupon: this._onCouponScan,
                });
            }
            _onCouponScan(code) {
                this.currentOrder.activateCode(code.base_code);
            }
            /**
             * @override
             */
            _setValue(val) {
                // Update the reward lines when numpad buffer is updated
                // except when the selected order line is a reward line.
                const selectedLine = this.currentOrder.get_selected_orderline();
                const floatVal = parseFloat(val) || 0;
                if (
                    !selectedLine.is_program_reward ||
                    (selectedLine.is_program_reward && [1.0, 0.0].includes(floatVal))
                ) {
                    super._setValue(val);
                }
                if (selectedLine.is_program_reward && val === 'remove') {
                    if (selectedLine.coupon_id) {
                        const coupon_code = Object.values(selectedLine.order.bookedCouponCodes).find(
                            (couponCode) => couponCode.coupon_id === selectedLine.coupon_id
                        ).code;
                        delete selectedLine.order.bookedCouponCodes[coupon_code];
                        selectedLine.order.trigger('reset-coupons', [selectedLine.coupon_id]);
                        this.showNotification(`Coupon (${coupon_code}) has been deactivated.`);
                    } else if (selectedLine.program_id) {
                        // remove program from active programs
                        const index = selectedLine.order.activePromoProgramIds.indexOf(selectedLine.program_id);
                        selectedLine.order.activePromoProgramIds.splice(index, 1);
                        this.showNotification(
                            `'${
                                this.env.pos.coupon_programs_by_id[selectedLine.program_id].name
                            }' program has been deactivated.`
                        );
                    }
                }
                selectedLine.order.trigger('update-rewards');
            }
        };

    Registries.Component.extend(ProductScreen, PosCouponProductScreen);

    return ProductScreen;
});
