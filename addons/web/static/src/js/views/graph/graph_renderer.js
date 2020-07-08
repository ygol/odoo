odoo.define('web.GraphRenderer', function (require) {
    'use strict';

    const config = require('web.config');
    const { DateClasses } = require('web.dataComparisonUtils');
    const fieldUtils = require('web.field_utils');
    const OwlAbstractRenderer = require('web.AbstractRendererOwl');
    const patchMixin = require('web.patchMixin');
    const { sortBy } = require('web.utils');

    const COLORS = ["#1f77b4", "#ff7f0e", "#aec7e8", "#ffbb78", "#2ca02c", "#98df8a", "#d62728",
    "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "#c49c94", "#e377c2", "#f7b6d2",
    "#7f7f7f", "#c7c7c7", "#bcbd22", "#dbdb8d", "#17becf", "#9edae5"];

    // used to format values in tooltips and yAxes.
    const FORMAT_OPTIONS = {
        // allow to decide if utils.human_number should be used
        humanReadable: value => {
            return Math.abs(value) >= 1000;
        },
        // with the choices below, 1236 is represented by 1.24k
        minDigits: 1,
        decimals: 2,
        // avoid comma separators for thousands in numbers when human_number is used
        formatterCallback: str => {
            return str;
        },
    };

    // hide top legend when too many items for device size
    const MAX_LEGEND_LENGTH = 4 * (Math.max(1, config.device.size_class));

    /**
     * @param {number} index
     * @returns {string}
     */
    function getColor(index) {
        return COLORS[index % COLORS.length];
    }

    /**
     * @param {string} hex
     * @param {number} opacity
     * @returns {string}
     */
    function hexToRGBA(hex, opacity) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        const rgb = result.slice(1, 4).map(n => {
            return parseInt(n, 16);
        }).join(',');
        return 'rgba(' + rgb + ',' + opacity + ')';
    }

    class GraphRenderer extends OwlAbstractRenderer {
        constructor() {
            super(...arguments);
            this.noDataLabel = [this.env._t("No data")];
        }

        mounted() {
            this._renderGraphMainContent();
        }

        patched() {
            this._renderGraphMainContent();
        }

        //----------------------------------------------------------------------
        // Getters
        //----------------------------------------------------------------------

        get canvas() {
            return this.el.querySelector('canvas');
        }

        get container() {
            return this.el.querySelector('div.o_graph_canvas_container');
        }

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * This function aims to remove a suitable number of lines from the tooltip in order to make
         * it reasonably visible. A message indicating the number of lines is added if necessary.
         * @private
         * @param {Number} maxTooltipHeight this the max height in pixels of the tooltip
         */
        _adjustTooltipHeight(maxTooltipHeight) {
            const sizeOneLine = this.tooltip.querySelector('tbody tr').clientHeight;
            const tbodySize = this.tooltip.querySelector('tbody').clientHeight;
            let toKeep = Math.floor((maxTooltipHeight - (this.tooltip.clientHeight - tbodySize)) / sizeOneLine) - 1;
            toKeep = Math.max(0, toKeep); // used to avoid toKeep = -1
            const lines = this.tooltip.querySelectorAll('tbody tr');
            const toRemove = lines.length - toKeep;
            if (toRemove > 0) {
                for (let i = toKeep; i < lines.length; ++i) {
                    lines[i].remove();
                }
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                tr.classList.add('o_show_more');
                td.innerHTML = this.env._t("...");
                tr.appendChild(td);
                this.tooltip.querySelector('tbody').appendChild(tr);
            }
        }

        /**
         * Compute various objects based on the param props.
         * @param {Object} props
         */
        _computeDerivedProps(props = this.props) {
            this.propsCopy = props;
            const filteredDataPoints = this._filterDataPoints();
            this.processedDataPoints = this._sortDataPoints(filteredDataPoints);

            this._setNoContentHelper();

            if (!this.noContentHelperData) {
                if (this.propsCopy.comparisonFieldIndex === 0) {
                    this.dateClasses = this._getDateClasses(this.processedDataPoints);
                }
                switch (this.propsCopy.mode) {
                    case 'bar':
                        this._prepareBarChartConfig();
                        break;
                    case 'line':
                        this._prepareLineChartConfig();
                        break;
                    case 'pie':
                        this._preparePieChartConfig();
                        break;
                }
            }
        }

        /**
         * This function creates a custom HTML tooltip.
         * @private
         * @param {Object} tooltipModel see chartjs documentation
         */
        _customTooltip(tooltipModel) {
            this.el.style.cursor = 'default';
            if (this.tooltip) {
                this.tooltip.remove();
            }
            if (tooltipModel.opacity === 0) {
                return;
            }
            if (tooltipModel.dataPoints.length === 0) {
                return;
            }
            if (this._isRedirectionEnabled()) {
                this.el.style.cursor = 'pointer';
            }

            const chartArea = this.chart.chartArea;
            const chartAreaLeft = chartArea.left;
            const chartAreaRight = chartArea.right;
            const chartAreaTop = chartArea.top;
            const rendererTop = this.el.getBoundingClientRect().top;

            const maxTooltipLabelWidth = Math.floor((chartAreaRight - chartAreaLeft) / 1.618) + 'px';
            const tooltipItems = this._getTooltipItems(tooltipModel);

            const template = document.createElement('template');
            const tooltipHtml = this.env.qweb.renderToString('GraphRenderer.CustomTooltip', {
                measure: this.propsCopy.fields[this.propsCopy.measure].string,
                tooltipItems: tooltipItems,
                maxWidth: maxTooltipLabelWidth,
            });
            template.innerHTML = tooltipHtml;
            this.tooltip = template.content.firstChild;

            this.container.prepend(this.tooltip);

            let top;
            const tooltipHeight = this.tooltip.clientHeight;
            const minTopAllowed = Math.floor(chartAreaTop);
            const maxTopAllowed = Math.floor(window.innerHeight - rendererTop - tooltipHeight) - 2;
            const y = Math.floor(tooltipModel.y);

            if (minTopAllowed <= maxTopAllowed) {
                // Here we know that the full tooltip can fit in the screen.
                // We put it in the position where Chart.js would put it
                // if two conditions are respected:
                //  1: the tooltip is not cut (because we know it is possible to not cut it)
                //  2: the tooltip does not hide the legend.
                // If it is not possible to use the Chart.js proposition (y)
                // we use the best approximated value.
                if (y <= maxTopAllowed) {
                    if (y >= minTopAllowed) {
                        top = y;
                    } else {
                        top = minTopAllowed;
                    }
                } else {
                    top = maxTopAllowed;
                }
            } else {
                // Here we know that we cannot satisfy condition 1 above,
                // so we position the tooltip at the minimal position and
                // cut it the minimum possible.
                top = minTopAllowed;
                const maxTooltipHeight = window.innerHeight - (rendererTop + chartAreaTop) -2;
                this._adjustTooltipHeight(maxTooltipHeight);
            }

            this._fixTooltipLeftPosition(this.tooltip, tooltipModel.x);
            this.tooltip.style.top = Math.floor(top) + 'px';
        }

        /**
         * Filter out some dataPoints because they would lead to bad graphics.
         * The filtering is done with respect to the graph view mode.
         * Note that the method does not alter this.state.dataPoints, since we
         * want to be able to change of mode without fetching data again:
         * we simply present the same data in a different way.
         * Note: this should be moved to the model at some point.
         * @private
         * @returns {Object[]}
         */
        _filterDataPoints() {
            let dataPoints = [];
            if (['bar', 'pie'].includes(this.propsCopy.mode)) {
                dataPoints = this.propsCopy.dataPoints.filter(dataPt => {
                    return dataPt.count > 0;
                });
            } else if (this.propsCopy.mode === 'line') {
                let counts = 0;
                for (const dataPt of this.propsCopy.dataPoints) {
                    if (dataPt.labels[0] !== this.env._t("Undefined")) {
                        dataPoints.push(dataPt);
                    }
                    counts += dataPt.count;
                }
                // data points with zero count might have been created on purpose
                // we only remove them if there are no data point with positive count
                if (counts === 0) {
                    dataPoints = [];
                }
            }
            return dataPoints;
        }

        /**
         * Sets best left position of a tooltip approaching the proposal x
         * @private
         * @param {DOMElement} tooltip
         * @param {number} x, left offset proposed
         */
        _fixTooltipLeftPosition(tooltip, x) {
            let left;
            const tooltipWidth = tooltip.clientWidth;
            const minLeftAllowed = Math.floor(this.chart.chartArea.left + 2);
            const maxLeftAllowed = Math.floor(this.chart.chartArea.right - tooltipWidth - 2);
            x = Math.floor(x);
            if (x <= maxLeftAllowed) {
                if (x >= minLeftAllowed) {
                    left = x;
                } else {
                    left = minLeftAllowed;
                }
            } else {
                left = maxLeftAllowed;
            }
            tooltip.style.left = left + 'px';
        }

        /**
         * Used to format correctly the values in tooltips and yAxes
         * @private
         * @param {number} value
         * @returns {string} The value formatted using fieldUtils.format.float
         */
        _formatValue(value) {
            const measureField = this.propsCopy.fields[this.propsCopy.measure];
            const formatter = fieldUtils.format.float;
            const formatedValue = formatter(value, measureField, FORMAT_OPTIONS);
            return formatedValue;
        }

        /**
         * Determines the initial section of the labels array
         * over a dataset has to be completed. The section only depends
         * on the datasets origins.
         * @private
         * @param {number} originIndex
         * @param {number} defaultLength
         * @returns {number}
         */
        _getDatasetDataLength(originIndex, defaultLength) {
            if (['bar', 'line'].includes(this.propsCopy.mode) && this.propsCopy.comparisonFieldIndex === 0) {
                return this.dateClasses.dateSets[originIndex].length;
            }
            return defaultLength;
        }

        /**
         * Determines the dataset to which belong the data point.
         * @private
         * @param {Object} dataPt
         * @returns {string}
         */
        _getDatasetLabel(dataPt) {
            if (['bar', 'line'].includes(this.propsCopy.mode)) {
                // ([origin] + second to last groupBys) or measure
                let datasetLabel = dataPt.labels.slice(1).join("/");
                if (this.propsCopy.origins.length > 1) {
                    datasetLabel = this.propsCopy.origins[dataPt.originIndex] +
                        (datasetLabel ? ('/' + datasetLabel) : '');
                }
                datasetLabel = datasetLabel || this.propsCopy.fields[this.propsCopy.measure].string;
                return datasetLabel;
            }
            return this.propsCopy.origins[dataPt.originIndex];
        }

        /**
         * Returns a DateClasses instance used to manage equivalence of dates.
         * @private
         * @param {Object[]} dataPoints
         * @returns {DateClasses}
         */
        _getDateClasses(dataPoints) {
            const dateSets = this.propsCopy.origins.map(() => {
                return [];
            });
            for (const dataPt of dataPoints) {
                dateSets[dataPt.originIndex].push(dataPt.labels[this.propsCopy.comparisonFieldIndex]);
            }
            return new DateClasses(dateSets.map(dateSet => [...(new Set(dateSet))]));
        }

        /**
         * Returns an object used to style chart elements independently from the datasets.
         * @private
         * @returns {Object}
         */
        _getElementOptions() {
            const elementOptions = {};
            if (this.propsCopy.mode === 'bar') {
                elementOptions.rectangle = {borderWidth: 1};
            } else if (this.propsCopy.mode === 'line') {
                elementOptions.line = {
                    tension: 0,
                    fill: false,
                };
            }
            return elementOptions;
        }

        /**
         * Determines the label over which the data point is.
         * @private
         * @param {Object} dataPt
         * @returns {Array}
         */
        _getLabel(dataPt) {
            const i = this.propsCopy.comparisonFieldIndex;
            if (['bar', 'line'].includes(this.propsCopy.mode)) {
                if (i === 0) {
                    return [this.dateClasses.dateClass(dataPt.originIndex, dataPt.labels[i])];
                } else {
                    return dataPt.labels.slice(0, 1);
                }
            } else if (i === 0) {
                return Array.prototype.concat.apply([], [
                            this.dateClasses.dateClass(dataPt.originIndex, dataPt.labels[i]),
                            dataPt.labels.slice(i + 1)
                        ]);
            } else {
                return dataPt.labels;
            }
        }

        /**
         * Returns the options used to generate the chart legend.
         * @private
         * @param {number} datasetsCount
         * @returns {Object}
         */
        _getLegendOptions(datasetsCount) {
            const legendOptions = {
                display: datasetsCount <= MAX_LEGEND_LENGTH,
                position: 'top',
                onHover: this._onlegendTooltipHover.bind(this),
                onLeave: this._onLegendTootipLeave.bind(this),
            };
            if (['bar', 'line'].includes(this.propsCopy.mode)) {
                let referenceColor;
                if (this.propsCopy.mode === 'bar') {
                    referenceColor = 'backgroundColor';
                } else {
                    referenceColor = 'borderColor';
                }
                legendOptions.labels = {
                    generateLabels: chart => {
                        const data = chart.data;
                        return data.datasets.map((dataset, i) => {
                            return {
                                text: this._shortenLabel(dataset.label),
                                fullText: dataset.label,
                                fillStyle: dataset[referenceColor],
                                hidden: !chart.isDatasetVisible(i),
                                lineCap: dataset.borderCapStyle,
                                lineDash: dataset.borderDash,
                                lineDashOffset: dataset.borderDashOffset,
                                lineJoin: dataset.borderJoinStyle,
                                lineWidth: dataset.borderWidth,
                                strokeStyle: dataset[referenceColor],
                                pointStyle: dataset.pointStyle,
                                datasetIndex: i,
                            };
                        });
                    },
                };
            } else {
                legendOptions.labels = {
                    generateLabels: chart => {
                        const data = chart.data;
                        const metaData = data.datasets.map((dataset, index) => {
                            return chart.getDatasetMeta(index).data;
                        });
                        return data.labels.map((label, i) => {
                            let hidden = false;
                            for (const data of metaData) {
                                if (data[i] && data[i].hidden) {
                                    hidden = true;
                                    break;
                                }
                            }
                            const fullText = this._relabelling(label);
                            const text = this._shortenLabel(fullText);
                            return {
                                text: text,
                                fullText: fullText,
                                fillStyle: label === this.noDataLabel ? '#d3d3d3' : getColor(i),
                                hidden: hidden,
                                index: i,
                            };
                        });
                    },
                };
            }
            return legendOptions;
        }

        /**
         * Returns the options used to generate the chart axes.
         * @private
         * @returns {Object}
         */
        _getScaleOptions() {
            if (['bar', 'line'].includes(this.propsCopy.mode)) {
                return {
                    xAxes: [{
                        type: 'category',
                        scaleLabel: {
                            display: this.propsCopy.processedGroupBy.length && !this.propsCopy.isEmbedded,
                            labelString: this.propsCopy.processedGroupBy.length ?
                                this.propsCopy.fields[this.propsCopy.processedGroupBy[0].split(':')[0]].string : '',
                        },
                        ticks: {
                            // don't use bind:  callback is called with 'index' as second parameter
                            // with value labels.indexOf(label)!
                            callback: label => {
                                return this._relabelling(label);
                            },
                        },
                    }],
                    yAxes: [{
                        type: 'linear',
                        scaleLabel: {
                            display: !this.propsCopy.isEmbedded,
                            labelString: this.propsCopy.fields[this.propsCopy.measure].string,
                        },
                        ticks: {
                            callback: this._formatValue.bind(this),
                            suggestedMax: 0,
                            suggestedMin: 0,
                        }
                    }],
                };
            }
            return {};
        }

        /**
         * Extracts the important information from a tooltipItem generated by Charts.js
         * (a tooltip item corresponds to a line (different from measure name) of a tooltip)
         * @private
         * @param {Object} item
         * @param {Object} data
         * @returns {Object}
         */
        _getTooltipItemContent(item, data) {
            const dataset = data.datasets[item.datasetIndex];
            let label = data.labels[item.index];
            let value;
            let boxColor;
            if (this.propsCopy.mode === 'bar') {
                label = this._relabelling(label, dataset.originIndex);
                if (this.propsCopy.processedGroupBy.length > 1 || this.propsCopy.origins.length > 1) {
                    label = label + "/" + dataset.label;
                }
                value = this._formatValue(item.yLabel);
                boxColor = dataset.backgroundColor;
            } else if (this.propsCopy.mode === 'line') {
                label = this._relabelling(label, dataset.originIndex);
                if (this.propsCopy.processedGroupBy.length > 1 || this.propsCopy.origins.length > 1) {
                    label = label + "/" + dataset.label;
                }
                value = this._formatValue(item.yLabel);
                boxColor = dataset.borderColor;
            } else {
                if (label === this.noDataLabel) {
                    value = this._formatValue(0);
                } else {
                    value = this._formatValue(dataset.data[item.index]);
                }
                label = this._relabelling(label, dataset.originIndex);
                if (this.propsCopy.origins.length > 1) {
                    label = dataset.label + "/" + label;
                }
                boxColor = dataset.backgroundColor[item.index];
            }
            return {
                label: label,
                value: value,
                boxColor: boxColor,
            };
        }

        /**
         * This function extracts the information from the data points in tooltipModel.dataPoints
         * (corresponding to datapoints over a given label determined by the mouse position)
         * that will be displayed in a custom tooltip.
         * @private
         * @param {Object} tooltipModel see chartjs documentation
         * @return {Object[]}
         */
        _getTooltipItems(tooltipModel) {
            const data = this.chart.config.data;

            const orderedItems = tooltipModel.dataPoints.sort((dPt1, dPt2) => {
                return dPt2.yLabel - dPt1.yLabel;
            });

            const tooltipItems = [];
            for (const item of orderedItems) {
                tooltipItems.push(this._getTooltipItemContent(item, data));
            }
            return tooltipItems;
        }

        /**
         * Returns the options used to generate chart tooltips.
         * @private
         * @returns {Object}
         */
        _getTooltipOptions() {
            const tooltipOptions = {
                // disable Chart.js tooltips
                enabled: false,
                custom: this._customTooltip.bind(this),
            };
            if (this.propsCopy.mode === 'line') {
                tooltipOptions.mode = 'index';
                tooltipOptions.intersect = false;
            }
            return tooltipOptions;
        }

        /**
         * Returns true iff the current graph can be clicked on to redirect to the
         * list of records.
         * @private
         * @returns {boolean}
         */
        _isRedirectionEnabled() {
            return !this.propsCopy.disableLinking &&
                   (this.propsCopy.mode === 'bar' || this.propsCopy.mode === 'pie');
        }

        /**
         * Create bar chart config.
         * @private
         */
        _prepareBarChartConfig() {
            // prepare data
            const data = this._prepareData(this.processedDataPoints);

            for (let index = 0; index < data.datasets.length; ++index) {
                const dataset = data.datasets[index];
                // used when stacked
                dataset.stack = this.propsCopy.stacked ? this.propsCopy.origins[dataset.originIndex] : undefined;
                // set dataset color
                const color = getColor(index);
                dataset.backgroundColor = color;
            }

            // prepare options
            const options = this._prepareOptions(data.datasets.length);

            // create bar chart config
            this.config = { data, options, type: 'bar' };
        }

        /**
         * Separate dataPoints coming from the read_group(s) into different datasets.
         * This function returns the parameters data and labels used to produce the charts.
         * @param {Object[]} dataPoints
         * @returns {Object}
         */
        _prepareData(dataPoints) {
            const labelMap = {};
            const labels = [];
            for (const dataPt of dataPoints) {
                const label = this._getLabel(dataPt);
                const labelKey = dataPt.resId + ':' + JSON.stringify(label);
                const index = labelMap[labelKey];
                if (index === undefined) {
                    labelMap[labelKey] = dataPt.labelIndex = labels.length;
                    labels.push(label);
                } else {
                    dataPt.labelIndex = index;
                }
            }

            const newDataset = (datasetLabel, originIndex) => {
                const data = new Array(this._getDatasetDataLength(originIndex, labels.length)).fill(0);
                const domain = new Array(this._getDatasetDataLength(originIndex, labels.length)).fill([]);
                return {
                    label: datasetLabel,
                    data: data,
                    domain: domain,
                    originIndex: originIndex,
                };
            };

            // dataPoints --> datasets
            const datasetsTmp = {};
            for (const dp of dataPoints) {
                const datasetLabel = this._getDatasetLabel(dp);
                if (!(datasetLabel in datasetsTmp)) {
                    datasetsTmp[datasetLabel] = newDataset(datasetLabel, dp.originIndex);
                }
                const labelIndex = dp.labelIndex;
                datasetsTmp[datasetLabel].data[labelIndex] = dp.value;
                datasetsTmp[datasetLabel].domain[labelIndex] = dp.domain;
            }
            const datasets = Object.values(datasetsTmp);

            // sort by origin
            datasets.sort((dataset1, dataset2) => {
                return dataset1.originIndex - dataset2.originIndex;
            });

            return { datasets, labels };
        }

        /**
         * Create line chart config.
         * @private
         */
        _prepareLineChartConfig() {
            // prepare data
            const data = this._prepareData(this.processedDataPoints);
            for (let index = 0; index < data.datasets.length; ++index) {
                const dataset = data.datasets[index];
                if (this.propsCopy.processedGroupBy.length <= 1 && this.propsCopy.origins.length > 1) {
                    if (dataset.originIndex === 0) {
                        dataset.fill = 'origin';
                        dataset.backgroundColor = hexToRGBA(COLORS[0], 0.4);
                        dataset.borderColor = hexToRGBA(COLORS[0], 1);
                    } else if (dataset.originIndex === 1) {
                        dataset.borderColor = hexToRGBA(COLORS[1], 1);
                    } else {
                        dataset.borderColor = getColor(index);
                    }
                } else {
                    dataset.borderColor = getColor(index);
                }
                if (data.labels.length === 1) {
                    // shift of the real value to right. This is done to center the points in the chart
                    // See data.labels below in Chart parameters
                    dataset.data.unshift(undefined);
                }
                dataset.pointBackgroundColor = dataset.borderColor;
                dataset.pointBorderColor = 'rgba(0,0,0,0.2)';
            }

            if (data.datasets.length === 1) {
                const dataset = data.datasets[0];
                dataset.fill = 'origin';
                dataset.backgroundColor = hexToRGBA(COLORS[0], 0.4);
            }

            // center the points in the chart (without that code they are put on the left and the graph seems empty)
            data.labels = data.labels.length > 1 ?
                data.labels :
                Array.prototype.concat.apply([], [[['']], data.labels, [['']]]);

            // prepare options
            const options = this._prepareOptions(data.datasets.length);

            // create line chart config
            this.config = { data, options, type: 'line' };
        }

        /**
         * Prepare options for the chart according to the current mode (= chart type).
         * This function returns the parameter options used to instantiate the chart
         * @private
         * @param {number} datasetsCount
         * @returns {Object} the chart options used for the current mode
         */
        _prepareOptions(datasetsCount) {
            const options = {
                maintainAspectRatio: false,
                scales: this._getScaleOptions(),
                legend: this._getLegendOptions(datasetsCount),
                tooltips: this._getTooltipOptions(),
                elements: this._getElementOptions(),
            };
            if (this._isRedirectionEnabled()) {
                options.onClick = this._onGraphClicked.bind(this);
            }
            return options;
        }

        /**
         * Create pie chart config
         * @private
         */
        _preparePieChartConfig() {
            // prepare data
            let data = {};
            let colors = [];
            const allZero = this.processedDataPoints.every(datapt => datapt.value === 0);
            if (allZero) {
                // add fake data to display a pie chart with a grey zone associated
                // with every origin
                data.labels = [this.noDataLabel];
                data.datasets = this.propsCopy.origins.map(origin => {
                    return {
                        label: origin,
                        data: [1],
                        backgroundColor: ['#d3d3d3'],
                    };
                });
            } else {
                data = this._prepareData(this.processedDataPoints);
                // give same color to same groups from different origins
                colors = data.labels.map((_, index) => {
                    return getColor(index);
                });
                for (const dataset of data.datasets) {
                    dataset.backgroundColor = colors;
                    dataset.borderColor = 'rgba(255,255,255,0.6)';
                }
                // make sure there is a zone associated with every origin
                const representedOriginIndexes = data.datasets.map(dataset => {
                    return dataset.originIndex;
                });
                let addNoDataToLegend = false;
                const fakeData = (new Array(data.labels.length)).concat([1]);

                for (let originIndex = 0; originIndex < this.propsCopy.origins.length; ++originIndex) {
                    const origin = this.propsCopy.origins[originIndex];
                    if (!representedOriginIndexes.includes(originIndex)) {
                        data.datasets.splice(originIndex, 0, {
                            label: origin,
                            data: fakeData,
                            backgroundColor: colors.concat(['#d3d3d3']),
                        });
                        addNoDataToLegend = true;
                    }
                }
                if (addNoDataToLegend) {
                    data.labels.push(this.noDataLabel);
                }
            }

            // prepare options
            const options = this._prepareOptions(data.datasets.length);

            // create pie chart config
            this.config = { data, options, type: 'pie' };
        }

        /**
         * Determine how to relabel a label according to a given origin.
         * The idea is that the getLabel function is in general not invertible but
         * it is when restricted to the set of dataPoints coming from a same origin.
         * @private
         * @param {Array} label
         * @param {Array} originIndex
         * @returns {string}
         */
        _relabelling(label, originIndex) {
            if (label === this.noDataLabel) {
                return label[0];
            }
            const i = this.propsCopy.comparisonFieldIndex;
            if (['bar', 'line'].includes(this.propsCopy.mode) && i === 0) {
                // here label is an array of length 1 and contains a number
                return this.dateClasses.representative(label, originIndex) || '';
            } else if (this.propsCopy.mode === 'pie' && i === 0) {
                // here label is an array of length at least one containing string or numbers
                const labelCopy = label.slice(0);
                if (originIndex !== undefined) {
                    labelCopy.splice(i, 1, this.dateClasses.representative(label[i], originIndex));
                } else {
                    labelCopy.splice(i, 1, this.dateClasses.dateClassMembers(label[i]));
                }
                return labelCopy.join('/');
            }
            // here label is an array containing strings or numbers.
            return label.join('/') || this.env._t("Total");
        }

        /**
         * Instantiate a Chart (Chart.js lib) to render the graph according to the
         * current config. Chart.js performs the rendering in a nextAnimationFrame,
         * so we wait for a tick before destroying/instantiating the chart, so
         * that both are done in the same frame, and there is no flickering.
         * Indeed, nested nextAnimationFrame callbacks are executed in successive
         * frames, and when we reach this function, we already are in a
         * requestAnimationFrame callback (see Owl internals).
         * @private
         */
        async _renderGraphMainContent() {
            await new Promise(setTimeout);

            if (this.chart) {
                this.chart.destroy();
            }
            if (this.mainContent) {
                this.mainContent.remove();
            }
            this._computeDerivedProps();

            const template = document.createElement('template');
            const content = this.env.qweb.renderToString('GraphRenderer.MainContent', {
                noContentHelperData: this.noContentHelperData,
            });
            template.innerHTML = content;
            this.mainContent = template.content.firstChild;
            this.el.append(this.mainContent);

            if (!this.noContentHelperData) {
                const ctx = this.canvas.getContext('2d');
                this.chart = new Chart(ctx, this.config);
            }
        }

        /**
         * Determine whether the data are good, and display an error message
         * if this is not the case.
         * @private
         */
        _setNoContentHelper() {
            delete this.noContentHelperData;

            const dataPoints = this.processedDataPoints;
            if (!dataPoints.length && this.propsCopy.mode !== 'pie') {
                this.noContentHelperData = { title: "", description: "" };
            } else if (this.propsCopy.mode === 'pie') {
                let allNegative = true;
                let someNegative = false;
                let allZero = true;
                for (const datapt of dataPoints) {
                    allNegative = allNegative && (datapt.value < 0);
                    someNegative = someNegative || (datapt.value < 0);
                    allZero = allZero && (datapt.value === 0);
                }
                if (someNegative && !allNegative) {
                    const title = this.env._t("Invalid data");
                    const description = this.env._t("Pie chart cannot mix positive and negative numbers. ") +
                              this.env._t("Try to change your domain to only display positive results");
                    this.noContentHelperData = { title, description };
                    return;
                }
                if (allZero && !this.propsCopy.isEmbedded && this.propsCopy.origins.length === 1) {
                    const title = _("Invalid data");
                    const description = this.env._t("Pie chart cannot display all zero numbers. ") +
                            this.env._t("Try to change your domain to display positive results");
                    this.noContentHelperData = { title, description };
                    return;
                }
            }
        }

        /**
         * Used to avoid too long legend items.
         * @private
         * @param {string} label
         * @returns {string} shortened version of the input label
         */
        _shortenLabel(label) {
            // string returned could be 'wrong' if a groupby value contain a '/'!
            const groups = label.split("/");
            let shortLabel = groups.slice(0, 3).join("/");
            if (shortLabel.length > 30) {
                shortLabel = shortLabel.slice(0, 30) + '...';
            } else if (groups.length > 3) {
                shortLabel = shortLabel + '/...';
            }
            return shortLabel;
        }

        /**
         * Sort datapoints according to the current order (ASC or DESC).
         * Note: this should be moved to the model at some point.
         * @private
         * @param {Object[]} dataPoints
         * @returns {Object[]} sorted dataPoints if orderby set on state
         */
        _sortDataPoints(dataPoints) {
            if (this.propsCopy.domains.length === 1 && this.propsCopy.orderBy &&
                ['bar', 'line'].includes(this.propsCopy.mode) && this.propsCopy.processedGroupBy.length) {
                // group data by their x-axis value, and then sort datapoints
                // based on the sum of values by group in ascending/descending order
                const groupByFieldName = this.propsCopy.processedGroupBy[0].split(':')[0];
                const groupedByMany2One = this.propsCopy.fields[groupByFieldName].type === 'many2one';
                const groupedDataPoints = {};
                for (const dataPt of dataPoints) {
                    const key = groupedByMany2One ? dataPt.resId : dataPt.labels[0];
                    if (!groupedDataPoints[key]) {
                        groupedDataPoints[key] = [];
                    }
                    groupedDataPoints[key].push(dataPt);
                }
                dataPoints = sortBy(Object.values(groupedDataPoints),
                    group => group.reduce((sum, dataPoint) => sum + dataPoint.value, 0)
                ).flat();
                if (this.propsCopy.orderBy === 'desc') {
                    dataPoints.reverse('value');
                }
            }
            return dataPoints;
        }

        //----------------------------------------------------------------------
        // Handlers
        //----------------------------------------------------------------------

        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onGraphClicked(ev) {
            const activeElement = this.chart.getElementAtEvent(ev);
            if (activeElement.length === 0) {
                return;
            }
            const domain = this.chart.data.datasets[activeElement[0]._datasetIndex].domain;
            if (!domain) {
                return; // empty dataset
            }
            this.trigger('open_view', {
                domain: domain[activeElement[0]._index],
            });
        }

        /**
         * If the text of a legend item has been shortened and the user mouse over
         * that item (actually the event type is mousemove), a tooltip with the item
         * full text is displayed.
         *
         * @private
         * @param {MouseEvent} ev
         * @param {Object} legendItem
         */
        _onlegendTooltipHover(ev, legendItem) {
            ev.target.style.cursor = 'pointer';
            // The string legendItem.text is an initial segment of legendItem.fullText.
            // If the two coincide, no need to generate a tooltip.
            // If a tooltip for the legend already exists, it is already good and don't need
            // to be recreated.
            if (legendItem.text === legendItem.fullText || this.legendTooltip) {
                return;
            }

            const chartAreaLeft = this.chart.chartArea.left;
            const chartAreaRight = this.chart.chartArea.right;
            const rendererTop = this.el.getBoundingClientRect().top;

            this.legendTooltip = document.createElement('div');
            this.legendTooltip.className = 'o_tooltip_legend';
            this.legendTooltip.innerText = legendItem.fullText;
            this.legendTooltip.style.top = (ev.clientY - rendererTop) + 'px';
            this.legendTooltip.style.maxWidth = Math.floor((chartAreaRight - chartAreaLeft) / 1.618) + 'px';

            this.container.appendChild(this.legendTooltip);

            this._fixTooltipLeftPosition(this.legendTooltip, ev.clientX);
        }

        /**
         * If there's a legend tooltip and the user mouse out of the corresponding
         * legend item, the tooltip is removed.
         *
         * @private
         * @param {MouseEvent} ev
         */
        _onLegendTootipLeave(ev) {
            ev.target.style.cursor = "";
            if (this.legendTooltip) {
                this.legendTooltip.remove();
                this.legendTooltip = null;
            }
        }
    }

    GraphRenderer.template = 'web.GraphRenderer';
    GraphRenderer.props = {
        arch: { type: Object, shape: {
            children: { type: Array, element: { type: Object } },
            attrs: Object,
            tag: { validate: s => s === 'graph' },
        }},
        comparisonFieldIndex: Number,
        context: Object,
        dataPoints: { type: Array, element: { type: Object }},
        disableLinking: Boolean,
        domain: { type: Array, element: { validate: s => s instanceof Array || typeof s === 'string' } },
        domains: { type: Array, element: {
            type: Array,
            element: { validate: s => s instanceof Array || typeof s === 'string' }
        }},
        fields: Object,
        groupBy: { type: Array, element: String },
        isEmbedded: Boolean,
        measure: String,
        mode: { validate: s => ['bar', 'line', 'pie'].includes(s) },
        origins: { type: Array, element: String },
        processedGroupBy: { type: Array, element: String },
        stacked: Boolean,
        timeRanges: Object,
        noContentHelp: { type: String, optional: 1 },
        orderBy: { type: { validate: s => ['string', 'boolean'].includes(typeof s) }, optional: 1 },
        title: { type: String, optional: 1 },
        withSearchPanel: { type: Boolean, optional: 1 },
    };

    return patchMixin(GraphRenderer);

});
