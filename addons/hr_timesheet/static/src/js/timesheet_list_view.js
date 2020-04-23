odoo.define('hr_timesheet.timesheet_list_view', function (require) {
"use strict";

const ListController = require('web.ListController');
const ListRenderer = require('web.ListRenderer');
var ListView = require('web.ListView');
var viewRegistry = require('web.view_registry');

function randInt(max) {
    return Math.floor(Math.random() * max);
}

const TimesheetListRenderer = ListRenderer.extend({
    init() {
        this._super.apply(this, arguments);
        this.demo_records = [];
    },

    _renderNoContentHelper() {
        let $noContent = $('<div/>').addClass('table-responsive o_timesheet_demo');
        let $table = $('<table>').addClass('o_list_table table table-sm table-hover table-striped');
        let content = this._super.apply(this, arguments);

        this.$el.addClass('o_list_view o_timesheet_list');
        let $header = this._renderHeader();

        $header.on('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        let $rows = $('<tbody>');

        if(!this.demo_records.length) {
            const numRecords = randInt(4) + 3;
            for(let i = 0; i < numRecords; i++) {
                let $row = this._renderDemoRow();
                this.demo_records.push($row);
            }
        }

        $rows.append(this.demo_records);

        $table.append($header);
        $table.append($rows);

        $table.appendTo($noContent);
        content.appendTo($noContent);

        return $noContent;
    },

    _renderDemoRow() {
        let $row = $('<tr>').addClass('o_data_row');
        let record = {
            is_timer_running: randInt(10) < 7 ? '<i class="fa fa-play-circle"></i>':'<i class="fa fa-stop-circle"></i>',
        };
        $row.append(this._renderSelector('td', true));

        this.columns.forEach((col) => {
            let $cell = $('<td>').addClass('o_data_cell');

            if(col.attrs.name in record) {
                $cell.html(record[col.attrs.name]);
            } else {
                const width = 15 + randInt(75);
                $cell.html(`<span class="placeholder" style="width: ${width}%"></span>`);
            }

            $row.append($cell);
        });

        return $row;
    }
});

/**
 * @override the ListController to add a trigger when the timer is launched or stopped
 */
const TimesheetListController = ListController.extend({
    custom_events: _.extend({}, ListController.prototype.custom_events, {
        'timer_changed': '_onTimerChanged',
    }),
    /**
     * When a timer is launched or stopped, we reload the view to see the updating.
     * @param {Object} event
     */
    _onTimerChanged: function (event) {
        this.reload();
    }
});

const TimesheetListView = ListView.extend({
    config: _.extend({}, ListView.prototype.config, {
        Controller: TimesheetListController,
        Renderer: TimesheetListRenderer,
    })
});

viewRegistry.add('timesheet_tree', TimesheetListView);

return { TimesheetListController, TimesheetListView, TimesheetListRenderer };

});
