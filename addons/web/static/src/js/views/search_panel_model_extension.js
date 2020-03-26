odoo.define("web.SearchPanelModelExtension", function (require) {
    "use strict";

    const ActionModel = require("web.ActionModel");
    const { deepEqual, sortBy } = require("web.utils");
    const Domain = require("web.Domain");
    const pyUtils = require("web.py_utils");

    // DefaultViewTypes is the list of view types for which the searchpanel is
    // present by default (if not explicitly stated in the 'view_types' attribute
    // in the arch).
    const defaultViewTypes = ["kanban", "tree"];
    let nextSectionId = 1;

    const SEARCH_PANEL_DEFAULT_LIMIT = 200;

    const hasValues = (s) => {
        if (s.groups) {
            return [...s.groups.values()].some((g) => g.values.size);
        } else {
            return s.values && s.values.size;
        }
    };
    const isObject = (obj) => typeof obj === "object" && obj !== null;

    class SearchPanelModelExtension extends ActionModel.Extension {
        constructor() {
            super(...arguments);

            this.searchDomain = null;
            this.DEFAULT_VALUE_INDEX = 0;
        }

        get(property, ...args) {
            switch (property) {
                case "domain": return this.getDomain();
                case "sections": return this.getSections(...args);
            }
        }

        async reloadAfterDispatch() {
            await this._fetchSections();
        }

        async load() {
            await this._fetchSections();
        }

        prepareState() {
            Object.assign(this.state, { sections: new Map(), });
            this._createSectionsFromArch();
            if (this.config.defaultNoFilter) {
                const categories = this.categories;
                for (const { fieldName } of categories) {
                    this.config.defaultValues[fieldName] =
                        this.config.defaultValues[fieldName] || false;
                }
            }
        }

        //---------------------------------------------------------------------
        // Actions / Getters
        //---------------------------------------------------------------------

        getDomain() {
            return [...this._getCategoryDomain(), ...this._getFilterDomain()];
        }

        /**
         * Return a sorted list of a copy of all sections. This list can be filtered
         * by a given predicate.
         * @private
         * @param {(section: Object) => boolean} [predicate] used to determine which subsets of sections is wanted
         * @returns {Object[]}
         */
        getSections(predicate) {
            let sections = [...this.state.sections.values()].map((section) =>
                Object.assign({}, section, { empty: !hasValues(section) })
            );
            if (predicate) {
                sections = sections.filter(predicate);
            }
            return sections.sort((s1, s2) => s1.index - s2.index);
        }

        toggleCategoryValue(sectionId, valueId) {
            const section = this.state.sections.get(sectionId);
            section.activeValueId = valueId;
            const storageKey = `searchpanel_${this.config.modelName}_${section.fieldName}`;
            this.env.services.local_storage.setItem(storageKey, valueId);
            this.searchDomain = null; // reset search domain to ensure fetch.
        }

        toggleFilterGroup(sectionId, groupId) {
            const section = this.state.sections.get(sectionId);
            const group = section.groups.get(groupId);
            group.state = group.state === "checked" ? "unchecked" : "checked";
            Object.values(group.values).forEach((value) => {
                value.checked = group.state === "checked";
            });
            this.searchDomain = null; // reset search domain to ensure fetch.
        }

        toggleFilterValue(sectionId, valueId) {
            const section = this.state.sections.get(sectionId);
            const value = section.values.get(valueId);
            value.checked = !value.checked;
            const group = section.groups && section.groups.get(value.group_id);
            if (group) {
                this._updateFilterGroupState(group);
            }
            this.searchDomain = null; // reset search domain to ensure fetch.
        }

        //---------------------------------------------------------------------
        // Internal getters
        //---------------------------------------------------------------------

        get categories() {
            return [...this.state.sections.values()].filter(
                (s) => s.type === "category"
            );
        }

        get filters() {
            return [...this.state.sections.values()].filter(
                (s) => s.type === "filter"
            );
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        /**
         * Set active values for each filter (coming from context). This needs to be
         * done only once, at widget startup.
         * @private
         */
        _applyDefaultFilterValues() {
            this.filters.forEach((filter) => {
                const defaultValues =
                    this.config.defaultValues[filter.fieldName] || [];
                defaultValues.forEach((valueId) => {
                    const value = filter.values.get(valueId);
                    if (value) {
                        value.checked = true;
                    }
                });
                if (filter.groups) {
                    [...filter.groups.values()].forEach(
                        this._updateFilterGroupState
                    );
                }
            });
        }

        /**
         * @private
         * @param {string} sectionId
         * @param {Object} result
         */
        _createCategoryTree(sectionId, result) {
            const category = this.state.sections.get(sectionId);

            let { error_msg, parent_field, values, } = result;
            if (error_msg) {
                category.errorMsg = error_msg;
                values = [];
            }
            let parentField = false;
            if (category.hierarchize) {
                category.parentField = parent_field;
                parentField = parent_field;
            }

            const allItem = {
                childrenIds: [],
                display_name: this.env._t("All"),
                id: "__all__",
                bold: true,
                parentId: false,
            };
            category.values = new Map([["__all__", allItem]]);
            for (const value of values) {
                category.values.set(
                    value.id,
                    Object.assign({}, value, {
                        childrenIds: [],
                        parentId: value[parentField] || false,
                    })
                );
            }
            for (const value of values) {
                const { parentId } = category.values.get(value.id);
                if (parentId && category.values.has(parentId)) {
                    category.values.get(parentId).childrenIds.push(value.id);
                }
            }
            // collect rootIds
            category.rootIds = ["__all__"];
            for (const value of values) {
                const { parentId } = category.values.get(value.id);
                if (!parentId) {
                    category.rootIds.push(value.id);
                }
            }
            // Set active value from context
            const validValues = [
                "__all__",
                ...values.map((val) => val.id),
                false,
            ];
            let value = this.config.defaultValues[category.fieldName];
            // If not set in context, or set to an unknown value, set active value
            // from localStorage
            if (!validValues.includes(value)) {
                const storageKey = `searchpanel_${this.config.modelName}_${category.fieldName}`;
                value = this.env.services.local_storage.getItem(storageKey);
                // If still not a valid value, get the search panel default value
                // from the given valid values.
                if (!validValues.includes(value)) {
                    value = validValues[this.DEFAULT_VALUE_INDEX];
                }
            }
            category.activeValueId = value;
        }

        /**
         * @private
         * @param {string} sectionId
         * @param {Object} result
         */
        _createFilterTree(sectionId, result) {
            const filter = this.state.sections.get(sectionId);


            let { error_msg, values, } = result;
            if (error_msg) {
                filter.errorMsg = error_msg;
                values = [];
            }

            // restore checked property
            values.forEach((value) => {
                const oldValue = filter.values && filter.values.get(value.id);
                value.checked = (oldValue && oldValue.checked) || false;
            });

            filter.values = new Map();
            const groupIds = [];
            if (filter.groupBy) {
                const groups = new Map();
                for (const value of values) {
                    const groupId = value.group_id;
                    if (!groups.has(groupId)) {
                        if (groupId) {
                            groupIds.push(groupId);
                        }
                        groups.set(groupId, {
                            id: groupId,
                            name: value.group_name,
                            values: new Map(),
                            tooltip: value.group_tooltip,
                            sequence: value.group_sequence,
                            hex_color: value.group_hex_color,
                        });
                        // restore former checked state
                        const oldGroup =
                            filter.groups && filter.groups.get(groupId);
                        groups.get(groupId).state =
                            (oldGroup && oldGroup.state) || false;
                    }
                    groups.get(groupId).values.set(value.id, value);
                }
                filter.groups = groups;
                filter.sortedGroupIds = sortBy(
                    groupIds,
                    (id) => groups.get(id).sequence || groups.get(id).name
                );
                for (const group of filter.groups.values()) {
                    for (const [valueId, value] of group.values) {
                        filter.values.set(valueId, value);
                    }
                }
            } else {
                for (const value of values) {
                    filter.values.set(value.id, value);
                }
            }
        }

        _createSectionsFromArch() {
            this.config.archNodes.forEach(({ attrs, tag }, index) => {
                if (tag !== "field" || attrs.invisible === "1") {
                    return;
                }
                const type = attrs.select === "multi" ? "filter" : "category";
                const section = {
                    color: attrs.color,
                    description:
                        attrs.string || this.config.fields[attrs.name].string,
                    enableCounters: !!pyUtils.py_eval(
                        attrs.enable_counters || "0"
                    ),
                    expand: !!pyUtils.py_eval(attrs.expand || "0"),
                    fieldName: attrs.name,
                    icon: attrs.icon,
                    id: nextSectionId++,
                    index,
                    limit: pyUtils.py_eval(attrs.limit || String(SEARCH_PANEL_DEFAULT_LIMIT)),
                    type,
                };
                if (type === "category") {
                    section.icon = section.icon || "fa-folder";
                    section.hierarchize = !!pyUtils.py_eval(
                        attrs.hierarchize || "1"
                    );
                } else {
                    section.domain = attrs.domain || "[]";
                    section.groupBy = attrs.groupby;
                    section.icon = section.icon || "fa-filter";
                }
                this.state.sections.set(section.id, section);
            });
        }

        /**co
         * Fetch values for each category at startup. At reload a category is only
         * fetched if the searchDomain changes and displayCounters is true for it.
         * @private
         * @param {boolean} shouldFetch
         * @returns {Promise} resolved when all categories have been fetched
         */
        _fetchCategories(shouldFetch) {
            const proms = [];
            for (const category of this.categories) {
                const { enableCounters, expand, hierarchize, limit } = category;
                const field = this.config.fields[category.fieldName];
                if (shouldFetch || enableCounters || !expand) {
                    const prom = this.env.services
                        .rpc({
                            method: "search_panel_select_range",
                            model: this.config.modelName,
                            args: [category.fieldName],
                            kwargs: {
                                category_domain: this._getCategoryDomain(
                                    category.id
                                ),
                                enable_counters: enableCounters,
                                expand,
                                filter_domain: this._getFilterDomain(),
                                hierarchize,
                                limit,
                                search_domain: this.searchDomain,
                            },
                        })
                        .then(
                            result => { this._createCategoryTree(category.id, result); }
                        );
                    proms.push(prom);
                }
            }
            return Promise.all(proms);
        }

        /**
         * Fetch values for each filter. This is done at startup, and at each reload
         * (when the controlPanel or searchPanel domain changes).
         * @private
         * @param {boolean} shouldFetch
         * @returns {Promise} resolved when all filters have been fetched
         */
        _fetchFilters(shouldFetch) {
            const evalContext = {};
            for (const category of this.categories) {
                // It is weird to have to put a domain of the form [categ_field, "=", false] or the like in case activeValueId is __all__!
                evalContext[category.fieldName] = category.activeValueId === '__all__' ? false : category.activeValueId;
            }
            const categoryDomain = this._getCategoryDomain();
            const proms = [];
            for (const filter of this.filters) {
                const { enableCounters, expand, groupBy, limit } = filter;
                if (shouldFetch || enableCounters || !expand) {
                    const prom = this.env.services
                        .rpc({
                            method: "search_panel_select_multi_range",
                            model: this.config.modelName,
                            args: [filter.fieldName],
                            kwargs: {
                                category_domain: categoryDomain,
                                comodel_domain: Domain.prototype.stringToArray(
                                    filter.domain,
                                    evalContext
                                ),
                                enable_counters: enableCounters,
                                filter_domain: this._getFilterDomain(filter.id),
                                expand,
                                group_by: groupBy || false,
                                group_domain: this._getGroupDomain(filter),
                                limit,
                                search_domain: this.searchDomain,
                            },
                        })
                        .then(
                            result => { this._createFilterTree(filter.id, result); }
                        );
                    proms.push(prom);
                }
            }
            return Promise.all(proms);
        }

        /**
         * Fetch all categories and values data. The server call is forced if a
         * change of search domain is detected.
         * @private
         */
        async _fetchSections() {
            const shouldFetch = this._updateSearchDomain();
            await this._fetchCategories(shouldFetch);
            await this._fetchFilters(shouldFetch);
            this._applyDefaultFilterValues();
        }

        /**
         * Compute and return the domain based on the current active categories.
         * If excludedCategoryId is provided, the category with that id is not taken into account
         * in the domain computation.
         * @private
         * @param {string} [excludedCategoryId]
         * @returns {any[]}
         */
        _getCategoryDomain(excludedCategoryId) {
            const domain = [];
            for (const category of this.categories) {
                if (
                    category.id === excludedCategoryId ||
                    category.activeValueId === "__all__"
                ) {
                    continue;
                }
                if (category.activeValueId) {
                    const field = this.config.fields[category.fieldName];
                    const operator =
                        field.type === "many2one" && category.parentField ? "child_of" : "=";
                    domain.push([
                        category.fieldName,
                        operator,
                        category.activeValueId,
                    ]);
                }
            }
            return domain;
        }

        /**
         * Compute and return the domain based on the current checked filters.
         * The values of a single filter are combined using a simple rule: checked values within
         * a same group are combined with an 'OR' (this is expressed as single condition using a list)
         * and groups are combined with an 'AND' (expressed by concatenation of conditions).
         * If a filter has no groups, its checked values are implicitely considered as forming
         * a group (and grouped using an 'OR').
         * If excludedFilterId is provided, the filter with that id is not taken into account
         * in the domain computation.
         * @private
         * @param {string} [excludedFilterId]
         * @returns {any[]}
         */
        _getFilterDomain(excludedFilterId) {
            const domain = [];

            function addCondition(fieldName, valueMap) {
                const ids = [];
                for (const [valueId, value] of valueMap) {
                    if (value.checked) {
                        ids.push(valueId);
                    }
                }
                if (ids.length) {
                    domain.push([fieldName, "in", ids]);
                }
            }

            for (const filter of this.filters) {
                if (filter.id === excludedFilterId) {
                    continue;
                }
                const { fieldName, groups, values } = filter;
                if (groups) {
                    for (const group of groups.values()) {
                        addCondition(fieldName, group.values);
                    }
                } else if (values) {
                    addCondition(fieldName, values);
                }
            }
            return domain;
        }

        /**
         * Returns a domain or an object of domains used to complement
         * the filter domains to accurately describe the constrains on
         * records when computing record counts associated to the filter
         * values (if a groupBy is provided). The idea is that the checked values
         * within a group should not impact the counts for the other values
         * in the same group.
         * @private
         * @param {string} filter
         * @returns {(Array{}|Array[]|undefined)}
         */
        _getGroupDomain(filter) {
            const { fieldName, groups, enableCounters } = filter;
            const { type: fieldType } = this.config.fields[fieldName];

            if (!enableCounters || !groups) {
                return {
                    many2one: [],
                    many2many: {},
                }[fieldType];
            }
            let groupDomain;
            if (fieldType === "many2one") {
                for (const group of groups.values()) {
                    const valueIds = [];
                    let active = false;
                    for (const [valueId, value] of group.values) {
                        const { checked } = value;
                        valueIds.push(valueId);
                        if (checked) {
                            active = true;
                        }
                    }
                    if (active) {
                        if (groupDomain) {
                            groupDomain = [[0, "=", 1]];
                            break;
                        } else {
                            groupDomain = [[fieldName, "in", valueIds]];
                        }
                    }
                }
            } else if (fieldType === "many2many") {
                const checkedValueIds = new Map();
                groups.forEach(({ values }, groupId) => {
                    values.forEach(({ checked }, valueId) => {
                        if (checked) {
                            if (!checkedValueIds.has(groupId)) {
                                checkedValueIds.set(groupId, []);
                            }
                            checkedValueIds.get(groupId).push(valueId);
                        }
                    });
                });
                groupDomain = {};
                for (const [gId, ids] of checkedValueIds.entries()) {
                    for (const groupId of groups.keys()) {
                        if (gId !== groupId) {
                            const key = JSON.stringify(groupId);
                            if (!groupDomain[key]) {
                                groupDomain[key] = [];
                            }
                            groupDomain[key].push([fieldName, "in", ids]);
                        }
                    }
                }
            }
            return groupDomain;
        }

        /**
         * Updates the state property of a given filter's group according to the
         * checked property of its values.
         * @private
         * @param {Object} group
         */
        _updateFilterGroupState(group) {
            if ([...group.values.values()].some((v) => v.checked)) {
                if ([...group.values.values()].some((v) => !v.checked)) {
                    group.state = "indeterminate";
                } else {
                    group.state = "checked";
                }
            } else {
                group.state = "unchecked";
            }
        }

        /**
         * Updates current search domain with all sibling extension domains excluding its own.
         * Returns whether the domain has changed or not.
         * @private
         * @returns {boolean}
         */
        _updateSearchDomain() {
            const domains = this.model.getAll("domain");
            delete domains[this.constructor.name];
            let flatDomains = [];
            for (const domain of Object.values(domains)) {
                flatDomains = flatDomains.concat(Domain.prototype.normalizeArray(domain));
            }
            const searchDomain = Domain.prototype.normalizeArray(flatDomains);
            const hasChanged = !deepEqual(this.searchDomain, searchDomain);
            this.searchDomain = searchDomain;
            return hasChanged;
        }

        //---------------------------------------------------------------------
        // Static
        //---------------------------------------------------------------------

        /**
         * @override
         * @returns {{ attrs: Object, children: Object[] } | undefined}
         */
        static extractArchInfo({ archs, viewType }) {
            const { children } = archs.search;
            const spNode = children.find(c => c.tag === "searchpanel");
            if (spNode) {
                const actualType = viewType === "list" ? "tree" : viewType;
                const { view_types } = spNode.attrs;
                const viewTypes = view_types ?
                    view_types.split(",") :
                    defaultViewTypes;
                if (viewTypes.includes(actualType)) {
                    return {
                        attrs: spNode.attrs,
                        children: spNode.children.filter(isObject),
                    };
                }
            }
        }
    }

    ActionModel.registry.add("search-panel", SearchPanelModelExtension, 40);

    return SearchPanelModelExtension;
});
