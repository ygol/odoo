odoo.define('website_crm_referral.referral_form', function (require) {
    "use strict";



var ReferralForm = require('website_sale_referral.referral_form');

ReferralForm.include({
    events: _.extend({}, ReferralForm.prototype.events, {
        'click #create_lead' : 'onclick_submit'
    }),

    onclick_submit: function(ev) {
        this.empty_form();
        this.onclick_common(ev, function(data)
        {
            window.location.reload(); //TODO inject or completely delete the custom widget (keep it only for window.open)
        });
    },

    empty_form:function() {
        $("input[name='name']")[0].val = '';
        $("input[name='email']")[0].val = '';
        $("input[name='phone']")[0].val = '';
        $("input[name='company']")[0].val = '';
        $("textarea[name='comment']")[0].val = '';
    },

    get_params:function(ev) {
        var params = this._super.apply(this, arguments);
        params.name = $("input[name='name']").val();
        params.email = $("input[name='email']").val();
        params.phone = $("input[name='phone']").val();
        params.company = $("input[name='company']").val();
        params.comment = $("textarea[name='comment']").val();
        return params;
    },

});

});
