odoo.define('website_crm_referral.referral_form', function (require) {
    "use strict";



var ReferralForm = require('website_sale_referral.referral_form');

ReferralForm.include({
    events: _.extend({}, ReferralForm.prototype.events, {
        'click #submit' : 'onclick_submit'
    }),

    onclick_submit: function(ev) {
        this.clean_checks()

        $("input[id='referred_email']").attr('required','1');
        $("input[id='referred_name']").attr('required','1');

        this.onclick_common(ev, function(data) { window.location.reload(); });
    },

    clean_checks: function() {
        this._super.apply(this, arguments);
        $("input[id='referred_email']").removeAttr('required');
        $("input[id='referred_name']").removeAttr('required');
    },

    empty_form:function() {
        this._super.apply(this, arguments);
        $("input[id='referred_name']")[0].val = '';
        $("input[id='referred_email']")[0].val = '';
        $("input[id='referred_phone']")[0].val = '';
        $("input[id='referred_company']")[0].val = '';
        $("textarea[id='referred_comment']")[0].val = '';
    },

    get_params:function() {
        var params = this._super.apply(this, arguments);
        params.name = $("input[id='referred_name']").val();
        params.email = $("input[id='referred_email']").val();
        params.phone = $("input[id='referred_phone']").val();
        params.company = $("input[id='referred_company']").val();
        params.comment = $("textarea[id='referred_comment']").val();
        return params;
    },

});

});
