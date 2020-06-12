odoo.define('pos_coupon.tour.pos_coupon2', function (require) {
    'use strict';

    // --- PoS Coupon Tour Basic Part 2 ---
    // Using the coupons generated from PosCouponTour1.

    const { PosCoupon } = require('pos_coupon.tour.PosCouponTourMethods');
    const { ProductScreen } = require('point_of_sale.tour.ProductScreenTourMethods');
    const { getSteps, startSteps } = require('point_of_sale.tour.utils');
    var Tour = require('web_tour.tour');

    startSteps();

    ProductScreen.do.clickHomeCategory();

    // Cheapest product discount should be replaced by the global discount
    // because it's amount is lower.
    // Applied programs:
    //   - global discount
    ProductScreen.exec.order('Desk Organizer', '10'); // 5.1
    PosCoupon.check.hasRewardLine('on cheapest product', '-4.59');
    ProductScreen.exec.order('Letter Tray', '4'); // 4.8 tax 10%
    PosCoupon.check.hasRewardLine('on cheapest product', '-4.32');
    PosCoupon.do.enterCode('123456');
    PosCoupon.check.hasRewardLine('10.0% discount on total amount', '-5.10');
    PosCoupon.check.hasRewardLine('10.0% discount on total amount', '-1.92');
    PosCoupon.check.orderTotalIs('64.91');
    PosCoupon.exec.finalizeOrder('Cash', '64.91');

    // Use coupon from global discount but on cheapest discount prevails.
    // The global discount coupon should be consumed during the order as it is
    // activated in the order. But upon validation, the coupon should return
    // to new state.
    // Applied programs:
    //   - on cheapest discount
    ProductScreen.exec.order('Small Shelf', '3'); // 2.83
    PosCoupon.check.hasRewardLine('90.0% discount on cheapest product', '-2.55');
    PosCoupon.do.enterCode('345678');
    PosCoupon.check.hasRewardLine('90.0% discount on cheapest product', '-2.55');
    ProductScreen.do.pressNumpad('Backspace 1 5')
    PosCoupon.check.hasRewardLine('10.0% discount on total amount', '-4.25');
    ProductScreen.do.pressNumpad('Backspace Backspace 2')
    PosCoupon.check.hasRewardLine('90.0% discount on cheapest product', '-2.55');
    ProductScreen.exec.order('Desk Pad', '1'); // 1.98
    PosCoupon.check.hasRewardLine('90.0% discount on cheapest product', '-1.78');
    PosCoupon.check.orderTotalIs('5.86');
    PosCoupon.exec.finalizeOrder('Cash', '5.86');

    // Scanning coupon twice.
    // Also apply global discount on top of free product to check if the
    // calculated discount is correct.
    // Applied programs:
    //  - coupon program (free product)
    //  - global discount
    ProductScreen.exec.order('Desk Organizer', '11'); // 5.1
    PosCoupon.check.hasRewardLine('90.0% discount on cheapest product', '-4.59');
    // add global discount and the discount will be replaced
    PosCoupon.do.enterCode('345678');
    PosCoupon.check.hasRewardLine('10.0% discount on total amount', '-5.61');
    // add free product coupon (for qty=11, free=4)
    // the discount should change after having free products
    // it should go back to cheapest discount as it is higher
    PosCoupon.do.enterCode('5678');
    PosCoupon.check.hasRewardLine('Free Product - Desk Organizer', '-20.40');
    PosCoupon.check.hasRewardLine('90.0% discount on cheapest product', '-4.59');
    // set quantity to 18
    // should result to 'charged qty'=12, 'free qty'=6
    ProductScreen.do.pressNumpad('Backspace 8')
    PosCoupon.check.hasRewardLine('10.0% discount on total amount', '-6.12');
    PosCoupon.check.hasRewardLine('Free Product - Desk Organizer', '-30.60');
    // scan the code again and check notification
    PosCoupon.do.enterCode('5678');
    PosCoupon.check.orderTotalIs('55.08');
    PosCoupon.exec.finalizeOrder('Cash', '55.08');

    // Specific products discount (with promocode) and free product (1357)
    // Applied programs:
    //   - discount on specific products
    //   - free product
    ProductScreen.exec.order('Desk Organizer', '6'); // 5.1
    PosCoupon.check.hasRewardLine('on cheapest product', '-4.59');
    PosCoupon.exec.removeRewardLine('90.0% discount on cheapest product');
    PosCoupon.do.enterCode('promocode');
    PosCoupon.check.hasRewardLine('50.0% discount on products', '-15.30');
    PosCoupon.do.enterCode('1357');
    PosCoupon.check.hasRewardLine('Free Product - Desk Organizer', '-10.20');
    PosCoupon.check.hasRewardLine('50.0% discount on products', '-10.20');
    PosCoupon.check.orderTotalIs('10.20');
    PosCoupon.exec.finalizeOrder('Cash', '10.20');

    // Check reset program
    // Enter to codes and reset the programs.
    // The codes should be checked afterwards. They should return to new.
    // Applied programs:
    //   - cheapest product
    ProductScreen.exec.order('Monitor Stand', '6'); // 3.19
    PosCoupon.do.enterCode('2468');
    PosCoupon.do.enterCode('098765');
    PosCoupon.check.hasRewardLine('90.0% discount on cheapest product', '-2.87');
    PosCoupon.exec.removeRewardLine('90.0% discount on cheapest product');
    PosCoupon.check.hasRewardLine('10.0% discount on total amount', '-1.91');
    PosCoupon.do.resetActivePrograms();
    PosCoupon.check.hasRewardLine('90.0% discount on cheapest product', '-2.87');
    PosCoupon.check.orderTotalIs('16.27');
    PosCoupon.exec.finalizeOrder('Cash', '16.27');

    Tour.register('PosCouponTour2', { test: true, url: '/pos/web' }, getSteps());
});
