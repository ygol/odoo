# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import datetime
import itertools
import json
import logging
import re
import traceback
import threading
import odoo
import odoo.exceptions
from odoo import models, fields, api
from odoo.http import serialize_exception

_logger = logging.getLogger(__name__)
BASE_VERSION = odoo.modules.load_information_from_description_file('base')['version']


class IrAsync(models.Model):
    _name = 'ir.async'
    _description = 'Asynchrone jobs'

    name = fields.Char(default="Unamed background task")
    state = fields.Selection([
        ('created', 'Created'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('done', 'Done'),
    ])
    res_model = fields.Char()
    res_ids = fields.Text()
    method = fields.Char()
    args = fields.Text()
    kwargs = fields.Text()
    user_id = fields.Many2one('res.users', string='Scheduler User', ondelete='cascade')
    context = fields.Text()
    super_user = fields.Boolean()
    traceback = fields.Text()
    payload = fields.Text(default=False)

    def call(self, target, args=None, kwargs=None):
        """
        Thread/Process-like API to create asynchronous jobs.

        Ensure the method is called in an independant worker using a
        copy of the current environnement (user, context, recordset).

        The job return value is stored has JSON in the payload field,
        web-notification are possible via bus/models/ir_async:IrAsync.call
        """
        recs = getattr(target, '__self__', None)
        if recs is None or not isinstance(recs, models.BaseModel):
            raise TypeError("You can only create an async task on a recordset")
        model = recs.__class__

        job = self.sudo().create({
            'state': 'created',
            'res_model': model._name,
            'res_ids': json.dumps(recs._ids),
            'method': target.__name__,
            'args': json.dumps(args or []),
            'kwargs': json.dumps(kwargs or {}),
            'user_id': int(recs.env.uid),
            'context': json.dumps(recs.env.context),
            'super_user': recs.env.su,
            'traceback': self._merge_traceback(traceback.format_stack()[:-1]),
        })

        self._cr.after("commit", self._notifydb)

        return job

    def _notifydb(self):
        """ Notify the workers a job has been enqueued """
        with odoo.sql_db.db_connect('postgres').cursor() as cr:
            cr.execute('NOTIFY odoo_async, %s', (self.env.cr.dbname,))
        _logger.debug("Async task commited. Workers notified.")

    @classmethod
    def _process_jobs(cls, dbname):
        """ Process all jobs of the selected database """
        db = odoo.sql_db.db_connect(dbname)
        threading.current_thread().dbname = dbname

        # make sure we can process this db
        with db.cursor() as cr:
            cr.execute("""
                SELECT latest_version
                FROM ir_module_module
                WHERE name=%s""", ('base',))
            (version,) = cr.fetchone()
            if version is None:
                _logger.warning(
                    "Skipping database %s because of modules to "
                    "install/upgrade/remove.", dbname)
                return
            if version != BASE_VERSION:
                _logger.warning(
                    "Skipping database %s as its base version is not %s.",
                    dbname, BASE_VERSION)
                return

        # process all jobs enqueued in this db
        while True:
            with db.cursor() as manager_cr:

                # acquire job
                manager_cr.execute("""
                    SELECT *
                    FROM ir_async
                    WHERE state = 'created'
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """)
                job = manager_cr.dictfetchone()
                if job is None:
                    break

                # process job
                with api.Environment.manage():
                    with db.cursor() as job_cr:
                        cls._process_job(job_cr, job)

                # update job
                manager_cr.execute("""
                    UPDATE ir_async
                    SET state=%s,
                        payload=%s,
                        write_date=%s
                    WHERE ID = %s""", (
                        job['state'],
                        json.dumps(job['payload']),
                        datetime.datetime.utcnow(),
                        job['id'],
                    ))

    @staticmethod
    def _process_job(job_cr, job):
        """
        Process one job, restore environment and recordset then safely
        call the desired model method.
        """
        for json_field in ('res_ids', 'args', 'kwargs', 'context'):
            job[json_field] = json.loads(job[json_field])
        job['context']['async_traceback'] = job['traceback']
        job['context']['async_job_id'] = job['id']
        env = api.Environment(job_cr, job['user_id'], job['context'], job['super_user'])
        ir_async = env['ir.async']

        ir_async._pre_process(job)

        try:
            _logger.info('Calling "%s" on "%s"', job['method'], job['res_model'])
            records = env[job['res_model']].browse(job['res_ids'])
            result = getattr(records, job['method'])(*job['args'], **job['kwargs'])
            json.dumps(result)  # ensure result is serializable
            records.flush()
        except Exception as exc:
            job['state'] = 'failed'
            job['payload'] = ir_async._handle_exception(exc)
        else:
            _logger.debug("Done, result is %s", result)
            if result is None:
                job['state'] = 'done'
            else:
                job['state'] = 'succeeded'
                job['payload'] = ir_async._json_response(result)

        ir_async._post_process(job)

    def _pre_process(self, job):
        pass

    def _post_process(self, job):
        pass

    def _merge_traceback(self, tb):
        """ Merge the given traceback with all previous level of execution """
        old_tb = self.env.context.get('async_traceback', '').splitlines(keepends=True)
        if old_tb:
            def fnc_process_job_not_reached(line):
                return not re.search(f'in {self._process_job.__name__}\\W', line)
            old_tb.append("Traceback of async job (most recent call last):\n")
            old_tb.extend(itertools.dropwhile(fnc_process_job_not_reached, tb))
            tb = old_tb
        return "".join(tb)

    def _handle_exception(self, exception):
        header, *tb = traceback.format_exc().splitlines(keepends=True)
        exc_tb = header + self._merge_traceback(tb)

        if isinstance(exception, odoo.exceptions.UserError):
            _logger.warning(exception)
        else:
            _logger.error("Failed to process async job\n%s", exc_tb)

        error = {
            'code': 200,
            'message': "Odoo Server Error",
            'data': serialize_exception(exception),
        }
        error['data']['debug'] = exc_tb
        return self._json_response(error=error)

    def _json_response(self, result=None, error=None):
        response = {}
        if result is not None:
            response['result'] = result
        if error is not None:
            response['error'] = error
        return response

    @api.autovacuum
    def _vacuum_terminated_tasks(self):
        self._cr.execute("""
            SELECT id
            FROM ir_async
            WHERE state in ('failed', 'done')
               OR (state = 'succeeded'
                   AND write_date + interval '3 day' < LOCALTIMESTAMP)
            FOR UPDATE SKIP LOCKED
            """)
        ids = tuple(self._cr.fetchall())
        if ids:
            self._cr.execute("""
                DELETE FROM ir_async
                WHERE id in %s
                """, (ids,))
        _logger.info("Vacuumed %d terminated asynchronous tasks", len(ids))

    def complete(self):
        self._cr.execute("""
            UPDATE ir_async
            SET state='done',
                write_date=%s
            WHERE id in %s
                  and user_id = %s
            """, (
                datetime.datetime.utcnow(),
                tuple(self.ids),
                self.env.uid,
            ))
