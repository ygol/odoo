# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import json
import jinja2
import subprocess
import socket
import sys
import netifaces
import odoo
from odoo import http
import os
from odoo.tools import misc
from pathlib import Path
import threading

from odoo.addons.hw_proxy.controllers import main as hw_proxy
from odoo.addons.web.controllers import main as web
from odoo.modules.module import get_resource_path
from odoo.addons.hw_drivers.tools import helpers
from odoo.addons.hw_drivers.controllers.driver import iot_devices
from odoo.http import Response

_logger = logging.getLogger(__name__)


#----------------------------------------------------------
# Controllers
#----------------------------------------------------------

if hasattr(sys, 'frozen'):
    # When running on compiled windows binary, we don't have access to package loader.
    path = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', 'views'))
    loader = jinja2.FileSystemLoader(path)
else:
    loader = jinja2.PackageLoader('odoo.addons.hw_posbox_homepage', "views")

jinja_env = jinja2.Environment(loader=loader, autoescape=True)
jinja_env.filters["json"] = json.dumps

homepage_template = jinja_env.get_template('homepage.html')
server_config_template = jinja_env.get_template('server_config.html')
wifi_config_template = jinja_env.get_template('wifi_config.html')
handler_list_template = jinja_env.get_template('handler_list.html')
remote_connect_template = jinja_env.get_template('remote_connect.html')
configure_wizard_template = jinja_env.get_template('configure_wizard.html')
six_payment_terminal_template = jinja_env.get_template('six_payment_terminal.html')
list_credential_template = jinja_env.get_template('list_credential.html')
upgrade_page_template = jinja_env.get_template('upgrade_page.html')

