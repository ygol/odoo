odoo.define('web.concurrency_tests', function (require) {
"use strict";

var concurrency = require('web.concurrency');

QUnit.module('core', {}, function () {

    QUnit.module('concurrency');

    /**
     * Helper function, make a promise with a public resolve function. Note that
     * this is not standard and should not be used outside of tests...
     *
     * @returns {Promise + resolve and reject function}
     */
    function makeTestPromise() {
        var resolve;
        var reject;
        var promise = new Promise(function (_resolve, _reject) {
            resolve = _resolve;
            reject = _reject;
        });
        promise.resolve = function () {
            resolve.apply(null, arguments);
            return promise;
        };
        promise.reject = function () {
            reject.apply(null, arguments);
            return promise;
        };
        return promise;
    }

    function makeTestPromiseWithAssert(assert, str) {
        var prom = makeTestPromise();
        prom.then(() => assert.step('ok ' + str));
        prom.catch(() => assert.step('ko ' + str));
        return prom;
    }

    QUnit.test('mutex: simple scheduling', async function (assert) {
        assert.expect(5);
        var done = assert.async();
        var mutex = new concurrency.Mutex();

        var prom1 = makeTestPromiseWithAssert(assert, 'prom1');
        var prom2 = makeTestPromiseWithAssert(assert, 'prom2');

        mutex.exec(function () { return prom1; });
        mutex.exec(function () { return prom2; });

        assert.verifySteps([]);

        await prom1.resolve();

        assert.verifySteps(['ok prom1']);

        await prom2.resolve();

        assert.verifySteps(['ok prom1', 'ok prom2']);

        done();
    });

    QUnit.test('mutex: simpleScheduling2', async function (assert) {
        assert.expect(5);
        var done = assert.async();
        var mutex = new concurrency.Mutex();

        var prom1 = makeTestPromiseWithAssert(assert, 'prom1');
        var prom2 = makeTestPromiseWithAssert(assert, 'prom2');

        mutex.exec(function () { return prom1; });
        mutex.exec(function () { return prom2; });

        assert.verifySteps([]);

        await prom2.resolve();

        assert.verifySteps(['ok prom2']);

        await prom1.resolve();

        assert.verifySteps(['ok prom2', 'ok prom1']);

        done();
    });

    QUnit.only('mutex: reject', async function (assert) {
        assert.expect(7);
        var done = assert.async();

        var mutex = new concurrency.Mutex();

        var prom1 = makeTestPromiseWithAssert(assert, 'prom1');
        var prom2 = makeTestPromiseWithAssert(assert, 'prom2');
        var prom3 = makeTestPromiseWithAssert(assert, 'prom3');

        mutex.exec(function () { return prom1; });
        mutex.exec(function () { return prom2; });
        mutex.exec(function () { return prom3; });

        assert.verifySteps([]);

        await prom1.resolve();

        assert.verifySteps(['ok prom1']);

        try {
            await prom2.reject();
        } catch {
            assert.verifySteps(['ok prom1', 'ko prom2']);
        }

        await prom3.resolve();

        assert.verifySteps(['ok prom1', 'ko prom2', 'ok prom3']);
        done();
    });

    QUnit.test('mutex: getUnlockedDef checks', function (assert) {
        assert.expect(5);

        var m = new concurrency.Mutex();

        var def1 = $.Deferred();
        var def2 = $.Deferred();

        assert.strictEqual(m.getUnlockedDef().state(), "resolved");

        m.exec(function() { return def1; });

        var unlockedDef = m.getUnlockedDef();

        assert.strictEqual(unlockedDef.state(), "pending");

        m.exec(function() { return def2; });

        assert.strictEqual(unlockedDef.state(), "pending");

        def1.resolve();

        assert.strictEqual(unlockedDef.state(), "pending");

        def2.resolve();

        assert.strictEqual(unlockedDef.state(), "resolved");
    });

    QUnit.test('DropPrevious: basic usecase', function (assert) {
        assert.expect(5);

        var dp = new concurrency.DropPrevious();

        var def1 = $.Deferred();
        var def2 = $.Deferred();

        var r1 = dp.add(def1);

        assert.strictEqual(r1.state(), "pending");

        var r2 = dp.add(def2);

        assert.strictEqual(r1.state(), "rejected");
        assert.strictEqual(r2.state(), "pending");

        def2.resolve();

        assert.strictEqual(r1.state(), "rejected");
        assert.strictEqual(r2.state(), "resolved");
    });

    QUnit.test('DropMisordered: resolve all correctly ordered, sync', function (assert) {
        assert.expect(1);

        var dm = new concurrency.DropMisordered(),
            flag = false;

        var d1 = $.Deferred(),
            d2 = $.Deferred();

        var r1 = dm.add(d1),
            r2 = dm.add(d2);

        $.when(r1, r2).done(function () {
            flag = true;
        });

        d1.resolve();
        d2.resolve();

        assert.ok(flag);
    });

    QUnit.test("DropMisordered: don't resolve mis-ordered, sync", function (assert) {
        assert.expect(4);

        var dm = new concurrency.DropMisordered(),
            done1 = false,
            done2 = false,
            fail1 = false,
            fail2 = false;

        var d1 = $.Deferred(),
            d2 = $.Deferred();

        dm.add(d1).done(function () { done1 = true; })
                    .fail(function () { fail1 = true; });
        dm.add(d2).done(function () { done2 = true; })
                    .fail(function () { fail2 = true; });

        d2.resolve();
        d1.resolve();

        // d1 is in limbo
        assert.ok(!done1);
        assert.ok(!fail1);

        // d2 is resolved
        assert.ok(done2);
        assert.ok(!fail2);
    });

    QUnit.test('DropMisordered: fail mis-ordered flag, sync', function (assert) {
        assert.expect(4);

        var dm = new concurrency.DropMisordered(true),
            done1 = false,
            done2 = false,
            fail1 = false,
            fail2 = false;

        var d1 = $.Deferred(),
            d2 = $.Deferred();

        dm.add(d1).done(function () { done1 = true; })
                    .fail(function () { fail1 = true; });
        dm.add(d2).done(function () { done2 = true; })
                    .fail(function () { fail2 = true; });

        d2.resolve();
        d1.resolve();

        // d1 is in limbo
        assert.ok(!done1);
        assert.ok(fail1);

        // d2 is resolved
        assert.ok(done2);
        assert.ok(!fail2);
    });

    QUnit.test('DropMisordered: resolve all correctly ordered, async', function (assert) {
        var done = assert.async();
        assert.expect(1);

        var dm = new concurrency.DropMisordered();

        var d1 = $.Deferred(),
            d2 = $.Deferred();

        var r1 = dm.add(d1),
            r2 = dm.add(d2);

        setTimeout(function () { d1.resolve(); }, 10);
        setTimeout(function () { d2.resolve(); }, 20);

        $.when(r1, r2).done(function () {
            assert.ok(true);
            done();
        });
    });

    QUnit.test("DropMisordered: don't resolve mis-ordered, async", function (assert) {
        var done = assert.async();
        assert.expect(4);

        var dm = new concurrency.DropMisordered(),
            done1 = false, done2 = false,
            fail1 = false, fail2 = false;

        var d1 = $.Deferred(),
            d2 = $.Deferred();

        dm.add(d1).done(function () { done1 = true; })
                    .fail(function () { fail1 = true; });
        dm.add(d2).done(function () { done2 = true; })
                    .fail(function () { fail2 = true; });

        setTimeout(function () { d1.resolve(); }, 20);
        setTimeout(function () { d2.resolve(); }, 10);

        setTimeout(function () {
            // d1 is in limbo
            assert.ok(!done1);
            assert.ok(!fail1);

            // d2 is resolved
            assert.ok(done2);
            assert.ok(!fail2);
            done();
        }, 30);
    });

    QUnit.test('DropMisordered: fail mis-ordered flag, async', function (assert) {
        var done = assert.async();
        assert.expect(4);

        var dm = new concurrency.DropMisordered(true),
            done1 = false, done2 = false,
            fail1 = false, fail2 = false;

        var d1 = $.Deferred(),
            d2 = $.Deferred();

        dm.add(d1).done(function () { done1 = true; })
                    .fail(function () { fail1 = true; });
        dm.add(d2).done(function () { done2 = true; })
                    .fail(function () { fail2 = true; });

        setTimeout(function () { d1.resolve(); }, 20);
        setTimeout(function () { d2.resolve(); }, 10);

        setTimeout(function () {
            // d1 is failed
            assert.ok(!done1);
            assert.ok(fail1);

            // d2 is resolved
            assert.ok(done2);
            assert.ok(!fail2);
            done();
        }, 30);
    });

    QUnit.test('MutexedDropPrevious: simple', function (assert) {
        assert.expect(3);

        var m = new concurrency.MutexedDropPrevious();

        var d1 = $.Deferred();
        var p1 = m.exec(function () { return d1; }).then(function (result) {
            assert.strictEqual(result, 'd1');
        });

        assert.strictEqual(p1.state(), "pending");

        d1.resolve('d1');
        assert.strictEqual(p1.state(), "resolved");
    });

    QUnit.test('MutexedDropPrevious: 2 arrives after 1 resolution', function (assert) {
        assert.expect(6);

        var m = new concurrency.MutexedDropPrevious();

        var d1 = $.Deferred();
        var p1 = m.exec(function () { return d1; }).then(function (result) {
            assert.strictEqual(result, 'd1');
        });

        assert.strictEqual(p1.state(), "pending");

        d1.resolve('d1');
        assert.strictEqual(p1.state(), "resolved");

        var d2 = $.Deferred();
        var p2 = m.exec(function () { return d2; }).then(function (result) {
            assert.strictEqual(result, 'd2');
        });

        assert.strictEqual(p2.state(), "pending");

        d2.resolve('d2');
        assert.strictEqual(p2.state(), "resolved");
    });

    QUnit.test('MutexedDropPrevious: 1 does not return a deferred', function (assert) {
        assert.expect(5);

        var m = new concurrency.MutexedDropPrevious();

        var p1 = m.exec(function () { return 42; }).then(function (result) {
            assert.strictEqual(result, 42);
        });

        assert.strictEqual(p1.state(), "resolved");

        var d2 = $.Deferred();
        var p2 = m.exec(function () { return d2; }).then(function (result) {
            assert.strictEqual(result, 'd2');
        });

        assert.strictEqual(p2.state(), "pending");

        d2.resolve('d2');
        assert.strictEqual(p2.state(), "resolved");
    });

    QUnit.test('MutexedDropPrevious: 2 arrives before 1 resolution', function (assert) {
        assert.expect(13);

        var m = new concurrency.MutexedDropPrevious();

        var d1 = $.Deferred();
        var d2 = $.Deferred();

        var p1 = m.exec(function () {
            assert.step('p1');
            return d1;
        });
        assert.strictEqual(p1.state(), "pending");

        var p2 = m.exec(function () {
            assert.step('p2');
            return d2;
        }).then(function (result) {
            assert.strictEqual(result, 'd2');
        });

        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "pending");

        assert.step('d1 resolved');
        d1.resolve('d1');
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "pending");

        assert.step('d2 resolved');
        d2.resolve('d2');
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "resolved");

        assert.verifySteps(['p1', 'd1 resolved', 'p2', 'd2 resolved']);
    });

    QUnit.test('MutexedDropPrevious: 3 arrives before 2 initialization', function (assert) {
        assert.expect(13);

        var m = new concurrency.MutexedDropPrevious();

        var d1 = $.Deferred();
        var d2 = $.Deferred();
        var d3 = $.Deferred();

        var p1 = m.exec(function () { return d1; });
        assert.strictEqual(p1.state(), "pending");

        var p2 = m.exec(function () {
            assert.ok(false, "should not execute this function");
            return d2;
        });
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "pending");

        var p3 = m.exec(function () { return d3; }).then(function (result) {
            assert.strictEqual(result, 'd3');
        });
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "rejected");
        assert.strictEqual(p3.state(), "pending");

        d1.resolve('d1');
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "rejected");
        assert.strictEqual(p3.state(), "pending");

        d3.resolve('d3');
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "rejected");
        assert.strictEqual(p3.state(), "resolved");
    });

    QUnit.test('MutexedDropPrevious: 3 arrives after 2 initialization', function (assert) {
        assert.expect(19);

        var m = new concurrency.MutexedDropPrevious();

        var d1 = $.Deferred();
        var d2 = $.Deferred();
        var d3 = $.Deferred();

        var p1 = m.exec(function () {
            assert.step('p1');
            return d1;
        });
        assert.strictEqual(p1.state(), "pending");

        var p2 = m.exec(function () {
            assert.step('p2');
            return d2;
        });

        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "pending");

        assert.step('d1 resolved');
        d1.resolve('d1');
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "pending");

        var p3 = m.exec(function () {
            assert.step('p3');
            return d3;
        }).then(function (result) {
            assert.strictEqual(result, 'd3');
        });

        assert.step('d2 resolved');
        d2.resolve('d2');
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "rejected");
        assert.strictEqual(p3.state(), "pending");

        assert.step('d3 resolved');
        d3.resolve('d3');
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "rejected");
        assert.strictEqual(p3.state(), "resolved");

        assert.verifySteps(['p1', 'd1 resolved', 'p2', 'd2 resolved', 'p3', 'd3 resolved']);
    });

    QUnit.test('MutexedDropPrevious: 2 in then of 1 with 3', function (assert) {
        assert.expect(6);

        var m = new concurrency.MutexedDropPrevious();

        var d1 = $.Deferred();
        var d2 = $.Deferred();
        var d3 = $.Deferred();
        var p3;

        var p1 = m.exec(function () { return d1; })
            .always(function () {
                p3 = m.exec(function () {
                    return d3;
                }).then(function (result) {
                    assert.strictEqual(result, 'd3');
                });
                return p3;
            });

        assert.strictEqual(p1.state(), "pending");

        var p2 = m.exec(function () {
            assert.ok(false, "should not execute this function");
            return d2;
        });
        assert.strictEqual(p1.state(), "rejected");
        assert.strictEqual(p2.state(), "rejected");

        d1.resolve('d1');
        assert.strictEqual(p3.state(), "pending");

        d3.resolve('d3');
        assert.strictEqual(p3.state(), "resolved");
    });

});

});