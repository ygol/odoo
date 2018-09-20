odoo.define('web_editor.wysiwyg.keyboard_tests', function (require) {
"use strict";

var FormView = require('web.FormView');
var testUtils = require('web.test_utils');
var weTestUtils = require('web_editor.test_utils');
var core = require('web.core');
var Wysiwyg = require('web_editor.wysiwyg');

var _t = core._t;

//--------------------------------------------------------------------------
// tests
//--------------------------------------------------------------------------

QUnit.module('web_editor', {}, function () {
QUnit.module('wysiwyg', {}, function () {

//--------------------------------------------------------------------------
// Unbreakable tests
//--------------------------------------------------------------------------
QUnit.module('Unbreakable');

var unbreakableTestDom = '' +
    '    <noteditable id="a">\n' +
    '        content_a_0\n' +
    '        <noteditable id="b">content_b_0</noteditable>\n' +
    '        <editable id="c">\n' +
    '            content_c_0\n' +
    '            <noteditable id="d">content_d_0</noteditable>\n' +
    '            <noteditable id="e">\n' +
    '                content_e_0\n' +
    '                <editable id="f">content_f_0</editable>\n' +
    '                content_e_1\n' +
    '            </noteditable>\n' +
    '            content_c_4\n' +
    '        </editable>\n' +
    '        <noteditable id="g">content_g_0</noteditable>\n' +
    '        <editable id="h">\n' +
    '            content_h_0\n' +
    '            <noteditable id="i">content_i_0</noteditable>\n' +
    '            content_h_2\n' +
    '        </editable>\n' +
    '        <editable id="j">\n' +
    '            content_j_0\n' +
    '            <editable id="k">content_k_0</editable>\n' +
    '            <editable id="l">content_l_0</editable>\n' +
    '            content_j_4\n' +
    '        </editable>\n' +
    '    </noteditable>\n' +
    '    <editable id="m">content_m_0</editable>\n' +
    '    <editable id="n">content_n_0</editable>\n';
var UnbreakableTests = [
    {   name: "nothing to do",
        content: unbreakableTestDom,
        steps: [{start: "#c:contents()[0]->13", end: "#c:contents()[0]->15"}],
        test: {
            content: unbreakableTestDom,
            start: "#c:contents()[0]->13",
            end: "#c:contents()[0]->15",
        },
    },
    {   name: "nothing to do 2",
        content: unbreakableTestDom,
        steps: [{start: "#j:contents()[0]->13", end: "#l:contents()[0]->5"}],
        test: {
            content: unbreakableTestDom,
            start: "#j:contents()[0]->13",
            end: "#l:contents()[0]->5",
        },
    },
    {   name: "nothing to do 3",
        content: unbreakableTestDom,
        steps: [{start: "#k:contents()[0]->3", end: "#l:contents()[0]->5"}],
        test: {
            content: unbreakableTestDom,
            start: "#k:contents()[0]->3",
            end: "#l:contents()[0]->5",
        },
    },
    {   name: "find the first allowed node)",
        content: unbreakableTestDom,
        steps: [{start: "#a:contents()[0]->13"}],
        test: {
            content: unbreakableTestDom,
            start: "#c:contents()[0]->0",
            end: "#c:contents()[0]->0",
        },
    },
    {   name: "find the first allowed node and colapse the selection",
        content: unbreakableTestDom,
        steps: [{start: "#a:contents()[0]->10", end: "#b:contents()[0]->3"}],
        test: {
            content: unbreakableTestDom,
            start: "#c:contents()[0]->0",
            end: "#c:contents()[0]->0",
        },
    },
    {   name: "resize the range to the allowed end",
        content: unbreakableTestDom,
        steps: [{start: "#a:contents()[0]->10", end: "#c:contents()[0]->14"}],
        test: {
            content: unbreakableTestDom,
            start: "#c:contents()[0]->0",
            end: "#c:contents()[0]->14",
        },
    },
    {   name: "resize the range to the allowed start",
        content: unbreakableTestDom,
        steps: [{start: "#c:contents()[0]->15", end: "#d:contents()[0]->4"}],
        test: {
            content: unbreakableTestDom,
            start: "#c:contents()[0]->15",
            end: "#c:contents()[0]->37",
        },
    },
    {   name: "resize the range to the allowed node who contains unbreakable node",
        content: unbreakableTestDom,
        steps: [{start: "#g:contents()[0]->5", end: "#h:contents()[2]->15"}],
        test: {
            content: unbreakableTestDom,
            start: "#h:contents()[0]->0",
            end: "#h:contents()[2]->15",
        },
    },
    {   name: "resize the range to the allowed node between the start and the end",
        content: unbreakableTestDom,
        steps: [{start: "#e:contents()[0]->15", end: "#c:contents()[4]->15"}],
        test: {
            content: unbreakableTestDom,
            start: "#f:contents()[0]->0",
            end: "#f:contents()[0]->11",
        },
    },
    {   name: "resize the range to the allowed start with the entirety of the unbreakable node",
        content: unbreakableTestDom,
        steps: [{start: "#c:contents()[0]->15", end: "#e:contents()[0]->15"}],
        test: {
            content: unbreakableTestDom,
            start: "#c:contents()[0]->15",
            end: "#d:contents()[0]->11",
        },
    },
    {   name: "resize the range to the allowed start and delete content",
        content: unbreakableTestDom,
        steps: [{start: "#c:contents()[0]->15", end: "#e:contents()[0]->15", key: "DELETE"}],
        test: {
            content: unbreakableTestDom
                // the unbreakable does not rerange on an invisible text node, when we remove, we keep the invisible space between #e and #d
                .replace(/ntent_c_0[\s\S]+content_d_0<\/noteditable>\s+/, '\n            ')
                .replace(/^\s+/, ''), // corner effest of the clean and normalize
            start: "#c:contents()[0]->15",
            end: "#c:contents()[0]->15",
        },
    },
    {   name: "delete unbreakable nodes in a breakable",
        content: unbreakableTestDom,
        steps: [{start: "#c:contents()[0]->15", end: "#c:contents()[4]->19", key: "DELETE"}],
        test: {
            content: unbreakableTestDom.replace(/content_c_0[\s\S]*content_c_4/, 'cot_c_4')
                .replace(/^\s+/, ''), // corner effest of the clean and normalize
            start: "#c:contents()[0]->15",
            end: "#c:contents()[0]->15",
        },
    },
    {   name: "select range with 2 nodes on the root",
        content: unbreakableTestDom,
        steps: [{start: "#m:contents()[0]->5", end: "#n:contents()[0]->5"}],
        test: {
            content: unbreakableTestDom,
            start: "#m:contents()[0]->5",
            end: "#n:contents()[0]->5",
        },
    },
    { name: "ENTER in an unbreakable p",
        content: "<p class='unbreakable'>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", end: "p:contents()[0]->1", key: 'ENTER'}],
        test: {
            content: '<p class="unbreakable">d<br>om to edit</p>',
            start: "p:contents()[2]->0",
        },
    },
];

QUnit.test('Unbreakable selection and edition', function (assert) {
    var done = assert.async();
    weTestUtils.createWysiwyg({
        data: this.data,
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');
        weTestUtils.testKeyboard($editable, assert, UnbreakableTests).then(function () {
            wysiwyg.destroy();
            done();
        });
    });
});

//--------------------------------------------------------------------------
// Keyboard integration
//--------------------------------------------------------------------------

QUnit.module('Keyboard');

var keyboardTestsChar = [
    { name: "visible char in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->3", keyCode: 66}],
        test: {
            content: "<p>domB to edit</p>",
            start: "p:contents()[0]->4",
            end: null,
            check: function ($editable, assert) {
                assert.ok(true);
            },
        },
    },
];

QUnit.test('Char', function (assert) {
    var done = assert.async();
    weTestUtils.createWysiwyg({
        data: this.data,
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');
        weTestUtils.testKeyboard($editable, assert, keyboardTestsChar).then(function () {
            wysiwyg.destroy();
            done();
        });
    });
});

var keyboardTestsEnter = [
    { name: "ENTER in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", key: 'ENTER'}],
        test: {
            content: "<p>d</p><p>om to edit</p>",
            start: "p:contents()[1]->0",
        },
    },
    { name: "double ENTER in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", key: 'ENTER'}, {key: 'ENTER'}],
        test: {
            content: "<p>d</p><p><br></p><p>om to edit</p>",
            start: "p:contents()[2]->0",
        },
    },
    { name: "SHIFT+ENTER in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<p>d<br>om to edit</p>",
            start: "p:contents()[2]->0",
        },
    },
    { name: "double SHIFT+ENTER in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", key: 'ENTER', shiftKey: true}, {key: 'ENTER', shiftKey: true}],
        test: {
            content: "<p>d<br><br>om to edit</p>",
            start: "p:contents()[3]->0",
        },
    },
    { name: "ENTER then SHIFT+ENTER in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", key: 'ENTER'}, {key: 'ENTER', shiftKey: true}],
        test: {
            content: "<p>d</p><p><br>om to edit</p>",
            start: "p:eq(1):contents()[1]->0",
        },
    },
    { name: "ENTER on a selection in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", end: "p:contents()[0]->7", key: 'ENTER'}],
        test: {
            content: "<p>d</p><p>edit</p>",
            start: "p:contents()[1]->0",
            end: "p:contents()[1]->0",
        },
    },
    { name: "SHIFT+ENTER on a selection in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", end: "p:contents()[0]->7", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<p>d<br>edit</p>",
            start: "p:contents()[2]->0",
        },
    },
    { name: "ENTER at start of list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'ENTER'}],
        test: {
            content: "<ul><li><br></li><li>dom to edit</li></ul>",
            start: "li:contents()[1]->0",
        },
    },
    { name: "ENTER within list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->5", key: 'ENTER'}],
        test: {
            content: "<ul><li>dom t</li><li>o edit</li></ul>",
            start: "li:eq(1):contents()[0]->0",
        },
    },
    { name: "SHIFT+ENTER at start of list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<ul><li><br>dom to edit</li></ul>",
            start: "li:contents()[1]->0",
        },
    },
    { name: "SHIFT+ENTER within list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->5", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<ul><li>dom t<br>o edit</li></ul>",
            start: "li:contents()[2]->0",
        },
    },
    { name: "SHIFT+ENTER on empty list element",
        content: "<ul><li><br></li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<ul><li><br><br></li></ul>",
            start: "li->2",
        },
    },
    { name: "ENTER on a selection in a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->1", end: "li:contents()[0]->7", key: 'ENTER'}],
        test: {
            content: "<ul><li>d</li><li>edit</li></ul>",
            start: "li:eq(1):contents()[0]->0",
        },
    },
    { name: "ENTER on a selection of all the contents of a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", end: "li:contents()[0]->11", key: 'ENTER'}],
        test: {
            content: "<ul><li><br></li><li><br></li></ul>",
            start: "li:eq(1)->1", // we are after the <br>, the carret is on the li with an offset equal to the node length
        },
    },
    { name: "'a' after ENTER on a selection of all the contents of a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", end: "li:contents()[0]->11", key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<ul><li><br></li><li>a</li></ul>",
            start: "li:eq(1):contents()[0]->1",
        },
    },
    { name: "ENTER on a selection across several list elements",
        content: "<ul><li>dom to edit</li><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->1", end: "li:eq(1):contents()[0]->4", key: 'ENTER'}],
        test: {
            content: "<ul><li>d</li><li>to edit</li></ul>",
            start: "li:eq(1):contents()[0]->0", // we are after the <br>, the carret is on the li with an offset equal to the node length
        },
    },
    { name: "SHIFT+ENTER on a selection in a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->1", end: "li:contents()[0]->7", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<ul><li>d<br>edit</li></ul>",
            start: "li:contents()[2]->0",
        },
    },
    { name: "ENTER after b tag in a p tag",
        content: "<p><b>dom</b> to edit</p>",
        steps: [{start: "p:contents()[1]->0", key: 'ENTER'}],
        test: {
            content: "<p><b>dom</b></p><p><b>\u200B</b> to edit</p>",
            start: "b:eq(1):contents()[0]->0",
        },
    },
    { name: "SHIFT+ENTER after b tag in a p tag",
        content: "<p><b>dom</b> to edit</p>",
        steps: [{start: "p:contents()[1]->0", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<p><b>dom<br></b> to edit</p>",
            start: "b->2",
        },
    },
    { name: "'a' after ENTER in b tag in a p tag",
        content: "<p><b>dom to edit</b></p>",
        steps: [{start: "b:contents()[0]->2", key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<p><b>do</b></p><p><b>am to edit</b></p>",
            start: "b:eq(1):contents()[0]->1",
        },
    },
    { name: "'a' after ENTER after b tag in a p tag",
        content: "<p><b>dom</b> to edit</p>",
        steps: [{start: "p:contents()[1]->0", key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<p><b>dom</b></p><p><b>a</b> to edit</p>",
            start: "b:eq(1):contents()[0]->1",
        },
    },
    { name: "'a' after SHIFT+ENTER after b tag in a p tag",
        content: "<p><b>dom</b>&nbsp;to edit</p>",
        steps: [{start: "p:contents()[1]->0", key: 'ENTER', shiftKey: true}, {key: 'a'}],
        test: {
            content: "<p><b>dom<br></b>a to edit</p>",
            start: "p:contents()[1]->1",
        },
    },
    { name: "ENTER at beginning of p - before span.b, after p ending with span.a",
        content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\">edit</span></p>",
        steps: [{start: "p:eq(1):contents()[0]->0", key: 'ENTER'}],
        test: {
            content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\"><br></span></p><p><span class=\"b\">edit</span></p>",
            start: "span:eq(2):contents()[0]->0",
        },
    },
    { name: "'a' after ENTER at beginning of p - before span.b, after p ending with span.a",
        content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\">edit</span></p>",
        steps: [{start: "p:eq(1):contents()[0]->0", key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\"><br></span></p><p><span class=\"b\">aedit</span></p>",
            start: "span:eq(2):contents()[0]->1",
        },
    },
    { name: "SHIFT+ENTER at beginning of p - before span.b, after p ending with span.a",
        content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\">edit</span></p>",
        steps: [{start: "p:eq(1):contents()[0]->0", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\"><br>edit</span></p>",
            start: "span:eq(1):contents()[1]->0",
        },
    },
    { name: "'a' after SHIFT+ENTER at beginning of p - before span.b, after p ending with span.a",
        content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\">edit</span></p>",
        steps: [{start: "p:eq(1):contents()[0]->0", key: 'ENTER', shiftKey: true}, {key: 'a'}],
        test: {
            content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\"><br>aedit</span></p>",
            start: "span:eq(1):contents()[1]->1",
        },
    },
    { name: "ENTER on a selection of all the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", end: "p:contents()[0]->11", key: 'ENTER'}],
        test: {
            content: "<p><br></p><p><br></p>",
            start: "p:eq(1)->1",
        },
    },
    { name: "'a' after ENTER on a selection of all the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", end: "p:contents()[0]->11", key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<p><br></p><p>a</p>",
            start: "p:eq(1):contents()[0]->1",
        },
    },
    { name: "SHIFT+ENTER on a selection of all the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", end: "p:contents()[0]->11", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<p><br><br></p>",
            start: "p->2",
        },
    },
    { name: "'a' after SHIFT+ENTER on a selection of all the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", end: "p:contents()[0]->11", key: 'ENTER', shiftKey: true}, {key: 'a'}],
        test: {
            content: "<p><br>a</p>",
            start: "p:contents()[1]->1",
        },
    },
    { name: "ENTER in an empty p tag in a li",
        content: "<ul><li><p><br></p></li></ul>",
        steps: [{start: "p:contents()[0]->0", key: 'ENTER'}],
        test: {
            content: "<ul><li><p><br></p></li><li><p><br></p></li></ul>",
            start: "p:eq(1)->1",
        },
    },
    { name: "ENTER in an empty b tag in a p tag in a li",
        content: "<ul><li><p><b><br></b></p></li></ul>",
        steps: [{start: "b:contents()[0]->0", key: 'ENTER'}],
        test: {
            content: "<ul><li><p><b><br></b></p></li><li><p><b><br></b></p></li></ul>",
            start: "b:eq(1)->1",
        },
    },
    { name: "'a' after double ENTER in the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->3", key: 'ENTER'}, {key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<p>dom</p><p><br></p><p>a to edit</p>",
            start: "p:eq(2):contents()[0]->1",
        },
    },
    { name: "ENTER in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER'}],
        test: {
            content: "<span><b>dom</b></span><br><span><b>&#8203; to edit</b></span>",
            start: "b:eq(1):contents()[0]->1",
        },
    },
    { name: "SHIFT+ENTER, ENTER in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'ENTER'}],
        test: {
            content: "<span><b>dom<br></b></span><br><span><b>&#8203;&nbsp;to edit</b></span>",
            start: "b:eq(1):contents()[0]->1",
        },
    },
    { name: "'a' after ENTER in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<span><b>dom</b></span><br><span><b>a to edit</b></span>",
            start: "b:eq(1):contents()[0]->1",
        },
    },
    { name: "SHIFT+ENTER in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<span><b>dom<br>&nbsp;to edit</b></span>",
            start: "b:contents()[2]->0",
        },
    },
    { name: "'a' after SHIFT+ENTER in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'a'}],
        test: {
            content: "<span><b>dom<br>a to edit</b></span>",
            start: "b:contents()[2]->1",
        },
    },
    { name: "'a' after SHIFT+ENTER, ENTER in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<span><b>dom<br></b></span><br><span><b>a to edit</b></span>",
            start: "b:eq(1):contents()[0]->1",
        },
    },
    { name: "'a' after double SHIFT+ENTER in the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'ENTER', shiftKey: true}, {key: 'a'}],
        test: { 
            content: "<p>dom<br><br>a to edit</p>",
            start: "p:contents()[3]->1",
        },
    },
    { name: "'a' after ENTER, SHIFT+ENTER in the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->3", key: 'ENTER'}, {key: 'ENTER', shiftKey: true}, {key: 'a'}],
        test: {
            content: "<p>dom</p><p><br>a to edit</p>",
            start: "p:eq(1):contents()[1]->1",
        },
    },
    { name: "'a' after ENTER in empty line",
        content: "<p>dom </p><p><br></p><p>to edit</p>",
        steps: [{start: "p:eq(1):contents()[0]->0", key: 'ENTER'}, {key: 'a'}],
        test: {
            content: "<p>dom </p><p><br></p><p>a</p><p>to edit</p>",
            start: "p:eq(2):contents()[0]->1",
        },
    },
    { name: "SHIFT+ENTER at the end of a p",
        content: "<p>dom </p><p>to edit</p>",
        steps: [{start: "p:first:contents()[0]->4", key: 'ENTER', shiftKey: true}],
        test: {
            content: "<p>dom <br>&#8203;</p><p>to edit</p>",
            start: "p:first:contents()[2]->0",
        },
    },
    { name: "'寺' after SHIFT+ENTER at the end of a p",
        content: "<p>dom </p><p>to edit</p>",
        steps: [{start: "p:first:contents()[0]->4", key: 'ENTER', shiftKey: true}, {keyCode: 23546 /*temple in chinese*/}],
        test: {
            content: "<p>dom <br>寺</p><p>to edit</p>",
            start: "p:first:contents()[2]->1",
        },
    },
    { name: "'a' after 3x SHIFT+ENTER in empty p before a in div",
        content: "<p><br></p><div><a href='#'>dom to edit</a></div>",
        steps: [{start: "p->1", key: 'ENTER', shiftKey: true},
                {key: 'ENTER', shiftKey: true},
                {key: 'ENTER', shiftKey: true},
                {key: 'a'}],
        test: {
            content: "<p><br><br><br>a</p><div><a href=\"#\">dom to edit</a></div>",
            start: "p:contents()[3]->1",
        }, 
    },
];

