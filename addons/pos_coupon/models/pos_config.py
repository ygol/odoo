# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# NOTE Use black to automatically format this code.

from datetime import datetime

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class PosConfig(models.Model):
    _inherit = "pos.config"

    use_coupon_programs = fields.Boolean(
        "Coupons & Promotions",
        help="Use coupon and promotion programs in this PoS configuration.",
    )
    coupon_program_ids = fields.Many2many(
        "coupon.program",
        relation="coupon_program_pos_config_rel",
        string="Coupon Programs",
        domain=[("program_type", "=", "coupon_program"), ("active", "=", True)],
    )
    promo_program_ids = fields.Many2many(
        "coupon.program",
        relation="promo_program_pos_config_rel",
        string="Promotion Programs",
        domain=[("program_type", "=", "promotion_program"), ("active", "=", True)],
    )
    program_ids = fields.Many2many(
        "coupon.program",
        relation="program_pos_config_rel",
        string="Coupons and Promotions",
        store=True,
        compute="_compute_program_ids",
    )

    @api.depends("promo_program_ids", "coupon_program_ids")
    def _compute_program_ids(self):
        for pos_config in self:
            pos_config.program_ids = (
                pos_config.promo_program_ids | pos_config.coupon_program_ids
            )

    def open_session_cb(self, check_coa=True):
        # Check validity of programs before opening a new session
        invalid_reward_products_msg = ""
        for program in self.program_ids:
            if (
                program.reward_product_id
                and not program.reward_product_id.available_in_pos
            ):
                reward_product = program.reward_product_id
                invalid_reward_products_msg += f"\n\tProgram: `{program.name}` ({program.program_type}), Reward Product: `{reward_product.name}`"

        if invalid_reward_products_msg:
            intro = f"To continue, make the following reward products to be available in Point of Sale.\n"
            raise UserError(f"{intro}{invalid_reward_products_msg}")

        return super(PosConfig, self).open_session_cb(check_coa)

    def use_coupon_code(self, code, partner_id, reserved_program_ids):
        # The idea is to have a list of filter methods.
        # We loop thru each filter method, reducing the valid
        # coupons with each iteration.
        # If we successfully went thru each filter with remaining valid coupons,
        #   we return with the first valid coupon.
        # Else,
        #   we return with the error message that broke the loop
        valid_coupons = self.env["coupon.coupon"]
        for filter_method in self._filter_coupon_methods():
            valid_coupons, error_message = filter_method(
                valid_coupons,
                code=code,
                partner_id=partner_id,
                reserved_program_ids=reserved_program_ids,
            )
            if not valid_coupons:
                break
        else:
            coupon_to_use = valid_coupons[:1]
            coupon_to_use.write({"state": "used"})
            return {
                "successful": True,
                "payload": {
                    "program_id": coupon_to_use.program_id.id,
                    "coupon_id": coupon_to_use.id,
                },
            }
        return {
            "successful": False,
            "payload": {"error_message": error_message},
        }

    def _only_coupons_with_given_code(self, coupons, **kwargs):
        code = kwargs.get("code")
        programs_to_check = (
            self.promo_program_ids.filtered(
                lambda program: program.promo_applicability == "on_next_order"
            )
            | self.coupon_program_ids
        )
        valid_coupons = self.env["coupon.coupon"].search(
            [("code", "=", code), ("program_id", "in", programs_to_check.ids)]
        )
        return valid_coupons, "Coupon not found." if not valid_coupons else ""

    def _only_coupons_from_unreserved_programs(self, coupons, **kwargs):
        reserved_program_ids = kwargs.get("reserved_program_ids") or []
        remaining_coupons = coupons.filtered(
            lambda c: c.program_id.id not in reserved_program_ids
        )
        return (
            remaining_coupons,
            "A coupon from the same program has already been reserved for this order."
            if not remaining_coupons
            else "",
        )

    def _only_unused_coupons(self, coupons, **kwargs):
        remaining_coupons = coupons.filtered(lambda c: c.state == "new")
        return (
            remaining_coupons,
            "Coupon has already been used." if not remaining_coupons else "",
        )

    def _only_coupons_owned_by_customer(self, coupons, **kwargs):
        partner_id = kwargs.get("partner_id")
        remaining_coupons = coupons.filtered(lambda c: c.partner_id.id == partner_id)
        return (
            remaining_coupons,
            "Coupon isn't owned by the customer." if not remaining_coupons else "",
        )

    def _only_unexpired_coupons(self, coupons, **kwargs):
        remaining_coupons = coupons.filtered(
            lambda c: not c.expiration_date
            or c.expiration_date >= datetime.date(datetime.now())
        )
        return (
            remaining_coupons,
            "Coupon already expired." if not remaining_coupons else "",
        )

    def _filter_coupon_methods(self):
        return [
            self._only_coupons_with_given_code,
            self._only_coupons_from_unreserved_programs,
            self._only_unused_coupons,
            self._only_coupons_owned_by_customer,
            self._only_unexpired_coupons,
        ]
