# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import collections

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools import ormcache

TYPE2FIELD = {
    'char': 'value_text',
    'float': 'value_float',
    'boolean': 'value_integer',
    'integer': 'value_integer',
    'text': 'value_text',
    'binary': 'value_binary',
    'many2one': 'value_reference',
    'date': 'value_datetime',
    'datetime': 'value_datetime',
    'selection': 'value_text',
}

TYPE2CLEAN = {
    'boolean': bool,
    'integer': lambda val: val or False,
    'float': lambda val: val or False,
    'char': lambda val: val or False,
    'text': lambda val: val or False,
    'selection': lambda val: val or False,
    'binary': lambda val: val or False,
    'date': lambda val: val.date() if val else False,
    'datetime': lambda val: val or False,
}


class Property(models.AbstractModel):
    _name = 'ir.property'
    _description = 'Company Property'

    name = fields.Char(index=True)
    res_id = fields.Char(string='Resource', index=True, help="If not set, acts as a default value for new resources",)
    company_id = fields.Many2one('res.company', string='Company', index=True)
    fields_id = fields.Many2one('ir.model.fields', string='Field', ondelete='cascade', required=True, index=True)
    value_float = fields.Float()
    value_integer = fields.Integer()
    value_text = fields.Text()  # will contain (char, text)
    value_binary = fields.Binary(attachment=False)
    value_reference = fields.Char()
    value_datetime = fields.Datetime()
    type = fields.Selection([('char', 'Char'),
                             ('float', 'Float'),
                             ('boolean', 'Boolean'),
                             ('integer', 'Integer'),
                             ('text', 'Text'),
                             ('binary', 'Binary'),
                             ('many2one', 'Many2One'),
                             ('date', 'Date'),
                             ('datetime', 'DateTime'),
                             ('selection', 'Selection'),
                             ],
                            required=True,
                            default='many2one',
                            index=True)

    def _update_values(self, values):
        if 'value' not in values:
            return values
        value = values.pop('value')

        prop = None
        type_ = values.get('type')
        if not type_:
            if self:
                prop = self[0]
                type_ = prop.type
            else:
                type_ = self._fields['type'].default(self)

        field = TYPE2FIELD.get(type_)
        if not field:
            raise UserError(_('Invalid type'))

        if field == 'value_reference':
            if not value:
                value = False
            elif isinstance(value, models.BaseModel):
                value = '%s,%d' % (value._name, value.id)
            elif isinstance(value, int):
                field_id = values.get('fields_id')
                if not field_id:
                    if not prop:
                        raise ValueError()
                    field_id = prop.fields_id
                else:
                    field_id = self.env['ir.model.fields'].browse(field_id)

                value = '%s,%d' % (field_id.sudo().relation, value)

        values[field] = value
        return values

    @api.multi
    def write(self, values):
        # if any of the records we're writing on has a res_id=False *or*
        # we're writing a res_id=False on any record
        default_set = False
        if self._ids:
            self.env.cr.execute(
                'SELECT EXISTS (SELECT 1 FROM ir_property WHERE id in %s AND res_id IS NULL)', [self._ids])
            default_set = self.env.cr.rowcount == 1 or any(
                v.get('res_id') is False
                for v in values
            )
        r = super(Property, self).write(self._update_values(values))
        if default_set:
            self.clear_caches()
        return r

    @api.model_create_multi
    def create(self, vals_list):
        # fields_id -> [(record, company, value)]
        fmap = collections.defaultdict(list)
        created_default = False
        for val in vals_list:
            field = val['fields_id']
            if not isinstance(field, models.BaseModel):
                field = self.env['ir.model.fields'].browse(field)
            field = field.sudo()
            # fallback on value_* field
            field_type = val.get('type') or self.env[field.model]._fields[field.name].type

            value = val.get('value')
            if value is None:
                value = val[TYPE2FIELD[field_type]]

            if field_type == 'many2one':
                if isinstance(value, str): # <model>,<id>
                    value = int(value.split(',', 1)[1])
                elif isinstance(value, models.BaseModel):
                    value = value.id

            # FIXME: fix me
            if value is False and type != 'boolean':
                if field_type in ('integer', 'float'):
                    value = 0
                else:
                    value = None

            if val.get('res_id'):
                record_id = int(val['res_id'].split(',', 1)[1])
            else:
                record_id = None

            created_default = created_default or not record_id
            fmap[field].append((
                record_id,
                val.get('company_id') or None,
                value, value
            ))

        for field, items in fmap.items():
            Model = self.env[field.model]
            fobj = Model._fields[field.name]
            table = fobj._company_table(Model)
            self.env.cr.executemany(f"""
            INSERT INTO {table} (record_id, company_id, {fobj.name})
            VALUES (%s, %s, %s)
            ON CONFLICT (coalesce(record_id, 0), coalesce(company_id, 0))
            DO UPDATE set {fobj.name}=%s
            """, items)

        if created_default:
            self.clear_caches()

        # FIXME: return something more sensible
        return [self]*len(vals_list)

    @api.multi
    def unlink(self):
        default_deleted = False
        if self._ids:
            self.env.cr.execute(
                'SELECT EXISTS (SELECT 1 FROM ir_property WHERE id in %s)',
                [self._ids]
            )
            default_deleted = self.env.cr.rowcount == 1
        r = super().unlink()
        if default_deleted:
            self.clear_caches()
        return r

    @api.multi
    def get_by_record(self):
        self.ensure_one()
        if self.type in ('char', 'text', 'selection'):
            return self.value_text
        elif self.type == 'float':
            return self.value_float
        elif self.type == 'boolean':
            return bool(self.value_integer)
        elif self.type == 'integer':
            return self.value_integer
        elif self.type == 'binary':
            return self.value_binary
        elif self.type == 'many2one':
            if not self.value_reference:
                return False
            model, resource_id = self.value_reference.split(',')
            return self.env[model].browse(int(resource_id)).exists()
        elif self.type == 'datetime':
            return self.value_datetime
        elif self.type == 'date':
            if not self.value_datetime:
                return False
            return fields.Date.to_string(fields.Datetime.from_string(self.value_datetime))
        return False

    @api.model
    def get(self, name, model, res_id=False):
        Model = self.env[model]
        field = Model._fields[name]
        if not res_id:
            return field.convert_to_record(
                field._default_company_dependent(Model),
                self,
            )

        if isinstance(res_id, str):
            mod, id_ = res_id.split(',')
            assert mod == model, "got different model & res_model: %r, %r" % (model, mod)
            res_id = int(id_)
        assert isinstance(res_id, int)
        vs = field._compute_company_dependent_(Model.browse(res_id)).get(res_id)
        print(f"get({name} ({field}), {model}, {res_id}) -> {vs}")
        if vs:
            return field.convert_to_record(vs, self)
        return False

    # only cache Property.get(res_id=False) as that's
    # sub-optimally.
    COMPANY_KEY = "self.env.context.get('force_company') or self.env.company.id"
    @ormcache(COMPANY_KEY, 'name', 'model')
    def _get_default_property(self, name, model):
        raise NotImplementedError
        prop = self._get_property(name, model, res_id=False)
        if not prop:
            return None, False
        v = prop.get_by_record()
        if prop.type != 'many2one':
            return prop.type, v
        return 'many2one', v and (v._name, v.id)

    def _get_property(self, name, model, res_id):
        domain = self._get_domain(name, model)
        if domain is not None:
            domain = [('res_id', '=', res_id)] + domain
            #make the search with company_id asc to make sure that properties specific to a company are given first
            return self.search(domain, limit=1, order='company_id')
        return self.browse(())

    def _get_domain(self, prop_name, model):
        self._cr.execute("SELECT id FROM ir_model_fields WHERE name=%s AND model=%s", (prop_name, model))
        res = self._cr.fetchone()
        if not res:
            return None
        company_id = self._context.get('force_company') or self.env.company.id
        return [('fields_id', '=', res[0]), ('company_id', 'in', [company_id, False])]

    def _load_records(self, data_list, update=False):
        for d in data_list:
            d['xml_id'] = None
        return super()._load_records(data_list, update=update)

    @api.model
    def get_multi(self, name, model, ids):
        """ Read the property field `name` for the records of model `model` with
            the given `ids`, and return a dictionary mapping `ids` to their
            corresponding value.
        """
        if not ids:
            return {}

        Model = self.env[model]
        field = Model._fields[name]
        records = Model.browse(ids)

        env = self.env
        company = env.context.get('force_company', env.company.id)
        env.cr.execute("""
        SELECT record_id, {name}
        FROM {table}
        WHERE (record_id =any(%s) OR record_id IS NULL)
          AND (company_id = %s OR company_id IS NULL)
        ORDER BY company_id NULLS FIRST
        """.format(
            name=name,
            table=field._company_table(Model)
        ), [ids, company])
        matches = dict(env.cr.fetchall())
        default = matches.pop(None, False)

        return {
            id_: self.convert_to_cache(
                matches.get(id_, default), records, validate=False
            )
            for id_ in ids
        }


    @api.model
    def set_multi(self, name, model, values, default_value=None):
        """ Assign the property field `name` for the records of model `model`
            with `values` (dictionary mapping record ids to their value).
            If the value for a given record is the same as the default
            value, the property entry will not be stored, to avoid bloating
            the database.
            If `default_value` is provided, that value will be used instead
            of the computed default value, to determine whether the value
            for a record should be stored or not.
        """
        if not values:
            return

        env = self.env

        records = env[model].browse(values.keys())
        vals = values.values()
        field = env[model]._fields[name]

        company = env.context.get('force_company', env.company.id)
        values = (
            (record.id, field.convert_to_column(
                field.convert_to_write(value, record),
                record,
                validate=False
            ))
            for record, value in zip(records, vals)
        )
        env.cr.executemany("""
        INSERT INTO {table} (record_id, company_id, {name})
        VALUES (%s, %s, %s)
        ON CONFLICT (coalesce(record_id, 0), coalesce(company_id, 0))
        DO UPDATE SET {name}=%s
        """.format(table=field._company_table(records), name=field.name),
            [(id_, company, value, value) for id_, value in values]
        )

        self.invalidate_cache()
        self.clear_caches()
        # also clear caches? IDK

    @api.model
    def search_multi(self, name, model, operator, value):
        """ Return a domain for the records that match the given condition. """
        raise NotImplementedError(f"search_multi(name={name}, model={model}, operator={operator}, value={value})")
        default_matches = False
        include_zero = False

        field = self.env[model]._fields[name]
        if field.type == 'many2one':
            comodel = field.comodel_name
            def makeref(value):
                return value and '%s,%s' % (comodel, value)
            if operator == "=":
                value = makeref(value)
                # if searching properties not set, search those not in those set
                if value is False:
                    default_matches = True
            elif operator in ('!=', '<=', '<', '>', '>='):
                value = makeref(value)
            elif operator in ('in', 'not in'):
                value = [makeref(v) for v in value]
            elif operator in ('=like', '=ilike', 'like', 'not like', 'ilike', 'not ilike'):
                # most probably inefficient... but correct
                target = self.env[comodel]
                target_names = target.name_search(value, operator=operator, limit=None)
                target_ids = [n[0] for n in target_names]
                operator, value = 'in', [makeref(v) for v in target_ids]
        elif field.type in ('integer', 'float'):
            # No record is created in ir.property if the field's type is float or integer with a value
            # equal to 0. Then to match with the records that are linked to a property field equal to 0,
            # the negation of the operator must be taken  to compute the goods and the domain returned
            # to match the searched records is just the opposite.
            if value == 0 and operator == '=':
                operator = '!='
                include_zero = True
            elif value <= 0 and operator == '>=':
                operator = '<'
                include_zero = True
            elif value < 0 and operator == '>':
                operator = '<='
                include_zero = True
            elif value >= 0 and operator == '<=':
                operator = '>'
                include_zero = True
            elif value > 0 and operator == '<':
                operator = '>='
                include_zero = True


        # retrieve the properties that match the condition
        domain = self._get_domain(name, model)
        if domain is None:
            raise Exception()
        props = self.search(domain + [(TYPE2FIELD[field.type], operator, value)])

        # retrieve the records corresponding to the properties that match
        good_ids = []
        for prop in props:
            if prop.res_id:
                res_model, res_id = prop.res_id.split(',')
                good_ids.append(int(res_id))
            else:
                default_matches = True

        if include_zero:
            return [('id', 'not in', good_ids)]
        elif default_matches:
            # exclude all records with a property that does not match
            all_ids = []
            props = self.search(domain + [('res_id', '!=', False)])
            for prop in props:
                res_model, res_id = prop.res_id.split(',')
                all_ids.append(int(res_id))
            bad_ids = list(set(all_ids) - set(good_ids))
            return [('id', 'not in', bad_ids)]
        else:
            return [('id', 'in', good_ids)]
