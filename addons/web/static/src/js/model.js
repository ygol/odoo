odoo.define("web.model", function (require) {
    "use strict";

    const { parse, stringify } = require("web.utils");
    const Registry = require("web.Registry");

    const { Component, core } = owl;
    const { EventBus, Observer } = core;
    const NULL_VALUES = [null, undefined];

    // TODO: remove this if made available in owl.utils
    function partitionBy(arr, fn) {
        let lastGroup = false;
        let lastValue;
        return arr.reduce((acc, cur) => {
            let curVal = fn(cur);
            if (lastGroup) {
                if (curVal === lastValue) {
                    lastGroup.push(cur);
                } else {
                    lastGroup = false;
                }
            }
            if (!lastGroup) {
                lastGroup = [cur];
                acc.push(lastGroup);
            }
            lastValue = curVal;
            return acc;
        }, []);
    }

    /**
     * Feature extension of the class Model
     * @see {Model}
     */
    class ModelExtension {
        constructor(model, config) {
            this.model = model;
            this.config = config;
            this.env = this.config.env;
            this.state = {};
        }

        //---------------------------------------------------------------------
        // Hooks
        //---------------------------------------------------------------------

        /**
         * Meant to return the result of the appropriate getter or do nothing if
         * not concerned by the given property.
         * @abstract
         * @param {string} property
         * @returns {any}
         */
        get() {
            /* ... */
        }

        /**
         * Called and awaited on initial model load.
         * @abstract
         */
        async load() {
            /* ... */
        }

        /**
         * Called on initialization if no imported state for the extension is found.
         * @abstract
         */
        prepareState() {
            /* ... */
        }

        /**
         * Called and awaited after an action dispatch.
         * @abstract
         */
        async reloadAfterDispatch() {
            /* ... */
        }
    }

    /**
     * Model
     *
     * The purpose of the class Model and the associated hook useModel
     * is to offer something similar to an owl store but with no automatic
     * notification (and rendering) of components when the 'state' used in the model
     * would change. Instead, one should call the __notifyComponents function whenever
     * it is useful to alert registered component. Nevertheless,
     * when calling a method throught the dispatch method, a notification
     * does take place automatically, and registered components (via useModel) are rendered.
     *
     * It is highly expected that this class will change in a near future. We don't have
     * the necessary hindsight to be sure its actual form is good.
     *
     * The following snippets show a typical use case of the model system: a search
     * model with a control panel extension feature.
     *
     *-------------------------------------------------------------------------
     * MODEL AND EXTENSIONS DEFINITION
     *-------------------------------------------------------------------------
     *
     * 1. Definition of the main model
     * @see Model
     * ```
     *  class ActionModel extends Model {
     *      // ...
     *  }
     * ```
     *
     * 2. Definition of the model extension
     * @see ModelExtension
     * ```
     *  class SearchModel extends ActionModel.Extension {
     *      // ...
     *  }
     * ```
     *
     * 3. Registration of the extension into the main model
     * @see Registry()
     * ```
     *  ActionModel.registry.add("control-panel", SearchModel, 10);
     * ```
     *
     *-------------------------------------------------------------------------
     * ON VIEW/ACTION INIT
     *-------------------------------------------------------------------------
     *
     * 4. Creation of the core model and its extensions
     * @see Model.prototype.constructor()
     * ```
     *  const extensions = {
     *      "search-panel" : {
     *          // ...
     *      }
     *  }
     *  const searchModelConfig = {
     *      // ...
     *  };
     *  const actionModel = new ActionModel(extensions, searchModelConfig[, importedState]);
     * ```
     *
     * 5. Loading of all extensions' asynchronous data
     * @see Model.prototype.load()
     * ```
     *  await actionModel.load();
     * ```
     *
     * 6. Subscribing to the model changes
     * @see useModel()
     * ```
     *  class ControlPanel extends Component {
     *      constructor() {
     *          super(...arguments);
     *          // env must contain the actionModel
     *          this.actionModel = useModel('actionModel');
     *      }
     *  }
     * ```
     *
     *-------------------------------------------------------------------------
     * MODEL USAGE ON RUNTIME
     *-------------------------------------------------------------------------
     *
     * Case: dispatch an action
     * @see Model.prototype.dispatch()
     * ```
     *  await actionModel.dispatch("updateProperty", value);
     * ```
     *
     * Case: call a getter
     * @see Model.prototype.get()
     * ```
     *  const result = actionModel.get("property");
     * ```
     *
     * Case: model transition -> export/import the state
     * @see Model.prototype.exportState()
     * @see Model.prototype.importState()
     * ```
     *  const state = actionModel.exportState();
     *  // ... begin anew from step 4 ...
     *  newActionModel.importState(state);
     * ```
     * @abstract
     * @extends EventBus
     */
    class Model extends EventBus {
        /**
         * Instantiated extensions are determined by the `extensions` argument:
         * - keys are the extensions names as added in the registry
         * - values are the local configurations given to each extension
         * The construction/loading/dispatch/get order is determined by the registry
         * score given to each extension.
         * An optional `importedState` can be given to speed up the instantiation
         * process.
         * @param {Object} extensions
         * @param {Object} [globalConfig={}] global configuration: can be accessed by itself
         *      and each of the added extensions.
         * @param {Object} [importedState]
         */
        constructor(extensions, globalConfig, importedState) {
            super();

            this.config = globalConfig || {};
            this.env = this.config.env;

            this.extensions = [];
            this.mapping = {};
            this.rev = 1;

            // Order and validate given extensions
            const excessExtensions = Object.assign({}, extensions);
            const { name, registry } = this.constructor;
            if (!registry || !(registry instanceof Registry)) {
                // No registry found on the current Model
                throw new Error(`Unimplemented registry on model "${name}".`);
            }
            const sortedExtensionNames = [];
            for (const key of registry.keys()) {
                if (key in excessExtensions) {
                    sortedExtensionNames.push(key);
                    delete excessExtensions[key];
                }
            }
            const excessKeys = Object.keys(excessExtensions);
            if (excessKeys.length) {
                // Keys not linked to a registered extensions
                throw new Error(
                    `Unknown model extension(s) "${excessKeys.join(
                        ", "
                    )}" in model "${name}".`
                );
            }

            // Sequencially instantiate all extensions
            for (const extensionName of sortedExtensionNames) {
                // Extension config = this.config ∪ extension.config
                const config = Object.assign(
                    {},
                    this.config,
                    extensions[extensionName]
                );
                const Extension = registry.get(extensionName);
                const extension = new Extension(this, config);
                this.extensions.push(extension);
            }

            // Sequencially start the extensions
            this.importState(importedState);
        }

        //---------------------------------------------------------------------
        // Public
        //---------------------------------------------------------------------

        /**
         * Call the base model method with given name with the arguments
         * determined by the dispatch extra arguments.
         * @returns {Promise}
         */
        async dispatch(method, ...args) {
            // Phase 1: call dispatch methods
            // Purpose: call the actual queried action
            const dispatchResults = [];
            for (const extension of this.extensions) {
                if (method in extension) {
                    dispatchResults.push(extension[method](...args));
                }
            }
            await Promise.all(dispatchResults);

            // Phase 2: call 'after dispatch' hooks
            // Purpose: fetch updated data from the server
            const afterDispatchResults = [];
            for (const extension of this.extensions) {
                afterDispatchResults.push(extension.reloadAfterDispatch());
            }
            await Promise.all(afterDispatchResults);

            // Phase 3: notify subscribed components
            // Purpose: re-render components bound by 'useModel'
            let rev = this.rev;
            await Promise.resolve();
            if (rev === this.rev) {
                this._notifyComponents();
            }
        }

        /**
         * Must be called after construction if a state must be imported.
         * Aggregate the extension states into a single state object
         * separated by the names of each extension.
         * @returns {{ [extensionName: string]: string}}
         */
        exportState() {
            const exportedState = {};
            for (const extension of this.extensions) {
                exportedState[extension.constructor.name] = stringify(
                    extension.state
                );
            }
            return exportedState;
        }

        /**
         * Return the result of the first related getter on itself or any instantiated
         * extension. This method must be overridden if multiple extensions share
         * a common getter.
         * @returns {any}
         */
        get(property) {
            const results = this.getAll(...arguments);
            const resultValues = Object.values(results);
            if (resultValues.length > 1) {
                throw new Error(
                    `Property "${property}" is provided by more than one extension: "${Object.keys(
                        results
                    ).join(`" and "`)}".`
                );
            }
            return resultValues.length ? resultValues[0] : null;
        }

        /**
         * Return the results of all extensions having a getter returning a non-null
         * value.
         * @param {string} property
         * @param  {...any} args
         * @returns {{ [extensionName: string]: any }}
         */
        getAll(property, ...args) {
            const results = {};
            for (const extension of this.extensions) {
                const result = extension.get(property, ...args);
                if (!NULL_VALUES.includes(result)) {
                    results[extension.constructor.name] = result;
                }
            }
            return results;
        }

        /**
         * Used to assign each state section to its respective extension.
         * If a model finds a related state in the imported state, it is imported
         * as its new state. If not, prepareState is called to prepare a new state.
         * @param {Object} [importedState={}]
         */
        importState(importedState = {}) {
            for (const extension of this.extensions) {
                if (extension.constructor.name in importedState) {
                    Object.assign(
                        extension.state,
                        parse(importedState[extension.constructor.name])
                    );
                } else {
                    extension.prepareState();
                }
            }
        }

        /**
         * Must be called after construction and state preparation/import.
         * Wait for all asynchronous work needed by the model extensions
         * to be ready.
         * @returns {Promise}
         */
        async load() {
            for (const extension of this.extensions) {
                await extension.load();
            }
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        /**
         * see Context method in owl.js for explanation
         * @private
         */
        async _notifyComponents() {
            const rev = ++this.rev;
            const subscriptions = this.subscriptions.update;
            const groups = partitionBy(subscriptions, (s) =>
                s.owner ? s.owner.__owl__.depth : -1
            );
            for (let group of groups) {
                const proms = group.map((sub) =>
                    sub.callback.call(sub.owner, rev)
                );
                Component.scheduler.flush();
                await Promise.all(proms);
            }
        }
    }

    Model.Extension = ModelExtension;

    /**
     * This is more or less the hook 'useContextWithCB' from owl only slightly simplified.
     *
     * @param {string} modelName
     */
    function useModel(modelName) {
        const component = Component.current;
        const model = component.env[modelName];
        if (!(model instanceof Model)) {
            throw new Error(`No Model found when connecting '${component.constructor.name}'`);
        }

        const mapping = model.mapping;
        const __owl__ = component.__owl__;
        const componentId = __owl__.id;
        if (!__owl__.observer) {
            __owl__.observer = new Observer();
            __owl__.observer.notifyCB = component.render.bind(component);
        }
        const currentCB = __owl__.observer.notifyCB;
        __owl__.observer.notifyCB = function () {
            if (model.rev > mapping[componentId]) {
                return;
            }
            currentCB();
        };
        mapping[componentId] = 0;
        const renderFn = __owl__.renderFn;
        __owl__.renderFn = function (comp, params) {
            mapping[componentId] = model.rev;
            return renderFn(comp, params);
        };

        model.on("update", component, async (modelRev) => {
            if (mapping[componentId] < modelRev) {
                mapping[componentId] = modelRev;
                await component.render();
            }
        });

        const __destroy = component.__destroy;
        component.__destroy = (parent) => {
            model.off("update", component);
            __destroy.call(component, parent);
        };

        return model;
    }

    return {
        Model,
        useModel,
    };
});
