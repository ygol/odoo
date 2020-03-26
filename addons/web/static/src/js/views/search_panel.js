odoo.define("web.SearchPanel", function (require) {
    "use strict";

    const { Model, useModel } = require("web.model");
    const patchMixin = require("web.patchMixin");

    const { Component, hooks } = owl;
    const { useState, useSubEnv } = hooks;

    /**
     * Search panel
     *
     * Represent an extension of the search interface located on the left side of
     * the view. It is divided in sections defined in a '<searchpanel>' node located
     * inside of a '<search>' arch. Each section is represented by a list of different
     * values (categories or ungrouped filters) or groups of values (grouped filters).
     * Its state is directly affected by its model (@see SearchPanelModel).
     * @extends Component
     */
    class SearchPanel extends Component {
        constructor() {
            super(...arguments);

            useSubEnv({
                searchModel: this.props.searchModel,
            });

            this.state = useState({
                expanded: {},
            });
            this.model = useModel("searchModel");

            const sections = this.model.get("sections");
            for (const section of sections) {
                this.state.expanded[section.id] = {};
            }

            this._expandParentCategories();
        }

        mounted() {
            if ("scrollTop" in this.props) {
                this.el.scrollTop = this.props.scrollTop;
            }
        }

        willUpdateProps() {
            this._expandParentCategories();
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        /**
         * Initialize the 'expanded' state of categories containing active sub-categories.
         * @private
         */
        _expandParentCategories() {
            const categories = this.model.get(
                "sections",
                (s) => s.type === "category"
            );
            for (const category of categories) {
                // unfold ancestor values of active value to make it is visible
                if (category.activeValueId) {
                    const ancestorIds = this._getAncestorValueIds(
                        category,
                        category.activeValueId
                    );
                    for (const id of ancestorIds) {
                        this.state.expanded[category.id][id] = true;
                    }
                }
            }
        }

        /**
         * @private
         * @param {Object} category
         * @param {number} categoryValueId
         * @returns {number[]} list of ids of the ancestors of the given value in
         *   the given category.
         */
        _getAncestorValueIds(category, categoryValueId) {
            const { parentId } = category.values.get(categoryValueId);
            return parentId ?
                [...this._getAncestorValueIds(category, parentId), parentId] :
                [];
        }

        /**
         * @private
         * @param {string} sectionId
         * @param {number} id value|group id
         */
        _isExpanded(sectionId, id) {
            return this.state.expanded[sectionId][id];
        }

        /**
         * Prevent unnecessary calls to the model by ensuring a different category
         * is clicked. Also toggle the 'state.expanded' state of the category on click.
         * @private
         * @param {number} sectionId
         * @param {number} valueId
         */
        _toggleCategory(sectionId, valueId) {
            const category = this.state.expanded[sectionId];
            if (category.activeValueId !== valueId) {
                this.model.dispatch("toggleCategoryValue", sectionId, valueId);
            }
            if (category[valueId]) {
                delete category[valueId];
            } else {
                category[valueId] = true;
            }
        }
    }
    SearchPanel.modelExtension = "search-panel";

    SearchPanel.props = {
        className: { type: String, optional: 1 },
        searchModel: Model,
        scrollTop: { type: Number, optional: 1 },
    };
    SearchPanel.template = "web.SearchPanel";

    return patchMixin(SearchPanel);
});
