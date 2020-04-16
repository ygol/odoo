odoo.define('mail.messaging.entity.ActivityType', function (require) {
'use strict';

const {
    fields: {
        attr,
        one2many,
    },
    registerNewEntity,
} = require('mail.messaging.entity.core');

function ActivityTypeFactory({ Entity }) {

    class ActivityType extends Entity {}

    ActivityType.entityName = 'ActivityType';

    ActivityType.fields = {
        activities: one2many('Activity', {
            inverse: 'type',
        }),
        displayName: attr(),
        id: attr(),
    };

    return ActivityType;
}

registerNewEntity('ActivityType', ActivityTypeFactory);

});
