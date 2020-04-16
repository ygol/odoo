odoo.define('mail.messaging.entity.User', function (require) {
'use strict';

const {
    fields: {
        attr,
        one2one,
    },
    registerNewEntity,
} = require('mail.messaging.entity.core');

function UserFactory({ Entity }) {

    class User extends Entity {

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * @returns {string}
         */
        nameOrDisplayName() {
            const partner = this.partner;
            if (!partner) {
                return this._displayName;
            }
            return partner.nameOrDisplayName;
        }

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * @override
         */
        _createInstanceLocalId(data) {
            return `${this.constructor.entityName}_${data.id}`;
        }

        /**
         * @override
         */
        _updateAfter(previous) {
            if (this._displayName && this.partner) {
                this.partner.update({ display_name: this._displayName });
            }
        }

    }

    User.entityName = 'User';

    User.fields = {
        _displayName: attr(),
        id: attr(),
        model: attr({
            default: 'res.user',
        }),
        partner: one2one('Partner', {
            inverse: 'user',
        }),
    };

    return User;
}

registerNewEntity('User', UserFactory);

});
