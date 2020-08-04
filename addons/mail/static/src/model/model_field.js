odoo.define('mail/static/src/model/model_field.js', function (require) {
'use strict';

/**
 * Class whose instances represent field on a model.
 * These field definitions are generated from declared fields in static prop
 * `fields` on the model.
 */
class ModelField {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    constructor({
        autocreate = false,
        compute,
        default: def,
        dependencies = [],
        dependents = [],
        fieldName,
        fieldType,
        hashes: extraHashes = [],
        inverse,
        isCausal = false,
        modelManager,
        related,
        relationType,
        to,
    } = {}) {
        const id = _.uniqueId('field_');
        /**
         * This prop only makes sense for fields of type "relation". If set,
         * it automatically creates a new record for this field on creation of
         * record, and auto-links with this record.
         */
        this.autocreate = autocreate;
        /**
         * If set, this field acts as a computed field, and this prop
         * contains the name of the instance method that computes the value
         * for this field. This compute method is called on creation of record
         * and whenever some of its dependencies change. @see dependencies
         */
        this.compute = compute;
        /**
         * Default value for this field. Used on creation of this field, to
         * set a value by default.
         */
        this.default = def;
        /**
         * List of field on current record that this field depends on for its
         * `compute` method. Useful to determine whether this field should be
         * registered for recomputation when some record fields have changed.
         * This list must be declared in model definition, or compute method
         * is only computed once.
         */
        this.dependencies = dependencies;
        /**
         * List of fields that are dependent of this field. They should never
         * be declared, and are automatically generated while processing
         * declared fields. This is populated by compute `dependencies` and
         * `related`.
         */
        this.dependents = dependents;
        /**
         * The messaging env.
         */
        this.env = modelManager.env;
        /**
         * Name of the field in the definition of fields on model.
         */
        this.fieldName = fieldName;
        /**
         * Type of this field. 2 types of fields are currently supported:
         *
         *   1. 'attribute': fields that store primitive values like integers,
         *                   booleans, strings, objects, array, etc.
         *
         *   2. 'relation': fields that relate to some other records.
         */
        this.fieldType = fieldType;
        /**
         * List of hashes registered on this field definition. Technical
         * prop that is specifically used in processing of dependent
         * fields, useful to clearly identify which fields of a relation are
         * dependents and must be registered for computed. Indeed, not all
         * related records may have a field that depends on changed field,
         * especially when dependency is defined on sub-model on a relation in
         * a super-model.
         *
         * To illustrate the purpose of this hash, suppose following definition
         * of models and fields:
         *
         * - 3 models (A, B, C) and 3 fields (x, y, z)
         * - A.fields: { x: one2one(C, inverse: x') }
         * - B extends A
         * - B.fields: { z: related(x.y) }
         * - C.fields: { y: attribute }
         *
         * Visually:
         *               x'
         *          <-----------
         *        A -----------> C { y }
         *        ^      x
         *        |
         *        | (extends)
         *        |
         *        B { z = x.y }
         *
         * If z has a dependency on x.y, it means y has a dependent on x'.z.
         * Note that field z exists on B but not on all A. To determine which
         * kinds of records in relation x' are dependent on y, y is aware of an
         * hash on this dependent, and any dependents who has this hash in list
         * of hashes are actual dependents.
         */
        this.hashes = extraHashes.concat([id]);
        /**
         * Identification for this field definition. Useful to map a dependent
         * from a dependency. Indeed, declared field definitions use
         * 'dependencies' but technical process need inverse as 'dependents'.
         * Dependencies just need name of fields, but dependents cannot just
         * rely on inverse field names because these dependents are a subset.
         */
        this.id = id;
        /**
         * This prop only makes sense in a relational field. This contains
         * the name of the field name in the inverse relation. This may not
         * be defined in declared field definitions, but processed relational
         * field definitions always have inverses.
         */
        this.inverse = inverse;
        /**
         * This prop only makes sense in a relational field. If set, when this
         * relation is removed, the related record is automatically deleted.
         */
        this.isCausal = isCausal;
        /**
         * Reference to the model manager.
         */
        this.modelManager = modelManager;
        /**
         * If set, this field acts as a related field, and this prop contains
         * a string that references the related field. It should have the
         * following format: '<relationName>.<relatedFieldName>', where
         * <relationName> is a relational field name on this model or a parent
         * model (note: could itself be computed or related), and
         * <relatedFieldName> is the name of field on the records that are
         * related to current record from this relation. When there are more
         * than one record in the relation, it maps all related fields per
         * record in relation.
         *
         * FIXME: currently flatten map due to bug, improvement is planned
         * see Task-id 2261221
         */
        this.related = related;
        /**
         * This prop only makes sense in a relational field. Determine which
         * type of relation there is between current record and other records.
         * 4 types of relation are supported: 'one2one', 'one2many', 'many2one'
         * and 'many2many'.
         */
        this.relationType = relationType;
        /**
         * This prop only makes sense in a relational field. Determine which
         * model name this relation refers to.
         */
        this.to = to;
    }

    /**
     * Define an attribute field.
     *
     * @param {Object} [options]
     * @returns {Object}
     */
    static attr(options) {
        return Object.assign({ fieldType: 'attribute' }, options);
    }

    /**
     * Define a many2many field.
     *
     * @param {string} modelName
     * @param {Object} [options]
     * @returns {Object}
     */
    static many2many(modelName, options) {
        return ModelField._relation(modelName, Object.assign({}, options, { relationType: 'many2many' }));
    }

    /**
     * Define a many2one field.
     *
     * @param {string} modelName
     * @param {Object} [options]
     * @returns {Object}
     */
    static many2one(modelName, options) {
        return ModelField._relation(modelName, Object.assign({}, options, { relationType: 'many2one' }));
    }

    /**
     * Define a one2many field.
     *
     * @param {string} modelName
     * @param {Object} [options]
     * @returns {Object}
     */
    static one2many(modelName, options) {
        return ModelField._relation(modelName, Object.assign({}, options, { relationType: 'one2many' }));
    }

    /**
     * Define a one2one field.
     *
     * @param {string} modelName
     * @param {Object} [options]
     * @returns {Object}
     */
    static one2one(modelName, options) {
        return ModelField._relation(modelName, Object.assign({}, options, { relationType: 'one2one' }));
    }

    /**
     * Combine current field definition with provided field definition and
     * return the combined field definition. Useful to track list of hashes of
     * a given field, which is necessary for the working of dependent fields
     * (computed and related fields).
     *
     * @param {ModelField} field
     * @returns {ModelField}
     */
    combine(field) {
        return new ModelField(Object.assign({}, this, {
            dependencies: this.dependencies.concat(field.dependencies),
            hashes: this.hashes.concat(field.hashes),
        }));
    }

    /**
     * Perform computation of this field, which is either a computed or related
     * field.
     *
     * @param {mail.model} record
     */
    doCompute(record) {
        if (this.compute) {
            record.update({ [this.fieldName]: record[this.compute]() });
            return;
        }
        if (this.related) {
            record.update({ [this.fieldName]: this._computeRelated(record) });
            return;
        }
        throw new Error("No compute method defined on this field definition");
    }

    /**
     * Get the value associated to this field.
     *
     * @param {mail.model} record
     * @returns {any}
     */
    get(record) {
        return record[this.fieldName];
    }

    /**
     * Get the raw value associated to this field. For relations, this means
     * the local id or list of local ids of records in this relational field.
     *
     * @param {mail.model} record
     * @returns {any}
     */
    read(record) {
        return record[this.fieldName];
    }

    /**
     * Set a value on this field. The format of the value comes from business
     * code.
     *
     * @param {mail.model} record
     * @param {any} newVal
     */
    set(record, newVal) {
        if (this.fieldType === 'attribute') {
            if (record[this.fieldName] === newVal) {
                return;
            }
            this.write(record, newVal);
        }
        if (this.fieldType === 'relation') {
            for (const val of newVal) {
                switch (val[0]) {
                    case 'create':
                        this._setRelationCreate(record, val[1]);
                        break;
                    case 'insert':
                        this._setRelationInsert(record, val[1]);
                        break;
                    case 'insert-and-replace':
                        this._setRelationInsertAndReplace(record, val[1]);
                        break;
                    case 'link':
                        this._setRelationLink(record, val[1]);
                        break;
                    case 'replace':
                        // TODO IMP replace should not unlink-all (task-2270780)
                        this._setRelationUnlink(record, null);
                        this._setRelationLink(record, val[1]);
                        break;
                    case 'unlink':
                        this._setRelationUnlink(record, val[1]);
                        break;
                    case 'unlink-all':
                        this._setRelationUnlink(record, null);
                        break;
                }
            }
        }
    }

    /**
     * Set a value in state associated to this field. Value corresponds exactly
     * that what is stored on this field, like local id or list of local ids
     * for a relational field. If the value changes, dependent fields are
     * automatically registered for (re-)computation.
     *
     * @param {mail.model} record
     * @param {any} newVal
     * @param {Object} [param2={}]
     * @param {Object} [param2.registerDependents=true] If set, write
     *   on this field with changed value registers dependent fields for compute.
     *   Of course, we almost always want to register them, so that they reflect
     *   the value with their dependencies. Disabling this feature prevents
     *   useless potentially heavy computation, like when setting default values.
     */
    write(record, newVal, { registerDependents = true } = {}) {
        record[this.fieldName] = newVal;
        record.__state++;

        if (!registerDependents) {
            return;
        }

        // flag all dependent fields for compute
        const Model = record.constructor;
        for (const dependent of this.dependents) {
            const [hash, currentFieldName, relatedFieldName] = dependent.split(
                this.modelManager.DEPENDENT_INNER_SEPARATOR
            );
            const field = Model.fields[currentFieldName];
            if (relatedFieldName) {
                if (['one2many', 'many2many'].includes(field.relationType)) {
                    for (const otherRecord of record[currentFieldName]) {
                        const OtherModel = otherRecord.constructor;
                        const field = OtherModel.fields[relatedFieldName];
                        if (field && field.hashes.includes(hash)) {
                            this.modelManager.registerToComputeField(otherRecord, field);
                        }
                    }
                } else {
                    const otherRecord = record[currentFieldName];
                    if (!otherRecord) {
                        continue;
                    }
                    const OtherModel = otherRecord.constructor;
                    const field = OtherModel.fields[relatedFieldName];
                    if (field && field.hashes.includes(hash)) {
                        this.modelManager.registerToComputeField(otherRecord, field);
                    }
                }
            } else {
                if (field && field.hashes.includes(hash)) {
                    this.modelManager.registerToComputeField(record, field);
                }
            }
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {string} modelName
     * @param {Object} [options]
     */
    static _relation(modelName, options) {
        return Object.assign({
            fieldType: 'relation',
            to: modelName,
        }, options);
    }

    /**
     * Compute method when this field is related.
     *
     * @private
     * @param {mail.model} record
     */
    _computeRelated(record) {
        const [relationName, relatedFieldName] = this.related.split('.');
        const Model = record.constructor;
        const relationField = Model.fields[relationName];
        if (['one2many', 'many2many'].includes(relationField.relationType)) {
            const newVal = [];
            for (const otherRecord of record[relationName]) {
                const otherValue = otherRecord[relatedFieldName];
                if (otherValue) {
                    if (typeof otherValue[Symbol.iterator] === 'function') {
                        // avoid nested array if otherField is x2many too
                        // TODO IMP task-2261221
                        for (const v of otherValue) {
                            newVal.push(v);
                        }
                    } else {
                        newVal.push(otherValue);
                    }
                }
            }
            if (this.fieldType === 'relation') {
                return [['replace', newVal]];
            }
            return newVal;
        }
        const otherRecord = record[relationName];
        if (otherRecord) {
            const newVal = otherRecord[relatedFieldName];
            if (this.fieldType === 'relation') {
                if (newVal) {
                    return [['replace', newVal]];
                } else {
                    return [['unlink-all']];
                }
            }
            return newVal;
        }
        if (this.fieldType === 'relation') {
            return [];
        }
    }

    /**
     * Converts given value to expected format for x2many processing, which is
     * an iterable of records.
     *
     * @private
     * @param {mail.model|mail.model[]} newValue
     * @returns {mail.model[]}
     */
    _setRelationConvertX2ManyValue(newValue) {
        if (typeof newValue[Symbol.iterator] === 'function') {
            for (const value of newValue) {
                this._verifyRelationalValue(value);
            }
            return newValue;
        }
        this._verifyRelationalValue(newValue);
        return [newValue];
    }

    /**
     * Set on this relational field in 'create' mode. Basically data provided
     * during set on this relational field contain data to create new records,
     * which themselves must be linked to record of this field by means of
     * this field.
     *
     * @private
     * @param {mail.model} record
     * @param {Object|Object[]} data
     */
    _setRelationCreate(record, data) {
        const OtherModel = this.env.models[this.to];
        const other = OtherModel.create(data);
        this._setRelationLink(record, other);
    }

    /**
     * Set on this relational field in 'insert' mode. Basically data provided
     * during set on this relational field contain data to insert records,
     * which themselves must be linked to record of this field by means of
     * this field.
     *
     * @private
     * @param {mail.model} record
     * @param {Object|Object[]} data
     */
    _setRelationInsert(record, data) {
        const OtherModel = this.env.models[this.to];
        const other = OtherModel.insert(data);
        this._setRelationLink(record, other);
    }

    /**
     * Set on this relational field in 'insert-and-repalce' mode. Basically
     * data provided during set on this relational field contain data to insert
     * records, which themselves must replace value on this field.
     *
     * @private
     * @param {mail.model} record
     * @param {Object|Object[]} data
     */
    _setRelationInsertAndReplace(record, data) {
        // unlink must be done before insert:
        // because unlink might trigger delete due to causality and new data
        // shouldn't be deleted just after being inserted
        // TODO IMP insert-and-replace should not unlink-all (task-2270780)
        this._setRelationUnlink(record, null);
        const OtherModel = this.env.models[this.to];
        const other = OtherModel.insert(data);
        this._setRelationLink(record, other);
    }

    /**
     * Set a 'link' operation on this relational field.
     *
     * @private
     * @param {mail.model|mail.model[]} newValue
     */
    _setRelationLink(record, newValue) {
        switch (this.relationType) {
            case 'many2many':
            case 'one2many':
                this._setRelationLinkX2Many(record, newValue);
                break;
            case 'many2one':
            case 'one2one':
                this._setRelationLinkX2One(record, newValue);
                break;
        }
    }

    /**
     * Handling of a `set` 'link' of a x2many relational field.
     *
     * @private
     * @param {mail.model} record
     * @param {mail.model|mail.model[]} newValue
     */
    _setRelationLinkX2Many(record, newValue) {
        const newOtherRecords = this._setRelationConvertX2ManyValue(newValue);
        const otherRecords = record[this.fieldName];

        let isAdding = false;
        for (const newOtherRecord of newOtherRecords) {
            // other record may be deleted due to causality, avoid linking
            // deleted records
            if (!newOtherRecord.exists()) {
                throw Error(`Attempt to link deleted record ${newOtherRecord.localId} to ${this.fieldName}`);
            }
            // other record already linked, avoid linking twice
            if (otherRecords.has(newOtherRecord)) {
                continue;
            }
            isAdding = true;
            // link other records to current record
            otherRecords.add(newOtherRecord);
            // link current record to other records
            for (const newOtherRecord of newOtherRecords) {
                newOtherRecord.update({
                    [this.inverse]: [['link', record]],
                });
            }
        }
        if (!isAdding) {
            return;
        }
        // register dependents
        this.write(record, otherRecords);
    }

    /**
     * Handling of a `set` 'link' of an x2one relational field.
     *
     * @private
     * @param {mail.model} record
     * @param {mail.model} newOtherRecord
     */
    _setRelationLinkX2One(record, newOtherRecord) {
        this._verifyRelationalValue(newOtherRecord);
        const prevOtherRecord = record[this.fieldName];

        // other record already linked, avoid linking twice
        if (prevOtherRecord === newOtherRecord) {
            return;
        }

        // unlink to properly update previous inverse before linking new value
        this._setRelationUnlinkX2One(record);

        if (!newOtherRecord) {
            throw Error(`Attempt to link non-record ${newOtherRecord} to ${this.fieldName}`);
        }
        // other record may be deleted due to causality, avoid linking deleted
        // records
        if (!newOtherRecord.exists()) {
            throw Error(`Attempt to link deleted record ${newOtherRecord.localId} to ${this.fieldName}`);
        }

        // link other record to current record
        this.write(record, newOtherRecord);
        // link current record to other record
        newOtherRecord.update({
            [this.inverse]: [['link', record]],
        });
    }

    /**
     * Set an 'unlink' operation on this relational field.
     *
     * @private
     * @param {mail.model} record
     * @param {mail.model|mail.model[]|null} newValue
     */
    _setRelationUnlink(record, newValue) {
        switch (this.relationType) {
            case 'many2many':
            case 'one2many':
                this._setRelationUnlinkX2Many(record, newValue);
                break;
            case 'many2one':
            case 'one2one':
                this._setRelationUnlinkX2One(record);
                break;
        }
    }

    /**
     * Handling of a `set` 'unlink' of a x2many relational field.
     *
     * @private
     * @param {mail.model} record
     * @param {mail.model|mail.model[]|null} newValue
     */
    _setRelationUnlinkX2Many(record, newValue) {
        // null is considered unlink all
        const deleteOtherRecords = newValue === null
            ? record[this.fieldName]
            : this._setRelationConvertX2ManyValue(newValue);
        const otherRecords = record[this.fieldName];

        let isDeleting = false;
        for (const deleteOtherRecord of deleteOtherRecords) {
            // unlink other record from current record
            const wasDeleted = otherRecords.delete(deleteOtherRecord);
            if (wasDeleted) {
                isDeleting = true;
                // unlink current record from other records
                deleteOtherRecord.update({
                    [this.inverse]: [['unlink', record]],
                });
                // apply causality
                if (this.isCausal) {
                    deleteOtherRecord.delete();
                }
            }
        }
        if (!isDeleting) {
            return;
        }
        // register dependents
        this.write(record, otherRecords);
    }

    /**
     * Handling of a `set` 'unlink' of a x2one relational field.
     *
     * @private
     * @param {mail.model} record
     */
    _setRelationUnlinkX2One(record) {
        const deleteOtherRecord = record[this.fieldName];
        // other record already unlinked, avoid useless processing
        if (!deleteOtherRecord) {
            return;
        }
        // unlink other record from current record
        this.write(record, undefined);
        // unlink current record from other record
        deleteOtherRecord.update({
            [this.inverse]: [['unlink', record]],
        });
        // apply causality
        if (this.isCausal) {
            deleteOtherRecord.delete();
        }
    }

    /**
     * Verifies the given relational value makes sense for the current field.
     *
     * @private
     * @param {mail.model} record
     * @throws {Error} if record does not satisfy related model
     */
    _verifyRelationalValue(record) {
        if (record === undefined) {
            // ignored value, often result of compute methods
            return;
        }
        if (record === null) {
            // "unlink-all" value
            return;
        }
        const OtherModel = this.env.models[this.to];
        if (!OtherModel.get(record.localId)) {
            throw Error(`Record ${record.localId} is not valid for relational field ${this.fieldName}.`);
        }
    }

}

return ModelField;

});
