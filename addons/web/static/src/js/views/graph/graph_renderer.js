odoo.define('web.GraphRenderer', function (require) {
    'use strict';

    const config = require('web.config');
    const { DateClasses } = require('web.dataComparisonUtils');
    const fieldUtils = require('web.field_utils');
    const OwlAbstractRenderer = require('web.AbstractRendererOwl');
    const patchMixin = require('web.patchMixin');
    const { sortBy } = require('web.utils');

    const COLORS = [
        "#1f77b4", "#ff7f0e", "#aec7e8", "#ffbb78", "#2ca02c", "#98df8a", "#d62728",
        "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "#c49c94", "#e377c2", "#f7b6d2",
        "#7f7f7f", "#c7c7c7", "#bcbd22", "#dbdb8d", "#17becf", "#9edae5",
    ];
    const DEFAULT_BG = "#d3d3d3";
    // used to format values in tooltips and yAxes.
    const FORMAT_OPTIONS = {
        // allow to decide if utils.human_number should be used
        humanReadable: value => Math.abs(value) >= 1000,
        // with the choices below, 1236 is represented by 1.24k
        minDigits: 1,
        decimals: 2,
        // avoid comma separators for thousands in numbers when human_number is used
        formatterCallback: str => str,
    };
    // hide top legend when too many items for device size
    const MAX_LEGEND_LENGTH = 4 * Math.max(1, config.device.size_class);
    const RGB_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

    /**
     * @param {number} index
     * @returns {string}
     */
    function getColor(index) {
        return COLORS[index % COLORS.length];
    }

    /**
     * @param {Object} chartArea
     * @returns {string}
     */
    function getMaxWidth({ left, right }) {
        return Math.floor((right - left) / 1.618) + "px";
    }

    /**
     * @param {string} hex
     * @param {number} opacity
     * @returns {string}
     */
    function hexToRGBA(hex, opacity) {
        const rgb = RGB_REGEX
            .exec(hex)
            .slice(1, 4)
            .map(n => parseInt(n, 16))
            .join(',');
        return `rgba(${rgb},${opacity})`;
    }

    class GraphRenderer extends OwlAbstractRenderer {
        constructor() {
            super(...arguments);

            this.noDataLabel = [this.env._t("No data")];
        }

        mounted() {
            this._computeDerivedProps(this.props);
            this._renderGraphMainContent();
        }

        patched() {
            this._computeDerivedProps(this.props);
            this._renderGraphMainContent();
        }

        //---------------------------------------------------------------------
        // Getters
        //---------------------------------------------------------------------

        /**
         * @returns {HTMLDivElement | null}
         */
        get container() {
            return this.el.querySelector('div.o_graph_canvas_container');
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        /**
         * This function aims to remove a suitable number of lines from the
         * tooltip in order to make it reasonably visible. A message indicating
         * the number of lines is added if necessary.
         * @private
         * @param {Number} maxTooltipHeight this the max height in pixels of the tooltip
         */
        _adjustTooltipHeight(maxTooltipHeight) {
            const sizeOneLine = this.tooltip.querySelector('tbody tr').clientHeight;
            const tbodySize = this.tooltip.querySelector('tbody').clientHeight;
            const toKeep = Math.max(0, Math.floor(
                (maxTooltipHeight - (this.tooltip.clientHeight - tbodySize)
                ) / sizeOneLine) - 1); // used to avoid toKeep = -1
            const lines = this.tooltip.querySelectorAll('tbody tr');
            const toRemove = lines.length - toKeep;
            if (toRemove > 0) {
                for (let index = toKeep; index < lines.length; ++index) {
                    lines[index].remove();
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
         * Computes various objects based on the param props.
         * @private
         * @param {Object} props
         */
        _computeDerivedProps(props) {
            this.propsCopy = Object.assign({}, props);
            const filteredDataPoints = this._filterDataPoints();
            this.processedDataPoints = this._sortDataPoints(filteredDataPoints);

            this._setNoContentHelper();

            if (this.noContentHelperData) {
                return;
            }
            if (this.propsCopy.comparisonFieldIndex === 0) {
                this.dateClasses = this._getDateClasses(this.processedDataPoints);
            }
            switch (this.propsCopy.mode) {
                case 'bar': this._prepareBarChartConfig(); break;
                case 'line': this._prepareLineChartConfig(); break;
                case 'pie': this._preparePieChartConfig(); break;
            }
        }

        /**
         * Creates a custom HTML tooltip.
         * @private
         * @param {Object} tooltipModel see chartjs documentation
         */
        _customTooltip(tooltipModel) {
            this.el.style.cursor = 'default';
            if (this.tooltip) {
                this.tooltip.remove();
            }
            if (tooltipModel.opacity === 0 || tooltipModel.dataPoints.length === 0) {
                return;
            }
            if (this._isRedirectionEnabled()) {
                this.el.style.cursor = 'pointer';
            }

            const chartAreaTop = this.chart.chartArea.top;
            const rendererTop = this.el.getBoundingClientRect().top;

            this.tooltip = this._renderTemplate("web.GraphRenderer.CustomTooltip", {
                maxWidth: getMaxWidth(this.chart.chartArea),
                measure: this.propsCopy.fields[this.propsCopy.measure].string,
                tooltipItems: this._getTooltipItems(tooltipModel),
            });

            this.container.prepend(this.tooltip);

            let top;
            const tooltipHeight = this.tooltip.clientHeight;
            const minTopAllowed = Math.floor(chartAreaTop);
            const maxTopAllowed = Math.floor(window.innerHeight - (rendererTop + tooltipHeight)) - 2;
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
                const maxTooltipHeight = window.innerHeight - (rendererTop + chartAreaTop) - 2;
                this._adjustTooltipHeight(maxTooltipHeight);
            }

            this._fixTooltipLeftPosition(this.tooltip, tooltipModel.x);
            this.tooltip.style.top = Math.floor(top) + 'px';
        }

        /**
         * Filters out some dataPoints because they would lead to bad graphics.
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
            if (this.propsCopy.mode === "line") {
                let counts = 0;
                for (const dataPoint of this.propsCopy.dataPoints) {
                    if (dataPoint.labels[0] !== this.env._t("Undefined")) {
                        dataPoints.push(dataPoint);
                    }
                    counts += dataPoint.count;
                }
                // data points with zero count might have been created on purpose
                // we only remove them if there are no data point with positive count
                if (counts === 0) {
                    dataPoints = [];
                }
            } else {
                dataPoints = this.propsCopy.dataPoints.filter(
                    dataPoint => dataPoint.count > 0
                );
            }
            return dataPoints;
        }

        /**
         * Sets best left position of a tooltip approaching the proposal x.
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
         * Used to format correctly the values in tooltips and yAxes.
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
         * Determines the initial section of the labels array over a dataset
         * has to be completed. The section only depends on the datasets
         * origins.
         * @private
         * @param {number} originIndex
         * @param {number} defaultLength
         * @returns {number}
         */
        _getDatasetDataLength(originIndex, defaultLength) {
            if (this.propsCopy.mode !== "pie" && this.propsCopy.comparisonFieldIndex === 0) {
                return this.dateClasses.dateSets[originIndex].length;
            }
            return defaultLength;
        }

        /**
         * Determines the dataset to which the data point belongs.
         * @private
         * @param {Object} dataPoint
         * @returns {string}
         */
        _getDatasetLabel({ labels, originIndex }) {
            const { fields, measure, mode, origins } = this.propsCopy;
            if (mode !== "pie") {
                // ([origin] + second to last groupBys) or measure
                let datasetLabel = labels.slice(1).join("/");
                if (origins.length > 1) {
                    datasetLabel = origins[originIndex] + (
                        datasetLabel ? ('/' + datasetLabel) : ''
                    );
                }
                datasetLabel = datasetLabel || fields[measure].string;
                return datasetLabel;
            }
            return origins[originIndex];
        }

        /**
         * Returns a DateClasses instance used to manage equivalence of dates.
         * @private
         * @param {Object[]} dataPoints
         * @returns {DateClasses}
         */
        _getDateClasses(dataPoints) {
            const dateSets = this.propsCopy.origins.map(() => []);
            for (const { labels, originIndex } of dataPoints) {
                dateSets[originIndex].push(labels[this.propsCopy.comparisonFieldIndex]);
            }
            return new DateClasses(dateSets.map(dateSet => [...new Set(dateSet)]));
        }

        /**
         * Returns an object used to style chart elements independently from
         * the datasets.
         * @private
         * @returns {Object}
         */
        _getElementOptions() {
            const elementOptions = {};
            if (this.propsCopy.mode === 'bar') {
                elementOptions.rectangle = { borderWidth: 1 };
            } else if (this.propsCopy.mode === 'line') {
                elementOptions.line = {
                    tension: 0,
                    fill: false,
                };
            }
            return elementOptions;
        }

        /**
         * Gets the label over which the data point is.
         * @private
         * @param {Object} dataPoint
         * @returns {Array}
         */
        _getLabel({ labels, originIndex }) {
            const index = this.propsCopy.comparisonFieldIndex;
            if (this.propsCopy.mode !== "pie") {
                if (index === 0) {
                    return [this.dateClasses.dateClass(originIndex, labels[index])];
                } else {
                    return labels.slice(0, 1);
                }
            } else if (index === 0) {
                return Array.prototype.concat.apply([], [
                    this.dateClasses.dateClass(originIndex, labels[index]),
                    labels.slice(index + 1)
                ]);
            } else {
                return labels;
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
            if (this.propsCopy.mode !== "pie") {
                let referenceColor;
                if (this.propsCopy.mode === 'bar') {
                    referenceColor = 'backgroundColor';
                } else {
                    referenceColor = 'borderColor';
                }
                legendOptions.labels = {
                    generateLabels: chart => {
                        const data = chart.data;
                        return data.datasets.map((dataset, index) => {
                            return {
                                text: this._shortenLabel(dataset.label),
                                fullText: dataset.label,
                                fillStyle: dataset[referenceColor],
                                hidden: !chart.isDatasetVisible(index),
                                lineCap: dataset.borderCapStyle,
                                lineDash: dataset.borderDash,
                                lineDashOffset: dataset.borderDashOffset,
                                lineJoin: dataset.borderJoinStyle,
                                lineWidth: dataset.borderWidth,
                                strokeStyle: dataset[referenceColor],
                                pointStyle: dataset.pointStyle,
                                datasetIndex: index,
                            };
                        });
                    },
                };
            } else {
                legendOptions.labels = {
                    generateLabels: chart => {
                        const data = chart.data;
                        const metaData = data.datasets.map(
                            (dataset, index) => chart.getDatasetMeta(index).data
                        );
                        return data.labels.map((label, index) => {
                            const hidden = metaData.some(
                                data => data[index] && data[index].hidden
                            );
                            const fullText = this._relabelling(label);
                            const text = this._shortenLabel(fullText);
                            const fillStyle = label === this.noDataLabel ?
                                DEFAULT_BG :
                                getColor(index);
                            return { text, fullText, fillStyle, hidden, index };
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
            if (this.propsCopy.mode === "pie") {
                return {};
            }
            const { fields, isEmbedded, measure, processedGroupBy } = this.propsCopy;
            const xAxes = [{
                type: 'category',
                scaleLabel: {
                    display: processedGroupBy.length && !isEmbedded,
                    labelString: processedGroupBy.length ?
                        fields[processedGroupBy[0].split(':')[0]].string :
                        '',
                },
                ticks: { callback: label => this._relabelling(label) },
            }];
            const yAxes = [{
                type: 'linear',
                scaleLabel: {
                    display: !isEmbedded,
                    labelString: fields[measure].string,
                },
                ticks: {
                    callback: this._formatValue.bind(this),
                    suggestedMax: 0,
                    suggestedMin: 0,
                },
            }];
            return { xAxes, yAxes };
        }

        /**
         * Extracts the important information from a tooltipItem generated by
         * Charts.js (a tooltip item corresponds to a line (different from
         * measure name) of a tooltip).
         * @private
         * @param {Object} item
         * @param {Object} data
         * @returns {Object}
         */
        _getTooltipItemContent(item, data) {
            const dataset = data.datasets[item.datasetIndex];
            const id = item.index;
            let label = data.labels[item.index];
            let value;
            let boxColor;
            if (this.propsCopy.mode === "pie") {
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
            } else {
                label = this._relabelling(label, dataset.originIndex);
                if (
                    this.propsCopy.processedGroupBy.length > 1 ||
                    this.propsCopy.origins.length > 1
                ) {
                    label = `${label}/${dataset.label}`;
                }
                value = this._formatValue(item.yLabel);
                boxColor = this.propsCopy.mode === "bar" ?
                    dataset.backgroundColor :
                    dataset.borderColor;
            }
            return { id, label, value, boxColor };
        }

        /**
         * This function extracts the information from the data points in
         * tooltipModel.dataPoints (corresponding to datapoints over a given
         * label determined by the mouse position) that will be displayed in a
         * custom tooltip.
         * @private
         * @param {Object} tooltipModel see chartjs documentation
         * @return {Object[]}
         */
        _getTooltipItems(tooltipModel) {
            const { data } = this.chart.config;
            const sortedDataPoints = sortBy(tooltipModel.dataPoints, "yLabel", false);
            return sortedDataPoints.map(
                item => this._getTooltipItemContent(item, data)
            );
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
         * Returns true iff the current graph can be clicked on to redirect to
         * the list of records.
         * @private
         * @returns {boolean}
         */
        _isRedirectionEnabled() {
            return !this.propsCopy.disableLinking && this.propsCopy.mode !== 'line';
        }

        /**
         * Creates a bar chart config.
         * @private
         */
        _prepareBarChartConfig() {
            // prepare data
            const data = this._prepareData(this.processedDataPoints);

            for (let index = 0; index < data.datasets.length; ++index) {
                const dataset = data.datasets[index];
                // used when stacked
                if (this.propsCopy.stacked) {
                    dataset.stack = this.propsCopy.origins[dataset.originIndex];
                }
                // set dataset color
                dataset.backgroundColor = getColor(index);
            }

            // prepare options
            const options = this._prepareOptions(data.datasets.length);

            // create bar chart config
            this.config = { data, options, type: 'bar' };
        }

        /**
         * Separates dataPoints coming from the read_group(s) into different
         * datasets. This function returns the parameters data and labels used
         * to produce the charts.
         * @param {Object[]} dataPoints
         * @returns {Object}
         */
        _prepareData(dataPoints) {
            const labelMap = {};
            const labels = [];
            for (const dataPt of dataPoints) {
                const label = this._getLabel(dataPt);
                const labelKey = `${dataPt.resId}:${JSON.stringify(label)}`;
                const index = labelMap[labelKey];
                if (index === undefined) {
                    labelMap[labelKey] = dataPt.labelIndex = labels.length;
                    labels.push(label);
                } else {
                    dataPt.labelIndex = index;
                }
            }

            // dataPoints --> datasets
            const datasetsTmp = {};
            for (const dp of dataPoints) {
                const datasetLabel = this._getDatasetLabel(dp);
                if (!(datasetLabel in datasetsTmp)) {
                    const dataLength = this._getDatasetDataLength(dp.originIndex, labels.length);
                    datasetsTmp[datasetLabel] = {
                        data: new Array(dataLength).fill(0),
                        domain: new Array(dataLength).fill([]),
                        label: datasetLabel,
                        originIndex: dp.originIndex,
                    };
                }
                const labelIndex = dp.labelIndex;
                datasetsTmp[datasetLabel].data[labelIndex] = dp.value;
                datasetsTmp[datasetLabel].domain[labelIndex] = dp.domain;
            }
            // sort by origin
            const datasets = sortBy(Object.values(datasetsTmp), "originIndex");
            return { datasets, labels };
        }

        /**
         * Creates a line chart config.
         * @private
         */
        _prepareLineChartConfig() {
            // prepare data
            const data = this._prepareData(this.processedDataPoints);
            for (let index = 0; index < data.datasets.length; ++index) {
                const dataset = data.datasets[index];
                if (
                    this.propsCopy.processedGroupBy.length <= 1 &&
                    this.propsCopy.origins.length > 1
                ) {
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
                    // shift of the real value to right. This is done to
                    // center the points in the chart. See data.labels below in
                    // Chart parameters
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

            // center the points in the chart (without that code they are put
            // on the left and the graph seems empty)
            data.labels = data.labels.length > 1 ?
                data.labels :
                [[''], ...data.labels, ['']];

            // prepare options
            const options = this._prepareOptions(data.datasets.length);

            // create line chart config
            this.config = { data, options, type: 'line' };
        }

        /**
         * Prepares options for the chart according to the current mode
         * (= chart type). This function returns the parameter options used to
         * instantiate the chart.
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
                options.onClick = ev => this._onGraphClicked(ev);
            }
            return options;
        }

        /**
         * Creates a pie chart config.
         * @private
         */
        _preparePieChartConfig() {
            // prepare data
            let data = {};
            const allZero = this.processedDataPoints.every(
                datapt => datapt.value === 0
            );
            if (allZero) {
                // add fake data to display a pie chart with a grey zone associated
                // with every origin
                data.labels = [this.noDataLabel];
                data.datasets = this.propsCopy.origins.map(origin => {
                    return {
                        label: origin,
                        data: [1],
                        backgroundColor: [DEFAULT_BG],
                    };
                });
            } else {
                data = this._prepareData(this.processedDataPoints);
                // give same color to same groups from different origins
                const colors = data.labels.map((_, index) => getColor(index));
                for (const dataset of data.datasets) {
                    dataset.backgroundColor = colors;
                    dataset.borderColor = 'rgba(255,255,255,0.6)';
                }
                // make sure there is a zone associated with every origin
                const representedOriginIndexes = data.datasets.map(
                    dataset => dataset.originIndex
                );
                let addNoDataToLegend = false;
                const fakeData = new Array(data.labels.length).concat([1]);

                for (let index = 0; index < this.propsCopy.origins.length; ++index) {
                    const origin = this.propsCopy.origins[index];
                    if (!representedOriginIndexes.includes(index)) {
                        data.datasets.splice(index, 0, {
                            label: origin,
                            data: fakeData,
                            backgroundColor: [...colors, DEFAULT_BG],
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
         * Determines how to relabel a label according to a given origin. The
         * idea is that the getLabel function is in general not invertible but
         * it is when restricted to the set of dataPoints coming from a same
         * origin.
         * @private
         * @param {Array} label
         * @param {Array} [originIndex]
         * @returns {string}
         */
        _relabelling(label, originIndex) {
            if (label === this.noDataLabel) {
                return label[0];
            }
            const index = this.propsCopy.comparisonFieldIndex;
            if (this.propsCopy.mode !== "pie" && index === 0) {
                // here label is an array of length 1 and contains a number
                return this.dateClasses.representative(label, originIndex) || '';
            } else if (this.propsCopy.mode === 'pie' && index === 0) {
                // here label is an array of length at least one containing string or numbers
                const labelCopy = label.slice();
                let newLabel;
                if (originIndex === undefined) {
                    newLabel = this.dateClasses.dateClassMembers(label[index]);
                } else {
                    newLabel = this.dateClasses.representative(label[index], originIndex);
                }
                labelCopy.splice(index, 1, newLabel);
                return labelCopy.join('/');
            }
            // here label is an array containing strings or numbers.
            return label.join('/') || this.env._t("Total");
        }

        /**
         * Instantiate a Chart (Chart.js lib) to render the graph according to
         * the current config. Chart.js performs the rendering in a
         * nextAnimationFrame, so we wait for a tick before destroying/
         * instantiating the chart, so that both are done in the same frame,
         * and there is no flickering. Indeed, nested nextAnimationFrame
         * callbacks are executed in successive frames, and when we reach this
         * function, we already are in a requestAnimationFrame callback (see
         * Owl internals).
         * @private
         * @returns {Promise}
         */
        async _renderGraphMainContent() {
            await new Promise(setTimeout);

            if (this.chart) {
                this.chart.destroy();
            }
            if (this.mainContent) {
                this.mainContent.remove();
            }

            if (!this.el) {
                // Element could have been destroyed in the interval. Rendering
                // is aborted in that case.
                return;
            }

            this.mainContent = this._renderTemplate("web.GraphRenderer.MainContent", this);
            this.el.append(this.mainContent);

            if (!this.noContentHelperData) {
                const canvas = this.el.querySelector("canvas");
                const ctx = canvas.getContext('2d');
                this.chart = new Chart(ctx, this.config);
            }
        }

        /**
         * Renders the given template name with the given props and return the
         * generated node.
         * @private
         * @param {string} name
         * @param {Object} props
         * @returns {HTMLElement}
         */
        _renderTemplate(name, props) {
            const template = Object.assign(document.createElement("template"), {
                innerHTML: this.env.qweb.renderToString(name, props),
            });
            return template.content.firstChild;
        }

        /**
         * Determines whether the data are good, and displays an error message
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
                    const description = [
                        this.env._t("Pie chart cannot mix positive and negative numbers. "),
                        this.env._t("Try to change your domain to only display positive results"),
                    ].join("");
                    this.noContentHelperData = { title, description };
                } else if (
                    allZero &&
                    !this.propsCopy.isEmbedded &&
                    this.propsCopy.origins.length === 1
                ) {
                    const title = this.env._t("Invalid data");
                    const description = [
                        this.env._t("Pie chart cannot display all zero numbers. "),
                        this.env._t("Try to change your domain to display positive results"),
                    ].join("");
                    this.noContentHelperData = { title, description };
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
         * Sorts datapoints according to the current order (ASC or DESC).
         * Note: this should be moved to the model at some point.
         * @private
         * @param {Object[]} dataPoints
         * @returns {Object[]} sorted dataPoints if orderby set on state
         */
        _sortDataPoints(dataPoints) {
            if (
                this.propsCopy.domains.length === 1 &&
                this.propsCopy.orderBy &&
                this.propsCopy.mode !== "pie" &&
                this.propsCopy.processedGroupBy.length
            ) {
                // group data by their x-axis value, and then sort datapoints
                // based on the sum of values by group in ascending/descending order
                const [groupByFieldName] = this.propsCopy.processedGroupBy[0].split(':');
                const { type } = this.propsCopy.fields[groupByFieldName];
                const groupedDataPoints = {};
                for (const dataPt of dataPoints) {
                    const key = type === 'many2one' ? dataPt.resId : dataPt.labels[0];
                    if (!groupedDataPoints[key]) {
                        groupedDataPoints[key] = [];
                    }
                    groupedDataPoints[key].push(dataPt);
                }
                const groupTotal = group => group.reduce((sum, { value }) => sum + value, 0);
                dataPoints = sortBy(Object.values(groupedDataPoints), groupTotal).flat();
                if (this.propsCopy.orderBy === 'desc') {
                    dataPoints.reverse();
                }
            }
            return dataPoints;
        }

        //---------------------------------------------------------------------
        // Handlers
        //---------------------------------------------------------------------

        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onGraphClicked(ev) {
            const [activeElement] = this.chart.getElementAtEvent(ev);
            if (!activeElement) {
                return;
            }
            const { _datasetIndex, _index } = activeElement;
            const { domain } = this.chart.data.datasets[_datasetIndex];
            if (domain) {
                this.trigger('open_view', { domain: domain[_index] });
            }
        }

        /**
         * If the text of a legend item has been shortened and the user mouse
         * hovers that item (actually the event type is mousemove), a tooltip
         * with the item full text is displayed.
         * @private
         * @param {MouseEvent} ev
         * @param {Object} legendItem
         */
        _onlegendTooltipHover(ev, legendItem) {
            ev.target.style.cursor = 'pointer';
            /**
             * The string legendItem.text is an initial segment of legendItem.fullText.
             * If the two coincide, no need to generate a tooltip. If a tooltip
             * for the legend already exists, it is already good and doesn't
             * need to be recreated.
             */
            if (legendItem.text === legendItem.fullText || this.legendTooltip) {
                return;
            }

            const rendererTop = this.el.getBoundingClientRect().top;

            this.legendTooltip = document.createElement('div');
            this.legendTooltip.className = 'o_tooltip_legend';
            this.legendTooltip.innerText = legendItem.fullText;
            this.legendTooltip.style.top = (ev.clientY - rendererTop) + 'px';
            this.legendTooltip.style.maxWidth = getMaxWidth(this.chart.chartArea);

            this.container.appendChild(this.legendTooltip);

            this._fixTooltipLeftPosition(this.legendTooltip, ev.clientX);
        }

        /**
         * If there's a legend tooltip and the user mouse out of the
         * corresponding legend item, the tooltip is removed.
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
        arch: {
            type: Object, shape: {
                children: { type: Array, element: Object },
                attrs: Object,
                tag: { validate: t => t === 'graph' },
            },
        },
        comparisonFieldIndex: Number,
        context: Object,
        dataPoints: { type: Array, element: Object },
        disableLinking: Boolean,
        domain: [Array, String],
        domains: { type: Array, element: [Array, String] },
        fields: Object,
        groupBy: { type: Array, element: String },
        isEmbedded: Boolean,
        measure: String,
        mode: { validate: m => ['bar', 'line', 'pie'].includes(m) },
        origins: { type: Array, element: String },
        processedGroupBy: { type: Array, element: String },
        stacked: Boolean,
        timeRanges: Object,
        noContentHelp: { type: String, optional: 1 },
        orderBy: { type: [String, Boolean], optional: 1 },
        title: { type: String, optional: 1 },
        withSearchPanel: { type: Boolean, optional: 1 },
    };

    return patchMixin(GraphRenderer);

});
