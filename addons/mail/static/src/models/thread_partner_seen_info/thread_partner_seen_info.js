odoo.define('mail/static/src/models/thread_partner_seen_info/thread_partner_seen_info.js', function (require) {
'use strict';

const { registerNewModel } = require('mail/static/src/model/model_core.js');
const { attr, many2one } = require('mail/static/src/model/model_field.js');

function factory(dependencies) {

    class ThreadPartnerSeenInfo extends dependencies['mail.model'] {

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * @override
         */
        static _findFunctionFromData(data) {
            return  record => (
                record.partner_id === data.partner_id &&
                record.channel_id === data.channel_id
            );
        }

        /**
         * @private
         * @returns {mail.partner|undefined}
         */
        _computePartner() {
            if (!this.partner_id) {
                return;
            }
            return [['insert', { id: this.partner_id }]];
        }

        /**
         * @private
         * @returns {mail.thread|undefined}
         */
        _computeThread() {
            if (!this.channel_id) {
                return;
            }
            return [['insert', { id: this.channel_id, model: 'mail.channel' }]];
        }

    }

    ThreadPartnerSeenInfo.modelName = 'mail.thread_partner_seen_info';

    ThreadPartnerSeenInfo.fields = {
        /**
         * This allows to have channel id available at creation (instead of command).
         */
        channel_id: attr(),
        lastFetchedMessage: many2one('mail.message'),
        lastSeenMessage: many2one('mail.message'),
        /**
         * Consider it as readonly, it is computed based on partner_id field.
         * @see partner_id
         */
        partner: many2one('mail.partner', {
            compute: '_computePartner',
            dependencies: ['partner_id'],
        }),
        /**
         * This allows to have partner id available at creation (instead of command).
         */
        partner_id: attr(),
        /**
         * Consider it as readonly, it is computed based on thread_id field.
         * @see thread_id
         */
        thread: many2one('mail.thread', {
            compute: '_computeThread',
            dependencies: ['channel_id'],
            inverse: 'partnerSeenInfos',
        }),
    };

    return ThreadPartnerSeenInfo;
}

registerNewModel('mail.thread_partner_seen_info', factory);

});
