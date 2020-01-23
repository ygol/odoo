odoo.define('website_crm_referral.referral_form', function (require) {
    "use strict";



var ReferralForm = require('website_sale_referral.referral_form');

ReferralForm.include({
    events: _.extend({}, ReferralForm.prototype.events, {
        'submit': 'onSubmit',
    }),

    start: function() {
        return this._super.apply(this, arguments);
    },

    onSubmit: function() {
        $("input[id='referree_email']").attr('required','1')
        $("input[id='referree_name']").attr('required','1')
    }
});

});