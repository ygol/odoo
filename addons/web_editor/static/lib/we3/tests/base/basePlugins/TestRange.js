(function () {
'use strict';

var TestRange = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Test'];

    // range collapsed: ◆
    // range start: ▶
    // range end: ◀

    this.tests = [
        {
            name: "Range in text",
            content: "<p>aa◆a</p>",
            test: "<p>aa◆a</p>",
        },
        {
            name: "Range on image (click test)",
            content: '<p>aa▶<img src="/web_editor/static/src/img/transparent.png"/>◀aa</p>',
            test: '<p>aa▶<img src="/web_editor/static/src/img/transparent.png"/>◀aa</p>',
        },
        {
            name: "Range at the end of a table",
            content: "<p>a</p><table><tbody><tr><td>b</td><td>c◆</td></tr></tbody></table><p>d</p>",
            test: "<p>a</p><table><tbody><tr><td>b</td><td>c◆</td></tr></tbody></table><p>d</p>",
        },
        {
            name: "Range at the end of a table when click on right",
            content: "<p>a</p><table><tbody><tr><td>b</td><td>c</td></tr></tbody></table>◆<p>d</p>",
            test: "<p>a</p><table><tbody><tr><td>b</td><td>c◆</td></tr></tbody></table><p>d</p>",
        },
        {
            name: "Range across BR",
            content: "<p>a<br/>▶<br/>b◀</p>",
            test: "<p>a<br/>▶<br/>b◀</p>",
        },
    ];

    }
    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }
    async test (assert) {
        for (var k = 0; k < this.tests.length; k++) {
            var test = this.tests[k];
            await this.dependencies.Test.setValue(test.content);
            var value = this.dependencies.Test.getValue();
            assert.strictEqual(value, test.test, test.name);
        }
    }
};

we3.addPlugin('TestRange', TestRange);

})();