QUnit.test('Enter', function (assert) {
    var done = assert.async();
    weTestUtils.createWysiwyg({
        data: this.data,
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');
        weTestUtils.testKeyboard($editable, assert, keyboardTestsEnter).then(function () {
            wysiwyg.destroy();
            done();
        });
    });
});

var keyboardTestsComplex = [
    { name: "'a' after BACKSPACE after SHIFT+ENTER in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<span><b>doma to edit</b></span>",
            start: "b:contents()[0]->4",
        },
    },
    { name: "SHIFT+ENTER, ENTER, BACKSPACE in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'ENTER'}, {key: 'BACK_SPACE'}],
        test: {
            content: "<span><b>dom<br>&nbsp;to edit</b></span>",
            start: "b:contents()[2]->0",
        },
    },
    { name: "'a' after SHIFT+ENTER, ENTER, BACKSPACE in the contents of a b in span tag",
        content: "<span><b>dom to edit</b></span>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'ENTER'}, {key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<span><b>dom<br>a to edit</b></span>",
            start: "b:contents()[2]->1",
        },
    },
    { name: "BACKSPACE after double SHIFT+ENTER",
        content: "<p><b>dom to edit</b></p>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'ENTER', shiftKey: true}, {key: 'BACK_SPACE'}],
        test: {
            content: "<p><b>dom<br>&nbsp;to edit</b></p>",
            start: "b:contents()[2]->0",
        },
    },
    { name: "'a' after BACKSPACE after double SHIFT+ENTER",
        content: "<p><b>dom to edit</b></p>",
        steps: [{start: "b:contents()[0]->3", key: 'ENTER', shiftKey: true}, {key: 'ENTER', shiftKey: true}, {key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<p><b>dom<br>a to edit</b></p>",
            start: "b:contents()[2]->1",
        },
    },
];

