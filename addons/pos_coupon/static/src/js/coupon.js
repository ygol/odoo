odoo.define('pos_coupon.pos', function (require) {
    'use strict';

    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    var session = require('web.session');
    const { Gui } = require('point_of_sale.Gui');

    class CouponCode {
        /**
         * @param {string} code coupon code
         * @param {number} coupon_id id of coupon.coupon
         * @param {numnber} program_id id of coupon.program
         */
        constructor(code, coupon_id, program_id) {
            this.code = code;
            this.coupon_id = coupon_id;
            this.program_id = program_id;
        }
    }

    class Reward {
        /**
         * @param {product.product} product product used in creating the reward line
         * @param {number} unit_price unit price of the reward
         * @param {number} quantity
         * @param {coupon.program} program
         * @param {number[]} tax_ids tax ids
         * @param {number?} coupon_id id of the coupon.coupon the generates this reward
         */
        constructor({ product, unit_price, quantity, program, tax_ids, coupon_id = undefined }) {
            this.product = product;
            this.unit_price = unit_price;
            this.quantity = quantity;
            this.program = program;
            this.tax_ids = tax_ids;
            this.coupon_id = coupon_id;
            this._discountAmount = Math.abs(unit_price * quantity);
        }
        /**
         * If the program's reward_type is 'product', return the product.product id of the
         * reward product.
         */
        get rewardedProductId() {
            return (
                this.program.reward_type == 'product' &&
                this.program.reward_product_id &&
                this.program.reward_product_id[0]
            );
        }
        get discountAmount() {
            return this._discountAmount;
        }
    }

    /**
     * Data structure of the programs (coupons) that was asked to generate rewards
     * but failed to do so.
     */
    class NotRewarded {
        /**
         * @param {coupon.program} program
         * @param {number} coupon_id
         * @param {string} reason
         */
        constructor(program, coupon_id, reason) {
            this.program = program;
            this.coupon_id = coupon_id;
            this.reason = reason;
        }
    }

    // Some utility functions

    /**
     * Calculate the number of free items based on the given number
     * of items `number_items` and the rule: buy `n` take `m`.
     *
     * e.g.
     *```
     *      rule: buy 2 take 1                    rule: buy 2 take 3
     *     +------------+--------+--------+      +------------+--------+--------+
     *     |number_items| charged|    free|      |number_items| charged|    free|
     *     +------------+--------+--------+      +------------+--------+--------+
     *     |           1|       1|       0|      |           1|       1|       0|
     *     |           2|       2|       0|      |           2|       2|       0|
     *     |           3|       2|       1|      |           3|       2|       1|
     *     |           4|       3|       1|      |           4|       2|       2|
     *     |           5|       4|       1|      |           5|       2|       3|
     *     |           6|       4|       2|      |           6|       3|       3|
     *     |           7|       5|       2|      |           7|       4|       3|
     *     |           8|       6|       2|      |           8|       4|       4|
     *     |           9|       6|       3|      |           9|       4|       5|
     *     |          10|       7|       3|      |          10|       4|       6|
     *     +------------+--------+--------+      +------------+--------+--------+
     * ```
     *
     * @param {number} numberItems number of items
     * @param {number} n items to buy
     * @param {number} m item for free
     * @returns {number} number of free items
     */
    function computeFreeQuantity(numberItems, n, m) {
        let factor = Math.trunc(numberItems / (n + m));
        let free = factor * m;
        let charged = numberItems - free;
        // adjust the calculated free quantities
        let x = (factor + 1) * n;
        let y = x + (factor + 1) * m;
        let adjustment = x <= charged && charged < y ? charged - x : 0;
        return free + adjustment;
    }

    // Load the products used for creating program reward lines.
    var existing_models = models.PosModel.prototype.models;
    var product_index = _.findIndex(existing_models, function (model) {
        return model.model === 'product.product';
    });
    var product_model = existing_models[product_index];
    models.load_models([
        {
            model: 'coupon.program',
            fields: [],
            domain: function (self) {
                return [['id', 'in', self.config.program_ids]];
            },
            loaded: function (self, programs) {
                self.programs = programs;
                self.coupon_programs_by_id = {};
                self.coupon_programs = [];
                self.promo_programs = [];
                for (let program of self.programs) {
                    // index by id
                    self.coupon_programs_by_id[program.id] = program;
                    // separate coupon programs from promo programs
                    if (program.program_type === 'coupon_program') {
                        self.coupon_programs.push(program);
                    } else {
                        self.promo_programs.push(program);
                    }
                    // cast some arrays to Set for faster membership checking
                    program.valid_product_ids = new Set(program.valid_product_ids);
                    program.valid_partner_ids = new Set(program.valid_partner_ids);
                    program.discount_specific_product_ids = new Set(program.discount_specific_product_ids);
                }
            },
        },
        {
            model: product_model.model,
            fields: product_model.fields,
            order: product_model.order,
            domain: function (self) {
                const discountLineProductIds = self.programs.map((program) => program.discount_line_product_id[0]);
                const rewardProductIds = self.programs.map((program) => program.reward_product_id[0]);
                return [['id', 'in', discountLineProductIds.concat(rewardProductIds)]];
            },
            context: product_model.context,
            loaded: product_model.loaded,
        },
    ]);

    var _posmodel_super = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function () {
            _posmodel_super.initialize.apply(this, arguments);
            this.ready.then(() => {
                if (this.get('selectedOrder')) {
                    this.get('selectedOrder').trigger('update-rewards');
                }
            });
        },
    });

    /**
     * @listens 'update-rewards' calls updateRewards when triggered.
     * @listens 'reset-coupons' calls resetCoupons when triggered.
     * @emits 'rewards-updated' emitted event when to updateRewards is successful.
     */
    var _order_super = models.Order.prototype;
    models.Order = models.Order.extend({
        // OVERIDDEN METHODS

        initialize: function () {
            let res = _order_super.initialize.apply(this, arguments);
            res.on('update-rewards', res.updateRewards, res);
            res.on('reset-coupons', res.resetCoupons, res);
            res.initializePrograms();
            return res;
        },
        init_from_JSON: function (json) {
            _order_super.init_from_JSON.apply(this, arguments);
            this.bookedCouponCodes = json.bookedCouponCodes;
            this.activePromoProgramIds = json.activePromoProgramIds;
        },
        export_as_JSON: function () {
            let json = _order_super.export_as_JSON.apply(this, arguments);
            return Object.assign(json, {
                bookedCouponCodes: this.bookedCouponCodes,
                activePromoProgramIds: this.activePromoProgramIds,
            });
        },
        set_orderline_options: function (orderline, options) {
            _order_super.set_orderline_options.apply(this, [orderline, options]);
            if (options && options.is_program_reward) {
                orderline.is_program_reward = true;
                orderline.tax_ids = options.tax_ids;
                orderline.program_id = options.program_id;
                orderline.coupon_id = options.coupon_id;
            }
        },
        /**
         * This function's behavior is modified so that the reward lines are
         * rendered at the bottom of the orderlines list.
         */
        get_orderlines: function () {
            var orderlines = _order_super.get_orderlines.apply(this, arguments);
            var regular_lines = orderlines.filter((line) => !line.is_program_reward);
            var reward_lines = orderlines.filter((line) => line.is_program_reward);
            return regular_lines.concat(reward_lines);
        },
        wait_for_push_order: function () {
            return this.pos.config.use_coupon_programs;
        },
        export_for_printing: function () {
            let result = _order_super.export_for_printing.apply(this, arguments);
            result.generated_coupons = this.generated_coupons;
            return result;
        },
        add_product: function (product, options) {
            _order_super.add_product.apply(this, [product, options]);
            this.trigger('update-rewards');
        },
        get_last_orderline: function () {
            const regularLines = _order_super.get_orderlines
                .apply(this, arguments)
                .filter((line) => !line.is_program_reward);
            return regularLines[regularLines.length - 1];
        },

        // NEW METHODS

        /**
         * This method is called whenever something has changed in the order.
         * It removes the current reward lines and replaces them with updated reward lines.
         * It is practically the entry point of the features of pos_coupon.
         */
        updateRewards: async function () {
            if (!this.pos.config.use_coupon_programs) return;
            this.orderlines.remove(this.orderlines.filter((line) => line.is_program_reward));
            const { rewards, unRewardedArray } = await this.calculateRewards();
            this.addRewardLines(rewards);
            this.unRewardedArray = unRewardedArray;
            this.trigger('rewards-updated');
        },
        addRewardLines: function (rewards) {
            this.assert_editable();
            const lines = rewards.map(({ product, unit_price, quantity, program, tax_ids, coupon_id }) => {
                const options = {
                    quantity: quantity,
                    price: unit_price,
                    lst_price: unit_price,
                    is_program_reward: true,
                    program_id: program.id,
                    tax_ids: tax_ids,
                    coupon_id: coupon_id,
                };
                const line = new models.Orderline({}, { pos: this.pos, order: this, product });
                this.fix_tax_included_price(line);
                this.set_orderline_options(line, options);
                return line;
            });
            this.orderlines.add(lines);
        },
        /**
         * When an order is created, it is initialized with default fields:
         * `bookedCouponCodes` and `activePromoProgramIds`.
         * These fields are updated based on different scenarios. An example of which
         * is scanning of coupon codes. `updateRewards` method is very dependent
         * on the values of these fields.
         */
        initializePrograms: async function () {
            if (!this.bookedCouponCodes) {
                /**
                 * @type {CouponCode[]}
                 */
                this.bookedCouponCodes = {};
            }
            if (!this.activePromoProgramIds) {
                /**
                 * These are the other activated promo programs.
                 * Initialized with automatic promo programs' ids.
                 * @type {number[]}
                 */
                this.activePromoProgramIds = this._getAutomaticPromoProgramIds();
            }
        },
        resetPrograms: function () {
            let deactivatedCount = 0;
            if (this.bookedCouponCodes) {
                const couponIds = Object.values(this.bookedCouponCodes).map((couponCode) => couponCode.coupon_id);
                if (couponIds.length > 0) {
                    this.trigger('reset-coupons', couponIds);
                }
                this.bookedCouponCodes = {};
                deactivatedCount += couponIds.length;
            }
            if (this.activePromoProgramIds) {
                const codeNeededPromoProgramIds = this.activePromoProgramIds.filter((program_id) => {
                    return this.pos.coupon_programs_by_id[program_id].promo_code_usage === 'code_needed';
                });
                this.activePromoProgramIds = this._getAutomaticPromoProgramIds();
                deactivatedCount += codeNeededPromoProgramIds.length;
            }
            if (deactivatedCount > 0) Gui.showNotification('Active coupons and promo codes were deactivated.');
            this.trigger('update-rewards');
        },
        _getAutomaticPromoProgramIds: function () {
            return this.pos.promo_programs
                .filter((program) => {
                    return program.promo_code_usage == 'no_code_needed';
                })
                .map((program) => program.id);
        },
        /**
         * These are the coupon programs that are activated
         * via coupon codes. Rewards can only be generated if the coupon
         * program rules are satisfied.
         *
         * @returns {[coupon.program, number][]}
         */
        getBookedCouponPrograms: function () {
            return Object.values(this.bookedCouponCodes)
                .map((couponCode) => [
                    this.pos.coupon_programs_by_id[couponCode.program_id],
                    parseInt(couponCode.coupon_id, 10),
                ])
                .filter(([program]) => {
                    return program.program_type === 'coupon_program';
                });
        },
        /**
         * These are the on_next_order promo programs that are activated
         * via coupon codes. Rewards can be generated from this program
         * without checking the constraints.
         *
         * @returns {[coupon.program, number][]}
         */
        getBookedPromoPrograms: function () {
            return Object.values(this.bookedCouponCodes)
                .map((couponCode) => [
                    this.pos.coupon_programs_by_id[couponCode.program_id],
                    parseInt(couponCode.coupon_id, 10),
                ])
                .filter(([program]) => {
                    return program.program_type === 'promotion_program';
                });
        },
        /**
         * These are the active on_current_order promo programs that will generate
         * rewards if the program constraints are fully-satisfied.
         *
         * @returns {coupon.program[]}
         */
        getActiveOnCurrentPromoPrograms: function () {
            return this.activePromoProgramIds
                .map((program_id) => this.pos.coupon_programs_by_id[program_id])
                .filter((program) => {
                    return program.promo_applicability === 'on_current_order';
                });
        },
        /**
         * These are the active on_next_order promo programs that will generate
         * coupon codes if the program constraints are fully-satisfied.
         *
         * @returns {coupon.program[]}
         */
        getActiveOnNextPromoPrograms: function () {
            return this.activePromoProgramIds
                .map((program_id) => this.pos.coupon_programs_by_id[program_id])
                .filter((program) => {
                    return program.promo_applicability === 'on_next_order';
                });
        },
        /**
         * @param {coupon.program} program
         * @returns {{ successful: boolean, reason: string | undefined }}
         */
        checkProgramRules: async function (program) {
            // Check minimum amount
            const amountToCheck =
                program.rule_minimum_amount_tax_inclusion === 'tax_included'
                    ? this.get_total_with_tax()
                    : this.get_total_without_tax();
            // TODO jcb rule_minimum_amount has to be converted.
            if (!(amountToCheck >= program.rule_minimum_amount)) {
                return {
                    successful: false,
                    reason: 'Minimum amount for this program is not satisfied.',
                };
            }

            // Check minimum quantity
            const validQuantity = this.orderlines
                .filter((line) => {
                    return program.valid_product_ids.has(line.product.id);
                })
                .reduce((total, line) => total + line.quantity, 0);
            if (!(validQuantity >= program.rule_min_quantity)) {
                return {
                    successful: false,
                    reason: "Program's minimum quantity is not satisfied.",
                };
            }

            // Bypass other rules if program is coupon_program
            if (program.program_type === 'coupon_program') {
                return {
                    successful: true,
                };
            }

            // Check if valid customer
            const customer = this.get_client();
            if (program.rule_partners_domain && !program.valid_partner_ids.has(customer ? customer.id : 0)) {
                return {
                    successful: false,
                    reason: "Current customer can't avail this program.",
                };
            }

            // Check rule date
            const ruleFrom = program.rule_date_from ? new Date(program.rule_date_from) : new Date(-8640000000000000);
            const ruleTo = program.rule_date_to ? new Date(program.rule_date_to) : new Date(8640000000000000);
            const orderDate = new Date();
            if (!(orderDate >= ruleFrom && orderDate <= ruleTo)) {
                return {
                    successful: false,
                    reason: 'Program already expired.',
                };
            }

            // Check max number usage
            if (program.maximum_use_number !== 0) {
                const numberUse = await rpc
                    .query({
                        model: 'coupon.program',
                        method: 'get_number_usage',
                        args: [program.id],
                        kwargs: { context: session.user_context },
                    })
                    .catch(() => Promise.resolve(null)); // may happen because offline
                if (numberUse === null) {
                    return {
                        successful: false,
                        reason: 'Unable to get the number of usage of the program.',
                    };
                } else if (!(numberUse < program.maximum_use_number)) {
                    return {
                        successful: false,
                        reason: "Program's maximum number of usage has been reached.",
                    };
                }
            }

            return {
                successful: true,
            };
        },
        /**
         * @param {coupon.program} program
         * @param {number} coupon_id
         * @returns {{ rewards: Reward[], reason: string | undefined }}
         */
        getProductRewards: function (program, coupon_id) {
            if (!(program.reward_type === 'product' || this.orderlines.models.length > 0)) {
                return { rewards: [], reason: 'Empty order.' };
            }

            // Calculate the total quantity of the product that belongs to
            // the programs valid products.
            const totalQuantity = this.orderlines
                .filter((line) => {
                    return program.valid_product_ids.has(line.product.id);
                })
                .reduce((quantity, line) => quantity + line.quantity, 0);

            const freeQuantity = computeFreeQuantity(
                totalQuantity,
                program.rule_min_quantity,
                program.reward_product_quantity
            );
            if (freeQuantity === 0) {
                return { rewards: [], reason: 'Zero free product quantity.' };
            } else {
                const rewardProduct = this.pos.db.get_product_by_id(program.reward_product_id[0]);
                const discountLineProduct = this.pos.db.get_product_by_id(program.discount_line_product_id[0]);
                return {
                    rewards: [
                        new Reward({
                            product: discountLineProduct,
                            unit_price: -rewardProduct.lst_price,
                            quantity: freeQuantity,
                            program: program,
                            tax_ids: rewardProduct.taxes_id,
                            coupon_id: coupon_id,
                        }),
                    ],
                    reason: null,
                };
            }
        },
        /**
         * Returns an Array of discount rewards based on the given program.
         * The provided product_rewards is taken into account, such that we
         * only discount the total amount. e.g. If an order contains 4 Product
         * with 1 Product rewarded, the orderlines will show:
         *      4 Product,
         *     -1 Product.
         * The computed discount is based on 3 Products instead of 4.
         *
         * @param {coupon.program} program
         * @param {Reward[]} product_rewards
         * @param {number} coupon_id
         * @returns {{ rewards: Reward[], reason: string | undefined }}
         */
        getDiscountRewards: function (program, product_rewards, coupon_id) {
            if (!(program.reward_type === 'discount' || this.orderlines.models.length > 0)) {
                return { rewards: [], reason: 'Empty order.' };
            }

            if (program.discount_type === 'fixed_amount') {
                const discountAmount = Math.min(program.discount_fixed_amount, program.discount_max_amount || Infinity);
                return {
                    rewards: [
                        new Reward({
                            product: this.pos.db.get_product_by_id(program.discount_line_product_id[0]),
                            unit_price: -discountAmount,
                            quantity: 1,
                            program: program,
                            tax_ids: [],
                            coupon_id: coupon_id,
                        }),
                    ],
                    reason: null,
                };
            }

            function getGroupKey(line) {
                return line
                    .get_taxes()
                    .map((tax) => tax.id)
                    .join(',');
            }

            // 1. Get amounts to discount
            const productIdsToAccount = new Set();
            const amountsToDiscount = {};
            if (program.discount_apply_on === 'specific_products') {
                for (let line of this.orderlines.models) {
                    if (program.discount_specific_product_ids.has(line.get_product().id)) {
                        const key = getGroupKey(line);
                        if (!(key in amountsToDiscount)) {
                            amountsToDiscount[key] = line.get_quantity() * line.get_lst_price();
                        } else {
                            amountsToDiscount[key] += line.get_quantity() * line.get_lst_price();
                        }
                        productIdsToAccount.add(line.get_product().id);
                    }
                }
            } else if (program.discount_apply_on === 'cheapest_product') {
                // get line with cheapest product
                if (this.orderlines.models.length > 0) {
                    const cheapestLine = this.orderlines.reduce((min_line, line) => {
                        if (line.get_lst_price() < min_line.get_lst_price()) {
                            return line;
                        } else {
                            return min_line;
                        }
                    }, this.orderlines.models[0]);
                    const key = getGroupKey(cheapestLine);
                    amountsToDiscount[key] = cheapestLine.get_lst_price();
                    productIdsToAccount.add(cheapestLine.get_product().id);
                }
            } else {
                for (let line of this.orderlines.models) {
                    const key = getGroupKey(line);
                    if (!(key in amountsToDiscount)) {
                        amountsToDiscount[key] = line.get_quantity() * line.get_lst_price();
                    } else {
                        amountsToDiscount[key] += line.get_quantity() * line.get_lst_price();
                    }
                    productIdsToAccount.add(line.get_product().id);
                }
            }

            // 2. Take into account the rewarded products
            if (program.discount_apply_on !== 'cheapest_product') {
                for (let reward of product_rewards) {
                    if (reward.rewardedProductId && productIdsToAccount.has(reward.rewardedProductId)) {
                        const key = reward.tax_ids.join(',');
                        amountsToDiscount[key] += reward.quantity * reward.unit_price;
                    }
                }
            }

            // 3. Return the discounts
            const discountRewards = Object.entries(amountsToDiscount).map(([tax_keys, amount]) => {
                let discountAmount = (amount * program.discount_percentage) / 100.0;
                discountAmount = Math.min(discountAmount, program.discount_max_amount || Infinity);
                return new Reward({
                    product: this.pos.db.get_product_by_id(program.discount_line_product_id[0]),
                    unit_price: -discountAmount,
                    quantity: 1,
                    program: program,
                    tax_ids: tax_keys !== '' ? tax_keys.split(',').map((val) => parseInt(val, 10)) : [],
                    coupon_id: coupon_id,
                });
            });
            return {
                rewards: discountRewards,
                reason: discountRewards.length > 0 ? null : 'No items to discount.',
            };
        },
        /**
         * Updates `bookedCouponCodes` or `activePromoProgramIds` depending on which code
         * is scanned.
         *
         * @param {string} code
         */
        activateCode: async function (code) {
            const promoProgram = this.pos.promo_programs.find(
                (program) => program.promo_barcode == code || program.promo_code == code
            );
            if (promoProgram && this.activePromoProgramIds.includes(promoProgram.id)) {
                Gui.showNotification('That promo code program has already been activated.');
            } else if (promoProgram) {
                // TODO these two operations should be atomic
                this.activePromoProgramIds.push(promoProgram.id);
                this.trigger('update-rewards');
            } else if (code in this.bookedCouponCodes) {
                Gui.showNotification('That coupon code has already been scanned and activated.');
            } else {
                const programIdsWithScannedCoupon = Object.values(this.bookedCouponCodes).map(
                    (couponCode) => couponCode.program_id
                );
                const customer = this.get_client();
                const { successful, payload } = await rpc.query({
                    model: 'pos.config',
                    method: 'use_coupon_code',
                    args: [[this.pos.config.id], code, customer ? customer.id : false, programIdsWithScannedCoupon],
                    kwargs: { context: session.user_context },
                });
                if (successful) {
                    // TODO these two operations should be atomic
                    this.bookedCouponCodes[code] = new CouponCode(code, payload.coupon_id, payload.program_id);
                    this.trigger('update-rewards');
                } else {
                    Gui.showNotification(payload.error_message);
                }
            }
        },
        /**
         * Using the `activePromoProgramIds`, `bookedCouponCodes` and `orderlines`
         * in this order, calculate rewards and non-reward-generating programs.
         *
         * @returns {{
         *  rewards: Reward[],
         *  unRewardedArray: NotRewarded[],
         * }}
         */
        calculateRewards: async function () {
            const freeProductPrograms = [],
                fixedAmountDiscountPrograms = [],
                onSpecificPrograms = [],
                onCheapestPrograms = [],
                onOrderPrograms = [],
                unRewardedArray = [];

            function updateProgramLists(program, coupon_id) {
                if (program.reward_type === 'product') {
                    freeProductPrograms.push([program, coupon_id]);
                } else {
                    if (program.discount_type === 'fixed_amount') {
                        fixedAmountDiscountPrograms.push([program, coupon_id]);
                    } else if (program.discount_apply_on === 'specific_products') {
                        onSpecificPrograms.push([program, coupon_id]);
                    } else if (program.discount_apply_on === 'cheapest_product') {
                        onCheapestPrograms.push([program, coupon_id]);
                    } else {
                        onOrderPrograms.push([program, coupon_id]);
                    }
                }
            }

            // 1. Update the program lists above based on the active and booked programs
            //    and their corresponding rules.
            for (let [program, coupon_id] of this.getBookedCouponPrograms()) {
                const { successful, reason } = await this.checkProgramRules(program);
                if (successful) {
                    updateProgramLists(program, coupon_id);
                } else {
                    unRewardedArray.push(new NotRewarded(program, coupon_id, reason));
                }
            }
            for (let [program, coupon_id] of this.getBookedPromoPrograms()) {
                // Booked coupons from on next order promo programs do not need
                // checking of rules because checks are done before generating
                // coupons.
                updateProgramLists(program, coupon_id);
            }
            for (let program of this.getActiveOnCurrentPromoPrograms()) {
                const { successful, reason } = await this.checkProgramRules(program);
                if (successful) {
                    updateProgramLists(program, null);
                } else {
                    unRewardedArray.push(new NotRewarded(program, null, reason));
                }
            }

            // 2. Gather the product rewards
            const freeProductRewards = [];
            for (let [program, coupon_id] of freeProductPrograms) {
                const { rewards, reason } = this.getProductRewards(program, coupon_id);
                if (reason) {
                    unRewardedArray.push(new NotRewarded(program, coupon_id, reason));
                }
                freeProductRewards.push(...rewards);
            }

            // 3. Gather the fixed amount discounts
            const fixedAmountDiscounts = [];
            for (let [program, coupon_id] of fixedAmountDiscountPrograms) {
                const { rewards, reason } = this.getDiscountRewards(program, freeProductRewards, coupon_id);
                if (reason) {
                    unRewardedArray.push(new NotRewarded(program, coupon_id, reason));
                }
                fixedAmountDiscounts.push(...rewards);
            }

            // 4. Gather the specific discounts
            const specificDiscounts = [];
            for (let [program, coupon_id] of onSpecificPrograms) {
                const { rewards, reason } = this.getDiscountRewards(program, freeProductRewards, coupon_id);
                if (reason) {
                    unRewardedArray.push(new NotRewarded(program, coupon_id, reason));
                }
                specificDiscounts.push(...rewards);
            }

            // 5. Get global discount (choose highest among results of on_cheapest_programs
            //    and on_order_programs)
            // 5a. Collect the discounts from on order and on cheapest discount programs.
            const globalDiscounts = [];
            for (let [program, coupon_id] of onOrderPrograms) {
                const { rewards, reason } = this.getDiscountRewards(program, freeProductRewards, coupon_id);
                if (reason) {
                    unRewardedArray.push(new NotRewarded(program, coupon_id, reason));
                }
                globalDiscounts.push(...rewards);
            }
            for (let [program, coupon_id] of onCheapestPrograms) {
                const { rewards, reason } = this.getDiscountRewards(program, freeProductRewards, coupon_id);
                if (reason) {
                    unRewardedArray.push(new NotRewarded(program, coupon_id, reason));
                }
                globalDiscounts.push(...rewards);
            }

            // 5b. Group the discounts by program id.
            const groupedGlobalDiscounts = {};
            for (let discount of globalDiscounts) {
                const key = [discount.program.id, discount.coupon_id].join(',');
                if (!(key in groupedGlobalDiscounts)) {
                    groupedGlobalDiscounts[key] = [discount];
                } else {
                    groupedGlobalDiscounts[key].push(discount);
                }
            }

            // 5c. We select the group of discounts with highest total amount.
            // Note that the result is an Array that might contain more than one
            // discount lines. This is because discounts are grouped by tax.
            let currentMaxTotal = 0;
            let currentMaxKey = null;
            for (let key in groupedGlobalDiscounts) {
                const discountRewards = groupedGlobalDiscounts[key];
                const newTotal = discountRewards.reduce((sum, discReward) => sum + discReward.discountAmount, 0);
                if (newTotal > currentMaxTotal) {
                    currentMaxTotal = newTotal;
                    currentMaxKey = key;
                }
            }
            const theOnlyGlobalDiscount = currentMaxKey
                ? groupedGlobalDiscounts[currentMaxKey].filter((discountReward) => discountReward.discountAmount !== 0)
                : [];

            // 5d. Get the messages for the discarded global_discounts
            if (theOnlyGlobalDiscount.length > 0) {
                const theOnlyGlobalDiscountKey = [
                    theOnlyGlobalDiscount[0].program.id,
                    theOnlyGlobalDiscount[0].coupon_id,
                ].join(',');
                for (let [key, discounts] of Object.entries(groupedGlobalDiscounts)) {
                    if (key !== theOnlyGlobalDiscountKey) {
                        unRewardedArray.push(
                            new NotRewarded(
                                discounts[0].program,
                                discounts[0].coupon_id,
                                'Not the greatest global discount.'
                            )
                        );
                    }
                }
            }

            return {
                rewards: freeProductRewards
                    .concat(fixedAmountDiscounts)
                    .concat(specificDiscounts)
                    .concat(theOnlyGlobalDiscount),
                unRewardedArray: unRewardedArray,
            };
        },
        /**
         * @param {number[]} coupon_ids ids of the coupon.coupon records to reset
         */
        resetCoupons: async function (coupon_ids) {
            await rpc.query(
                {
                    model: 'coupon.coupon',
                    method: 'write',
                    args: [coupon_ids, { state: 'new' }],
                    kwargs: { context: session.user_context },
                },
                {}
            );
        },
    });

    var _orderline_super = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        export_as_JSON: function () {
            var result = _orderline_super.export_as_JSON.apply(this);
            result.is_program_reward = this.is_program_reward;
            result.program_id = this.program_id;
            result.coupon_id = this.coupon_id;
            return result;
        },
        init_from_JSON: function (json) {
            if (json.is_program_reward) {
                this.is_program_reward = json.is_program_reward;
                this.program_id = json.program_id;
                this.coupon_id = json.coupon_id;
                this.tax_ids = json.tax_ids[0][2];
            }
            _orderline_super.init_from_JSON.apply(this, [json]);
        },
        set_quantity: function (quantity, keep_price) {
            _orderline_super.set_quantity.apply(this, [quantity, keep_price]);
            // This function removes an order line if we set the quantity to 'remove'
            // We extend its functionality so that if a reward line is removed,
            // other reward lines from the same program are also deleted.
            if (quantity === 'remove' && this.is_program_reward) {
                let related_rewards = this.order.orderlines.filter(
                    (line) => line.is_program_reward && line.program_id === this.program_id
                );
                for (let line of related_rewards) {
                    line.order.remove_orderline(line);
                }
                if (related_rewards.length !== 0) {
                    Gui.showNotification('Other reward lines from the same program were also removed.');
                }
            }
        },
    });
});
