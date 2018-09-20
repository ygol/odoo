odoo.define('web_editor.wysiwyg_tests', function (require) {
"use strict";

var AltDialog = require('wysiwyg.widgets.AltDialog');
var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');
var CropDialog = require('wysiwyg.widgets.CropImageDialog');
var LinkDialog = require('wysiwyg.widgets.LinkDialog');
var MediaDialog = require('wysiwyg.widgets.MediaDialog');
var testUtils = require('web.test_utils');
var weTestUtils = require('web_editor.test_utils');
var Wysiwyg = require('web_editor.wysiwyg');

var testName = "";
var carretTestSuffix = " (carret position)";

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
            var range = weTestUtils.select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
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
            var range = weTestUtils.select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            $editable[0].normalize();
            assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
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
            var range = weTestUtils.select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Text forecolor', function (assert) {
    var done = assert.async();
    assert.expect(40);

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
                    var self = this;
                    var def = $.Deferred();

                    $dropdownForeColor.mousedown().click();
                    wysiwyg.$('.note-color .note-fore-color .note-custom-color').mousedown().click();

                    defColorpickerDialogInit.then(function () {
                        $('.modal-dialog .o_hex_input').val('#875A7B').change();
                        $('.o_technical_modal .modal-footer .btn-primary:contains("Choose")').mousedown().click();
                        wysiwyg.$('.note-color .note-fore-color .note-custom-color-btn:last').mousedown().click();

                        assert.deepEqual(wysiwyg.getValue(),
                                        '<p>dom not to edit</p><p>d<font style="color: rgb(135, 90, 123);">om t</font><font style="color: rgb(0, 0, 255);">o </font>edit</p>',
                                        self.name);
                        var range = weTestUtils.select('font:contents()[0]->0', 'font:contents()[0]->4', $editable);
                        assert.deepEqual(Wysiwyg.getRange($editable[0]), range, self.name + carretTestSuffix);
                        def.resolve();
                    });
                    return def;
                },
            },
            { name: "Click CUSTOM COLORS then CUSTOM COLOR: change blue input",
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[0]->6',
                do: function () {
                    var self = this;
                    var def = $.Deferred();

                    $dropdownForeColor.mousedown().click();
                    wysiwyg.$('.note-color .note-fore-color .note-custom-color').mousedown().click();

                    defColorpickerDialogInit.then(function () {
                        $('.modal-dialog .o_blue_input').val('100').change();

                        assert.deepEqual($('.modal-dialog .o_hex_input').val(), '#ff0064', self.name + ' (hex)');
                        assert.deepEqual($('.modal-dialog .o_hue_input').val(), '337', self.name + ' (hue)');

                        $('.o_technical_modal .modal-footer .btn-primary:contains("Choose")').mousedown().click();
                        wysiwyg.$('.note-color .note-fore-color .note-custom-color-btn:last').mousedown().click();
                        def.resolve();
                    });
                    return def;
                },
                test: {
                    content: '<p>d<font style="color: rgb(255, 0, 100);">om to</font> edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->5',
                },
            },
            { name: "CUSTOM COLOR: change hue, saturation and lightness inputs",
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[0]->6',
                do: function () {
                    var self = this;
                    var def = $.Deferred();

                    $dropdownForeColor.mousedown().click();
                    wysiwyg.$('.note-color .note-fore-color .note-custom-color').mousedown().click();

                    defColorpickerDialogInit.then(function () {
                        $('.modal-dialog .o_hue_input').val('337').change();
                        $('.modal-dialog .o_saturation_input').val('50').change();
                        $('.modal-dialog .o_lightness_input').val('40').change();

                        assert.deepEqual($('.modal-dialog .o_hex_input').val(), '#99335a', self.name + ' (hex)');
                        assert.deepEqual($('.modal-dialog .o_green_input').val(), '51', self.name + ' (green)');

                        $('.o_technical_modal .modal-footer .btn-primary:contains("Choose")').mousedown().click();
                        wysiwyg.$('.note-color .note-fore-color .note-custom-color-btn:last').mousedown().click();
                        def.resolve();
                    });
                    return def;
                },
                test: {
                    content: '<p>d<font style="color: rgb(153, 51, 90);">om to</font> edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->5',
                },
            },
            { name: "CUSTOM COLOR: mousedown on area",
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[0]->6',
                do: function () {
                    var self = this;
                    var def = $.Deferred();

                    $dropdownForeColor.mousedown().click();
                    wysiwyg.$('.note-color .note-fore-color .note-custom-color').mousedown().click();

                    defColorpickerDialogInit.then(function () {
                        var $area = $('.modal-dialog .o_color_pick_area');
                        var pos = $area.offset();
                        $area.trigger($.Event("mousedown", {
                            which: 1,
                            pageX: pos.left + 50,
                            pageY: pos.top + 50
                        }));
                        $area.trigger('mouseup');

                        assert.deepEqual($('.modal-dialog .o_hex_input').val(), '#cfafaf', self.name + ' (hex)');
                        assert.deepEqual($('.modal-dialog .o_red_input').val(), '207', self.name + ' (red)');
                        assert.deepEqual($('.modal-dialog .o_green_input').val(), '175', self.name + ' (green)');
                        assert.deepEqual($('.modal-dialog .o_blue_input').val(), '175', self.name + ' (blue)');
                        assert.deepEqual($('.modal-dialog .o_hue_input').val(), '0', self.name + ' (hue)');
                        assert.deepEqual($('.modal-dialog .o_saturation_input').val(), '25', self.name + ' (saturation)');
                        assert.deepEqual($('.modal-dialog .o_lightness_input').val(), '75', self.name + ' (lightness)');

                        $('.o_technical_modal .modal-footer .btn-primary:contains("Choose")').mousedown().click();
                        wysiwyg.$('.note-color .note-fore-color .note-custom-color-btn:last').mousedown().click();
                        def.resolve();
                    });
                    return def;
                },
                test: {
                    content: '<p>d<font style="color: rgb(207, 175, 175);">om to</font> edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->5',
                },
            },
            { name: "CUSTOM COLOR: mousedow on sliders",
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[0]->6',
                do: function () {
                    var self = this;
                    var def = $.Deferred();

                    $dropdownForeColor.mousedown().click();
                    wysiwyg.$('.note-color .note-fore-color .note-custom-color').mousedown().click();

                    defColorpickerDialogInit.then(function () {
                        var $slider1 = $('.modal-dialog .o_slider_pointer');
                        var pos1 = $slider1.offset();
                        $slider1.trigger($.Event("mousedown", {
                            which: 1,
                            pageX: pos1.left,
                            pageY: pos1.top + 50
                        }));
                        $slider1.trigger('mouseup');

                        assert.deepEqual($('.modal-dialog .o_hex_input').val(), '#83ff00', self.name + ' (hex)');

                        var $slider2 = $('.modal-dialog .o_opacity_slider');
                        var pos2 = $slider2.offset();
                        $slider2.trigger($.Event("mousedown", {
                            which: 1,
                            pageX: pos2.left,
                            pageY: pos2.top + 80
                        }));
                        $slider2.trigger('mouseup');

                        assert.deepEqual($('.modal-dialog .o_hue_input').val(), '89', self.name + ' (hue)');
                        assert.deepEqual($('.modal-dialog .o_opacity_input').val(), '60', self.name + ' (opacity)');

                        $('.o_technical_modal .modal-footer .btn-primary:contains("Choose")').mousedown().click();
                        wysiwyg.$('.note-color .note-fore-color .note-custom-color-btn:last').mousedown().click();
                        def.resolve();
                    });
                    return def;
                },
                test: {
                    content: '<p>d<font style="color: rgba(131, 255, 0, 0.6);">om to</font> edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->5',
                },
            },
            { name: "Apply a color on a font",
                content: '<p>dom <i class="fa fa-glass"/>not to edit</p>',
                start: 'i->0',
                do: function () {
                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('[style="background-color:#0000FF"]').mousedown().click();
                },
                test: {
                    content: '<p>dom <i class="fa fa-glass" style="color: rgb(0, 0, 255);"></i>not to edit</p>',
                    start: 'p:contents()[0]->4',
                },
            },
            { name: "Apply a color on a font with text",
                content: '<p>dom <i class="fa fa-glass"/>not to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[2]->6',
                do: function () {
                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('[style="background-color:#0000FF"]').mousedown().click();
                },
                test: {
                    content: '<p>d<font style="color: rgb(0, 0, 255);">om&nbsp;</font><i class="fa fa-glass" style="color: rgb(0, 0, 255);"></i><font style="color: rgb(0, 0, 255);">not to</font> edit</p>',
                    start: 'font:eq(0):contents()[0]->0',
                    end: 'font:eq(1):contents()[0]->6',
                },
            },
            { name: "Don't apply color if collapsed",
                content: '<p>dom not to edit</p>',
                start: 'p:contents()[0]->1',
                do: function () {
                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('[style="background-color:#0000FF"]').mousedown().click();
                },
                test: {
                    content: '<p>dom not to edit</p>',
                    start: 'p:contents()[0]->1',
                },
            },
            { name: "Apply color on two ranges with the same color",
                content: '<p>do<br><span class="toto">       </span>m not to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[3]->4',
                do: function ($editable) {
                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('[style="background-color:#0000FF"]').mousedown().click();

                    var range = weTestUtils.select('p:contents()[5]->3', 'p:contents()[5]->6', $editable);
                    Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);

                    $dropdownForeColor.mousedown().click();
                    $btnsForeColor.filter('[style="background-color:#0000FF"]').mousedown().click();
                },
                test: {
                    content: '<p>d<font style="color: rgb(0, 0, 255);">o</font><br><span class="toto">       </span><font style="color: rgb(0, 0, 255);">m no</font>t t<font style=\"color: rgb(0, 0, 255);\">o e</font>dit</p>',
                    start: 'font:eq(2):contents()[0]->0',
                end: 'font:eq(2):contents()[0]->3',
                },
            },
        ];

        var def = $.when();
        _.each(forecolorTests, function (test) {
            def = def.then(function () {
                testName = test.name;
                wysiwyg.setValue(test.content);
                var range = weTestUtils.select(test.start, test.end, $editable);
                Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
                return $.when(test.do($editable)).then(function () {
                    if (!test.async) {
                        assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
                        assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
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
                        $('.modal-dialog .o_hex_input').val('#875A7B').change();
                        $('.o_technical_modal .modal-footer .btn-primary:contains("Choose")').mousedown().click();
                        wysiwyg.$('.note-color .note-bg-color .note-custom-color-btn:last').mousedown().click();

                        assert.deepEqual(wysiwyg.getValue(),
                                         '<p>dom not to edit</p><p>d<font style="background-color: rgb(135, 90, 123);">om t</font><font style="background-color: rgb(0, 0, 255);">o </font>edit</p>',
                                         testName);
                        var range = weTestUtils.select('font:contents()[0]->0',
                                            'font:contents()[0]->4',
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
                var range = weTestUtils.select(test.start, test.end, $editable);
                Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
                return $.when(test.do()).then(function () {
                    if (!test.async) {
                        assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
                        assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
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
            var range = weTestUtils.select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
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
            var range = weTestUtils.select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
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
            var range = weTestUtils.select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
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
                content: '<ul><li><p>dom</p></li><li><p>to edit</p></li></ul>',
                start: 'p:eq(1):contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnIndent.mousedown().click();
                },
                test: {
                    content: '<ul><li><p>dom</p></li><ul><li><p>to edit</p></li></ul></ul>',
                    start: 'p:eq(1):contents()[0]->1',
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
                content: '<ul><li><p>dom</p></li><ul><li><p>to edit</p></li></ul></ul>',
                start: 'p:eq(1):contents()[0]->1',
                do: function () {
                    $dropdownPara.mousedown().click();
                    $btnOutdent.mousedown().click();
                },
                test: {
                    content: '<ul><li><p>dom</p></li><li><p>to edit</p></li></ul>',
                    start: 'p:eq(1):contents()[0]->1',
                },
            },
        ];

        _.each(indentTests, function (test) {
            testName = test.name;
            wysiwyg.setValue(test.content);
            var range = weTestUtils.select(test.start, test.end, $editable)
            Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
            test.do();
            assert.deepEqual(wysiwyg.getValue(), test.test.content, testName);
            assert.deepEqual(Wysiwyg.getRange($editable[0]), weTestUtils.select(test.test.start, test.test.end, $editable), testName + carretTestSuffix);
        });

        wysiwyg.destroy();
        done();
    });
});

QUnit.test('Link', function (assert) {
    var done = assert.async();
    assert.expect(19);

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
                if (test.check) {
                    test.check();
                }
                if (test.content) {
                    assert.deepEqual(wysiwyg.getValue(), test.content, testName);
                }
                if (test.start) {
                    var range = weTestUtils.select(test.start, test.end, $editable);
                    assert.deepEqual(Wysiwyg.getRange($editable[0]), range, testName + carretTestSuffix);
                }
            });
            return defLinkDialogInit;
        };

        var linkTests = [
            { name: "Click LINK: p -> a in p (w/ URL)",
                async: true,
                content: '<p>dom to edit</p>',
                start: "p:contents()[0]->1",
                end: "p:contents()[0]->5",
                do: function () {
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
                async: true,
                content: '<p>do edit</p>',
                start: 'p:contents()[0]->1',
                do: function () {
                    $('.modal-dialog #o_link_dialog_label_input').val('om t');
                    $('.modal-dialog #o_link_dialog_url_input').val('#');
                },
                test: {
                    content: '<p>d<a href="#">om t</a>o edit</p>',
                    start: 'a:contents()[0]->4', // link not selected, the user can continue to write
                    end: 'a:contents()[0]->4',
                },
            },
            { name: "Click LINK: a.btn in div -> a.btn.btn-outline-alpha in div (edit) (no selection)",
                content: '<div><a href="#" class="btn btn-outline-alpha btn-lg">dom to edit</a></div>',
                start: 'a->0',
                do: function () {
                    assert.strictEqual($('.modal-dialog #o_link_dialog_label_input').val(), 'dom to edit', testName + ' (label)');
                    $('.modal-dialog #o_link_dialog_url_input').val('#newlink');
                },
                test: {
                    content: '<div><a href="#newlink" class="btn btn-outline-alpha btn-lg">dom to edit</a></div>',
                    start: 'a:contents()[0]->0',
                    end: 'a:contents()[0]->0',
                },
            },
            { name: "Click LINK: p -> a in p (w/ Email)",
                async: true,
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[0]->5',
                do: function () {
                    $('.modal-dialog #o_link_dialog_url_input').val('john.coltrane@example.com');
                },
                test: {
                    content: '<p>d<a href="mailto:john.coltrane@example.com">om t</a>o edit</p>',
                    start: 'a:contents()[0]->0',
                    end: 'a:contents()[0]->4',
                },
            },
            { name: "Click LINK: p -> a in p (w/ URL & Size Large)",
                async: true,
                content: '<p>dom to edit</p>',
                start: 'p:contents()[0]->1',
                end: 'p:contents()[0]->5',
                do: function () {
                    $('.modal-dialog #o_link_dialog_url_input').val('#');
                    $('.modal-dialog [name="link_style_size"]').val("lg");
                },
                test: {
                    content: '<p>d<a href="#" class="btn-lg">om t</a>o edit</p>',
                    start: 'a:contents()[0]->0',
                    end: 'a:contents()[0]->4',
                },
            },
            { name: "Click LINK: a in p -> a.btn-outline-alpha in p with alpha color and target=\"_blank\"",
                async: true,
                content: '<p><a href="#">dom to edit</a></p>',
                start: 'a:contents()[0]->1',
                do: function () {
                    $('.modal-dialog #o_link_dialog_url_input').val('#');
                    $('.modal-dialog [name="link_style_shape"]').val("outline");
                    $('.modal-dialog .o_link_dialog_color .o_link_dialog_color_item.btn-alpha').mousedown().click();
                    $('.modal-dialog .o_switch [name="is_new_window"]').mousedown().click();
                },
                test: {
                    content: '<p><a href="#" target="_blank" class="btn btn-outline-alpha">dom to edit</a></p>',
                    start: 'a:contents()[0]->1',
                },
            },
            /* POPOVER */
            { name: "Click LINK in popover after adding link in p",
                async: true,
                content: '<p>dom to edit</p>',
                start: "p:contents()[0]->1",
                end: "p:contents()[0]->5",
                do: function () {
                    $('.modal-dialog #o_link_dialog_url_input').val('/link');
                },
                test: {
                    check: function () {
                        $('.note-link-popover .note-btn .note-icon-link').mousedown().click();
                        defLinkDialogInit.then(function () {
                            assert.strictEqual($('.modal-dialog #o_link_dialog_label_input').val(), 'om t', testName + ' (label)');
                            assert.strictEqual($('.modal-dialog #o_link_dialog_url_input').val(), '/link', testName + ' (url)');
                            $('.modal-dialog #o_link_dialog_url_input').val('/newlink');
                            $('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")').mousedown().click();
                            assert.deepEqual(wysiwyg.getValue(), '<p>d<a href="/newlink">om t</a>o edit</p>', testName);
                        });
                    },
                },
            },
            { name: "Click UNLINK in popover after adding link in p",
                async: true,
                content: '<p>dom to edit</p>',
                start: "p:contents()[0]->1",
                end: "p:contents()[0]->5",
                do: function () {
                    $('.modal-dialog #o_link_dialog_url_input').val('/link');
                },
                test: {
                    content:  '<p>dom to edit</p>',
                    check: function () {
                        $('.note-link-popover .note-btn .note-icon-chain-broken').mousedown().click();
                        var range = weTestUtils.select('p:contents()[0]->1', 'p:contents()[0]->5', $editable);
                        assert.deepEqual(Wysiwyg.getRange($editable[0]), range, testName + carretTestSuffix);
                    },
                },
            },
        ];

        var def = $.when();
        _.each(linkTests, function (test) {
            def = def.then(function () {
                testName = test.name;
                wysiwyg.setValue(test.content);
                var range = weTestUtils.select(test.start, test.end, $editable);
                Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
                return _clickLink(test.do, test.test);
            });
        });
        def.then(function () {
            testUtils.unpatch(LinkDialog);
            wysiwyg.destroy();
            done();
        });
    });
});

QUnit.test('Media', function (assert) {
    var done = assert.async();
    assert.expect(27);

    var records = [{
        id: 1,
        public: true,
        name: 'image',
        datas_fname: 'image.png',
        mimetype: 'image/png',
        checksum: false,
        url: '/web_editor/static/src/img/transparent.png',
        type: 'url',
        res_id: 0,
        res_model: false,
        access_token: false
    }];
    var imgWidth = 10;
    var imgHeight = 10;

    return weTestUtils.createWysiwyg({
        debug: false,
        wysiwygOptions: {

        },
        data: {
            'ir.attachment': {
                fields: {
                    display_name: { string: "Displayed name", type: 'char' },
                },
                records: records,
                generate_access_token: function () {
                    return;
                },
            },
        },
        mockRPC: function (route, args) {
            if (args.model === 'ir.attachment' || !args.length) {
                if (!args.length && route.indexOf('data:image/png;base64') === 0 ||
                    args.method === "search_read" &&
                    args.kwargs.domain[7][2].join(',') === "image/gif,image/jpe,image/jpeg,image/jpg,image/gif,image/png") {
                    return $.when(this.data.records);
                }
            }
            if (route.indexOf('youtube') !== -1) {
                return $.when();
            }
            return this._super(route, args);
        },
    }).then(function (wysiwyg) {
        $('body').on('submit.WysiwygTests', function (ev) {
            ev.preventDefault();
            var $from = $(ev.target);
            var iframe = $from.find('iframe[name="' + $from.attr('target') + '"]')[0];
            if (iframe) {
                iframe.contentWindow.attachments = records;
                $(iframe).trigger('load');
            }
        }.bind(this));
        var $editable = wysiwyg.$('.note-editable');

        var $btnMedia = wysiwyg.$('.note-insert .note-icon-picture');

        var defMediaDialogInit;
        var defMediaDialogSave;
        testUtils.patch(MediaDialog, {
            init: function () {
                this._super.apply(this, arguments);
                defMediaDialogInit = $.Deferred();
                defMediaDialogSave = $.Deferred();
                this.opened(defMediaDialogInit.resolve.bind(defMediaDialogInit));
            },
            save: function () {
                $.when(this._super.apply(this, arguments)).then(function () {
                    var def = defMediaDialogSave;
                    defMediaDialogInit = null;
                    defMediaDialogSave = null;
                    def.resolve();
                });
            },
        });
        var defCropDialogInit;
        var defCropDialogSave;
        testUtils.patch(CropDialog, {
            init: function () {
                $(arguments[2]).attr('src', $(arguments[2]).data('src'));
                this._super.apply(this, arguments);
                var self = this;
                defCropDialogInit = $.Deferred();
                defCropDialogSave = $.Deferred();
                this.opened(function () {
                    var cropper = self.$cropperImage.data('cropper');
                    cropper.clone();
                    $.extend(cropper.image, {
                        naturalWidth: imgWidth,
                        naturalHeight: imgHeight,
                        aspectRatio: imgWidth / imgHeight,
                    });
                    cropper.loaded = true;
                    cropper.build();
                    cropper.render();
                    defCropDialogInit.resolve();
                });
            },
            save: function () {
                $.when(this._super.apply(this, arguments)).then(function () {
                    var def = defCropDialogSave;
                    defCropDialogInit = null;
                    defCropDialogSave = null;
                    def.resolve();
                });
            },
        });
        var defAltDialogInit;
        var defAltDialogSave;
        testUtils.patch(AltDialog, {
            init: function () {
                this._super.apply(this, arguments);
                defAltDialogInit = $.Deferred();
                defAltDialogSave = $.Deferred();
                this.opened(function () {
                    defAltDialogInit.resolve();
                });
            },
            save: function () {
                $.when(this._super.apply(this, arguments)).then(function () {
                    var def = defAltDialogSave;
                    defAltDialogInit = null;
                    defAltDialogSave = null;
                    def.resolve();
                });
            },
        });
        var _clickMedia = function (callbackInit, test) {
            $btnMedia.mousedown().click();
            defMediaDialogSave.then(function () {
                if (test.check) {
                    test.check();
                }
                if (test.content) {
                    assert.deepEqual(wysiwyg.getValue(), test.content, testName);
                }
                if (test.start) {
                    var range = weTestUtils.select(test.start, test.end, $editable);
                    assert.deepEqual(Wysiwyg.getRange($editable[0]), range, testName + carretTestSuffix);
                }
            });
            return defMediaDialogInit.then(function () {
                callbackInit();
                var def = $.Deferred();
                setTimeout(function () {
                    def.resolve();
                }, 0);
                return def;
            });
        };
        var _uploadAndInsertImg = function (url) {
            $('.modal-dialog #imageurl:first').val(url).trigger('input');
            $('.modal-dialog .o_upload_image_url_button').mousedown().click();
        }
        var _insertVideo = function (url, checkOptions) {
            $('.modal-dialog .nav-link:contains("Video")').mousedown().click();
            $('.modal-dialog #o_video_text').val(url).keydown().keyup();
            if (checkOptions) {
                assert.strictEqual($('.o_yt_option:first').css('display'), 'block', testName + ' (options)');
            };
            $('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")').mousedown().click();
        }
        var _insertPictogram = function (className) {
            $('.modal-dialog .nav-link:contains("Pictogram")').mousedown().click();
            $('.modal-dialog .font-icons-icons .font-icons-icon.fa.' + className).mousedown().click();
            $('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")').mousedown().click();
        }
        var _valueToRatio = function (value) {
            return value < 0 ? 1 / (1 - value) : 1 + value;
        };

        var mediaTests = [
            /* IMAGE */
            { name: "Click ADD AN IMAGE URL in empty p: p -> img in p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    content: '<p><img class="img-fluid o_we_custom_image" data-src="/web_editor/static/src/img/transparent.png"></p>',
                    check: function () {
                        assert.strictEqual($('.note-image-popover').css('display'), 'block', testName + ' (popover)');
                    },
                },
            },
            /* PICTOGRAM */
            { name: "Add PICTOGRAM in empty p: p -> span.fa in p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _insertPictogram('fa-glass');
                },
                test: {
                    content: '<p><span class="fa fa-glass"> </span></p>',
                    check: function () {
                        assert.strictEqual($('.note-icon-popover').css('display'), 'block', testName + ' (popover)');
                    },
                },
            },
            /* VIDEO */
            { name: "Add VIDEO (youtube) in empty p: p -> div.media_iframe_video after p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _insertVideo('https://www.youtube.com/watch?v=xxxxxxxxxxx', true);
                },
                test: {
                    content: '<p><br></p><div class="media_iframe_video" data-oe-expression="about:blank"><div class="css_editable_mode_display">&nbsp;</div><div class="media_iframe_video_size">&nbsp;</div><iframe src="about:blank" frameborder="0"></iframe></div><p><br></p>',
                    check: function () {
                        assert.strictEqual($('.note-video-popover').css('display'), 'block', testName + ' (popover)');
                    },
                },
            },
            { name: "Add VIDEO (youtube) in p in breakable in unbreakable in breakable: p -> div.media_iframe_video after p",
                async: true,
                content: '<breakable><unbreakable><breakable><p>tata yoyo</p></breakable></unbreakable></breakable>',
                start: "p:contents()[0]->4",
                do: function () {
                    _insertVideo('https://www.youtube.com/watch?v=xxxxxxxxxxx');
                },
                test: {
                    content: '<breakable><unbreakable><breakable><p>tata</p></breakable>' +
                        '<div class="media_iframe_video" data-oe-expression="about:blank"><div class="css_editable_mode_display">&nbsp;</div><div class="media_iframe_video_size">&nbsp;</div><iframe src="about:blank" frameborder="0"></iframe></div>' +
                        '<breakable><p> yoyo</p></breakable></unbreakable></breakable>',
                    check: function () {
                        assert.strictEqual($('.note-video-popover').css('display'), 'block', testName + ' (popover)');
                    },
                },
            },
            /* IMAGE POPOVER */
            { name: "Click PADDING XL in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    content: '<p><img class="img-fluid o_we_custom_image padding-xl" data-src="/web_editor/static/src/img/transparent.png"></p>',
                    check: function () {
                        $('.note-image-popover .note-padding .dropdown-toggle').mousedown().click();
                        $('.note-image-popover .note-padding .dropdown-item li:contains("Xl")').mousedown().click();
                    },
                },
            },
            { name: "Click IMAGE SIZE 25% in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    content: '<p><img class="img-fluid o_we_custom_image" data-src="/web_editor/static/src/img/transparent.png" style="width: 25%;"></p>',
                    check: function () {
                        $('.note-image-popover .note-imagesize .note-btn:contains(25%)').mousedown().click();
                    },
                },
            },
            { name: "Click FLOAT RIGHT in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    content: '<p><img class="img-fluid o_we_custom_image pull-right" data-src="/web_editor/static/src/img/transparent.png"></p>',
                    check: function () {
                        $('.note-image-popover .note-float .note-icon-align-right').mousedown().click();
                    },
                },
            },
            { name: "Click FLOAT CENTER then FLOAT LEFT in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    content: '<p><img class="img-fluid o_we_custom_image pull-left" data-src="/web_editor/static/src/img/transparent.png"></p>',
                    check: function () {
                        $('.note-image-popover .note-float .note-icon-align-center').mousedown().click();
                        $('.note-image-popover .note-float .note-icon-align-left').mousedown().click();
                    },
                },
            },
            { name: "Click SHAPE ROUNDED in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    content: '<p><img class="img-fluid o_we_custom_image rounded" data-src="/web_editor/static/src/img/transparent.png"></p>',
                    check: function () {
                        $('.note-image-popover .note-imageShape .note-btn:has(.fa-square)').mousedown().click();
                    },
                },
            },
            // Crop
            { name: "Click CROP 16:9 + ZOOM IN in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    check: function () {
                        var zoomRatio;
                        $('.note-image-popover .note-btn:has(.fa-crop)').mousedown().click();
                        defCropDialogSave.then(function () {
                            var $img = $(wysiwyg.getValue()).find('img.o_cropped_img_to_save');
                            assert.strictEqual($img.data('aspect-ratio'), '16/9', testName + " (aspect-ratio)");
                            assert.strictEqual($img.data('width'), imgWidth/zoomRatio, testName + " (zoom)");
                        });
                        defCropDialogInit.then(function () {
                            $('.o_crop_image_dialog .o_crop_options .btn:contains("16:9")').mousedown().click();
                            var $zoomBtn = $('.o_crop_image_dialog .o_crop_options .btn:has(.fa-search-plus)');
                            zoomRatio = _valueToRatio(Number($zoomBtn.data('value')));
                            $zoomBtn.mousedown().click();
                            $('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")').mousedown().click();
                        });
                    },
                },
            },
            { name: "Click CROP ROTATE LEFT + FLIP HORIZONTAL in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    check: function () {
                        $('.note-image-popover .note-btn:has(.fa-crop)').mousedown().click();
                        defCropDialogSave.then(function () {
                            var $img = $(wysiwyg.getValue()).find('img.o_cropped_img_to_save');
                            assert.strictEqual($img.data('rotate'), -45, testName + " (rotate)");
                            assert.strictEqual($img.data('scale-x'), -1, testName + " (flip)");
                        });
                        defCropDialogInit.then(function () {
                            $('.o_crop_image_dialog .o_crop_options .btn:contains("16:9")').mousedown().click();
                            $('.o_crop_image_dialog .o_crop_options .btn:has(.fa-rotate-left)').mousedown().click();
                            $('.o_crop_image_dialog .o_crop_options .btn:has(.fa-arrows-h)').mousedown().click();
                            $('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")').mousedown().click();
                        });
                    },
                },
            },
            { name: "Click CROP FREE in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    check: function () {
                        var cropFactor = 10;
                        $('.note-image-popover .note-btn:has(.fa-crop)').mousedown().click();
                        defCropDialogSave.then(function () {
                            var $img = $(wysiwyg.getValue()).find('img.o_cropped_img_to_save');
                            assert.strictEqual(Math.round($img.data('width')), Math.round(imgWidth - (imgWidth / cropFactor)), testName + " (rotate)");
                        });
                        defCropDialogInit.then(function () {
                            var $cropperPoints = $('.modal-dialog .cropper-crop-box .cropper-point');
                            var $pointW = $cropperPoints.filter('.point-w');
                            var pos1 = $pointW.offset();
                            var cropperWidth = $cropperPoints.filter('.point-e').offset().left - pos1.left;
                            $pointW.trigger($.Event("pointerdown", {
                                pageX: pos1.left,
                                pageY: pos1.top,
                            }));
                            $pointW.trigger($.Event("pointermove", {
                                pageX: pos1.left + (cropperWidth / cropFactor),
                                pageY: pos1.top,
                            }));
                            $pointW.trigger('pointerup');
                            $('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")').mousedown().click();
                        });
                    },
                },
            },
            // Replace picture
            { name: "Click PICTURE in popover after adding image in empty p (replace picture with video)",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    check: function () {
                        $('.note-image-popover .note-btn .note-icon-picture').mousedown().click();
                        defMediaDialogSave.then(function () {
                            assert.deepEqual(wysiwyg.getValue(),
                                             '<p><br></p><div class="media_iframe_video" data-oe-expression="about:blank"><div class="css_editable_mode_display">&nbsp;</div><div class="media_iframe_video_size">&nbsp;</div><iframe src="about:blank" frameborder="0"></iframe></div><p><br></p>',
                                             testName);
                        });
                        defMediaDialogInit.then(function () {
                            $('.modal-dialog .nav-link:contains("Video")').mousedown().click();
                            $('.modal-dialog #o_video_text').val('https://www.youtube.com/watch?v=xxxxxxxxxxx').keydown().keyup();
                            $('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")').mousedown().click();
                        });
                    },
                },
            },
            // Remove picture
            { name: "Click REMOVE in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    content: '<p><br></p>',
                    check: function () {
                        $('.note-image-popover .note-btn .note-icon-trash').mousedown().click();
                    },
                },
            },
            // Describe picture
            { name: "Click DESCRIPTION in popover after adding image in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _uploadAndInsertImg('https://www.odoo.com/logo.png');
                },
                test: {
                    check: function () {
                        $('.note-image-popover .note-btn:contains("Description")').mousedown().click();
                        defAltDialogSave.then(function () {
                            assert.deepEqual(wysiwyg.getValue(),
                                             '<p><img class="img-fluid o_we_custom_image" data-src="/web_editor/static/src/img/transparent.png" alt="Description" title="Title"></p>',
                                             testName)
                        });
                        defAltDialogInit.then(function () {
                            $('.modal-dialog input#alt').val('Description');
                            $('.modal-dialog input#title').val('Title');
                            $('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")').mousedown().click();
                        });
                    },
                },
            },
            /* VIDEO POPOVER */
            // Multiple clicks
            { name: "Click FLOAT CENTER then FLOAT LEFT in popover after adding youtube video in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _insertVideo('https://www.youtube.com/watch?v=xxxxxxxxxxx');
                },
                test: {
                    content: '<p><br></p><div class="media_iframe_video pull-left" data-oe-expression="about:blank"><div class="css_editable_mode_display">&nbsp;</div><div class="media_iframe_video_size">&nbsp;</div><iframe src="about:blank" frameborder="0"></iframe></div><p><br></p>',
                    check: function () {
                        $('.note-image-popover .note-float .note-icon-align-center').mousedown().click();
                        $('.note-image-popover .note-float .note-icon-align-left').mousedown().click();
                    },
                },
            },
            // Replace video
            { name: "Click PICTURE in popover after adding video in empty p (replace video with pictogram)",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _insertVideo('https://www.youtube.com/watch?v=xxxxxxxxxxx');
                },
                test: {
                    check: function () {
                        $('.note-image-popover .note-btn .note-icon-picture').mousedown().click();
                        defMediaDialogSave.then(function () {
                            assert.deepEqual(wysiwyg.getValue(),
                                             '<p><span class="fa fa-glass"> </span></p>',
                                             testName);
                        });
                        defMediaDialogInit.then(function () {
                            _insertPictogram('fa-glass');
                        });
                    },
                },
            },
            /* PICTOGRAM POPOVER */
            // Icon size
            { name: "Click ICON SIZE then 5X in popover after adding pictogram in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _insertPictogram('fa-glass');
                },
                test: {
                    content: '<p><span class="fa fa-glass" style="font-size: 5em;"> </span></p>',
                    check: function () {
                        $('.note-icon-popover .note-faSize .dropdown-toggle').mousedown().click();
                        $('.note-icon-popover .note-faSize .dropdown-item li:contains("5x")').mousedown().click();
                    },
                },
            },
            // Spin
            { name: "Click SPIN in popover after adding pictogram in empty p",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _insertPictogram('fa-glass');
                },
                test: {
                    content: '<p><span class="fa fa-glass fa-spin"> </span></p>',
                    check: function () {
                        $('.note-icon-popover .note-faSpin .note-btn').mousedown().click();
                    },
                },
            },
            // Replace pictogram
            { name: "Click PICTURE in popover after adding pictogram in empty p (replace pictogram with other pictogram)",
                async: true,
                content: '<p><br></p>',
                start: "p->0",
                do: function () {
                    _insertPictogram('fa-glass');
                },
                test: {
                    check: function () {
                        $('.note-image-popover .note-btn .note-icon-picture').mousedown().click();
                        defMediaDialogSave.then(function () {
                            assert.deepEqual(wysiwyg.getValue(),
                                             '<p><span class="fa fa-heart"> </span></p>',
                                             testName);
                        });
                        defMediaDialogInit.then(function () {
                            _insertPictogram('fa-heart');
                        });
                    },
                },
            },
        ];

        var def = $.when();
        _.each(mediaTests, function (test) {
            def = def.then(function () {
                testName = test.name;
                wysiwyg.setValue(test.content);
                var range = weTestUtils.select(test.start, test.end, $editable);
                Wysiwyg.setRange(range.sc, range.so, range.ec, range.eo);
                return _clickMedia(test.do, test.test);
            });
        });
        def.then(function () {
            testUtils.unpatch(MediaDialog);
            testUtils.unpatch(CropDialog);
            testUtils.unpatch(AltDialog);
            wysiwyg.destroy();
            $('body').off('submit.WysiwygTests');
            done();
        });
    });
});


});
});
});
});
