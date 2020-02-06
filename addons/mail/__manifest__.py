# -*- coding: utf-8 -*-

{
    'name': 'Discuss',
    'version': '1.0',
    'category': 'Discuss',
    'summary': 'Chat, mail gateway and private channels',
    'description': "",
    'website': 'https://www.odoo.com/page/discuss',
    'depends': ['base', 'base_setup', 'bus', 'web_tour'],
    'data': [
        'views/mail_menus.xml',
        'wizard/invite_view.xml',
        'wizard/mail_compose_message_view.xml',
        'wizard/mail_resend_cancel_views.xml',
        'wizard/mail_resend_message_views.xml',
        'wizard/mail_template_preview_views.xml',
        'views/mail_message_subtype_views.xml',
        'views/mail_tracking_views.xml',
        'views/mail_notification_views.xml',
        'views/mail_message_views.xml',
        'views/mail_mail_views.xml',
        'views/mail_followers_views.xml',
        'views/mail_moderation_views.xml',
        'views/mail_channel_views.xml',
        'views/mail_shortcode_views.xml',
        'views/mail_activity_views.xml',
        'views/res_config_settings_views.xml',
        'data/mail_data.xml',
        'data/mail_channel_data.xml',
        'data/mail_activity_data.xml',
        'data/ir_cron_data.xml',
        'security/mail_security.xml',
        'security/ir.model.access.csv',
        'views/mail_alias_views.xml',
        'views/res_users_views.xml',
        'views/mail_templates.xml',
        'views/mail_template_views.xml',
        'views/ir_actions_views.xml',
        'views/ir_model_views.xml',
        'views/res_partner_views.xml',
        'views/mail_blacklist_views.xml',
        'views/mail_channel_partner_views.xml',
    ],
    'demo': [
        'data/mail_channel_demo.xml',
    ],
    'installable': True,
    'application': True,
    'qweb': [
        'static/src/xml/activity.xml',
        'static/src/xml/activity_view.xml',
        'static/src/xml/composer.xml',
        'static/src/xml/chatter.xml',
        'static/src/xml/discuss.xml',
        'static/src/xml/followers.xml',
        'static/src/xml/systray.xml',
        'static/src/xml/out_of_office.xml',
        'static/src/xml/thread.xml',
        'static/src/xml/abstract_thread_window.xml',
        'static/src/xml/thread_window.xml',
        'static/src/xml/web_kanban_activity.xml',
        'static/src/xml/text_emojis.xml',

        'static/src/owl/components/attachment/attachment.xml',
        'static/src/owl/components/attachment_box/attachment_box.xml',
        'static/src/owl/components/attachment_list/attachment_list.xml',
        'static/src/owl/components/attachment_viewer/attachment_viewer.xml',
        'static/src/owl/components/autocomplete_input/autocomplete_input.xml',
        'static/src/owl/components/chatter/chatter.xml',
        'static/src/owl/components/chatter_topbar/chatter_topbar.xml',
        'static/src/owl/components/chat_window/chat_window.xml',
        'static/src/owl/components/chat_window_header/chat_window_header.xml',
        'static/src/owl/components/chat_window_hidden_menu/chat_window_hidden_menu.xml',
        'static/src/owl/components/chat_window_manager/chat_window_manager.xml',
        'static/src/owl/components/composer/composer.xml',
        'static/src/owl/components/composer_text_input/composer_text_input.xml',
        'static/src/owl/components/dialog/dialog.xml',
        'static/src/owl/components/dialog_manager/dialog_manager.xml',
        'static/src/owl/components/discuss/discuss.xml',
        'static/src/owl/components/discuss_mobile_mailbox_selection/discuss_mobile_mailbox_selection.xml',
        'static/src/owl/components/discuss_sidebar/discuss_sidebar.xml',
        'static/src/owl/components/discuss_sidebar_item/discuss_sidebar_item.xml',
        'static/src/owl/components/drop_zone/drop_zone.xml',
        'static/src/owl/components/editable_text/editable_text.xml',
        'static/src/owl/components/emojis_button/emojis_button.xml',
        'static/src/owl/components/emojis_popover/emojis_popover.xml',
        'static/src/owl/components/file_uploader/file_uploader.xml',
        'static/src/owl/components/message/message.xml',
        'static/src/owl/components/message_author_prefix/message_author_prefix.xml',
        'static/src/owl/components/message_list/message_list.xml',
        'static/src/owl/components/messaging_menu/messaging_menu.xml',
        'static/src/owl/components/mobile_messaging_navbar/mobile_messaging_navbar.xml',
        'static/src/owl/components/partner_im_status_icon/partner_im_status_icon.xml',
        'static/src/owl/components/thread/thread.xml',
        'static/src/owl/components/thread_icon/thread_icon.xml',
        'static/src/owl/components/thread_preview/thread_preview.xml',
        'static/src/owl/components/thread_preview_list/thread_preview_list.xml',
        'static/src/owl/widgets/common.xml',
        'static/src/owl/widgets/discuss.xml',
        'static/src/owl/widgets/discuss_invite_partner_dialog.xml',
        'static/src/owl/widgets/messaging_menu.xml',
    ],
}
