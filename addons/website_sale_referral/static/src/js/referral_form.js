odoo.define('website_sale_referral.referral_form', function (require) {
    "use strict";

var publicWidget = require('web.public.widget');
var ajax = require('web.ajax');

publicWidget.registry.ReferralWidget = publicWidget.Widget.extend({
    selector:'.referral_form',
    events: {
        'click .share_social_network': 'onclick_share_social_network',
        'click .get_link' : 'onclick_get_link',
    },

    onclick_share_social_network: function(ev) {
        this.onclick_common(ev, function(data)
        {
            window.open(data.link);
        });
    },

    onclick_get_link: function(ev) {
        this.onclick_common(ev, function(data) {
            var input = $("input[id='copy_link_input']")[0];
            input.value = data.link;
            input.select();
            document.execCommand("copy");
        });
    },

    onclick_common: function(ev, then_func) {
        if(this.check_form_validity(ev.target.closest('button')))
        {
            ajax.jsonRpc('/referral/send', 'call', this.get_params(ev))
            .then(function (data) {
                then_func(data);
            });
        } else {}
    },

    check_form_validity: function(submit_button) {
        return true;
        // var required_empty_input = $("input:required").filter(function(index, item) { return item.value === ''; });
        // if(required_empty_input.length) {
        //     //ELIZABETH2 => Il y a 2 endroits ou cette injection peut se produire
        //     //Voir fichiers website_sale_referral/views/referral_template.xml et website_crm_referral/views/referral_template.xml
        //     $(submit_button).parent().parent().append("<div class='alert alert-danger alert-dismissable fade show'>" + _('Some required fields are not filled') + "</div>");
        //     required_empty_input.each(function(index, item) { $(item).addClass('bg-danger'); });
        // }

        // var invalid_email = false;
        // $("input[type='email']:required").each(function(index, item) {
        //     var email = item.value;
        //     if(email != '') {
        //         var atpos = email.indexOf("@");
        //         var dotpos = email.lastIndexOf(".");
        //         if (atpos<1 || dotpos<atpos+2 || dotpos+2>=email.length) { //invalid
        //             $(item).addClass('bg-danger');
        //             if(!invalid_email) {
        //                 //ELIZABETH2
        //                 $(submit_button).parent().append("<div class='alert alert-danger alert-dismissable fade show'>" + _('Not a valid e-mail address') + "</div>");
        //                 invalid_email = true;
        //             }
        //         }
        //     }
        // });
        // $(".alert").delay(4000).slideUp(200, function() {
        //     $(this).alert('close');
        // });
        // return !invalid_email && !required_empty_input.length;
    },

    get_params:function(ev) {
        var params = {};
        params.token = $("input[name='token']").val();
        params.channel = ev.target.closest('button').value;
        return params;
    },
});

return publicWidget.registry.ReferralWidget;

});
