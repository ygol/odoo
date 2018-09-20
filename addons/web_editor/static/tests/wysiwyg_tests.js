odoo.define('web_editor.wysiwyg_tests', function (require) {
"use strict";

var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');
var LinkDialog = require('wysiwyg.widgets.LinkDialog');
var testUtils = require('web.test_utils');
var weTestUtils = require('web_editor.test_utils');
var Wysiwyg = require('web_editor.wysiwyg');

var testName = "";
var carretTestSuffix = " (carret position)";
var __select = function (selector, $editable) {
    var sel = selector.match(/^(.+?)(:contents\(\)\[([0-9]+)\])?(->([0-9]+))?$/);
    var $node = $editable.find(sel[1]);
    return {
        node: sel[2] ? $node.contents()[+sel[3]] : $node[0],
        offset: sel[4] ? +sel[5] : 0,
    };
};
var _select = function (startSelector, endSelector, $editable) {
    var start = __select(startSelector, $editable);
    var end = endSelector ? __select(endSelector, $editable) : start;
    return {sc: start.node,
            so: start.offset,
            ec: end.node,
            eo: end.offset};
};

QUnit.module('web_editor', {}, function () {
QUnit.module('wysiwyg', {}, function () {
QUnit.module('Menu', {}, function () {

QUnit.test('Magic wand', function (assert) {
    var done = assert.async();
    assert.expect(8);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $dropdownStyle = wysiwyg.$('.note-style .dropdown-toggle');
        var $btnsStyle = wysiwyg.$('.note-style .dropdown-menu .dropdown-item');

        var wandTests = [
            { name: "Click H1: p -> h1",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                do: function () {
                    $dropdownStyle.mousedown().click();
                    $btnsStyle.find('h1').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><h1>dom to edit</h1>',
                    start: 'h1:contents()[0]->1',
                },
            },
            { name: "Click QUOTE: h1 -> blockquote",
                content: '<p>dom not to edit</p><h1>dom to edit</h1>',
                start: 'h1:contents()[0]->1',
                do: function () {
                    $dropdownStyle.mousedown().click();
                    $btnsStyle.find('blockquote').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><blockquote>dom to edit</blockquote>',
                    start: 'blockquote:contents()[0]->1',
                },
            },
            { name: "Click CODE: blockquote -> pre",
                content: '<p>dom not to edit</p><blockquote>dom to edit</blockquote>',
                start: 'blockquote:contents()[0]->1',
                do: function () {
                    $dropdownStyle.mousedown().click();
                    $btnsStyle.find('pre').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><pre>dom to edit</pre>',
                    start: 'pre:contents()[0]->1',
                },
            },
            { name: "Click NORMAL: pre -> p",
                content: '<p>dom not to edit</p><pre>dom to edit</pre>',
                start: 'pre:contents()[0]->1',
                do: function () {
                    $dropdownStyle.mousedown().click();
                    $btnsStyle.find('p').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                },
            },
        ]

        _.each(wandTests, function (test) {
            testName = test.name;
            wysiwyg.setValue(test.content);
            var range = _select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Font style', function (assert) {
    var done = assert.async();
    assert.expect(16);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $btnBold = wysiwyg.$('.note-font .note-btn-bold');
        var $btnItalic = wysiwyg.$('.note-font .note-btn-italic');
        var $btnUnderline = wysiwyg.$('.note-font .note-btn-underline');
        var $btnRemoveStyles = wysiwyg.$('.note-font .btn-sm .note-icon-eraser');

        var styleTests = [
            /* BOLD */
            { name: "Click BOLD: normal -> bold",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $btnBold.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<b>om t</b>o edit</p>',
                    start: 'b:contents()[0]->0',
                    end: 'b:contents()[0]->4',
                },
            },
            { name: "Click BOLD: normal -> bold (across paragraphs)",
                content: '<p>dom to edit</p><p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $btnBold.mousedown().click();
                },
                test: {
                    content: '<p>d<b>om to edit</b></p><p><b>dom t</b>o edit</p>',
                    start: 'b:contents()[0]->0',
                    end: 'b:eq(1):contents()[0]->5',
                },
            },
            /* ITALIC */
            { name: "Click ITALIC: bold -> bold + italic",
                content: '<p>dom not to edit</p><p><b>dom to edit</b></p>',
                start: 'b:contents()[0]->1',
                end: 'b:contents()[0]->5',
                do: function () {
                    $btnItalic.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p><b>d<i>om t</i>o edit</b></p>',
                    start: 'i:contents()[0]->0',
                    end: 'i:contents()[0]->4',
                },
            },
            { name: "Click ITALIC: bold & normal -> italic & bold + italic (across paragraphs)",
                content: '<p>dom <b>to</b> edit</p><p><b>dom to edit</b></p>',
                start: 'p:contents()[0]->1',
                end: 'b:eq(1):contents()[0]->5',
                do: function () {
                    $btnItalic.mousedown().click();
                },
                test: {
                    content: '<p>d<i>om <b>to</b> edit</i></p><p><b><i>dom t</i>o edit</b></p>',
                    start: 'i:contents()[0]->0',
                    end: 'i:eq(1):contents()[0]->5',
                },
            },
            /* UNDERLINE */
            { name: "Click UNDERLINE: bold -> bold + underlined",
                content: '<p>dom not to edit</p><p><b>dom to edit</b></p>',
                start: 'b:contents()[0]->1',
                end: 'b:contents()[0]->5',
                do: function () {
                    $btnUnderline.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p><b>d<u>om t</u>o edit</b></p>',
                    start: 'u:contents()[0]->0',
                    end: 'u:contents()[0]->4',
                },
            },
            { name: "Click UNDERLINE: bold & normal -> underlined & bold + underlined (across paragraphs)",
                content: '<p>dom <b>to</b> edit</p><p><b>dom to edit</b></p>',
                start: 'p:contents()[0]->1',
                end: 'b:eq(1):contents()[0]->5',
                do: function () {
                    $btnUnderline.mousedown().click();
                },
                test: {
                    content: '<p>d<u>om <b>to</b> edit</u></p><p><b><u>dom t</u>o edit</b></p>',
                    start: 'u:contents()[0]->0',
                    end: 'u:eq(1):contents()[0]->5',
                },
            },
            /* REMOVE FONT STYLE */
            { name: "Click REMOVE FONT STYLE: bold -> normal",
                content: '<p>dom not to edit</p><p><b>dom to edit</b></p>',
                start: 'b:contents()[0]->1',
                end: 'b:contents()[0]->5',
                do: function () {
                    $btnRemoveStyles.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p><b>d</b>om t<b>o edit</b></p>',
                    start: 'p:eq(1):contents()[1]->0',
                    end: 'p:eq(1):contents()[1]->4',
                },
            },
            { name: "Click REMOVE FONT STYLE: bold, italic, underlined & normal -> normal (across paragraphs)",
                content: '<p>dom <b>t<i>o</i></b> e<u>dit</u></p><p><b><u>dom</u> to edit</b></p>',
                start: 'p:contents()[0]->1',
                end: 'u:eq(1):contents()[0]->3',
                do: function () {
                    $btnRemoveStyles.mousedown().click();
                },
                test: {
                    content: '<p>dom to edit</p><p>dom<b> to edit</b></p>',
                    start: 'p:contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->3',
                },
            },
        ];

        _.each(styleTests, function (test) {
            testName = test.name;
            wysiwyg.setValue(test.content);
            var range = _select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            $editable[0].normalize();
            assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Font size', function (assert) {
    var done = assert.async();
    assert.expect(4);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $dropdownFontSize = wysiwyg.$('.note-fontsize .dropdown-toggle');
        var $linksFontSize = wysiwyg.$('.note-fontsize .dropdown-menu .dropdown-item');

        var sizeTests = [
            { name: "Click 18: default -> 18px",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $dropdownFontSize.mousedown().click();
                    $linksFontSize.filter(':contains("18")').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font style="font-size: 18px;">om t</font>o edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            { name: "Click DEFAULT: 18px -> default",
                content: '<p>dom not to edit</p><p><font style="font-size: 18px;">dom to edit</font></p>',
                start: 'font:contents()[0]->1',
                end: 'font:contents()[0]->5',
                do: function () {
                    $dropdownFontSize.mousedown().click();
                    $linksFontSize.filter(':contains("Default")').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p><font style="font-size: 18px;">d</font>om t<font style="font-size: 18px;">o edit</font></p>',
                    start: 'p:eq(1):contents()[1]->0',
                    end: 'p:eq(1):contents()[1]->4',
                },
            },
        ];
        
        _.each(sizeTests, function (test) {
            testName = test.name;
            wysiwyg.setValue(test.content);
            var range = _select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Text forecolor', function (assert) {
    var done = assert.async();
    assert.expect(10);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $dropdownForeColor = wysiwyg.$('.note-color .note-fore-color .dropdown-toggle');
        var $btnsForeColor = wysiwyg.$('.note-color .note-fore-color .dropdown-menu .note-palette .note-color-btn');

        var defColorpickerDialogInit;
        testUtils.patch(ColorpickerDialog, {
            init: function () {
                this._super.apply(this, arguments);
                defColorpickerDialogInit = $.Deferred();
                this.opened(defColorpickerDialogInit.resolve.bind(defColorpickerDialogInit));
            },
        });

        var forecolorTests = [
            { name: "Click THEME COLORS - ALPHA: default -> alpha theme color",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('.bg-alpha').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font class="text-alpha">om t</font>o edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            { name: "Click THEME COLORS - BLACK 25: alpha theme color & default -> black 25",
                content: '<p>dom not to edit</p><p>do<font class="text-alpha">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: function () {
                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('.bg-black-25').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font class="text-black-25">om t</font><font class="text-alpha">o </font>edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            { name: "Click COMMON COLORS - BLUE #0000FF: black 25 & default -> blue #0000FF",
                content: '<p>dom not to edit</p><p>do<font class="text-black-25">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: function () {
                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('[style="background-color:#0000FF"]').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font style="color: rgb(0, 0, 255);">om t</font><font class="text-black-25">o </font>edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            { name: "Click RESET TO DEFAULT: black 25 & default -> default",
                content: '<p>dom not to edit</p><p>do<font class="text-black-25">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: function () {
                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('.note-color-reset').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom t<font class="text-black-25">o </font>edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->5',
                },
            },
            { name: "Click CUSTOM COLORS then CUSTOM COLOR: blue #0000FF & default -> #875A7B",
                async: true,
                content: '<p>dom not to edit</p><p>do<font style="color: rgb(0, 0, 255);">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: function () {
                    var def = $.Deferred();
                    testName = "Click CUSTOM COLORS then CUSTOM COLOR: blue #0000FF & default -> #875A7B";

                    $dropdownForeColor.mousedown().click();
                    wysiwyg.$('.note-color .note-fore-color .note-custom-color').mousedown().click();

                    defColorpickerDialogInit.then(function () {
                        $('.modal-dialog .o_hex_input').val('#875A7B');
                        $('.o_technical_modal .modal-footer .btn-primary:contains("Choose")').mousedown().click();
                        wysiwyg.$('.note-color .note-fore-color .note-custom-color-btn:first').mousedown().click();

                        assert.deepEqual(wysiwyg.getValue(),
                                         '<p>dom not to edit</p><p>d<font style="color: rgb(135,90,123);">om t</font><font style="color: rgb(0, 0, 255);">o </font>edit</p>',
                                         testName);
                        var range = _select('p:eq(1):contents()[0]->1',
                                            'font:contents()[0]->3',
                                            $editable);
                        assert.deepEqual(Wysiwyg.getRange($editable[0]), range, testName + carretTestSuffix);
                        def.resolve();
                    });
                    return def;
                },
            },
        ];

        var def = $.when();
        _.each(forecolorTests, function (test) {
            def = def.then(function () {
                testName = test.name;
                wysiwyg.setValue(test.content);
                var range = _select(test.start, test.end, $editable);
                Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
                return $.when(test.do()).then(function () {
                    if (!test.async) {
                        assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
                        assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
                    }
                });
            });
        });
        def.then(function () {
            testUtils.unpatch(ColorpickerDialog);
            wysiwyg.destroy();
            done();
        });
    });
});

QUnit.test('Text bgcolor', function (assert) {
    var done = assert.async();
    assert.expect(10);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');
        var testName = "";
        var carretTestSuffix = " (carret position)"

        var $dropdownBgColor = wysiwyg.$('.note-color .note-bg-color .dropdown-toggle');
        var $btnsBgColor = wysiwyg.$('.note-color .note-bg-color .dropdown-menu .note-palette .note-color-btn');

        var defColorpickerDialogInit;
        testUtils.patch(ColorpickerDialog, {
            init: function () {
                this._super.apply(this, arguments);
                defColorpickerDialogInit = $.Deferred();
                this.opened(defColorpickerDialogInit.resolve.bind(defColorpickerDialogInit));
            },
        });
        
        var bgcolorTests = [
            { name: "Click THEME COLORS - ALPHA: default -> alpha theme color",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $dropdownBgColor.mousedown().click();
                    $btnsBgColor.filter('.bg-alpha').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font class="bg-alpha">om t</font>o edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            { name: "Click THEME COLORS - BLACK 25: alpha theme color & default -> black 25",
                content: '<p>dom not to edit</p><p>do<font class="bg-alpha">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: function () {
                    $dropdownBgColor.mousedown().click();
                    $btnsBgColor.filter('.bg-black-25').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font class="bg-black-25">om t</font><font class="bg-alpha">o </font>edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            { name: "Click COMMON COLORS - BLUE #0000FF: black 25 & default -> blue #0000FF",
                content: '<p>dom not to edit</p><p>do<font class="bg-black-25">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: function () {
                    $dropdownBgColor.mousedown().click();
                    $btnsBgColor.filter('[style="background-color:#0000FF"]').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font style="background-color: rgb(0, 0, 255);">om t</font><font class="bg-black-25">o </font>edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            { name: "Click RESET TO DEFAULT: black 25 & default -> default",
                content: '<p>dom not to edit</p><p>do<font class="bg-black-25">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: function () {
                    $dropdownBgColor.mousedown().click();
                    $btnsBgColor.filter('.note-color-reset').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom t<font class="bg-black-25">o </font>edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->5',
                },
            },
            { name: "Click CUSTOM COLORS then CUSTOM COLOR: blue #0000FF & default -> #875A7B",
                async: true,
                content: '<p>dom not to edit</p><p>do<font style="background-color: rgb(0, 0, 255);">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: function () {
                    var def = $.Deferred();
                    testName = "Click CUSTOM COLORS then CUSTOM COLOR: blue #0000FF & default -> #875A7B";

                    $dropdownBgColor.mousedown().click();
                    wysiwyg.$('.note-color .note-bg-color .note-custom-color').mousedown().click();

                    defColorpickerDialogInit.then(function () {
                        $('.modal-dialog .o_hex_input').val('#875A7B');
                        $('.o_technical_modal .modal-footer .btn-primary:contains("Choose")').mousedown().click();
                        wysiwyg.$('.note-color .note-bg-color .note-custom-color-btn:first').mousedown().click();

                        assert.deepEqual(wysiwyg.getValue(),
                                         '<p>dom not to edit</p><p>d<font style="background-color: rgb(135,90,123);">om t</font><font style="background-color: rgb(0, 0, 255);">o </font>edit</p>',
                                         testName);
                        var range = _select('p:eq(1):contents()[0]->1',
                                            'font:contents()[0]->3',
                                            $editable);
                        assert.deepEqual(Wysiwyg.getRange($editable[0]), range, testName + carretTestSuffix);
                        def.resolve();
                    });
                    return def;
                },
            },
        ];

        var def = $.when();
        _.each(bgcolorTests, function (test) {
            def = def.then(function () {
                testName = test.name;
                wysiwyg.setValue(test.content);
                var range = _select(test.start, test.end, $editable);
                Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
                return $.when(test.do()).then(function () {
                    if (!test.async) {
                        assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
                        assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
                    }
                });
            });
        });
        def.then(function () {
            testUtils.unpatch(ColorpickerDialog);
            wysiwyg.destroy();
            done();
        });
    });
});

QUnit.test('Unordered list', function (assert) {
    var done = assert.async();
    assert.expect(10);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $btnUL = wysiwyg.$('.note-para .note-icon-unorderedlist');

        var ulTests = [
            { name: "Click UL: p -> ul",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $btnUL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><ul><li><p>dom to edit</p></li></ul>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->5',
                },
            },
            { name: "Click UL: p -> ul (across paragraphs)",
                content: '<p>dom not to edit</p><p>dom to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(2):contents()[0]->5',
                do: function () {
                    $btnUL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><ul><li><p>dom to edit</p></li><li><p>dom to edit</p></li></ul>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(2):contents()[0]->5',
                },
            },
            { name: "Click UL: ul -> p",
                content: '<p>dom not to edit</p><ul><li><p>dom to edit</p></li></ul>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $btnUL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->5',
                },
            },
            { name: "Click UL: p -> ul (across li's)",
                content: '<p>dom not to edit</p><ul><li><p>dom to edit</p></li><li><p>dom to edit</p></li></ul>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(2):contents()[0]->5',
                do: function () {
                    $btnUL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(2):contents()[0]->5',
                },
            },
            { name: "Click UL: ul -> p (from second li)",
                content: '<p>dom not to edit</p><ul><li><p>dom to edit</p></li><li><p>dom to edit</p></li></ul>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $btnUL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->5',
                },
            },
        ];

        _.each(ulTests, function (test) {
            testName = test.name;
            wysiwyg.setValue(test.content);
            var range = _select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Ordered list', function (assert) {
    var done = assert.async();
    assert.expect(10);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $btnOL = wysiwyg.$('.note-para .note-icon-orderedlist');

        var olTests = [
            { name: "Click OL: p -> ol",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $btnOL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><ol><li><p>dom to edit</p></li></ol>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->5',
                },
            },
            { name: "Click OL: p -> ol (across paragraphs)",
                content: '<p>dom not to edit</p><p>dom to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(2):contents()[0]->5',
                do: function () {
                    $btnOL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><ol><li><p>dom to edit</p></li><li><p>dom to edit</p></li></ol>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(2):contents()[0]->5',
                },
            },
            { name: "Click OL: ol -> p",
                content: '<p>dom not to edit</p><ol><li><p>dom to edit</p></li></ol>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $btnOL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->5',
                },
            },
            { name: "Click OL: p -> ol (across li's)",
                content: '<p>dom not to edit</p><ol><li><p>dom to edit</p></li><li><p>dom to edit</p></li></ol>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(2):contents()[0]->5',
                do: function () {
                    $btnOL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(2):contents()[0]->5',
                },
            },
            { name: "Click OL: ol -> p (from second li)",
                content: '<p>dom not to edit</p><ol><li><p>dom to edit</p></li><li><p>dom to edit</p></li></ol>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: function () {
                    $btnOL.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(1):contents()[0]->5',
                },
            },
        ];

        _.each(olTests, function (test) {
            testName = test.name;
            wysiwyg.setValue(test.content);
            var range = _select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Align', function (assert) {
    var done = assert.async();
    assert.expect(16);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $dropdownPara = wysiwyg.$('.note-para .dropdown-toggle');
        var $btnAlignLeft = wysiwyg.$('.note-align .note-icon-align-left');
        var $btnAlignCenter = wysiwyg.$('.note-align .note-icon-align-center');
        var $btnAlignRight = wysiwyg.$('.note-align .note-icon-align-right');
        var $btnAlignJustify = wysiwyg.$('.note-align .note-icon-align-justify');

        var alignTests = [
            /* ALIGN LEFT */
            { name: "Click ALIGN LEFT: p -> p align left (does nothing)",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnAlignLeft.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                },
            },
            { name: "Click ALIGN LEFT: p align right & default -> p align left (across paragraphs)",
                content: '<p>dom not to edit</p><p style="text-align: right;">dom to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(2):contents()[0]->5',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnAlignLeft.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p style="text-align: left;">dom to edit</p><p>dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(2):contents()[0]->5',
                },
            },
            /* ALIGN CENTER */
            { name: "Click ALIGN CENTER: p -> p align center",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnAlignCenter.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p style="text-align: center;">dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                },
            },
            { name: "Click ALIGN CENTER: p align left & default -> p align center (across paragraphs)",
                content: '<p>dom not to edit</p><p style="text-align: left;">dom to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(2):contents()[0]->5',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnAlignCenter.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p style="text-align: center;">dom to edit</p><p style="text-align: center;">dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(2):contents()[0]->5',
                },
            },
            /* ALIGN RIGHT */
            { name: "Click ALIGN RIGHT: p align center -> p align right",
                content: '<p>dom not to edit</p><p style="text-align: center;">dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnAlignRight.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p style="text-align: right;">dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                },
            },
            { name: "Click ALIGN RIGHT: p align center & default -> p align right (across paragraphs)",
                content: '<p>dom not to edit</p><p style="text-align: center;">dom to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(2):contents()[0]->5',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnAlignRight.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p style="text-align: right;">dom to edit</p><p style="text-align: right;">dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(2):contents()[0]->5',
                },
            },
            /* ALIGN JUSTIFY */
            { name: "Click ALIGN JUSTIFY: p align right -> p align justify",
                content: '<p>dom not to edit</p><p style="text-align: right;">dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnAlignJustify.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p style="text-align: justify;">dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                },
            },
            { name: "Click ALIGN JUSTIFY: p align right & default -> p align justify (across paragraphs)",
                content: '<p>dom not to edit</p><p style="text-align: right;">dom to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(2):contents()[0]->5',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnAlignJustify.mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p><p style="text-align: justify;">dom to edit</p><p style="text-align: justify;">dom to edit</p>',
                    start: 'p:eq(1):contents()[0]->1',
                    end: 'p:eq(2):contents()[0]->5',
                },
            },
        ];

        _.each(alignTests, function (test) {
            testName = test.name;
            wysiwyg.setValue(test.content);
            var range = _select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Indent/outdent', function (assert) {
    var done = assert.async();
    assert.expect(8);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $dropdownPara = wysiwyg.$('.note-para .dropdown-toggle');
        var $btnIndent = wysiwyg.$('.note-list .note-btn:eq(1)');
        var $btnOutdent = wysiwyg.$('.note-list .note-btn:first');

        var indentTests = [
            /* INDENT */
            { name: "Click INDENT: p -> indented p",
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnIndent.mousedown().click();
                },
                test: {
                    content: '<p style="margin-left: 1.5em;">dom to edit</p>',
                    start: 'p:contents()[0]->1',
                },
            },
            { name: "Click INDENT: li -> indented li",
                content: '<ul><li><p>dom to edit</p></li></ul>',
                start: 'p:contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnIndent.mousedown().click();
                },
                test: {
                    content: '<ul><li style="list-style: none;"><ul><li><p>dom to edit</p></li></ul></li></ul>',
                    start: 'p:contents()[0]->1',
                },
            },
            /* OUTDENT */
            { name: "Click OUTDENT: indented p -> p",
                content: '<p style="margin-left: 1.5em;">dom to edit</p>',
                start: 'p:contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnOutdent.mousedown().click();
                },
                test: {
                    content: '<p style="">dom to edit</p>',
                    start: 'p:contents()[0]->1',
                },
            },
            { name: "Click OUTDENT: indented li -> li",
                content: '<ul><li><ul><li><p>dom to edit</p></li></ul></li></ul>',
                start: 'p:contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnOutdent.mousedown().click();
                },
                test: {
                    content: '<ul><li><p>dom to edit</p></li></ul>',
                    start: 'p:contents()[0]->1',
                },
            },
        ];

        _.each(indentTests, function (test) {
            testName = test.name;
            wysiwyg.setValue(test.content);
            var range = _select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), _select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Link', function (assert) {
    var done = assert.async();
    assert.expect(14);

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');

        var $btnLink = wysiwyg.$('.note-insert .note-icon-link');

        var defLinkDialogInit;
        testUtils.patch(LinkDialog, {
            init: function () {
                this._super.apply(this, arguments);
                defLinkDialogInit = $.Deferred();
                this.opened(defLinkDialogInit.resolve.bind(defLinkDialogInit));
            },
            save: function () {
                defLinkDialogInit = null;
                return this._super.apply(this, arguments);
            },
        });
        var _clickLink = function (callbackInit, test) {
            $btnLink.mousedown().click();
            defLinkDialogInit.then(callbackInit).then(function () {
                $('.modal-dialog .btn-primary:contains("Save")').mousedown().click();
                assert.deepEqual(wysiwyg.getValue(), test.content, testName);
                var range = _select(test.start, test.end, $editable);
                assert.deepEqual(Wysiwyg.getRange($editable[0]), range, testName + carretTestSuffix);
            });
            return defLinkDialogInit;
        };

        var linkTests = [
            { name: "Click LINK: p -> a in p (w/ URL)",
                content: '<p>dom to edit</p>',
                start: "p:contents()[0]->1",
                end: "p:contents()[0]->5",
                onInit: function () {
                    assert.strictEqual($('.modal-dialog #o_link_dialog_label_input').val(), 'om t', testName + ' (label)');
                    $('.modal-dialog #o_link_dialog_url_input').val('#');
                },
                test: {
                    content: '<p>d<a href="#">om t</a>o edit</p>',
                    start: 'a:contents()[0]->0',
                    end: 'a:contents()[0]->4',
                },
            },
            { name: "Click LINK: p -> a in p (w/ URL) (no selection)",
                content: '<p>do edit</p>',
                start: 'p:contents()[0]->1',
                onInit: function () {
                    $('.modal-dialog #o_link_dialog_label_input').val('om t');
                    $('.modal-dialog #o_link_dialog_url_input').val('#');
                },
                test: {
                    content: '<p>d<a href="#">om t</a>o edit</p>',
                    start: 'a:contents()[0]->4', // link not selected, the user can continue to write
                    end: 'a:contents()[0]->4',
                },
            },
            { name: "Click LINK: a.btn in div -> a.btn.btn-outline-primary in div (edit) (no selection)",
                content: '<div><a href="#" class="btn btn-outline-primary btn-lg">dom to edit</a></div>',
                start: 'a->0',
                onInit: function () {
                    assert.strictEqual($('.modal-dialog #o_link_dialog_label_input').val(), 'dom to edit', testName + ' (label)');
                    $('.modal-dialog #o_link_dialog_url_input').val('#newlink');
                },
                test: {
                    content: '<div><a href="#newlink" class="btn btn-outline-primary btn-lg">dom to edit</a></div>',
                    start: 'a:contents()[0]->0',
                    end: 'a:contents()[0]->0',
                },
            },
            { name: "Click LINK: p -> a in p (w/ Email)",
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[0]->5',
                onInit: function () {
                    $('.modal-dialog #o_link_dialog_url_input').val('john.coltrane@example.com');
                },
                test: {
                    content: '<p>d<a href="mailto:john.coltrane@example.com">om t</a>o edit</p>',
                    start: 'a:contents()[0]->0',
                    end: 'a:contents()[0]->4',
                },
            },
            { name: "Click LINK: p -> a in p (w/ URL & Size Large)",
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[0]->5',
                onInit: function () {
                    $('.modal-dialog #o_link_dialog_url_input').val('#');
                    $('.modal-dialog [name="link_style_size"]').val("lg");
                },
                test: {
                    content: '<p>d<a href="#" class="btn-lg">om t</a>o edit</p>',
                    start: 'a:contents()[0]->0',
                    end: 'a:contents()[0]->4',
                },
            },
            { name: "a in p -> a.btn-outline-primary in p with primary color and target=\"_blank\"",
                content: '<p><a href="#">dom to edit</a></p>',
                start: 'a:contents()[0]->1',
                onInit: function () {
                    $('.modal-dialog #o_link_dialog_url_input').val('#');
                    $('.modal-dialog [name="link_style_shape"]').val("outline");
                    $('.modal-dialog .o_link_dialog_color .o_link_dialog_color_item.btn-primary').mousedown().click();
                    $('.modal-dialog .o_switch [name="is_new_window"]').mousedown().click();
                },
                test: {
                    content: '<p><a href="#" target="_blank" class="btn btn-outline-primary">dom to edit</a></p>',
                    start: 'a:contents()[0]->1',
                },
            },
        ];

        var def = $.when();
        _.each(linkTests, function (test) {
            def = def.then(function () {
                testName = test.name;
                wysiwyg.setValue(test.content);
                var range = _select(test.start, test.end, $editable);
                Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
                return _clickLink(test.onInit, test.test);
            });
        });
        def.then(function () {
            testUtils.unpatch(LinkDialog);
            wysiwyg.destroy();
            done();
        });
    });
});


});
});
});
});