class IoTboxHomepage(web.Home):
    def __init__(self):
        super(IoTboxHomepage,self).__init__()
        self.updating = threading.Lock()

    def clean_partition(self):
        subprocess.check_call(['sudo', 'bash', '-c', '. /home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/upgrade.sh; cleanup'])

    def get_six_terminal(self):
        return helpers.read_iot_config('iot_box_driver').get('six_terminal_id', 'Not Configured')

    def get_homepage_data(self):
        hostname = str(socket.gethostname())
        ssid = helpers.get_ssid()
        wired = subprocess.check_output(['cat', '/sys/class/net/eth0/operstate']).decode('utf-8').strip('\n')
        if wired == 'up':
            network = 'Ethernet'
        elif ssid:
            if helpers.access_point():
                network = 'Wifi access point'
            else:
                network = 'Wifi : ' + ssid
        else:
            network = 'Not Connected'

        iot_device = []
        for device in iot_devices:
            iot_device.append({
                'name': iot_devices[device].device_name + ' : ' + str(iot_devices[device].data['value']),
                'type': iot_devices[device].device_type.replace('_', ' '),
                'message': iot_devices[device].device_identifier + iot_devices[device].get_message()
            })

        return {
            'hostname': hostname,
            'ip': helpers.get_ip(),
            'mac': helpers.get_mac_address(),
            'iot_device_status': iot_device,
            'server_status': helpers.get_odoo_server_url() or 'Not Configured',
            'six_terminal': self.get_six_terminal(),
            'network_status': network,
            'version': helpers.get_version(),
            }

    @http.route('/', type='http', auth='none')
    def index(self):
        wifi = helpers.read_iot_config('iot_box_network').get('ssid', False)
        remote_server = helpers.read_iot_config('iot_box_config').get('url_odoo_server', False)
        if ( not wifi or not remote_server ) and helpers.access_point():
            return "<meta http-equiv='refresh' content='0; url=http://" + helpers.get_ip() + ":8069/steps'>"
        else:
            return homepage_template.render(self.get_homepage_data())

    @http.route('/list_handlers', type='http', auth='none', website=True)
    def list_handlers(self):
        drivers_list = []
        for driver in os.listdir(get_resource_path('hw_drivers', 'iot_handlers/drivers')):
            if driver != '__pycache__':
                drivers_list.append(driver)
        interfaces_list = []
        for interface in os.listdir(get_resource_path('hw_drivers', 'iot_handlers/interfaces')):
            if interface != '__pycache__':
                interfaces_list.append(interface)
        return handler_list_template.render({
            'title': "Odoo's IoT Box - Handlers list",
            'breadcrumb': 'Handlers list',
            'drivers_list': drivers_list,
            'interfaces_list': interfaces_list,
            'server': helpers.get_odoo_server_url()
        })

    @http.route('/load_iot_handlers', type='http', auth='none', website=True)
    def load_iot_handlers(self):
        helpers.download_iot_handlers(False)
        subprocess.check_call(["sudo", "service", "odoo", "restart"])
        return "<meta http-equiv='refresh' content='20; url=http://" + helpers.get_ip() + ":8069/list_handlers'>"

    @http.route('/list_credential', type='http', auth='none', website=True)
    def list_credential(self):
        return list_credential_template.render({
            'title': "Odoo's IoT Box - List credential",
            'breadcrumb': 'List credential',
            'db_uuid': helpers.read_iot_config('iot_box_config').get('db_uuid', None),
            'enterprise_code': helpers.read_iot_config('iot_box_config').get('enterprise_code', None)
        })

    @http.route('/save_credential', type='http', auth='none', cors='*', csrf=False)
    def save_credential(self, db_uuid, enterprise_code):
        helpers.add_cert_config({'db_uuid': db_uuid, 'enterprise_code': enterprise_code})
        subprocess.check_call(["sudo", "service", "odoo", "restart"])
        return "<meta http-equiv='refresh' content='20; url=http://" + helpers.get_ip() + ":8069'>"

    @http.route('/clear_credential', type='http', auth='none', cors='*', csrf=False)
    def clear_credential(self):
        helpers.delete_iot_config('iot_box_config', 'db_uuid')
        helpers.delete_iot_config('iot_box_config', 'enterprise_code')
        subprocess.check_call(["sudo", "service", "odoo", "restart"])
        return "<meta http-equiv='refresh' content='20; url=http://" + helpers.get_ip() + ":8069'>"

    @http.route('/wifi', type='http', auth='none', website=True)
    def wifi(self):
        return wifi_config_template.render({
            'title': 'Wifi configuration',
            'breadcrumb': 'Configure Wifi',
            'loading_message': 'Connecting to Wifi',
            'ssid': helpers.get_wifi_essid(),
        })

    @http.route('/wifi_connect', type='http', auth='none', cors='*', csrf=False)
    def connect_to_wifi(self, essid, password):
        credential = {'ssid': essid, 'password': password}
        helpers.add_wifi_config(credential)

        subprocess.check_call([get_resource_path('point_of_sale', 'tools/posbox/configuration/connect_to_wifi.sh'), essid, password])
        server = helpers.get_odoo_server_url()
        res_payload = {
            'message': 'Connecting to ' + essid,
        }
        if server:
            res_payload['server'] = {
                'url': server,
                'message': 'Redirect to Odoo Server'
            }
        else:
            res_payload['server'] = {
                'url': 'http://' + helpers.get_ip() + ':8069',
                'message': 'Redirect to IoT Box'
            }

        return json.dumps(res_payload)

    @http.route('/wifi_clear', type='http', auth='none', cors='*', csrf=False)
    def clear_wifi_configuration(self):
        helpers.delete_iot_config('iot_box_network', 'ssid')
        helpers.delete_iot_config('iot_box_network', 'password')
        return "<meta http-equiv='refresh' content='0; url=http://" + helpers.get_ip() + ":8069'>"

    @http.route('/server_clear', type='http', auth='none', cors='*', csrf=False)
    def clear_server_configuration(self):
        helpers.delete_iot_config('iot_box_config', 'url_odoo_server')
        return "<meta http-equiv='refresh' content='0; url=http://" + helpers.get_ip() + ":8069'>"

    @http.route('/handlers_clear', type='http', auth='none', cors='*', csrf=False)
    def clear_handlers_list(self):
        helpers.delete_iot_handlers()
        return "<meta http-equiv='refresh' content='0; url=http://" + helpers.get_ip() + ":8069/list_handlers'>"

    @http.route('/server_connect', type='http', auth='none', cors='*', csrf=False)
    def connect_to_server(self, token, iotname):
        if token:
            credential = token.split('|')
            helpers.add_server_config(credential)
        subprocess.check_call([get_resource_path('point_of_sale', 'tools/posbox/configuration/change_hostname.sh'), iotname])
        return 'http://' + helpers.get_ip() + ':8069'

    @http.route('/steps', type='http', auth='none', cors='*', csrf=False)
    def step_by_step_configure_page(self):
        return configure_wizard_template.render({
            'title': 'Configure IoT Box',
            'breadcrumb': 'Configure IoT Box',
            'loading_message': 'Configuring your IoT Box',
            'ssid': helpers.get_wifi_essid(),
            'server': helpers.get_odoo_server_url() or '',
            'hostname': subprocess.check_output('hostname').decode('utf-8').strip('\n'),
        })

    @http.route('/step_configure', type='http', auth='none', cors='*', csrf=False)
    def step_by_step_configure(self, token, iotname, essid, password):
        if token:
            credential = token.split('|')
            helpers.add_server_config(credential)
        else:
            credential[0] = ''
        
        credential = {'ssid': essid, 'password': password}
        helpers.add_wifi_config(credential)
        subprocess.check_call([get_resource_path('point_of_sale', 'tools/posbox/configuration/connect_to_wifi.sh'), essid, password])
        subprocess.check_call([get_resource_path('point_of_sale', 'tools/posbox/configuration/change_hostname.sh'), iotname])
        return credential[0]

    # Set server address
    @http.route('/server', type='http', auth='none', website=True)
    def server(self):
        return server_config_template.render({
            'title': 'IoT -> Odoo server configuration',
            'breadcrumb': 'Configure Odoo Server',
            'hostname': subprocess.check_output('hostname').decode('utf-8').strip('\n'),
            'server_status': helpers.get_odoo_server_url() or 'Not configured yet',
            'loading_message': 'Configure Domain Server'
        })

    @http.route('/remote_connect', type='http', auth='none', cors='*')
    def remote_connect(self):
        """
        Establish a link with a customer box trough internet with a ssh tunnel
        1 - take a new auth_token on https://dashboard.ngrok.com/
        2 - copy past this auth_token on the IoT Box : http://IoT_Box:8069/remote_connect
        3 - check on ngrok the port and url to get access to the box
        4 - you can connect to the box with this command : ssh -p port -v pi@url
        """
        return remote_connect_template.render({
            'title': 'Remote debugging',
            'breadcrumb': 'Remote Debugging',
        })

    @http.route('/enable_ngrok', type='http', auth='none', cors='*', csrf=False)
    def enable_ngrok(self, auth_token):
        if subprocess.call(['pgrep', 'ngrok']) == 1:
            subprocess.Popen(['ngrok', 'tcp', '-authtoken', auth_token, '-log', '/tmp/ngrok.log', '22'])
            return 'starting with ' + auth_token
        else:
            return 'already running'

    @http.route('/six_payment_terminal', type='http', auth='none', cors='*', csrf=False)
    def six_payment_terminal(self):
        return six_payment_terminal_template.render({
            'title': 'Six Payment Terminal',
            'breadcrumb': 'Six Payment Terminal',
            'terminalId': self.get_six_terminal(),
        })

    @http.route('/six_payment_terminal_add', type='http', auth='none', cors='*', csrf=False)
    def add_six_payment_terminal(self, terminal_id):
        iot_box_config = {'iot_box_driver': {
            'six_terminal_id': terminal_id
            }
        }
        helpers.write_iot_config(iot_box_config)
        subprocess.check_call(["sudo", "service", "odoo", "restart"])
        return 'http://' + helpers.get_ip() + ':8069'

    @http.route('/six_payment_terminal_clear', type='http', auth='none', cors='*', csrf=False)
    def clear_six_payment_terminal(self):
        helpers.delete_iot_config('iot_box_driver', 'six_terminal_id')
        subprocess.check_call(["sudo", "service", "odoo", "restart"])
        return "<meta http-equiv='refresh' content='0; url=http://" + helpers.get_ip() + ":8069'>"

    @http.route('/hw_proxy/upgrade', type='http', auth='none', )
    def upgrade(self):
        commit = subprocess.check_output(["git", "--work-tree=/home/pi/odoo/", "--git-dir=/home/pi/odoo/.git", "log", "-1"]).decode('utf-8').replace("\n", "<br/>")
        flashToVersion = helpers.check_image()
        actualVersion = helpers.get_version()
        if flashToVersion:
            flashToVersion = '%s.%s' % (flashToVersion.get('major', ''), flashToVersion.get('minor', ''))
        return upgrade_page_template.render({
            'title': "Odoo's IoTBox - Software Upgrade",
            'breadcrumb': 'IoT Box Software Upgrade',
            'loading_message': 'Updating IoT box',
            'commit': commit,
            'flashToVersion': flashToVersion,
            'actualVersion': actualVersion,
        })

    @http.route('/hw_proxy/perform_upgrade', type='http', auth='none')
    def perform_upgrade(self):
        self.updating.acquire()
        os.system('/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/posbox_update.sh')
        self.updating.release()
        return 'SUCCESS'

    @http.route('/hw_proxy/get_version', type='http', auth='none')
    def check_version(self):
        return helpers.get_version()

    @http.route('/hw_proxy/perform_flashing_create_partition', type='http', auth='none')
    def perform_flashing_create_partition(self):
        try:
            response = subprocess.check_output(['sudo', 'bash', '-c', '. /home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/upgrade.sh; create_partition']).decode().split('\n')[-2]
            if response in ['Error_Card_Size', 'Error_Upgrade_Already_Started']:
                raise Exception(response)
            return Response('success', status=200)
        except subprocess.CalledProcessError as e:
            raise Exception(e.output)
        except Exception as e:
            _logger.error('A error encountered : %s ' % e)
            return Response(str(e), status=500)

    @http.route('/hw_proxy/perform_flashing_download_raspbian', type='http', auth='none')
    def perform_flashing_download_raspbian(self):
        try:
            response = subprocess.check_output(['sudo', 'bash', '-c', '. /home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/upgrade.sh; download_raspbian']).decode().split('\n')[-2]
            if response == 'Error_Raspbian_Download':
                raise Exception(response)
            return Response('success', status=200)
        except subprocess.CalledProcessError as e:
            raise Exception(e.output)
        except Exception as e:
            self.clean_partition()
            _logger.error('A error encountered : %s ' % e)
            return Response(str(e), status=500)

    @http.route('/hw_proxy/perform_flashing_copy_raspbian', type='http', auth='none')
    def perform_flashing_copy_raspbian(self):
        try:
            response = subprocess.check_output(['sudo', 'bash', '-c', '. /home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/upgrade.sh; copy_raspbian']).decode().split('\n')[-2]
            if response == 'Error_Iotbox_Download':
                raise Exception(response)
            return Response('success', status=200)
        except subprocess.CalledProcessError as e:
            raise Exception(e.output)
        except Exception as e:
            self.clean_partition()
            _logger.error('A error encountered : %s ' % e)
            return Response(str(e), status=500)
