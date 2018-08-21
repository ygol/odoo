odoo.define('web_editor.test_utils', function (require) {
"use strict";

var ajax = require('web.ajax');
var testUtils = require('web.test_utils');
var Widget = require('web.Widget');
var Wysiwyg = require('web_editor.wysiwyg');


var WysiwygTest = Wysiwyg.extend({
    _parentToDestroyForTest: null,
    /**
     * override 'destroy' of discuss so that it calls 'destroy' on the parent
     * 
     */
    destroy: function () {
        unpatch();
        this._super();
        this.$target.remove();
        this._parentToDestroyForTest.destroy();
    },
    isUnbreakableNode: function (node) {
        var Node = (node.tagName ? node : node.parentNode);
        return !this.isEditableNode(node) || Node.tagName === "UNBREAKABLE" || (Node.className + '').indexOf('unbreakable') !== -1;
    },
    isEditableNode: function (node) {
        if (!$(node).closest(this.$el).length) {
            return false;
        }
        while (node) {
            if (node.tagName === "EDITABLE") {
                return true;
            }
            if (node.tagName === "NOTEDITABLE") {
                return false;
            }
            if (this.$el[0] === node) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    },
});


function patch () {
    testUtils.patch(ajax, {
        loadAsset: function (xmlId) {
            if (xmlId === 'template.assets') {
                return $.when({
                    cssLibs: [],
                    cssContents: ['body {background-color: red;}']
                });
            }
            if (xmlId === 'template.assets_all_style') {
                return $.when({
                    cssLibs: $('head link[href]:not([type="image/x-icon"])').map(function () { return $(this).attr('href'); }).get(),
                    cssContents: ['body {background-color: red;}']
                });
            }
            throw 'Wrong template';
        },
    });
}
function unpatch () {
    testUtils.unpatch(ajax);
}


function createWysiwyg (params) {
    patch();
    params.data = _.extend({}, params.data, {
        'ir.ui.view': {
            fields: {
                display_name: { string: "Displayed name", type: "char" },
            },
            records: [],
            read_template: function (args) {
                if (args[0] === 'web_editor.colorpicker') {
                    return '<templates><t t-name="web_editor.colorpicker">' +
                        '<colorpicker>' +
                        '    <div class="o_colorpicker_section" data-name="theme" data-display="Theme Colors" data-icon-class="fa fa-flask">' +
                        '        <button data-color="alpha"></button>' +
                        '        <button data-color="beta"></button>' +
                        '        <button data-color="gamma"></button>' +
                        '        <button data-color="delta"></button>' +
                        '        <button data-color="epsilon"></button>' +
                        '    </div>' +
                        '    <div class="o_colorpicker_section" data-name="transparent_grayscale" data-display="Transparent Colors" data-icon-class="fa fa-eye-slash">' +
                        '        <button class="o_btn_transparent"></button>' +
                        '        <button data-color="black-25"></button>' +
                        '        <button data-color="black-50"></button>' +
                        '        <button data-color="black-75"></button>' +
                        '        <button data-color="white-25"></button>' +
                        '        <button data-color="white-50"></button>' +
                        '        <button data-color="white-75"></button>' +
                        '    </div>' +
                        '    <div class="o_colorpicker_section" data-name="common" data-display="Common Colors" data-icon-class="fa fa-paint-brush"></div>' +
                        '</colorpicker>' +
                    '</t></templates>';
                }
            },
            render_template: function (args) {
                if (args[0] === 'web_editor.snippets') {
                    return '<h2 id="snippets_menu">Add blocks</h2>' +
                        '<div id="o_scroll">' +
                        '    <div id="snippet_structure" class="o_panel">' +
                        '        <div class="o_panel_header">' +
                        '            <i class="fa fa-th-large"></i> First Panel' +
                        '        </div>' +
                        '        <div class="o_panel_body">' +
                        '            <div name="Separator" data-oe-type="snippet" data-oe-thumbnail="/website/static/src/img/snippets_thumbs/s_separator.png">' +
                        '                <div class="s_hr pt32 pb32">' +
                        '                    <hr class="s_hr_1px s_hr_solid w-100 mx-auto"/>' +
                        '                </div>' +
                        '            </div>' +
                        '        </div>' +
                        '    </div>' +
                        '</div>' +
                        '<div id="snippet_options" class="d-none">' +
                        '    <div data-js="many2one" data-selector="[data-oe-many2one-model]:not([data-oe-readonly])" data-no-check="true"></div>' +
                        '    <div data-js="content" data-selector=".s_hr" data-drop-near="p, h1, h2, h3, blockquote, .s_hr"></div>' +
                        '</div>';
                }
            },
        },
    });

    var parent = new Widget();
    testUtils.addMockEnvironment(parent, params);

    var wysiwygOptions = _.extend({}, params.wysiwygOptions, {
        recordInfo: {
            context: {},
            res_model: 'module.test',
            res_id: 1,
        },
    });

    var wysiwyg = new WysiwygTest(parent, wysiwygOptions);
    wysiwyg._parentToDestroyForTest = parent;

    var $textarea = $('<textarea/>');
    var selector = params.debug ? 'body' : '#qunit-fixture';
    $textarea.prependTo($(selector));
    if (params.debug) {
        $('body').addClass('debug');
    }
    return wysiwyg.attachTo($textarea).then(function () {
        return wysiwyg;
    });
}


var dom = $.summernote.dom;
var keyboardMap = {
    "8": "BACK_SPACE",
    "9": "TAB",
    "13": "ENTER",
    "16": "SHIFT",
    "17": "CONTROL",
    "18": "ALT",
    "19": "PAUSE",
    "20": "CAPS_LOCK",
    "27": "ESCAPE",
    "32": "SPACE",
    "33": "PAGE_UP",
    "34": "PAGE_DOWN",
    "35": "END",
    "36": "HOME",
    "37": "LEFT",
    "38": "UP",
    "39": "RIGHT",
    "40": "DOWN",
    "45": "INSERT",
    "46": "DELETE",
    "91": "OS_KEY", // 'left command' Windows Key (Windows) or Command Key (Mac)
    "93": "CONTEXT_MENU", // 'right command'
};
_.each(_.range(40, 127), function (keyCode) {
    if (!keyboardMap[keyCode]) {
        keyboardMap[keyCode] = String.fromCharCode(keyCode);
    }
});
/**
 * Patch for Chrome's contenteditable SPAN bug.
 * 
 * @param {$.Promise} resolved with wysiwyg as argument
 * @param {object} assert
 * @param {object[]} keyboardTests
 */
var testKeyboard = function ($editable, assert, keyboardTests, addTests) {
    var tests = _.compact(_.pluck(keyboardTests, 'test'));
    var testNumber = _.compact(_.pluck(tests, 'start')).length + _.compact(_.pluck(tests, 'content')).length + _.compact(_.pluck(tests, 'check')).length + (addTests|0);
    assert.expect(testNumber);

    function keydown(target, keypress) {
        var $target = $(target.tagName ? target : target.parentNode);
        if (!keypress.keyCode) {
            keypress.keyCode = +_.findKey(keyboardMap, function (key) {return key === keypress.key;});
        } else {
            keypress.key = keyboardMap[keypress.keyCode] || String.fromCharCode(keypress.keyCode);
        }
        keypress.keyCode = keypress.keyCode;
        var event = $.Event( "keydown", keypress);
        $target.trigger(event);
        if (!event.isDefaultPrevented()) {
            if (keypress.key.length === 1) {
                document.execCommand("insertText", 0, keypress.key);
            } else {
                console.warn('Native "' + keypress.key + '" is not supported in test');
            }
        }
        $target.trigger($.Event( "keyup", keypress));
        return $target;
    }
    function _select (selector) {
        var sel = selector.match(/^(.+?)(:contents\(\)\[([0-9]+)\])?(->([0-9]+))?$/);
        var $node = $editable.find(sel[1]);
        var point = {
            node: sel[2] ? $node.contents()[+sel[3]] : $node[0],
            offset: sel[4] ? +sel[5] : 0,
        };
        if (!point.node || point.offset > (point.node.tagName ? point.node.childNodes : point.node.textContent).length) {
            assert.notOk('Node not found: "' + selector + '"');
        }
        return point;
    }
    function selectText (start, end) {
        start = _select(start);
        var target = start.node;
        $(target.tagName ? target : target.parentNode).trigger("mousedown");
        if (end) {
            end = _select(end);
            Wysiwyg.setRange(start.node, start.offset, end.node, end.offset);
        } else {
            Wysiwyg.setRange(start.node, start.offset);
        }
        target = end ? end.node : start.node;
        $(target.tagName ? target : target.parentNode).trigger('mouseup');
    }
    function endOfAreaBetweenTwoNodes (point) {
        // move the position because some browser make the caret on the end of the previous area after normalize
        if (!point.node.tagName && point.offset === point.node.textContent.length && !/\S|\u00A0/.test(point.node.textContent)) {
            point = dom.nextPoint(dom.nextPoint(point));
            while (point.node.tagName && point.node.textContent.length) {
                point = dom.nextPoint(point);
            }
        }
        return point;
    }

    var defPollTest = $.when();
    function pollTest(test) {
        var def = $.when();
        $editable.html(test.content);

        function poll(step) {
            var def = $.Deferred();
            if (step.start) {
                selectText(step.start, step.end);
                if (!Wysiwyg.getRange($editable[0])) {
                    throw 'Wrong range! \n' +
                        'Test: ' + test.name + '\n' +
                        'Selection: ' + step.start + '" to "' + step.end + '"\n' +
                        'DOM: ' + $editable.html();
                }
            }
            setTimeout(function () {
                if (step.keyCode || step.key) {
                    var target = Wysiwyg.getRange($editable[0]).ec;
                    if (window.location.search.indexOf('notrycatch') !== -1) {
                        keydown(target, {
                            key:        step.key,
                            keyCode:    step.keyCode,
                            ctrlKey:  !!step.ctrlKey,
                            shiftKey: !!step.shiftKey,
                            altKey:   !!step.altKey,
                            metaKey:  !!step.metaKey,
                        });
                    } else {
                        try {
                            keydown(target, {
                                key:        step.key,
                                keyCode:    step.keyCode,
                                ctrlKey:  !!step.ctrlKey,
                                shiftKey: !!step.shiftKey,
                                altKey:   !!step.altKey,
                                metaKey:  !!step.metaKey,
                            });
                        } catch (e) {
                            assert.notOk(e.name + '\n\n' + e.stack, test.name);
                        }
                    }
                }
                setTimeout(def.resolve.bind(def));
            });
            return def;
        }
        while (test.steps.length) {
            def = def.then(poll.bind(null, test.steps.shift()));
        }

        return def.then(function () {
            if (!test.test) {
                return;
            }

            if (test.test.check) {
                test.test.check($editable, assert);
            }

            // test content
            if (test.test.content) {
                assert.strictEqual($editable.html().replace(/\u200B/g, '&#8203;'), test.test.content.replace(/\u200B/g, '&#8203;'), test.name);
            }

            // test carret position
            if (test.test.start) {
                var start = _select(test.test.start);
                var range = Wysiwyg.getRange($editable[0]);
                if ((range.sc !== range.ec || range.so !== range.eo) && !test.test.end) {
                    assert.ok(false, test.name + ": the carret is not colapsed and the 'end' selector in test is missing");
                    return;
                }
                var end = test.test.end ? _select(test.test.end) : start;
                if (start.node && end.node) {
                    var range = Wysiwyg.getRange($editable[0]);
                    var startPoint = endOfAreaBetweenTwoNodes({node: range.sc, offset: range.so});
                    var endPoint = endOfAreaBetweenTwoNodes({node: range.ec, offset: range.eo});
                    assert.deepEqual({
                            outerHTMLNode: startPoint.node.outerHTML || startPoint.node.textContent,
                            outerHTMLParent: startPoint.node.parentNode.outerHTML,
                            startNode: startPoint.node,
                            startOffset: startPoint.offset,
                            endNode: endPoint.node,
                            endOffset: endPoint.offset
                        },
                        {
                            outerHTMLNode: start.node.outerHTML || start.node.textContent,
                            outerHTMLParent: start.node.parentNode.outerHTML,
                            startNode: start.node,
                            startOffset: start.offset,
                            endNode: end.node,
                            endOffset: end.offset
                        },
                        test.name + " (carret position)");
                }
            }
        });
    }
    while (keyboardTests.length) {
        defPollTest = defPollTest.then(pollTest.bind(null, keyboardTests.shift()));
    }

    return defPollTest;
};

return {
    createWysiwyg: createWysiwyg,
    testKeyboard: testKeyboard,
};


});
