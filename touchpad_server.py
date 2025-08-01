from flask import Flask, render_template
from flask_socketio import SocketIO
import pyautogui
import platform
import socket
import qrcode
import comtypes
from comtypes import CLSCTX_ALL
import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
import engineio
import socketio

engineio_logger = logging.getLogger('engineio')
socketio_logger = logging.getLogger('socketio')
engineio_logger.setLevel(logging.ERROR)
socketio_logger.setLevel(logging.ERROR)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('move')
def handle_move(data):
    dx, dy = data['dx'], data['dy']
    pyautogui.moveRel(dx * 3, dy * 3)

@socketio.on('click')
def handle_click():
    pyautogui.click()

@socketio.on('right_click')
def handle_right_click():
    pyautogui.click(button='right')

@socketio.on('scroll')
def handle_scroll(data):
    dy = data['dy']
    pyautogui.scroll(int(dy * 3))

@socketio.on('media')
def handle_media(data):
    action = data['action']
    if action == 'play_pause':
        pyautogui.press('space')
    elif action == 'next':
        pyautogui.press('right')
    elif action == 'prev':
        pyautogui.press('left')

@socketio.on('set_volume')
def handle_set_volume(data):
    volume = data['volume']
    system = platform.system()

    if system == "Windows":
        try:
            import ctypes
            from ctypes import POINTER, cast
            from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

            comtypes.CoInitialize()

            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            volume_obj = cast(interface, POINTER(IAudioEndpointVolume))
            volume_obj.SetMasterVolumeLevelScalar(volume / 100, None)

        except Exception as e:
            print("Volume control failed:", e)

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == '__main__':
    host_ip = get_local_ip()
    port = 5000
    url = f'http://{host_ip}:{port}'
    
    print(f"\nServer running at: {url}\n")

    qr = qrcode.QRCode(border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii(invert=True)

    socketio.run(app, host='0.0.0.0', port=port, debug=False, use_reloader=False)