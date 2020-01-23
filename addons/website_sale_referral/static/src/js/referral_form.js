odoo.define('website_sale_referral.referral_form', function (require) {
    "use strict";

var publicWidget = require('web.public.widget');
var ajax = require('web.ajax');

publicWidget.registry.ReferralWidget = publicWidget.Widget.extend({
    selector:'.referral_form',
    events: {
        'click .share_social_network': 'onclick_share_social_network',
        'click .get_link' : 'onclick_get_link'
    },

    start: function() {
        var referrer_email = $("input[id='referrer_email']")
        if(referrer_email.length) { //user is not connected
            referrer_email.attr('required','1')
        }
        return this._super.apply(this, arguments);
    },

    onclick_common: function(ev, then) {
        var form = this.el
        if(form.checkValidity())
        {
            var referrer_email_input = $("input[id='referrer_email']")
            var params = {}
            if(referrer_email_input.length) {
                params['referrer_email'] = referrer_email_input[0].value
            }
            params['channel'] = ev.target.closest('button').value
            ajax.jsonRpc('/referral/send2', 'call', params)
            .then(function (data) {
                referrer_email_input[0].value = ''
                then(data)
            })
        } else {debugger}
    },

    onclick_share_social_network: function(ev) {
        this.onclick_common(ev, function(data) {window.open(data["link"])})
    },

    onclick_get_link: function(ev) {
        this.onclick_common(ev, function(data) {
            debugger
            $("#share_link_text").append("<div class='row col-lg-12 text-center alert alert-info'>" + data["link"] + "</div>");
        })
    }
});

return publicWidget.registry.ReferralWidget;

});