QUnit.test('Complex', function (assert) {
    var done = assert.async();
    weTestUtils.createWysiwyg({
        data: this.data,
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');
        weTestUtils.testKeyboard($editable, assert, keyboardTestsComplex).then(function () {
            wysiwyg.destroy();
            done();
        });
    });
});

var keyboardTestsTab = [
    { name: "TAB at start of list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'TAB'}],
        test: {
            content: "<ul><li>&nbsp;&nbsp;&nbsp;&nbsp;dom to edit</li></ul>",
            start: "li:contents()[0]->4",
        },
    },
    { name: "TAB within list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->5", key: 'TAB'}],
        test: {
            content: "<ul><li>dom t&nbsp;&nbsp;&nbsp;&nbsp;o edit</li></ul>",
            start: "li:contents()[1]->4",
        },
    },
    { name: "TAB within list element change cell",
        content: "<table><tbody><tr><td>dom to edit</td><td>node</td></tr></tbody></table>",
        steps: [{start: "td:contents()[0]->5", key: 'TAB'}],
        test: {
            content: "<table><tbody><tr><td>dom to edit</td><td>node</td></tr></tbody></table>",
            start: "td:eq(1)->0",
        },
    },
];

QUnit.test('Tab', function (assert) {
    var done = assert.async();
    weTestUtils.createWysiwyg({
        data: this.data,
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');
        weTestUtils.testKeyboard($editable, assert, keyboardTestsTab).then(function () {
            wysiwyg.destroy();
            done();
        });
    });
});

