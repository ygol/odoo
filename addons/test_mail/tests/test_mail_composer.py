# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from unittest.mock import patch

from odoo.addons.test_mail.tests.common import BaseFunctionalTest, MockEmails, TestRecipients
from odoo.addons.test_mail.tests.common import mail_new_test_user
from odoo.addons.test_mail.models.test_mail_models import MailTestSimple
from odoo.tests import tagged
from odoo.tests.common import users
from odoo.tools import mute_logger


@tagged('mail_composer')
class TestComposerInternals(BaseFunctionalTest, MockEmails, TestRecipients):

    @classmethod
    def setUpClass(cls):
        super(TestComposerInternals, cls).setUpClass()
        cls._init_mail_gateway()

        cls.user_employee_2 = mail_new_test_user(
            cls.env, login='employee2', groups='base.group_user',
            notification_type='inbox', email='eglantine@example.com',
            name='Eglantine Employee', signature='--\nEglantine')
        cls.partner_employee_2 = cls.user_employee_2.partner_id

        cls.test_record = cls.env['mail.test.full'].with_context(cls._test_context).create({
            'name': 'TestRecord',
            'customer_id': cls.partner_1.id,
            'user_id': cls.user_employee_2.id,
        })
        cls.test_report = cls.env['ir.actions.report'].create({
            'name': 'Test Report on mail test full',
            'model': 'mail.test.full',
            'report_type': 'qweb-pdf',
            'report_name': 'test_mail.mail_test_full_test_template',
        })

        cls.test_from = '"John Doe" <john@example.com>'

        cls.mail_server = cls.env['ir.mail_server'].create({
            'name': 'Dummy Test Server',
            'smtp_host': 'smtp.pizza.moc',
            'smtp_port': 17,
            'smtp_encryption': 'ssl',
            'sequence': 666,
        })

        cls.template = cls._create_template('mail.test.full', {
            'email_from': '${object.user_id.email_formatted | safe}',
            'mail_server_id': cls.mail_server.id,
        })

    def _generate_attachments_data(self, count):
        return [{
            'name': '%02d.txt' % x,
            'datas': base64.b64encode(b'Att%02d' % x),
        } for x in range(count)]

    @users('employee')
    @mute_logger('odoo.addons.mail.models.mail_mail')
    def test_mail_composer_attachments_comment(self):
        attachment_data = self._generate_attachments_data(3)
        self.template.write({
            'attachment_ids': [(0, 0, a) for a in attachment_data],
            'report_template': self.test_report.id,
        })
        attachs = self.env['ir.attachment'].search([('name', 'in', [a['name'] for a in attachment_data])])
        self.assertEqual(len(attachs), 3)

        composer = self.env['mail.compose.message'].with_context({
            'default_composition_mode': 'comment',
            'default_model': self.test_record._name,
            'default_res_id': self.test_record.id,
            'default_template_id': self.template.id,
        }).create({
            'body': '<p>Test Body</p>',
        })
        # fixme: currently onchange necessary
        composer.onchange_template_id_wrapper()

        # values coming from template
        self.assertEqual(len(composer.attachment_ids), 4)
        for attach in attachs:
            self.assertIn(attach, composer.attachment_ids)
        generated = composer.attachment_ids - attachs
        self.assertEqual(generated.res_model, 'mail.compose.message')
        self.assertEqual(generated.res_id, 0)

    @users('employee')
    @mute_logger('odoo.addons.mail.models.mail_mail')
    def test_mail_composer_author_comment(self):
        composer = self.env['mail.compose.message'].with_context({
            'default_composition_mode': 'comment',
            'default_model': self.test_record._name,
            'default_res_id': self.test_record.id,
        }).create({
            'body': '<p>Test Body</p>',
        })

        # default values are current user
        self.assertEqual(composer.author_id, self.env.user.partner_id)
        self.assertEqual(composer.email_from, self.env.user.email_formatted)

        # author values reset email
        composer.write({'author_id': self.partner_1})
        self.assertEqual(composer.author_id, self.partner_1)
        self.assertEqual(composer.email_from, self.partner_1.email_formatted)

        # changing template should update its email_from
        composer.write({'template_id': self.template.id, 'author_id': self.env.user.partner_id})
        self.assertEqual(composer.author_id, self.env.user.partner_id)
        self.assertEqual(composer.email_from, self.test_record.user_id.email_formatted)

        # manual values is kept over template
        composer.write({'email_from': self.test_from})
        self.assertEqual(composer.author_id, self.env.user.partner_id)
        self.assertEqual(composer.email_from, self.test_from)

    @users('employee')
    @mute_logger('odoo.addons.mail.models.mail_mail')
    def test_mail_composer_author_mass(self):
        composer = self.env['mail.compose.message'].with_context({
            'default_composition_mode': 'mass_mail',
            'default_model': self.test_record._name,
        }).create({
            'body': '<p>Test Body</p>',
        })

        # default values are current user
        self.assertEqual(composer.author_id, self.env.user.partner_id)
        self.assertEqual(composer.email_from, self.env.user.email_formatted)

        # author values reset email
        composer.write({'author_id': self.partner_1})
        self.assertEqual(composer.author_id, self.partner_1)
        self.assertEqual(composer.email_from, self.partner_1.email_formatted)

        # changing template should update its email_from
        composer.write({'template_id': self.template.id, 'author_id': self.env.user.partner_id})
        self.assertEqual(composer.author_id, self.env.user.partner_id)
        self.assertEqual(composer.email_from, self.template.email_from)

        # manual values is kept over template
        composer.write({'email_from': self.test_from})
        self.assertEqual(composer.author_id, self.env.user.partner_id)
        self.assertEqual(composer.email_from, self.test_from)

    @users('employee')
    def test_mail_composer_content_comment(self):
        composer = self.env['mail.compose.message'].with_context({
            'default_composition_mode': 'comment',
            'default_model': self.test_record._name,
            'default_res_id': self.test_record.id,
        }).create({
            'subject': 'My amazing subject',
            'body': '<p>Test Body</p>',
        })

        # creation values are taken
        self.assertEqual(composer.subject, 'My amazing subject')
        self.assertEqual(composer.body, '<p>Test Body</p>')
        self.assertEqual(composer.mail_server_id.id, False)

        # changing template should update its content
        composer.write({'template_id': self.template.id})
        # fixme: currently onchange necessary
        composer.onchange_template_id_wrapper()
        self.assertEqual(composer.subject, 'About %s' % self.test_record.name)
        self.assertEqual(composer.body, '<p>Hello %s</p>' % self.test_record.name)
        self.assertEqual(composer.mail_server_id, self.template.mail_server_id)

        # manual values is kept over template
        composer.write({'subject': 'Back to my amazing subject'})
        self.assertEqual(composer.subject, 'Back to my amazing subject')

    @users('employee')
    def test_mail_composer_content_mass(self):
        composer = self.env['mail.compose.message'].with_context({
            'default_composition_mode': 'mass_mail',
            'default_model': self.test_record._name,
        }).create({
            'subject': 'My amazing subject',
            'body': '<p>Test Body</p>',
            'mail_server_id': False,
            'template_id': self.template.id,
        })

        # creation values are taken
        self.assertEqual(composer.subject, 'My amazing subject')
        self.assertEqual(composer.body, '<p>Test Body</p>')
        self.assertEqual(composer.mail_server_id.id, False)

        # erasing template should erase its content
        composer.write({'template_id': False})
        # fixme: currently onchange necessary
        composer.onchange_template_id_wrapper()
        self.assertEqual(composer.subject, 'My amazing subject')
        # self.assertEqual(composer.body, '<p>Test Body</p>')
        self.assertEqual(composer.body, '')
        self.assertEqual(composer.mail_server_id.id, False)

        # changing template should update its content
        composer.write({'template_id': self.template.id})
        # fixme: currently onchange necessary
        composer.onchange_template_id_wrapper()
        self.assertEqual(composer.subject, self.template.subject)
        self.assertEqual(composer.body, self.template.body_html)
        self.assertEqual(composer.mail_server_id, self.template.mail_server_id)

        # manual values is kept over template
        composer.write({'subject': 'Back to my amazing subject'})
        self.assertEqual(composer.subject, 'Back to my amazing subject')

    @users('employee')
    def test_mail_composer_content_w_template(self):
        composer = self.env['mail.compose.message'].with_context({
            'default_composition_mode': 'comment',
            'default_model': self.test_record._name,
            'default_res_id': self.test_record.id,
        }).create({
            'template_id': self.template.id,
        })

        # creation values from from template
        composer.write({'template_id': self.template.id})
        # fixme: currently onchange necessary
        composer.onchange_template_id_wrapper()
        self.assertEqual(composer.subject, 'About %s' % self.test_record.name)
        self.assertEqual(composer.body, '<p>Hello %s</p>' % self.test_record.name)
        self.assertEqual(composer.mail_server_id, self.template.mail_server_id)

    @users('employee')
    @mute_logger('odoo.addons.mail.models.mail_mail')
    def test_mail_composer_subject(self):
        composer = self.env['mail.compose.message'].with_context({
            'default_composition_mode': 'comment',
            'default_model': self.test_record._name,
            'default_res_id': self.test_record.id,
        }).create({})
        msg = self.test_record.message_post(subject='Posted manually')
        self.assertEqual(msg.subject, 'Posted manually')

        # default values come from record
        self.assertEqual(composer.record_name, self.test_record.name)
        self.assertEqual(composer.subject, 'Re: %s' % self.test_record.name)

        # reset values
        composer.write({'subject': False})
        self.assertFalse(composer.subject)

        # set parent
        composer.write({'parent_id': msg.id})
        # self.assertEqual(composer.subject, 'Re: %s' % msg.subject)
        self.assertEqual(composer.subject, False)
