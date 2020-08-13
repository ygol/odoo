{
    'name': 'Two-Factor Authentication (TOTP): HR profile hook',
    'depends': ['auth_totp', 'hr'],
    'category': 'Hidden',
    'auto_install': True,
    'data': [
        'views/user_profile.xml',
    ],
}
