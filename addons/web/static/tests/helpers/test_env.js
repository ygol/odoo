odoo.define('web.test_env', async function (require) {
    "use strict";

    const Bus = require('web.Bus');
    const { buildQuery } = require('web.rpc');
    const session = require('web.session');

    /**
     * Creates a test environment with the given environment object.
     * Any access to a key that has not been explicitly defined in the given environment object
     * will result in an error.
     *
     * @param {Object} [env={}]
     * @param {Function} [providedRPC=null]
     * @returns {Proxy}
     */
    function makeTestEnvironment(env = {}, providedRPC = null) {
        const database = {
            parameters: {
                code: "en_US",
                date_format: '%m/%d/%Y',
                decimal_point: ".",
                direction: 'ltr',
                grouping: [],
                thousands_sep: ",",
                time_format: '%H:%M:%S',
            },
        };
        const defaultEnv = {
            _t: env._t || Object.assign((s => s), { database }),
            bus: env.bus || new Bus(),
            device: Object.assign({ isMobile: false }, env.device),
            isDebug: env.isDebug || (() => false),
            qweb: new owl.QWeb({ templates: session.owlTemplates }),
            services: Object.assign({
                ajax: {
                    rpc() {
                      return env.session.rpc(...arguments); // Compatibility Legacy Widgets
                    }
                },
                getCookie() {},
                httpRequest(/* route, params = {}, readMethod = 'json' */) {
                    return Promise.resolve('');
                },
                rpc(params, options) {
                    const query = buildQuery(params);
                    return env.session.rpc(query.route, query.params, options);
                },
                notification: { notify() { } },
            }, env.services),
            session: Object.assign({
                rpc(route, params, options) {
                    if (providedRPC) {
                        return providedRPC(route, params, options);
                    }
                    throw new Error(`No method to perform RPC`);
                },
                url: session.url,
            }, env.session),
            window: Object.assign({
                clearTimeout: (...args) => window.clearTimeout(...args),
                innerHeight: 1080,
                innerWidth: 1920,
                Notification: {
                    permission: 'denied',
                    async requestPermission() {
                        return this.permission;
                    },
                },
                setTimeout: (...args) => window.setTimeout(...args),
            }, env.window),
        };
        return Object.assign(env, defaultEnv);
    }

    /**
     * Before each test, we want owl.Component.env to be a fresh test environment.
     */
    QUnit.on('OdooBeforeTestHook', function () {
        owl.Component.env = makeTestEnvironment();
    });

    return makeTestEnvironment;
});
