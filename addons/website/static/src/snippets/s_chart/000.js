odoo.define('website.s_chart', function (require) {
'use strict';

const publicWidget = require('web.public.widget');

const ChartWidget = publicWidget.Widget.extend({
    selector: '.s_chart',
    disabledInEditableMode: false,
    jsLibs: [
        '/web/static/lib/Chart/Chart.js',
    ],

    /**
     * @override
     * @param {Object} parent
     * @param {Object} options The default value of the chartbar.
     */
    init: function (parent, options) {
        this._super.apply(this, arguments);
        this.style = window.getComputedStyle(document.documentElement);
    },
    /**
     * @override
     */
    start: function () {
        // Convert Theme colors to css color
        const data = JSON.parse(this.el.dataset.data);
        data.datasets.forEach(el => {
            if (Array.isArray(el.backgroundColor)) {
                el.backgroundColor = el.backgroundColor.map(el => this._convertToCssColor(el));
                el.borderColor = el.borderColor.map(el => this._convertToCssColor(el));
            } else {
                el.backgroundColor = this._convertToCssColor(el.backgroundColor);
                el.borderColor = this._convertToCssColor(el.borderColor);
            }
            el.borderWidth = this.el.dataset.borderWidth;
        });

        // Make chart data
        const chartData = {
            type: this.el.dataset.type,
            data: data,
            options: {
                legend: {
                    display: this.el.dataset.legendPosition !== 'none',
                    position: this.el.dataset.legendPosition,
                },
                tooltips: {
                    enabled: this.el.dataset.tooltipDisplay === 'true',
                    position: 'custom',
                },
                title: {
                    display: !!this.el.dataset.title,
                    text: this.el.dataset.title,
                },
            },
        };

        // Add type specific options
        if (this.el.dataset.type === 'radar') {
            chartData.options.scale = {
                ticks: {
                    beginAtZero: true,
                }
            };
        } else if (['pie', 'doughnut'].includes(this.el.dataset.type)) {
            chartData.options.tooltips.callbacks = {
                label: (tooltipItem, data) => {
                    const label = data.datasets[tooltipItem.datasetIndex].label;
                    const secondLabel = data.labels[tooltipItem.index];
                    let final = label;
                    if (label) {
                        if (secondLabel) {
                            final = label + ' - ' + secondLabel;
                        }
                    } else if (secondLabel) {
                        final = secondLabel;
                    }
                    return final + ':' + data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                },
            };
        } else {
            // for extending the range of the axis while maintaining the auto fit behaviour
            const beforeBuildTicks = (scale) => {
                scale.min = parseInt(this.el.dataset.minValue) || 0;
                let maxValue = parseInt(this.el.dataset.maxValue);
                if (!isNaN(maxValue)) {
                    scale.max = maxValue;
                    // for reversing a min max value when min value is greater than max value
                    if (scale.max < scale.min) {
                        scale.max = scale.min;
                        scale.min = maxValue;
                    } else if (scale.max == scale.min) {
                        // to maintaining a chart if min value and max value are same for positive and negative number
                        scale.min < 0 ? (scale.max = 0, scale.min = 2*scale.min) : (scale.min = 0, scale.max = 2*scale.max);
                    }
                } else {
                    // for managing range of axis when max value does not given and min value is greater than chart data value
                    if (scale.min > Math.max(...data.datasets[0].data)) {
                        scale.max = scale.min;
                        scale.min = 0;
                    }
                }
                return;
            };
            chartData.options.scales = {
                xAxes: [{
                    stacked: this.el.dataset.stacked === 'true',
                    ticks: {
                        beginAtZero: true
                    },
                    beforeBuildTicks: beforeBuildTicks,
                }],
                yAxes: [{
                    stacked: this.el.dataset.stacked === 'true',
                    ticks: {
                        beginAtZero: true
                    },
                    beforeBuildTicks: beforeBuildTicks,
                }],
            };
        }

        // Disable animation in edit mode
        if (this.editableMode) {
            chartData.options.animation = {
                duration: 0,
            };
        }

        const canvas = this.el.querySelector('canvas');
        window.Chart.Tooltip.positioners.custom = (elements, eventPosition) => {return eventPosition;};
        this.chart = new window.Chart(canvas, chartData);
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     * Discard all library changes to reset the state of the Html.
     */
    destroy: function () {
        if (this.chart) { // The widget can be destroyed before start has completed
            this.chart.destroy();
            this.el.querySelectorAll('.chartjs-size-monitor').forEach(el => el.remove());
        }
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {string} color A css color or theme color string
     * @returns {string} Css color
     */
    _convertToCssColor: function (color) {
        if (!color) {
            return 'transparent';
        }
        return this.style.getPropertyValue(`--${color}`).trim() || color;
    },
});

publicWidget.registry.chart = ChartWidget;

return ChartWidget;
});
