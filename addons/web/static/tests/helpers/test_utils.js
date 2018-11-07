odoo.define('web.test_utils', function (require) {
"use strict";

/**
 * Test Utils
 *
 * In this module, we define various utility functions to help simulate a mock
 * environment as close as possible as a real environment.  The main function is
 * certainly createView, which takes a bunch of parameters and give you back an
 * instance of a view, appended in the dom, ready to be tested.
 */

var ajax = require('web.ajax');
var basic_fields = require('web.basic_fields');
var concurrency = require('web.concurrency');
var config = require('web.config');
var ControlPanel = require('web.ControlPanel');
var core = require('web.core');
var session = require('web.session');
var testUtilsCreate = require('web.test_utils_create');
var testUtilsDom = require('web.test_utils_dom');
var testUtilsFields = require('web.test_utils_fields');
var testUtilsForm = require('web.test_utils_form');
var testUtilsGraph = require('web.test_utils_graph');
var testUtilsKanban = require('web.test_utils_kanban');
var testUtilsMock = require('web.test_utils_mock');
var testUtilsModal = require('web.test_utils_modal');
var testUtilsPivot = require('web.test_utils_pivot');
var Widget = require('web.Widget');

/**
 * Create a new promise that can be waited by the caller in order to execute
 * code after the next microtask tick and before the next jobqueue tick.
 *
 * @return {Promise} an already fulfilled promise
 */
async function nextMicrotaskTick() {
    return Promise.resolve();
}

/**
 * Returns a promise that is resolved in the next jobqueue tick so that the
 *  caller can wait on it in order to execute code in the next jobqueue tick.
 *
 * @return {Promise} a promise that will be fulfilled in the next jobqueue tick
 */
async function nextTick() {
    return concurrency.delay(0);
}

/**
 * Removes the src attribute on images and iframes to prevent not found errors,
 * and optionally triggers an rpc with the src url as route on a widget.
 * This method is critical and must be fastest (=> no jQuery, no underscore)
 *
 * @param {DOM Node} el
 * @param {[Widget]} widget the widget on which the rpc should be performed
 */
function removeSrcAttribute(el, widget) {
    var nodes;
    if (el.nodeName === 'IMG' || el.nodeName === 'IFRAME') {
        nodes = [el];
    } else {
        nodes = Array.prototype.slice.call(el.getElementsByTagName('img'))
            .concat(Array.prototype.slice.call(el.getElementsByTagName('iframe')));
    }
    var node;
    while (node = nodes.pop()) {
        var src = node.attributes.src && node.attributes.src.value;
        if (src && src !== 'about:blank') {
            var $el = $(node);
            node.setAttribute('data-src', src);
            if (node.nodeName === 'IMG') {
                node.attributes.removeNamedItem('src');
            } else {
                node.setAttribute('src', 'about:blank');
            }
            if (widget) {
                widget._rpc({ route: src });
            }
        }
    }
}

/**
 * Opens the datepicker of a given element.
 *
 * @param {jQuery} $datepickerEl element to which a datepicker is attached
 */
function openDatepicker($datepickerEl) {
    $datepickerEl.find('.o_datepicker_input').trigger('focus.datetimepicker');
}

// Loading static files cannot be properly simulated when their real content is
// really needed. This is the case for static XML files so we load them here,
// before starting the qunit test suite.
// (session.js is in charge of loading the static xml bundle and we also have
// to load xml files that are normally lazy loaded by specific widgets).
return Promise.all([
    session.is_bound,
    ajax.loadXML('/web/static/src/xml/dialog.xml', core.qweb)
]).then(function () {
    setTimeout(function () {
        // this is done with the hope that tests are
        // only started all together...
        QUnit.start();
    }, 0);
    return {
        mock: {
            addMockEnvironment: testUtilsMock.addMockEnvironment,
            intercept: testUtilsMock.intercept,
            patch: testUtilsMock.patch,
            patchDate: testUtilsMock.patchDate,
            unpatch: testUtilsMock.unpatch,
            fieldsViewGet: testUtilsMock.fieldsViewGet,
        },
        dom: {
            triggerKeypressEvent: testUtilsDom.triggerKeypressEvent,
            triggerMouseEvent: testUtilsDom.triggerMouseEvent,
            triggerPositionalMouseEvent: testUtilsDom.triggerPositionalMouseEvent,
            dragAndDrop: testUtilsDom.dragAndDrop,
            openDatepicker: testUtilsDom.openDatepicker,
            click: testUtilsDom.click,
            clickFirst: testUtilsDom.clickFirst,
            clickLast: testUtilsDom.clickLast,
        },
        form: {
            clickEdit: testUtilsForm.clickEdit,
            clickSave: testUtilsForm.clickSave,
            clickCreate: testUtilsForm.clickCreate,
            clickDiscard: testUtilsForm.clickDiscard,
            reload: testUtilsForm.reload,
        },
        graph: {
            reload: testUtilsGraph.reload,
        },
        kanban: {
            reload: testUtilsKanban.reload,
            clickCreate: testUtilsKanban.clickCreate,
            quickCreate: testUtilsKanban.quickCreate,
            toggleGroupSettings: testUtilsKanban.toggleGroupSettings,
            toggleRecordDropdown: testUtilsKanban.toggleRecordDropdown,
        },
        modal: {
            clickButton: testUtilsModal.clickButton,
        },
        pivot: {
            clickMeasure: testUtilsPivot.clickMeasure,
            toggleMeasuresDropdown: testUtilsPivot.toggleMeasuresDropdown,
            reload: testUtilsPivot.reload,
        },
        fields: {
            many2one: {
                clickOpenDropdown: testUtilsFields.clickOpenM2ODropdown,
                clickHighlightedItem: testUtilsFields.clickM2OHighlightedItem,
				clickItem: testUtilsFields.clickM2OItem,
                searchAndClickItem: testUtilsFields.searchAndClickM2OItem,
            },
            editInput: testUtilsFields.editInput,
            editSelect: testUtilsFields.editSelect,
            editAndTrigger: testUtilsFields.editAndTrigger,
        },

        createActionManager: testUtilsCreate.createActionManager,
        createDebugManager: testUtilsCreate.createDebugManager,
        createAsyncView: testUtilsCreate.createAsyncView,
        createModel: testUtilsCreate.createModel,
        createParent: testUtilsCreate.createParent,
        nextMicrotaskTick: nextMicrotaskTick,
        nextTick: nextTick,
    };
});

});
