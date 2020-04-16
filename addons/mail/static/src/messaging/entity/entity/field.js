odoo.define('mail.messaging.entity.Field', function (require) {
'use strict';

class Field {

    /**
     * @param {mail.messaging.entity.Entity} entity
     * @param {mail.messaging.entity.FieldDefinition} definition
     */
    constructor(entity, definition) {
        this.definition = definition;
        this.entity = entity;
        this.localId = _.uniqueId('entityField_');

        if (this.definition.fieldType === 'attribute') {
            this.write(this.definition.default, { registerDependents: false });
        }
        if (this.definition.fieldType === 'relation') {
            if (['one2many', 'many2many'].includes(this.definition.relationType)) {
                // Ensure X2many relations are arrays by defaults.
                this.write([], { registerDependents: false });
            } else {
                this.write(undefined, { registerDependents: false });
            }
        }
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Perform computation of this field, which is either a computed or related
     * field.
     */
    compute() {
        if (this.definition.compute) {
            this.set(this.entity[this.definition.compute]());
            return;
        }
        if (this.definition.related) {
            const [relationName, relatedFieldName] = this.definition.related.split('.');
            const relationField = this.entity.__fields[relationName];
            if (['one2many', 'many2many'].includes(relationField.definition.relationType)) {
                const newVal = [];
                for (const otherEntity of this.entity[relationName]) {
                    const v = otherEntity.__fields[relatedFieldName].get();
                    if (v) {
                        newVal.push(v);
                    }
                }
                if (this.definition.fieldType === 'relation') {
                    this.set([['replace', newVal]]);
                } else {
                    this.set(newVal);
                }
            } else {
                const otherEntity = this.entity[relationName];
                if (otherEntity) {
                    const newVal = otherEntity.__fields[relatedFieldName].get();
                    if (this.definition.fieldType === 'relation') {
                        if (newVal) {
                            this.set([['replace', newVal]]);
                        } else {
                            this.set([['unlink-all']]);
                        }
                    } else {
                        this.set(newVal);
                    }
                }
            }
            return;
        }
        throw new Error("No compute method defined on this field definition");
    }

    /**
     * Get the messaging environment.
     *
     * @returns {mail.messaging.messaging_env}
     */
    get env() {
        return this.entity.env;
    }

    /**
     * Get the value associated to this field. Relations must convert entity
     * local ids to entities instances.
     *
     * @returns {any}
     */
    get() {
        if (this.definition.fieldType === 'attribute') {
            return this.read();
        }
        if (this.definition.fieldType === 'relation') {
            const OtherEntity = this.env.entities[this.definition.to];
            if (['one2one', 'many2one'].includes(this.definition.relationType)) {
                return OtherEntity.get(this.read());
            }
            return this.read()
                .map(localId => OtherEntity.get(localId))
                /**
                 * FIXME: Stored relation may still contain
                 * outdated entities.
                 */
                .filter(entity => !!entity);
        }
        throw new Error(`cannot get field with unsupported type ${this.definition.fieldType}.`);
    }

    /**
     * Get the raw value associated to this field. For relations, this means
     * the local id or list of local ids of entities in this relational field.
     *
     * @returns {any}
     */
    read() {
        return this.entity.__state[this.definition.fieldName];
    }

    /**
     * Set a value on this field. The format of the value comes from business
     * code.
     *
     * @param {any} newVal
     */
    set(newVal) {
        if (this.definition.fieldType === 'attribute') {
            this.write(newVal);
        }
        if (this.definition.fieldType === 'relation') {
            for (const val of newVal) {
                switch (val[0]) {
                    case 'create':
                        this._setRelationCreate(val[1]);
                        break;
                    case 'insert':
                        this._setRelationInsert(val[1]);
                        break;
                    case 'insert-and-replace':
                        this._setRelationInsertAndReplace(val[1]);
                        break;
                    case 'link':
                        this._setRelationLink(val[1]);
                        break;
                    case 'replace':
                        this._setRelationUnlink(null);
                        this._setRelationLink(val[1]);
                        break;
                    case 'unlink':
                        this._setRelationUnlink(val[1]);
                        break;
                    case 'unlink-all':
                        this._setRelationUnlink(null);
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
     * @param {any} newVal
     * @param {Object} [param1={}]
     * @param {Object} [param1.registerDependents=true] If set, write
     *   on this field with changed value registers dependent fields for compute.
     *   Of course, we almost always want to register them, so that they reflect
     *   the value with their dependencies. Disabling this feature prevents
     *   useless potentially heavy computation, like when setting default values.
     */
    write(newVal, { registerDependents = true } = {}) {
        if (this.read() === newVal) {
            return;
        }
        const prevStringified = JSON.stringify(this.read());
        this.entity.__state[this.definition.fieldName] = newVal;
        const newStringified = JSON.stringify(this.read());
        if (this._containsEntity(newVal)) {
            throw new Error("Forbidden write operation with entities in the __state!!");
        }
        if (newStringified === prevStringified) {
            // value unchanged, don't need to compute dependent fields
            return;
        }
        if (!registerDependents) {
            return;
        }

        // flag all dependent fields for compute
        for (const dependent of this.definition.dependents) {
            const [hash, currentFieldName, relatedFieldName] = dependent.split('.');
            if (relatedFieldName) {
                const relationField = this.entity.__fields[currentFieldName];
                if (['one2many', 'many2many'].includes(relationField.definition.relationType)) {
                    for (const otherEntity of this.entity[currentFieldName]) {
                        const field = otherEntity.__fields[relatedFieldName];
                        if (field && field.definition.hashes.includes(hash)) {
                            this._registerToCompute(field);
                        }
                    }
                } else {
                    if (!this.entity[currentFieldName]) {
                        continue;
                    }
                    const field = this.entity[currentFieldName].__fields[relatedFieldName];
                    if (field && field.definition.hashes.includes(hash)) {
                        this._registerToCompute(field);
                    }
                }
            } else {
                const field = this.entity.__fields[currentFieldName];
                if (field && field.definition.hashes.includes(hash)) {
                    this._registerToCompute(field);
                }
            }
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Determines whether the provided value contains an entity. Useful to
     * prevent writing entity directly in state of this field, which should be
     * treated as buggy design. Indeed, state of field should only contain
     * either a primitive type or a simple datastructure containing itself
     * simple datastructures too.
     *
     * @private
     * @param {any} val
     * @returns {boolean}
     */
    _containsEntity(val) {
        if (!val) {
            return false;
        }
        if (val.isEntity) {
            return true;
        }
        if (!(val instanceof Array)) {
            return false;
        }
        if (val.length > 0 && val[0].isEntity) {
            return true;
        }
        return false;
    }

    /**
     * Register the given field to compute during the compute step of the entity
     * update cycle currently in progress. This method is called when current
     * field value has changed and dependent fields must re-compute their value.
     *
     * @private
     * @param {mail.messaging.entity.Field} field
     */
    _registerToCompute(field) {
        this.env.messaging.registerToComputeField(field);
    }

    /**
     * Set on this relational field in 'create' mode. Basically data provided
     * during set on this relational field contain data to create new entities,
     * which themselves must be linked to entity of this field by means of
     * this field.
     *
     * @private
     * @param {Object|Object[]} data
     */
    _setRelationCreate(data) {
        const OtherEntity = this.env.entities[this.definition.to];
        let other;
        if (['one2one', 'many2one'].includes(this.definition.relationType)) {
            other = OtherEntity.create(data);
        } else {
            if (data instanceof Array) {
                other = data.map(d => OtherEntity.create(d));
            } else {
                other = OtherEntity.create(data);
            }
        }
        this._setRelationLink(other);
    }

    /**
     * Set on this relational field in 'insert' mode. Basically data provided
     * during set on this relational field contain data to insert entities,
     * which themselves must be linked to entity of this field by means of
     * this field.
     *
     * @private
     * @param {Object|Object[]} data
     */
    _setRelationInsert(data) {
        const OtherEntity = this.env.entities[this.definition.to];
        let other;
        if (['one2one', 'many2one'].includes(this.definition.relationType)) {
            other = OtherEntity.insert(data);
        } else {
            if (data instanceof Array) {
                other = data.map(d => OtherEntity.insert(d));
            } else {
                other = OtherEntity.insert(data);
            }
        }
        this._setRelationLink(other);
    }

    /**
     * Set on this relational field in 'insert-and-repalce' mode. Basically
     * data provided during set on this relational field contain data to insert
     * entities, which themselves must replace value on this field.
     *
     * @private
     * @param {Object|Object[]} data
     */
    _setRelationInsertAndReplace(data) {
        const OtherEntity = this.env.entities[this.definition.to];
        let other;
        if (['one2one', 'many2one'].includes(this.definition.relationType)) {
            other = OtherEntity.insert(data);
        } else {
            if (data instanceof Array) {
                other = data.map(d => OtherEntity.insert(d));
            } else {
                other = OtherEntity.insert(data);
            }
        }
        this._setRelationUnlink(null);
        this._setRelationLink(other);
    }

    /**
     * Set a 'link' operation on this relational field.
     *
     * @private
     * @param {string|string[]|mail.messaging.entity.Entity|mail.messaging.entity.Entity[]} newValue
     */
    _setRelationLink(newValue) {
        switch (this.definition.relationType) {
            case 'many2many':
                this._setRelationLinkMany2Many(newValue);
                break;
            case 'many2one':
                this._setRelationLinkMany2One(newValue);
                break;
            case 'one2many':
                this._setRelationLinkOne2Many(newValue);
                break;
            case 'one2one':
                this._setRelationLinkOne2One(newValue);
                break;
        }
    }

    /**
     * Technical management of updating a link operation of provided
     * relation of type many2many. Should never be called/overriden outside
     * of this file.
     *
     * @private
     * @param {string|mail.messaging.entity.Entity|<mail.messaging.entity.Entity|string>[]} newValue
     */
    _setRelationLinkMany2Many(newValue) {
        const prevValue = this.read();
        const value = newValue instanceof Array
            ? newValue.map(e => e.isEntity ? e.localId : e)
            : [newValue.isEntity ? newValue.localId : newValue];
        if (value.every(valueItem => prevValue.includes(valueItem))) {
            // Do not alter relations if unchanged.
            return;
        }
        this.write([...new Set(this.read().concat(value))]);
        for (const valueItem of value) {
            if (prevValue.includes(valueItem)) {
                continue;
            }
            const OtherEntity = this.env.entities[this.definition.to];
            const otherEntity = OtherEntity.get(valueItem);
            const otherField = otherEntity.__fields[this.definition.inverse];
            otherField.write([
                ...new Set(otherField.read().concat([this.entity.localId]))
            ]);
        }
    }

    /**
     * Technical management of updating a link operation of provided
     * relation of type many2one. Should never be called/overriden outside
     * of this file.
     *
     * @private
     * @param {string|mail.messaging.entity.Entity} newValue
     */
    _setRelationLinkMany2One(newValue) {
        const prevValue = this.read();
        const value = newValue.isEntity ? newValue.localId : newValue;
        if (value === this.read()) {
            // Do not alter relations if unchanged.
            return;
        }
        this.write(value);
        const OtherEntity = this.env.entities[this.definition.to];
        if (prevValue) {
            const otherEntity = OtherEntity.get(prevValue);
            if (!otherEntity) {
                // prev Entity has already been deleted.
                return;
            }
            const otherField = otherEntity.__fields[this.definition.inverse];
            otherField.write(otherField.read().filter(
                valueItem => valueItem !== this.entity.localId
            ));
            if (this.definition.isCausal) {
                otherEntity.delete();
            }
        }
        const otherEntity = OtherEntity.get(value);
        const otherField = otherEntity.__fields[this.definition.inverse];
        otherField.write(otherField.read().concat([this.entity.localId]));
    }

    /**
     * Technical management of updating a link operation of provided
     * relation of type one2many. Should never be called/overriden outside
     * of this file.
     *
     * @private
     * @param {string|mail.messaging.entity.Entity|<string|mail.messaging.entity.Entity>[]} newValue
     */
    _setRelationLinkOne2Many(newValue) {
        const prevValue = this.read();
        const value = newValue instanceof Array
            ? newValue.map(e => e.isEntity ? e.localId: e)
            : [newValue.isEntity ? newValue.localId : newValue];
        if (value.every(valueItem => prevValue.includes(valueItem))) {
            // Do not alter relations if unchanged.
            return;
        }
        this.write([...new Set(this.read().concat(value))]);
        for (const valueItem of value) {
            if (prevValue.includes(valueItem)) {
                continue;
            }
            const OtherEntity = this.env.entities[this.definition.to];
            const otherEntity = OtherEntity.get(valueItem);
            const otherField = otherEntity.__fields[this.definition.inverse];
            otherField.write(this.entity.localId);
        }
    }

    /**
     * Technical management of updating a link operation of provided
     * relation of type one2one. Should never be called/overriden outside
     * of this file.
     *
     * @private
     * @param {string|mail.messaging.entity.Entity} value
     */
    _setRelationLinkOne2One(newValue) {
        const prevValue = this.read();
        const value = newValue.isEntity ? newValue.localId : newValue;
        this.write(value);
        const OtherEntity = this.env.entities[this.definition.to];
        if (prevValue) {
            const otherEntity = OtherEntity.get(prevValue);
            const otherField = otherEntity.__fields[this.definition.inverse];
            otherField.write(undefined);
            if (this.definition.isCausal) {
                otherEntity.delete();
            }
        }
        const otherEntity = OtherEntity.get(value);
        const otherField = otherEntity.__fields[this.definition.inverse];
        otherField.write(this.entity.localId);
    }

    /**
     * Set an 'unlink' operation on this relational field.
     *
     * @private
     * @param {string|string[]|mail.messaging.entity.Entity|mail.messaging.entity.Entity[]|null} newValue
     */
    _setRelationUnlink(newValue) {
        if (!this.entity.constructor.get(this.entity)) {
            // Entity has already been deleted.
            // (e.g. unlinking one of its reverse relation was causal)
            return;
        }
        switch (this.definition.relationType) {
            case 'many2many':
                this._setRelationUnlinkMany2Many(newValue);
                break;
            case 'many2one':
                this._setRelationUnlinkMany2One();
                break;
            case 'one2many':
                this._setRelationUnlinkOne2Many(newValue);
                break;
            case 'one2one':
                this._setRelationUnlinkOne2One();
                break;
        }
    }

    /**
     * Technical management of unlink operation of provided relation of
     * type many2many. Should never be called/overriden outside of this file.
     *
     * @private
     * @param {string|mail.messaging.entity.Entity|<string|mail.messaging.entity.Entity>[]|null} newValue
     */
    _setRelationUnlinkMany2Many(newValue) {
        if (!this.entity.constructor.get(this.entity)) {
            // Entity has already been deleted.
            // (e.g. unlinking one of its reverse relation was causal)
            return;
        }
        const value = newValue === null
            ? [...this.read()]
            : newValue instanceof Array
            ? newValue.map(e => e.isEntity ? e.localId: e)
            : [newValue.isEntity ? newValue.localId : newValue];
        this.write(
            this.read().filter(
                valueItem => !value.includes(valueItem)
            )
        );
        const OtherEntity = this.env.entities[this.definition.to];
        for (const valueItem of value) {
            const otherEntity = OtherEntity.get(valueItem);
            const otherField = otherEntity.__fields[this.definition.inverse];
            otherField.write(otherField.read().filter(
                valueItem => valueItem !== this.entity.localId
            ));
            if (this.definition.isCausal) {
                otherEntity.delete();
            }
        }
    }

    /**
     * Technical management of unlink operation of provided relation of
     * type many2one. Should never be called/overriden outside of this file.
     *
     * @private
     */
    _setRelationUnlinkMany2One() {
        if (!this.entity.constructor.get(this.entity)) {
            // Entity has already been deleted.
            // (e.g. unlinking one of its reverse relation was causal)
            return;
        }
        const prevValue = this.read();
        if (prevValue) {
            const OtherEntity = this.env.entities[this.definition.to];
            const prevEntity = OtherEntity.get(prevValue);
            prevEntity.update({
                [this.definition.inverse]: [['unlink', this.entity.localId]],
            });
        }
    }

    /**
     * Technical management of unlink operation of provided relation of
     * type one2many. Should never be called/overriden outside of this file.
     *
     * @private
     * @param {string|mail.messaging.entity.Entity|<string|mail.messaging.entity.Entity>[]|null} newValue
     *   if null, unlink all items in the relation of provided entity.
     */
    _setRelationUnlinkOne2Many(newValue) {
        if (!this.entity.constructor.get(this.entity)) {
            // Entity has already been deleted.
            // (e.g. unlinking one of its reverse relation was causal)
            return;
        }
        const prevValue = this.read();
        const value = newValue === null
            ? [...this.read()]
            : newValue instanceof Array
            ? newValue.map(e => e.isEntity ? e.localId: e)
            : [newValue.isEntity ? newValue.localId : newValue];
        this.write(this.read().filter(valueItem => !value.includes(valueItem)));
        if (prevValue) {
            const OtherEntity = this.env.entities[this.definition.to];
            for (const valueItem of value) {
                const otherEntity = OtherEntity.get(valueItem);
                if (!otherEntity) {
                    // may be deleted from causality...
                    continue;
                }
                const otherField = otherEntity.__fields[this.definition.inverse];
                otherField.write(undefined);
                if (this.definition.isCausal) {
                    otherEntity.delete();
                }
            }
        }
    }

    /**
     * Technical management of unlink operation of provided relation of
     * type one2one. Should never be called/overriden outside of this file.
     *
     * @private
     */
    _setRelationUnlinkOne2One() {
        if (!this.entity.constructor.get(this.entity)) {
            // Entity has already been deleted.
            // (e.g. unlinking one of its reverse relation was causal)
            return;
        }
        const prevValue = this.read();
        this.write(undefined);
        const OtherEntity = this.env.entities[this.definition.to];
        if (prevValue) {
            const otherEntity = OtherEntity.get(prevValue);
            if (!otherEntity) {
                // Entity has already been deleted.
                // (e.g. unlinking one of its reverse relation was causal)
                return;
            }
            const otherField = otherEntity.__fields[this.definition.inverse];
            otherField.write(undefined);
        }
    }
}

return Field;

});
