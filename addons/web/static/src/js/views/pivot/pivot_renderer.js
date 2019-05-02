odoo.define('web.PivotRenderer', function (require) {
"use strict";

var AbstractRenderer = require('web.AbstractRenderer');
var config = require('web.config');
var core = require('web.core');
var dataComparisonUtils = require('web.dataComparisonUtils');
var field_utils = require('web.field_utils');

var QWeb = core.qweb;

var PivotRenderer = AbstractRenderer.extend({
    tagName: 'table',
    className: 'table-hover table-sm table-bordered',
    events: _.extend({}, AbstractRenderer.prototype.events, {
        'hover td': '_onTdHover',
        'click td.o_pivot_cell_value': '_onCellValueClicked',
        'click .o_pivot_header_cell_opened': '_onOpenHeaderClick',
        'click .o_pivot_measure_row': '_onSpecialRowClick',
        'click .o_pivot_origin_row': '_onSpecialRowClick',
    }),

    /**
     * @overide
     *
     * @param {Widget} parent
     * @param {Object} state
     * @param {Object} params
     * @param {boolean} params.enableLinking configure the pivot view to allow
     *   opening a list view by clicking on a cell with some data.
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.enableLinking = params.enableLinking;
        this.fieldWidgets = params.widgets || {};
        this.paddingLeftHeaderTabWidth = config.device.isMobile ? 5 : 30;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {string[]} groupBy list of 'fieldName[:period]'
     * @returns {string[]} list of fields label
     */
    _getGroupByLabels: function (groupBy) {
        var self = this;
        return _.map(groupBy, function (gb) {
            return self.state.fields[gb.split(':')[0]].string;
        });
    },
    /**
     * Used to determine whether or not to display the no content helper.
     *
     * @private
     * @returns {boolean}
     */
    _hasContent: function () {
        return this.state.hasData && this.state.measures.length;
    },
    /**
     * @override
     * @private
     * @returns {Promise}
     */
    _render: function () {
        if (!this._hasContent()) {
            // display the nocontent helper
            this._replaceElement(QWeb.render('PivotView.nodata'));
            return this._super.apply(this, arguments);
        }

        var $fragment = $(document.createDocumentFragment());
        var $table = $('<table>').appendTo($fragment);
        var $thead = $('<thead>').appendTo($table);
        var $tbody = $('<tbody>').appendTo($table);

        this._renderHeaders($thead);
        this._renderRows($tbody);

        // todo: make sure the next line does something
        $table.find('.o_pivot_header_cell_opened,.o_pivot_header_cell_closed').tooltip();

        if (!this.$el.is('table')) {
            // coming from the no content helper, so the root element has to be
            // re-rendered before rendering and appending its content
            this.renderElement();
        }
        this.$el.toggleClass('o_enable_linking', this.enableLinking);
        this.$el.html($table.contents());
        return this._super.apply(this, arguments);
    },
    /**
     * @private
     * @param {jQuery} $thead
     */
    _renderHeaders: function ($thead) {
        // groupbyLabels is the list of col groupby fields label
        var groupbyLabels = this._getGroupByLabels(this.state.colGroupBys);

        this.state.table.headers.forEach(function (row, rowIndex) {
            var $tr = $('<tr>');
            row.forEach(function (cell) {
                var $cell = $('<th>').text(cell.title)
                                     .attr('colspan', cell.width)
                                     .attr('rowspan', cell.height)
                                     .data('groupId', cell.groupId)
                                     .data('type', 'col');

                var className;
                if (cell.measure) {
                    if (cell.originIndexes) {
                        $cell.data('originIndexes', cell.originIndexes);
                        className = 'o_pivot_origin_row';
                    } else {
                        className = 'o_pivot_measure_row';
                    }
                    className += ' text-muted';
                    if (cell.order) {
                        className += ' o_pivot_sort_order_' + cell.order;
                        if (cell.order === 'asc') {
                            $cell.attr('aria-sorted', 'ascending');
                        } else {
                            $cell.attr('aria-sorted', 'descending');
                        }
                    }
                    $cell.data('measure', cell.measure);
                } else if ('isLeaf' in cell) {
                    if (rowIndex > 0) {
                        $cell.attr('title', groupbyLabels[rowIndex - 1]);
                    }
                    className = 'o_pivot_header_cell_' + (cell.isLeaf ? 'closed' : 'opened');
                }
                $cell.addClass(className);

                $tr.append($cell);
            });
            $thead.append($tr);
        });
    },
    _renderRows: function ($tbody) {
        var self = this;

        // measureTypes is a mapping from measure fields to their field type,
        // with a special case for many2one fields which are mapped to the
        // 'integer' type (as their group_operator is 'count_distinct')
        var measureTypes = this.state.measures.reduce(
            function (acc, measureName) {
                var type = self.state.fields[measureName].type;
                acc[measureName] = type === 'many2one' ? 'integer' : type;
                return acc;
            },
            {}
        );

        // groupbyLabels is the list of row groupby fields label
        var groupbyLabels = this._getGroupByLabels(this.state.rowGroupBys);

        this.state.table.rows.forEach(function (row) {
            var $tr = $('<tr>');
            var paddingLeft = 5 + row.indent * self.paddingLeftHeaderTabWidth;
            $tr.append($('<th>')
                            .text(row.title)
                            .attr('title', row.indent > 0 ? groupbyLabels[row.indent - 1] : null)
                            .data('groupId', row.groupId)
                            .data('type', 'row')
                            .css('padding-left', paddingLeft + 'px')
                            .addClass('o_pivot_header_cell_' + (row.isLeaf ? 'closed' : 'opened')));
            row.subGroupMeasurements.forEach(function (measurement) {
                var $cell = $('<td>')
                                .data('groupId', measurement.groupId)
                                .data('originIndexes', measurement.originIndexes)
                                .addClass('o_pivot_cell_value text-right');

                if (measurement.isBold) {
                    $cell.css('font-weight', 'bold');
                }

                if (measurement.value !== undefined) {
                    var measure = measurement.measure;
                    var measureField = self.state.fields[measure];
                    var $value;
                    if (measurement.originIndexes.length > 1) {
                        $value = dataComparisonUtils.renderVariation(measurement.value, measureField);
                    } else {
                        var formatType = self.fieldWidgets[measure] || measureTypes[measure];
                        var formatter = field_utils.format[formatType];
                        $value = $('<div>')
                                    .addClass('o_value')
                                    .html(formatter(measurement.value, measureField));
                    }
                    $cell.append($value);
                } else {
                    $cell.addClass('o_empty');
                }

                $tr.append($cell);
            });
            $tbody.append($tr);
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * When the user clicks on a non empty cell, and the view is configured to allow
     * 'linking' (with enableLinking), we want to open a list view with the
     * corresponding record.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onCellValueClicked: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        var $target = $(ev.currentTarget);
        if ($target.hasClass('o_empty') || !this.enableLinking) {
            return;
        }

        var context = _.omit(this.state.context, function (val, key) {
            return key === 'group_by' || _.str.startsWith(key, 'search_default_');
        });

        var groupId = $target.data('groupId');
        var originIndexes = $target.data('originIndexes');

        var group = {
            rowValues: groupId[0],
            colValues: groupId[1],
            originIndex: originIndexes[0]
        }; // FIXME

        this.trigger_up('open_view', {
            group: group,
            context: context,
        });
    },
    /**
     * This method is called when someone clicks on an open header.  When that
     * happens, we want to close the header, then redisplay the view.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onOpenHeaderClick: function (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();

        var $target = $(ev.target);
        var groupId = $target.data('groupId');
        var type = $target.data('type');

        this.trigger_up('close_group', {
            groupId: groupId,
            type: type,
        });

    },
    /**
     * If the user clicks on a measure or origin row, we perform an in-memory sort
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onSpecialRowClick: function (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();

        var $target = $(ev.target);
        var groupId = $target.data('groupId');
        var measure = $target.data('measure');
        var originIndexes = $target.data('originIndexes');
        var isAscending = $target.hasClass('o_pivot_sort_order_asc');
        var order = isAscending ? 'desc' : 'asc';

        this.trigger_up('sort_rows', {
            sortedColumn: {
                groupId: groupId,
                measure: measure,
                order: order,
                originIndexes: originIndexes,
            }
        });
    },
    // Did not work. We should make it work again!
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onTdHover: function (ev) {
        var $td = $(event.target);
        $td.closest('table').find('col:eq(' + $td.index()+')').toggleClass('hover');
    },
});

return PivotRenderer;
});
