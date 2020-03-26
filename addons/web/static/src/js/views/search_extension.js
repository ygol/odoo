odoo.define("web.SearchExtension", function (require) {
    "use strict";

    const ActionModel = require("web.ActionModel");
    const Domain = require("web.Domain");

    /**
     * Combine the domains into a single domain using an 'AND'.
     * @param {Array[]} domains
     * @returns {Array[]}
     */
    function mergeDomains(domains) {
        let flatDomains = [];
        for (const domain of domains) {
            flatDomains = flatDomains.concat(Domain.prototype.normalizeArray(domain));
        }
        return Domain.prototype.normalizeArray(flatDomains);
    }

    /**
     * @param {Object[]} objects
     * @returns {Object}
     */
    function mergeObjects(objects) {
        const result = {};
        for (const object of objects) {
            Object.assign(result, object);
        }
        return result;
    }

    /**
     * /!\ This extension is required in order to access the `query` getter
     * => CPModel and SPModel are meaningless without it, maybe add a dependency ?
     * @extends ActionModel.Extension
     */
    class SearchExtension extends ActionModel.Extension {

        constructor() {
            super(...arguments);
            this.searchMenuTypes = this.config.searchMenuTypes || [];
        }

        get(property) {
            switch (property) {
                case "query": return this.getQuery();
            }
        }

        //---------------------------------------------------------------------
        // Actions / Getters
        //---------------------------------------------------------------------

        /**
         * @typedef TimeRange
         * @property {string} fieldName
         * @property {string} rangeId
         * @property {string} [comparisonRangeId]
         *
         * @returns {{ context: Object, domain: Array[], groupBy: string[], orderedBy: string[], timeRanges?: TimeRange }}
         */
        getQuery() {
            const contexts = Object.values(this.model.getAll("context"));
            const domains = Object.values(this.model.getAll("domain"));
            const orderedBys = Object.values(this.model.getAll("orderedBy"));
            const query = {
                context: mergeObjects(contexts),
                domain: mergeDomains(domains),
                orderedBy: orderedBys.flat(),
            };
            if (this.searchMenuTypes.includes('groupBy')) {
                const groupBys = Object.values(this.model.getAll("groupBy"));
                query.groupBy = groupBys.flat();
            } else {
                query.groupBy = [];
            }
            if (this.searchMenuTypes.includes("comparison")) {
                const timeRanges = Object.values(
                    this.model.getAll("timeRanges")
                );
                query.timeRanges = mergeObjects(timeRanges);
            }
            return query;
        }
    }

    ActionModel.registry.add('search', SearchExtension, 10);

    return SearchExtension;
});
