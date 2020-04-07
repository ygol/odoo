odoo.define('mail.testUtils', function (require) {
"use strict";

var Discuss = require('mail.Discuss');

var testUtils = require('web.test_utils');
var Widget = require('web.Widget');

/**
 * Test Utils
 *
 * In this module, we define some utility functions to create mock objects
 * in the mail module, such as the BusService or Discuss.
 */

/**
 * Create asynchronously a discuss widget.
 * This is async due to mail_manager/mail_service that needs to be ready.
 *
 * @param {Object} params
 * @return {Promise} resolved with the discuss widget
 */
async function createDiscuss(params) {
    var Parent = Widget.extend({
        do_push_state: function () {},
    });
    var parent = new Parent();
    params.archs = params.archs || {
        'mail.message,false,search': '<search/>',
    };
    testUtils.mock.addMockEnvironment(parent, params);
    var discuss = new Discuss(parent, params);
    var selector = params.debug ? 'body' : '#qunit-fixture';

    // override 'destroy' of discuss so that it calls 'destroy' on the parent
    // instead, which is the parent of discuss and the mockServer.
    discuss.destroy = function () {
        // remove the override to properly destroy discuss and its children
        // when it will be called the second time (by its parent)
        delete discuss.destroy;
        parent.destroy();
    };

    return discuss.appendTo($(selector)).then(function () {
        return discuss;
    });
}

return {
    createDiscuss: createDiscuss,
};

});
