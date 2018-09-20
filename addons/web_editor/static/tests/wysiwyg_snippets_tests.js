odoo.define('web_editor.wysiwyg_snippets_tests', function (require) {
"use strict";

var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');
var testUtils = require('web.test_utils');
var weTestUtils = require('web_editor.test_utils');
var Wysiwyg = require('web_editor.wysiwyg');


QUnit.module('web_editor', {}, function () {
QUnit.module('wysiwyg', {}, function () {
QUnit.module('Snippets', {}, function () {

QUnit.test('drag&drop', function (assert) {
    var done = assert.async();
    assert.expect(2);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {
            snippets: true,
            value: '<p>toto toto toto</p><p>tata</p>',
        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.getEditable();

        var $hr = wysiwyg.snippets.$('.oe_snippet_thumbnail:first');
        testUtils.dragAndDrop($hr, $editable.find('p'));

        assert.strictEqual($editable.html().replace(/\s+/g, ' '),
            '<p>toto toto toto</p><div class=\"s_hr pt32 pb32\"> <hr class=\"s_hr_1px s_hr_solid w-100 mx-auto\"> </div><p>tata</p>',
            "should drop the snippet");

        testUtils.intercept(wysiwyg, "snippet_focused", function () {
            assert.strictEqual($editable.html().replace(/\s+/g, ' '),
                '<p>toto toto toto</p><div class=\"s_hr pt32 pb32 built focus\"> <hr class=\"s_hr_1px s_hr_solid w-100 mx-auto\"> </div><p>tata</p>',
                "should build and focus the snippet");

            wysiwyg.destroy();
            done();
        });
    });
});

QUnit.test('clean the dom before save, after drag&drop', function (assert) {
    var done = assert.async();
    assert.expect(1);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {
            snippets: true,
            value: '<p>toto toto toto</p><p>tata</p>',
        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.getEditable();

        var $hr = wysiwyg.snippets.$('.oe_snippet_thumbnail:first');
        testUtils.dragAndDrop($hr, $editable.find('p'));

        testUtils.intercept(wysiwyg, "snippet_focused", function () {
            wysiwyg.save().then(function (isDirty, html) {
                assert.strictEqual(html.replace(/\s+/g, ' '),
                    '<p>toto toto toto</p><div class=\"s_hr pt32 pb32 built cleanForSave\"> <hr class=\"s_hr_1px s_hr_solid w-100 mx-auto\"> </div><p>tata</p>',
                    "should clean the snippet");

                wysiwyg.destroy();
                done();
            });
        });
    });
});

QUnit.test('clean the dom before save', function (assert) {
    var done = assert.async();
    assert.expect(1);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {
            snippets: true,
            value: '<div class="s_hr pt32 pb32"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div>',
        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.getEditable();

        testUtils.intercept(wysiwyg, "snippet_focused", function () {
            // add dirty flag to remove warning because the cleaned dom is different of the initial value and no dirty flag
            $editable.find('.s_hr').keydown();

            wysiwyg.save().then(function (isDirty, html) {
                assert.strictEqual(html.replace(/\s+/g, ' '),
                    '<div class=\"s_hr pt32 pb32 cleanForSave\"> <hr class=\"s_hr_1px s_hr_solid w-100 mx-auto\"> </div>',
                    "should clean the snippet");

                wysiwyg.destroy();
                done();
            });
        });

        $editable.find('.s_hr').mousedown().click();
    });
});

QUnit.test('remove snippet', function (assert) {
    var done = assert.async();
    assert.expect(1);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {
            snippets: true,
            value: '<div class="s_hr pt32 pb32"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div>',
        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.getEditable();

        testUtils.intercept(wysiwyg, "snippet_focused", function () {
            $('#oe_manipulators .oe_overlay_options .oe_snippet_remove').click();

            wysiwyg.save().then(function (isDirty, html) {
                assert.strictEqual(html.replace(/\s+/g, ' '), '', "should remove the snippet");

                wysiwyg.destroy();
                done();
            });
        });

        $editable.find('.s_hr').mousedown().click();
    });
});

QUnit.test('move a snippet', function (assert) {
    var done = assert.async();
    assert.expect(1);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {
            snippets: true,
            value: '<div class="s_hr pt32 pb32"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><h1>test</h1><p><b>test</b></p>',
        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.getEditable();

        var first = true;
        testUtils.intercept(wysiwyg, "snippet_focused", function () {
            if (first) {
                first = false;
                var $hr = $('#oe_manipulators .oe_overlay_options .oe_snippet_move');
                testUtils.dragAndDrop($hr, $editable.find('b'));
            } else {
                wysiwyg.save().then(function (isDirty, html) {
                    assert.strictEqual(html.replace(/\s+/g, ' '),
                        '<h1>test</h1><div class="s_hr pt32 pb32 move cleanForSave"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><p><b>test</b></p>',
                        "should move the snippet on the bottom");

                    wysiwyg.destroy();
                    done();
                });
            }
        });

        $editable.find('.s_hr').mousedown().click();
    });
});

QUnit.test('clone a snippet', function (assert) {
    var done = assert.async();
    assert.expect(2);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {
            snippets: true,
            value: '<div class="s_hr pt32 pb32"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><h1>test</h1><p><b>test</b></p>',
        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.getEditable();

        testUtils.intercept(wysiwyg, "snippet_focused", function () {
            $('#oe_manipulators .oe_overlay_options .oe_snippet_clone').click();

            assert.strictEqual($editable.html().replace(/\s+/g, ' '),
                '<div class="s_hr pt32 pb32 focus"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><div class="s_hr pt32 pb32 clone"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><h1>test</h1><p><b>test</b></p>',
                "should duplicate the snippet");

            wysiwyg.save().then(function (isDirty, html) {
                assert.strictEqual(html.replace(/\s+/g, ' '),
                    '<div class="s_hr pt32 pb32 cleanForSave"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><div class="s_hr pt32 pb32 clone cleanForSave"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><h1>test</h1><p><b>test</b></p>',
                    "should duplicate the snippet");

                wysiwyg.destroy();
                done();
            });
        });

        $editable.find('.s_hr').mousedown().click();
    });
});

QUnit.test('customize snippet', function (assert) {
    var done = assert.async();
    assert.expect(3);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {
            snippets: true,
            value: '<h1>test</h1><div class="s_hr pt32 pb32"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><p><b>test</b></p>',
        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.getEditable();

        testUtils.intercept(wysiwyg, "snippet_focused", function () {
            $('#oe_manipulators .oe_overlay_options .oe_options a:first').click();
            var $option = $('#oe_manipulators .oe_overlay_options a[data-select-class="align-items-center"]');

            assert.strictEqual($option.size(), 1, "should display the snippet option");

            $option.click();

            assert.strictEqual($editable.html().replace(/\s+/g, ' '),
                '<h1>test</h1><div class="s_hr pt32 pb32 focus align-items-center"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><p><b>test</b></p>',
                "should customized the snippet");

            $('#oe_manipulators .oe_overlay_options .oe_options a:first').click();
            $('#oe_manipulators .oe_overlay_options a[data-select-class="align-items-end"]').click();

            assert.strictEqual($editable.html().replace(/\s+/g, ' '),
                '<h1>test</h1><div class="s_hr pt32 pb32 focus align-items-end"> <hr class="s_hr_1px s_hr_solid w-100 mx-auto"> </div><p><b>test</b></p>',
                "should twice customized the snippet");

            wysiwyg.destroy();
            done();
        });

        $editable.find('.s_hr').mousedown().click();
    });
});


});
});
});
});