var keyboardTestsBackspace = [
    { name: "BACKSPACE in empty document (must leave it unchanged)",
        content: "<p></p>",
        steps: [{start: "p->0", key: 'BACK_SPACE'}],
        test: {
            content: "<p><br></p>", // The br is there to ensure the carret can enter the p tag
            start: "p->1",
        },
    },
    { name: "BACKSPACE within text",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->5", key: 'BACK_SPACE'}],
        test: {
            content: "<p>dom o edit</p>", // The br is there to ensure the carret can enter the p tag
            start: "p:contents()[0]->4",
        },
    },
    { name: "BACKSPACE twice within text",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->5", key: 'BACK_SPACE'}, {key: 'BACK_SPACE'}],
        test: {
            content: "<p>domo edit</p>", // The br is there to ensure the carret can enter the p tag
            start: "p:contents()[0]->3",
        },
    },
    { name: "BACKSPACE on ul's only li, which is empty - with p before (must move into p)",
        content: "<p><br></p><ul><li><br></li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<p><br></p><ul><li><br></li></ul>",
            start: "p:first->1",
        },
    },
    { name: "'a' after BACKSPACE on ul's only li, which is empty - with p before (must write into p)",
        content: "<p><br></p><ul><li><br></li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<p>a</p><ul><li><br></li></ul>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "BACKSPACE on ul's only li, which is empty - nothing before (must do nothing)",
        content: "<ul><li><br></li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><li><br></li></ul>",
            start: "li->1",
        },
    },
    { name: "BACKSPACE at beginning of ul's second li (must move contents to end of first li)",
        content: "<ul><li>dom to</li><li>edit</li></ul>",
        steps: [{start: "li:eq(1):contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><li>dom toedit</li></ul>",
            start: "li:contents()[0]->6",
        },
    },
    { name: "'a' after BACKSPACE at beginning of ul's second li (must move contents to end of first li then write)",
        content: "<ul><li>dom to</li><li>edit</li></ul>",
        steps: [{start: "li:eq(1):contents()[0]->0", key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<ul><li>dom toaedit</li></ul>",
            start: "li:contents()[0]->7",
        },
    },
    { name: "BACKSPACE within text of ul's second li's p tag",
        content: "<ul><li><p>dom to</p></li><li><p>edit</p></li></ul>",
        steps: [{start: "p:eq(1):contents()[0]->4", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><li><p>dom to</p></li><li><p>edi</p></li></ul>",
            start: "p:eq(1):contents()[0]->3",
        },
    },
    { name: "BACKSPACE at beginning of indented li - other li before (must move cursor to previous li)",
        content: "<ul><li>dom to&nbsp;</li><ul><li>edit</li></ul></ul>",
        steps: [{start: "li:eq(1):contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><li>dom to&nbsp;</li><ul><li>edit</li></ul></ul>",
            start: "li:contents()[0]->7",
        },
    },
    { name: "'a' after BACKSPACE at beginning of indented li - other li before (must write at end of previous li)",
        content: "<ul><li>dom to&nbsp;</li><ul><li>edit</li></ul></ul>",
        steps: [{start: "li:eq(1):contents()[0]->0", key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<ul><li>dom to a</li><ul><li>edit</li></ul></ul>",
            start: "li:contents()[0]->8",
        },
    },
    { name: "BACKSPACE at beginning of indented li - no other li - p before ul (must move cursor to p)",
        content: "<p>dom to</p><ul><ul><li>edit</li></ul></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<p>dom to</p><ul><ul><li>edit</li></ul></ul>",
            start: "p:contents()[0]->6",
        },
    },
    { name: "'a' after BACKSPACE at beginning of indented li - no other li - p before ul (must write in p)",
        content: "<p>dom to</p><ul><ul><li>edit</li></ul></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<p>dom toa</p><ul><ul><li>edit</li></ul></ul>",
            start: "p:contents()[0]->7",
        },
    },
    { name: "BACKSPACE at beginning of indented li - no other li - nothing before ul (must do nothing)",
        content: "<ul><ul><li>dom to edit</li></ul></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><ul><li>dom to edit</li></ul></ul>",
            start: "li:contents()[0]->0",
        },
    },
    { name: "BACKSPACE at beginning of p - before span.b, after p ending with span.a (must attach them)",
        content: "<p><span class=\"a\">dom to</span></p><p><span class=\"b\">edit</span></p>",
        steps: [{start: "p:eq(1):contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<p><span class=\"a\">dom to</span><span class=\"b\">edit</span></p>",
            start: "span:eq(0):contents()[0]->6",
        },
    },
    { name: "BACKSPACE at beginning of p - before span.a, after p ending with span.a (must merge them)",
        content: "<p><span class=\"a\">dom to&nbsp;</span></p><p><span class=\"a\">edit</span></p>",
        steps: [{start: "p:eq(1):contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<p><span class=\"a\">dom to&nbsp;edit</span></p>",
            start: "span:contents()[0]->7",
        },
    },
    { name: "BACKSPACE after b tag in a p tag",
        content: "<p><b>dom</b> to edit</p>",
        steps: [{start: "p:contents()[1]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<p><b>do</b> to edit</p>",
            start: "b:contents()[0]->2",
        },
    },
    { name: "BACKSPACE at beginning of p - before span.a, after div ending with span.a (must move cursor to end of div)",
        content: "<div><span class=\"a\">dom to&nbsp;</span></div><p><span class=\"a\">edit</span></p>",
        steps: [{start: "p:contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<div><span class=\"a\">dom to&nbsp;</span></div><p><span class=\"a\">edit</span></p>",
            start: "span:eq(0):contents()[0]->7",
        },
    },
    { name: "BACKSPACE at beginning of p.c - before span.b, after p.a ending with span.b (must move cursor to end of div)",
        content: "<p class=\"a\"><span class=\"b\">dom to&nbsp;</span></p><p class=\"c\"><span class=\"b\">edit</span></p>",
        steps: [{start: "p:eq(1):contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<p class=\"a\"><span class=\"b\">dom to&nbsp;</span></p><p class=\"c\"><span class=\"b\">edit</span></p>",
            start: "span:eq(0):contents()[0]->7",
        },
    },
    { name: "BACKSPACE on a selection in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", end: "p:contents()[0]->7", key: 'BACK_SPACE'}],
        test: {
            content: "<p>dedit</p>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "BACKSPACE on a selection across two p tags",
        content: "<p>dom</p><p>to edit</p>",
        steps: [{start: "p:contents()[0]->1", end: "p:eq(1):contents()[0]->3", key: 'BACK_SPACE'}],
        test: {
            content: "<p>dedit</p>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "BACKSPACE on a selection in a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->1", end: "li:contents()[0]->7", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><li>dedit</li></ul>",
            start: "li:contents()[0]->1",
        },
    },
    { name: "BACKSPACE on a selection across several list elements",
        content: "<ul><li>dom to edit</li><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->1", end: "li:eq(1):contents()[0]->7", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><li>dedit</li></ul>",
            start: "li:contents()[0]->1",
        },
    },
    { name: "BACKSPACE on a selection of all the contents of a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", end: "li:contents()[0]->11", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><li><br></li></ul>",
            start: "li->1",
        },
    },
    { name: "'a' after BACKSPACE on a selection of all the contents of a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", end: "li:contents()[0]->11", key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<ul><li>a</li></ul>",
            start: "li:contents()[0]->1",
        },
    },
    { name: "BACKSPACE on a selection of all the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", end: "p:contents()[0]->11", key: 'BACK_SPACE'}],
        test: {
            content: "<p><br></p>",
            start: "p->1",
        },
    },
    { name: "'a' after BACKSPACE on a selection of all the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", end: "p:contents()[0]->11", key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<p>a</p>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "BACKSPACE on a selection of most contents of a complex dom",
        content: "<p><b>dom</b></p><p><b>to<br>partially</b>re<i>m</i>ove</p>",
        steps: [{start: "b:contents()[0]->2", end: "i:contents()[0]->1", key: 'BACK_SPACE'}],
        test: {
            content: "<p><b>do</b>ove</p>",
            start: "b:contents()[0]->2",
        },
    },
    { name: "BACKSPACE on a selection of all the contents of a complex dom",
        content: "<p><b>dom</b></p><p><b>to<br>completely</b>remov<i>e</i></p>",
        steps: [{start: "p:contents()[0]->0", end: "i:contents()[0]->1", key: 'BACK_SPACE'}],
        test: {
            content: "<p><b><br></b></p>",
            start: "b->1",
        },
    },
    { name: "BACKSPACE after br tag",
        content: "<p>dom <br>to edit</p>",
        steps: [{start: "p:contents()[2]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<p>dom to edit</p>",
            start: "p:contents()[0]->4",
        },
    },
    { name: "BACKSPACE after only character in a p tag in a li",
        content: "<ul><li><p>a</p></li></ul>",
        steps: [{start: "p:contents()[0]->1", key: 'BACK_SPACE'}],
        test: {
            content: "<ul><li><p><br></p></li></ul>",
            start: "p->1",
        },
    },
    { name: "'a' after BACKSPACE after only character in a p tag in a li",
        content: "<ul><li><p>a</p></li></ul>",
        steps: [{start: "p:contents()[0]->1", key: 'BACK_SPACE'}, {key: 'a'}],
        test: {
            content: "<ul><li><p>a</p></li></ul>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "BACKSPACE complexe dom create by ENTER in the contents of a b in span tag",
        content: "<span><b>dom<br></b></span><br><span><b>&nbsp;to edit</b></span>",
        steps: [{start: "b:eq(1):contents()[0]->0", key: 'BACK_SPACE'}],
        test: {
            content: "<span><b>dom<br>&nbsp;to edit</b></span>",
            start: "b:contents()[2]->0",
        },
    },
    { name: "BACKSPACE complexe dom create by ENTER in the contents of a b in span tag (2)",
        content: "<span><b>dom<br></b></span><br><span><b>a to edit</b></span>",
        steps: [{start: "b:eq(1):contents()[0]->1", key: 'BACK_SPACE'}, {key: 'BACK_SPACE'}],
        test: {
            content: "<span><b>dom<br>&nbsp;to edit</b></span>",
            start: "b:contents()[2]->0",
        },
    },
];

QUnit.test('Backspace', function (assert) {
    var done = assert.async();
    weTestUtils.createWysiwyg({
        data: this.data,
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');
        weTestUtils.testKeyboard($editable, assert, keyboardTestsBackspace).then(function () {
            wysiwyg.destroy();
            done();
        });
    });
});

var keyboardTestsDelete = [
    { name: "DELETE in empty document (must leave it unchanged)",
        content: "<p></p>",
        steps: [{start: "p->0", key: 'DELETE'}],
        test: {
            content: "<p><br></p>", // The br is there to ensure the carret can enter the p tag
            start: "p->1",
        },
    },
    { name: "DELETE at beginning of text",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", key: 'DELETE'}],
        test: {
            content: "<p>om to edit</p>", // The br is there to ensure the carret can enter the p tag
            start: "p:contents()[0]->0",
        },
    },
    { name: "DELETE twice at beginning of text",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", key: 'DELETE'}, {key: 'DELETE'}],
        test: {
            content: "<p>m to edit</p>", // The br is there to ensure the carret can enter the p tag
            start: "p:contents()[0]->0",
        },
    },
    { name: "DELETE on ul's only li, which is empty (must do nothing)",
        content: "<ul><li><br></li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'DELETE'}],
        test: {
            content: "<ul><li><br></li></ul>",
            start: "li->1",
        },
    },
    { name: "'a' after DELETE on ul's only li, which is empty (must write into it)",
        content: "<ul><li><br></li></ul>",
        steps: [{start: "li:contents()[0]->0", key: 'DELETE'}, {key: 'a'}],
        test: {
            content: "<ul><li>a</li></ul>",
            start: "li:contents()[0]->1",
        },
    }, 
    { name: "DELETE at end of ul's first li, out of two (must move contents of second li to carret)",
        content: "<ul><li>dom to&nbsp;</li><li>edit</li></ul>",
        steps: [{start: "li:contents()[0]->7", key: 'DELETE'}],
        test: {
            content: "<ul><li>dom to&nbsp;edit</li></ul>",
            start: "li:contents()[0]->7",
        },
    },
    { name: "'a' after DELETE at end of ul's first li, out of two (must move contents of second li to carret, then write)",
        content: "<ul><li>dom to&nbsp;</li><li>edit</li></ul>",
        steps: [{start: "li:contents()[0]->7", key: 'DELETE'}, {key: 'a'}],
        test: {
            content: "<ul><li>dom to aedit</li></ul>",
            start: "li:contents()[0]->8",
        },
    },
    { name: "DELETE at end of indented ul (must do nothing)",
        content: "<ul><ul><li>dom to edit</li></ul></ul>",
        steps: [{start: "li:contents()[0]->11", key: 'DELETE'}],
        test: {
            content: "<ul><ul><li>dom to edit</li></ul></ul>",
            start: "li:contents()[0]->11",
        },
    },
    { name: "'a' after DELETE at end of indented ul (must do nothing) (must write)",
        content: "<ul><ul><li>dom to edit</li></ul></ul>",
        steps: [{start: "li:contents()[0]->11", key: 'DELETE'}, {key: 'a'}],
        test: {
            content: "<ul><ul><li>dom to edita</li></ul></ul>",
            start: "li:contents()[0]->12",
        },
    },
    { name: "DELETE after b tag in a p tag",
        content: "<p><b>dom</b>to edit</p>",
        steps: [{start: "b:contents()[0]->3", key: 'DELETE'}],
        test: {
            content: "<p><b>dom</b>o edit</p>",
            start: "b:contents()[0]->3",
        },
    },
    { name: "DELETE at end of p - after span.a, before div starting with span.a (must do nothing)",
        content: "<p><span class=\"a\">dom to</span></p><div><span class=\"a\">edit</span></div>",
        steps: [{start: "span:contents()[0]->6", key: 'DELETE'}],
        test: {
            content: "<p><span class=\"a\">dom to</span></p><div><span class=\"a\">edit</span></div>",
            start: "span:eq(1):contents()[0]->0",
        },
    },
    { name: "DELETE at end of p.a - after span.b, before p.c starting with span.b (must do nothing)",
        content: "<p class=\"a\"><span class=\"b\">dom to</span></p><p class=\"c\"><span class=\"b\">edit</span></p>",
        steps: [{start: "span:contents()[0]->6", key: 'DELETE'}],
        test: {
            content: "<p class=\"a\"><span class=\"b\">dom to</span></p><p class=\"c\"><span class=\"b\">edit</span></p>",
            start: "span:eq(1):contents()[0]->0",
        },
    },
    { name: "DELETE on a selection in a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->1", end: "p:contents()[0]->7", key: 'DELETE'}],
        test: {
            content: "<p>dedit</p>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "DELETE on a selection in across two p tags",
        content: "<p>dom</p><p>to edit</p>",
        steps: [{start: "p:contents()[0]->1", end: "p:eq(1):contents()[0]->3", key: 'DELETE'}],
        test: {
            content: "<p>dedit</p>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "DELETE on a selection in a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->1", end: "li:contents()[0]->7", key: 'DELETE'}],
        test: {
            content: "<ul><li>dedit</li></ul>",
            start: "li:contents()[0]->1",
        },
    },
    { name: "DELETE on a selection across several list elements",
        content: "<ul><li>dom to edit</li><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->1", end: "li:eq(1):contents()[0]->7", key: 'DELETE'}],
        test: {
            content: "<ul><li>dedit</li></ul>",
            start: "li:contents()[0]->1",
        },
    },
    { name: "DELETE on a selection of all the contents of a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", end: "li:contents()[0]->11", key: 'DELETE'}],
        test: {
            content: "<ul><li><br></li></ul>",
            start: "li->1",
        },
    },
    { name: "'a' after DELETE on a selection of all the contents of a list element",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{start: "li:contents()[0]->0", end: "li:contents()[0]->11", key: 'DELETE'}, {key: 'a'}],
        test: {
            content: "<ul><li>a</li></ul>",
            start: "li:contents()[0]->1",
        },
    },
    { name: "DELETE on a selection of all the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", end: "p:contents()[0]->11", key: 'DELETE'}],
        test: {
            content: "<p><br></p>",
            start: "p->1",
        },
    },
    { name: "'a' after DELETE on a selection of all the contents of a p tag",
        content: "<p>dom to edit</p>",
        steps: [{start: "p:contents()[0]->0", end: "p:contents()[0]->11", key: 'DELETE'}, {key: 'a'}],
        test: {
            content: "<p>a</p>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "DELETE before br tag",
        content: "<p>dom <br>to edit</p>",
        steps: [{start: "p:contents()[0]->4", key: 'DELETE'}],
        test: {
            content: "<p>dom to edit</p>",
            start: "p:contents()[0]->4",
        },
    },
    { name: "DELETE on a selection of most contents of a complex dom",
        content: "<p><b>dom</b></p><p><b>to<br>partially</b>re<i>m</i>ove</p>",
        steps: [{start: "b:contents()[0]->2", end: "i:contents()[0]->1", key: 'DELETE'}],
        test: {
            content: "<p><b>do</b>ove</p>",
            start: "b:contents()[0]->2",
        },
    },
    { name: "DELETE on a selection of all the contents of a complex dom",
        content: "<p><b>dom</b></p><p><b>to<br>completely</b>remov<i>e</i></p>",
        steps: [{start: "p:contents()[0]->0", end: "i:contents()[0]->1", key: 'DELETE'}],
        test: {
            content: "<p><b><br></b></p>",
            start: "b->1",
        },
    },
    { name: "DELETE before only character in a p tag in a li",
        content: "<ul><li><p>a</p></li></ul>",
        steps: [{start: "p:contents()[0]->0", key: 'DELETE'}],
        test: {
            content: "<ul><li><p><br></p></li></ul>",
            start: "p->1",
        },
    },
    { name: "'a' after DELETE before only character in a p tag in a li",
        content: "<ul><li><p>a</p></li></ul>",
        steps: [{start: "p:contents()[0]->0", key: 'DELETE'}, {key: 'a'}],
        test: {
            content: "<ul><li><p>a</p></li></ul>",
            start: "p:contents()[0]->1",
        },
    },
    { name: "DELETE complexe dom create by ENTER in the contents of a b in span tag",
        content: "<span><b>dom</b></span><br><span><b> to edit</b></span>",
        steps: [{start: "b:eq(0):contents()[0]->3", key: 'DELETE'}],
        test: {
            content: "<span><b>dom to edit</b></span>",
            start: "b:contents()[0]->3",
        },
    },
];

QUnit.test('Delete', function (assert) {
    var done = assert.async();
    weTestUtils.createWysiwyg({
        data: this.data,
    }).then(function (wysiwyg) {
        var $editable = wysiwyg.$('.note-editable');
        weTestUtils.testKeyboard($editable, assert, keyboardTestsDelete).then(function () {
            wysiwyg.destroy();
            done();
        });
    });
});

});
});
});
