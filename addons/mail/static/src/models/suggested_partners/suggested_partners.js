odoo.define('mail/static/src/models/suggested_partners/suggested_partners.js', function (require) {
'use strict';

const { registerNewModel } = require('mail/static/src/model/model_core.js');
const { attr, many2one } = require('mail/static/src/model/model_field.js');
const mailUtils = require('mail.utils');

function factory(dependencies) {
    class SuggestedPartner extends dependencies['mail.model'] {
        init(...args) {
            super.init(...args);
        }

        static convertData(data) {
            const parsedEmail = data[1] && mailUtils.parseEmail(data[1]);
            const data2 = {
                checked: true,
                partner_id: data[0] ? data[0] : undefined,
                reason: data[2],
            };

            if (data2.partner_id) {
                data2.partner = [
                    ['insert', {
                        id: data2.partner_id,
                        name: parsedEmail[0],
                        email: parsedEmail[1],
                        email_formatted: data[1],
                    }],
                ];
            } else {
                data2.name = '"' + parsedEmail[0] + '" (' + parsedEmail[1] + ')';
                data2.email = parsedEmail[1];
            }

            return data2;
        }
    }

    SuggestedPartner.fields = {
        id: attr(),
        name: attr(),
        email: attr(),
        checked: attr({ default: true }),
        partner: many2one('mail.partner'),
        reason: attr(),
    };
    SuggestedPartner.modelName = 'mail.suggested_partner';
    return SuggestedPartner;
}

registerNewModel('mail.suggested_partner', factory);
});
