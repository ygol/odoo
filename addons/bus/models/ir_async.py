# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
from odoo import models, fields

_logger = logging.getLogger(__name__)


class IrAsync(models.Model):
    _inherit = "ir.async"

    notify = fields.Boolean(default=False)

    def call(self, target, args=None, kwargs=None, description=False, **call_kwargs):
        """
        Thread/Process-like API to create asynchronous jobs with
        optional notifications throught the longpolling bus.

        Ensure the method is called in an independant worker using a
        copy of the current environnement (user, context, recordset).

        The notifications are:

        - created, the task has been enqueued
        - processing, the worker begins to process the task
        - succeeded, the task succeeded with a result the user must process
        - failed, when the task failed with an error
        - done, the task succeeded without result or the user processed it

        See the `async_job` javascript service.

        To enable web notifications, give the ``description`` param
        a job description. This description is reused in the job list
        systay client-side.
        """
        job = super().call(target, args, kwargs, **call_kwargs)

        if description:
            job.name = description
            job.notify = True

            channel = (self._cr.dbname, 'res.partner', self.env.user.partner_id.id)
            self.env['bus.bus'].sendone(channel, {
                'type': 'ir.async',
                'id': job.id,
                'name': job.name,
                'state': job.state,
            })

        return job

    def _pre_process(self, job):
        """ Notify the user a task is processing """
        super()._pre_process(job)
        if job['notify']:
            channel = (self._cr.dbname, 'res.partner', self.env.user.partner_id.id)
            self.env['bus.bus'].sendone(channel, {
                'type': 'ir.async',
                'id': job['id'],
                'name': job['name'],
                'state': 'processing',
            })
            self._cr.commit()

    def _post_process(self, job):
        """ Notify the user a task is completed on the server side """
        super()._post_process(job)
        if job['notify']:
            channel = (self._cr.dbname, 'res.partner', self.env.user.partner_id.id)
            self.env['bus.bus'].sendone(channel, {
                'type': 'ir.async',
                'id': job['id'],
                'name': job['name'],
                'state': job['state'],
                'payload': job['payload'],
            })

    def complete(self):
        """ Notify the user a task is completed on the client side """
        super().complete()
        for job in self:
            channel = (self._cr.dbname, 'res.partner', self.env.user.partner_id.id)
            self.env['bus.bus'].sendone(channel, {
                'type': 'ir.async',
                'id': job.id,
                'name': job.name,
                'state': 'done',
            })
