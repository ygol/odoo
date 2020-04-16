odoo.define('mail.messaging.entity.FollowerSubtypeList', function (require) {
'use strict';

const {
    fields: {
        many2one,
    },
    registerNewEntity,
} = require('mail.messaging.entity.core');

function FollowerSubtypeListFactory({ Entity }) {

    class FollowerSubtypeList extends Entity {}

    FollowerSubtypeList.entityName = 'FollowerSubtypeList';

    FollowerSubtypeList.fields = {
        follower: many2one('Follower'),
    };

    return FollowerSubtypeList;
}

registerNewEntity('FollowerSubtypeList', FollowerSubtypeListFactory);

});
