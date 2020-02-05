odoo.define('website_crm_referral.referral_form', function (require) {
    "use strict";



var ReferralForm = require('website_sale_referral.referral_form');
var core = require('web.core');
var QWeb = core.qweb;

ReferralForm.include({
    events: _.extend({}, ReferralForm.prototype.events, {
        'click #create_lead' : 'onclick_submit'
    }),

    start: function() {
        QWeb.add_template("/website_crm_referral/static/src/xml/template.xml");
        return this._super.apply(this, arguments);
    },

    onclick_submit: function(ev) {
        var params = this.get_params(ev);
        this.empty_form();
        var self = this;
        this.onclick_common(ev, function(data)
        {
            self.inject_tracking(params);
            //window.location.reload(); //TODO inject or completely delete the custom widget (keep it only for window.open)
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

    inject_tracking: function(params) {
        var rendered_html = QWeb.render('website_sale_referral.testt_template', {'r':{'name': params.name, 'company': params.company, 'state': 'new'}});
        $("div[id='testtt']").append(rendered_html);
    },

});

});
