import threading
import socket
import platform
import pyautogui
import qrcode
import io
import logging
from PIL import Image, ImageDraw, ImageTk, ImageOps
from flask import Flask, render_template
from flask_socketio import SocketIO
from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
import ctypes
from ctypes import POINTER, cast
from comtypes import CLSCTX_ALL, CoInitialize
import pystray
import tkinter as tk
import os
import time

logging.getLogger('werkzeug').setLevel(logging.ERROR)
logging.getLogger('engineio').setLevel(logging.ERROR)
logging.getLogger('socketio').setLevel(logging.ERROR)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('move')
def handle_move(data):
    pyautogui.moveRel(data['dx'] * 3, data['dy'] * 3)
    time.sleep(0.005)

@socketio.on('click')
def handle_click():
    pyautogui.click()

@socketio.on('right_click')
def handle_right_click():
    pyautogui.click(button='right')

@socketio.on('scroll')
def handle_scroll(data):
    pyautogui.scroll(int(data['dy'] * 3))

@socketio.on('mouse_down')
def handle_mouse_down():
    pyautogui.mouseDown()

@socketio.on('mouse_up')
def handle_mouse_up():
    pyautogui.mouseUp()

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
    if platform.system() == "Windows":
        try:
            CoInitialize()
            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            volume_obj = cast(interface, POINTER(IAudioEndpointVolume))
            volume_obj.SetMasterVolumeLevelScalar(data['volume'] / 100, None)
        except Exception as e:
            print("Volume control error:", e)

@socketio.on('type')
def handle_type(data):
    try:
        pyautogui.write(data['key'])
    except Exception as e:
        print("Typing error:", e)

@socketio.on('key')
def handle_key(data):
    try:
        key = data['key'].lower()
        if data.get('down'):
            pyautogui.keyDown(key)
        else:
            pyautogui.keyUp(key)
    except Exception as e:
        print("Key event error:", e)

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

host_ip = get_local_ip()
port = 5000
url = f"http://{host_ip}:{port}"

def run_server():
    socketio.run(app, host="0.0.0.0", port=port, debug=False, use_reloader=False)

def position_popup(root, width=250, height=100):
    root.update_idletasks()
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    x = screen_width - width - 20
    y = screen_height - height - 80
    root.geometry(f"{width}x{height}+{x}+{y}")

def show_ip_popup():
    root = tk.Tk()
    root.title("Server Info")
    root.resizable(False, False)
    root.attributes('-topmost', True)
    root.overrideredirect(True)
    label = tk.Label(root, text=f"Website running at:\n{url}", font=('Arial', 10), padx=10, pady=10)
    label.pack()
    position_popup(root, width=250, height=60)
    root.bind("<FocusOut>", lambda e: root.destroy())
    root.after(5000, root.destroy)
    root.mainloop()

def show_qr_popup():
    root = tk.Tk()
    root.title("QR Code")
    root.resizable(False, False)
    root.attributes('-topmost', True)
    root.overrideredirect(True)
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    target_size = 150
    try:
        resample_filter = Image.Resampling.LANCZOS
    except AttributeError:
        resample_filter = Image.LANCZOS
    img = img.resize((target_size, target_size), resample_filter)
    qr_img = ImageTk.PhotoImage(img)
    frame = tk.Frame(root, bg="white")
    frame.pack(fill='both', expand=True)
    label_text = tk.Label(
        frame,
        text="Open this link in your browser to access the touchpad",
        font=("Arial", 9),
        bg="white",
        wraplength=180,
        justify="center",
        padx=10,
        pady=5
    )
    label_text.pack()
    label_img = tk.Label(frame, image=qr_img, bg="white")
    label_img.image = qr_img
    label_img.pack(pady=(0, 10))
    popup_width = 200
    popup_height = 210
    position_popup(root, width=popup_width, height=popup_height)
    root.bind("<FocusOut>", lambda e: root.destroy())
    root.after(8000, root.destroy)
    root.mainloop()

def create_icon():
    icon_image = Image.open("Mouse_Icon.png")
    def on_show_ip(icon, item):
        threading.Thread(target=show_ip_popup, daemon=True).start()
    def on_show_qr(icon, item):
        threading.Thread(target=show_qr_popup, daemon=True).start()
    def on_exit(icon, item):    
        icon.stop()
        time.sleep(1)
        os._exit(0)
    return pystray.Icon(
        "RemoteControl",
        icon_image,
        menu=pystray.Menu(
            pystray.MenuItem("Show IP & Port", on_show_ip),
            pystray.MenuItem("Show QR Code", on_show_qr),
            pystray.MenuItem("Exit", on_exit)
        )
    )

if __name__ == "__main__":
    threading.Thread(target=run_server, daemon=True).start()
    tray_icon = create_icon()
    tray_icon.run()
