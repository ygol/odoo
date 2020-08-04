odoo.define('mail/static/src/model/model_recordset.js', function (require) {
'use strict';

class RecordSet {

    /**
     * @param {Model[]} [records=[]] iterable of records
     */
    constructor(records = []) {
        this._records = new Set(records);
    }

    [Symbol.iterator]() {
        return this._records[Symbol.iterator]();
    }

    add(...args) {
        return this._records.add(...args);
    }

    concat(...args) {
        let records = [...this._records];
        for (const arg of args) {
            if(typeof arg[Symbol.iterator] === 'function') {
                records = records.concat(...arg);
            } else {
                records = records.push(arg);
            }
        }
        return new RecordSet(records);
    }

    delete(...args) {
        return this._records.delete(...args);
    }

    filter(...args) {
        return new RecordSet([...this._records].filter(...args));
    }

    find(...args) {
        return [...this._records].find(...args);
    }

    first() {
        return [...this._records][0];
    }

    forEach(...args) {
        return this._records.forEach(...args);
    }

    has(...args) {
        return this._records.has(...args);
    }

    includes(...args) {
        return [...this._records].includes(...args);
    }

    last() {
        const {
            length: l,
            [l - 1]: last,
        } = [...this._records];
        return last;
    }

    get length() {
        return this._records.size;
    }

    map(...args) {
        return [...this._records].map(...args);
    }

    reduce(...args) {
        return [...this._records].reduce(...args);
    }

    some(...args) {
        return [...this._records].some(...args);
    }

    sort(...args) {
        return new RecordSet([...this._records].sort(...args));
    }
}

return {
    RecordSet,
};

});
