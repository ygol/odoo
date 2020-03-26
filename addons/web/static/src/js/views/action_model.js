odoo.define("web.ActionModel", function (require) {
    "use strict";

    const { Model } = require("web.model");
    const { parseArch } = require("web.viewUtils");
    const Registry = require("web.Registry");

    const isObject = (obj) => typeof obj === "object" && obj !== null;

    /**
     * @extends Model.Extension
     */
    class ActionModelExtension extends Model.Extension {

        //---------------------------------------------------------------------
        // Static
        //---------------------------------------------------------------------

        /**
         * @abstract
         * @static
         * @param {Object} params
         * @param {Object} params.archs
         * @param {(string | null)} params.viewType
         * @returns {any}
         */
        static extractArchInfo(params) { }
    }

    /**
     * @extends Model
     */
    class ActionModel extends Model {

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        /**
         * @override
         */
        _notifyComponents() {
            this.trigger("search", this.get("query"));
            super._notifyComponents(...arguments);
        }

        //---------------------------------------------------------------------
        // Static
        //---------------------------------------------------------------------

        /**
         * @static
         * @param {Object} archs
         * @param {(string | null)} [viewType=null]
         * @returns {Object}
         */
        static extractArchInfo(archs, viewType = null) {
            const parsedArchs = {};
            if (!archs.search) {
                archs.search = "<search/>";
            }
            for (const key in archs) {
                const { attrs, children } = parseArch(archs[key]);
                const objectChildren = children.filter(isObject);
                parsedArchs[key] = {
                    attrs,
                    children: objectChildren,
                };
            }
            const archInfo = {};
            for (const key of this.registry.keys()) {
                const extension = this.registry.get(key);
                const result = extension.extractArchInfo({
                    archs: parsedArchs,
                    viewType,
                });
                if (result) {
                    archInfo[key] = result;
                }
            }
            return archInfo;
        }
    }

    ActionModel.Extension = ActionModelExtension;
    ActionModel.registry = new Registry(
        null,
        (value) => value.prototype instanceof ActionModel.Extension
    );

    return ActionModel;
});
