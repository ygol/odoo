odoo.define('pos_coupon.PaymentScreen', function (require) {
    'use strict';

    const PaymentScreen = require('point_of_sale.PaymentScreen');
    const Registries = require('point_of_sale.Registries');
    const session = require('web.session');

    const PosCouponPaymentScreen = (PaymentScreen) =>
        class extends PaymentScreen {
            async _postPushOrderResolve(order, server_ids) {
                const programIdsToGenerateCoupons = [];
                const messages = {};
                for (let program of order.getActiveOnNextPromoPrograms()) {
                    const { successful, reason } = await order.checkProgramRules(program);
                    if (successful) {
                        programIdsToGenerateCoupons.push(program.id);
                    } else {
                        messages[program.id] = reason;
                    }
                }
                const bookedCouponIds = new Set(
                    Object.values(order.bookedCouponCodes)
                        .map((couponCode) => couponCode.coupon_id)
                        .filter((coupon_id) => coupon_id)
                );
                const usedCouponIds = order.orderlines.models
                    .map((line) => line.coupon_id)
                    .filter((coupon_id) => coupon_id);
                for (let coupon_id of usedCouponIds) {
                    bookedCouponIds.delete(coupon_id);
                }
                const unusedCouponIds = [...bookedCouponIds.values()];
                order.generated_coupons = await this.rpc(
                    {
                        model: 'pos.order',
                        method: 'validate_coupon_programs',
                        args: [server_ids, programIdsToGenerateCoupons, unusedCouponIds],
                        kwargs: { context: session.user_context },
                    },
                    {}
                );
                return super._postPushOrderResolve(order, server_ids);
            }
        };

    Registries.Component.extend(PaymentScreen, PosCouponPaymentScreen);

    return PaymentScreen;
});
