(function() {
"use strict";

/**
 * QUnit Config
 *
 * The Odoo javascript test framework is based on QUnit (http://qunitjs.com/).
 * This file is necessary to setup Qunit and to prepare its interactions with
 * Odoo.  It has to be loaded before any tests are defined.
 *
 * Note that it is not an Odoo module, because we want this code to be executed
 * as soon as possible, not whenever the Odoo module system feels like it.
 */


/**
 * This configuration variable is not strictly necessary, but it ensures more
 * safety for asynchronous tests.  With it, each test has to explicitely tell
 * QUnit how many assertion it expects, otherwise the test will fail.
 */
QUnit.config.requireExpects = true;

/**
 * not important in normal mode, but in debug=assets, the files are loaded
 * asynchroneously, which can lead to various issues with QUnit... Notice that
 * this is done outside of odoo modules, otherwise the setting would not take
 * effect on time.
 */
QUnit.config.autostart = false;

/**
 * A test timeout of 1 min, before an async test is considered failed.
 */
// QUnit.config.testTimeout = 1 * 60 * 1000;

/**
 * Hide passed tests by default in the QUnit page
 */
QUnit.config.hidepassed = (window.location.href.match(/[?&]testId=/) === null);

var sortButtonAppended = false;

/**
 * This is the way the testing framework knows that tests passed or failed. It
 * only look in the phantomJS console and check if there is a ok or an error.
 *
 * Someday, we should devise a safer strategy...
 */
QUnit.done(function(result) {
    if (!result.failed) {
        console.log('test successful');
    } else {
        console.error(result.failed, "/", result.total, "tests failed");
    }

    if (!sortButtonAppended) {
        _addSortButton();
    }
});

/**
 * This logs various data in the console, which will be available in the log
 * .txt file generated by the runbot.
 */
QUnit.log(function (result) {
    if (!result.result) {
        var info = '"QUnit test failed: "' + result.module + ' > ' + result.name + '"';
        info += ' [message: "' + result.message + '"';
        if (result.actual !== null) {
            info += ', actual: "' + result.actual + '"';
        }
        if (result.expected !== null) {
            info += ', expected: "' + result.expected + '"';
        }
        info += ']';
        console.error(info);
    }
});

/**
 * This is done mostly for the .txt log file generated by the runbot.
 */
QUnit.moduleDone(function(result) {
    if (!result.failed) {
        console.log('"' + result.name + '"', "passed", result.total, "tests.");
    } else {
        console.log('"' + result.name + '"',
                    "failed", result.failed,
                    "tests out of", result.total, ".");
    }

});

/**
 * After each test, we check that there is no leftover in the DOM.
 *
 * Note: this event is not QUnit standard, we added it for this specific use case.
 */
QUnit.on('OdooAfterTestHook', function () {
    // check for leftover elements in the body
    var $bodyChilds = $('body > *');
    var validElements = [
        // always in the body:
        {tagName: 'DIV', attrToCompare: 'id', value: 'qunit'},
        {tagName: 'DIV', attrToCompare: 'id', value: 'qunit-fixture'},
        {tagName: 'SCRIPT', attrToCompare: 'id', value: ''},
        // shouldn't be in the body after a test but are tolerated:
        {tagName: 'DIV', attrToCompare: 'className', value: 'o_notification_manager'},
        {tagName: 'DIV', attrToCompare: 'className', value: 'tooltip fade bs-tooltip-auto'},
        {tagName: 'DIV', attrToCompare: 'className', value: 'tooltip fade bs-tooltip-auto show'},
        {tagName: 'I', attrToCompare: 'title', value: 'Raphaël Colour Picker'},
        {tagName: 'SPAN', attrToCompare: 'className', value: 'select2-hidden-accessible'},
        // Due to a Document Kanban bug (already present in 12.0)
        {tagName: 'DIV', attrToCompare: 'className', value: 'ui-helper-hidden-accessible'},
        {tagName: 'UL', attrToCompare: 'className', value: 'ui-menu ui-widget ui-widget-content ui-autocomplete ui-front'},
    ];
    if ($bodyChilds.length > 3) {
        for (var i = 0; i < $bodyChilds.length; i++) {
            var bodyChild = $bodyChilds[i];
            var isValid = false;

            for (var j = 0; j < validElements.length; j++) {
                var toleratedElement = validElements[j];
                if (toleratedElement.tagName === bodyChild.tagName) {
                    var attr = toleratedElement.attrToCompare;
                    if (toleratedElement.value === bodyChild[attr]) {
                        isValid = true;
                        break;
                    }
                }
            }

            if (!isValid) {
                console.error('Body still contains undesirable elements:' +
                    '\nInvalid element:\n' + bodyChild.outerHTML +
                    '\nBody HTML: \n' + $('body').html());
                if (!document.body.classList.contains('debug')) {
                    $(bodyChild).remove();
                }
                QUnit.pushFailure(`Body still contains undesirable elements`);
            }
        }
    }

    // check for leftovers in #qunit-fixture
    var qunitFixture = document.getElementById('qunit-fixture');
    if (qunitFixture.children.length) {
        console.error('#qunit-fixture still contains elements:' +
            '\n#qunit-fixture HTML:\n' + qunitFixture.outerHTML);
        QUnit.pushFailure(`#qunit-fixture still contains elements`);
        if (!document.body.classList.contains('debug')) {
            $(qunitFixture.children).remove();
        }
    }
});

/**
 * Add a sort button on top of the QUnit result page, so we can see which tests
 * take the most time.
 */
function _addSortButton() {
    sortButtonAppended = true;
    var $sort = $('<label> sort by time (desc)</label>').css({float: 'right'});
    $('h2#qunit-userAgent').append($sort);
    $sort.click(function() {
        var $ol = $('ol#qunit-tests');
        var $results = $ol.children('li').get();
        $results.sort(function (a, b) {
            var timeA = Number($(a).find('span.runtime').first().text().split(" ")[0]);
            var timeB = Number($(b).find('span.runtime').first().text().split(" ")[0]);
            if (timeA < timeB) {
                return 1;
            } else if (timeA > timeB) {
                return -1;
            } else {
                return 0;
            }
        });
        $.each($results, function(idx, $itm) { $ol.append($itm); });

    });
}

/**
 * We add here a 'fail fast' feature: we often want to stop the test suite after
 * the first failed test.  This is also useful for the runbot test suites.
 */

QUnit.config.urlConfig.push({
  id: "failfast",
  label: "Fail Fast",
  tooltip: "Stop the test suite immediately after the first failed test."
});

QUnit.begin(function() {
    if (QUnit.config.failfast) {
        QUnit.testDone(function(details) {
            if (details.failed > 0) {
                QUnit.config.queue.length = 0;
            }
        });
    }
});

})();
