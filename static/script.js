const socket = io();
const touchpad = document.getElementById('touchpad');
const touchpadContainer = document.getElementById('touchpadWrapper');
const keyboardContainer = document.getElementById('keyboardContainer');
const modeButtons = document.getElementById('modeButtons');

const modifierState = {
    Shift: false,
    Ctrl: false,
    Alt: false,
    CapsLock: false,
};

let lastTapTime = 0;
let dragActive = false;
let isTwoFingerScroll = false;
let initialTouch = null;
let lastTouches = [];

const DOUBLE_TAP_THRESHOLD = 300; // ms
const TAP_MOVE_THRESHOLD = 10;

touchpad.addEventListener('touchstart', (e) => {
    const touches = e.touches;

    if (touches.length === 2) {
        isTwoFingerScroll = true;
        dragActive = false;
        return;
    }

    isTwoFingerScroll = false;

    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastTapTime;

    if (touches.length === 1 && timeDiff < DOUBLE_TAP_THRESHOLD) {
        dragActive = true;
        socket.emit('mouse_down');
    }

    lastTapTime = currentTime;

    initialTouch = {
        x: touches[0].clientX,
        y: touches[0].clientY
    };

    lastTouches = Array.from(touches);
});

touchpad.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touches = e.touches;

    if (isTwoFingerScroll && touches.length === 2 && lastTouches.length === 2) {
        const dy = ((touches[0].clientY + touches[1].clientY) / 2) -
            ((lastTouches[0].clientY + lastTouches[1].clientY) / 2);
        socket.emit('scroll', { dy });
    }

    if (!isTwoFingerScroll && touches.length === 1 && lastTouches.length === 1) {
        const dx = touches[0].clientX - lastTouches[0].clientX;
        const dy = touches[0].clientY - lastTouches[0].clientY;
        socket.emit('move', { dx, dy });
    }

    lastTouches = Array.from(touches);
});

touchpad.addEventListener('touchend', (e) => {
    if (dragActive && e.touches.length === 0) {
        socket.emit('mouse_up');
        dragActive = false;
        return;
    }

    if (!isTwoFingerScroll && initialTouch && e.changedTouches.length === 1) {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const dx = endX - initialTouch.x;
        const dy = endY - initialTouch.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < TAP_MOVE_THRESHOLD) {
            socket.emit('click');
        }
    }

    initialTouch = null;
    lastTouches = [];
    isTwoFingerScroll = false;
});

function leftClick() {
    socket.emit('click');
}

function rightClick() {
    socket.emit('right_click');
}

function media(action) {
    socket.emit('media', { action });
}

function setVolume(value) {
    socket.emit('set_volume', { volume: parseInt(value) });
}

function showTouchpad() {
    keyboardContainer.style.display = 'none';
    touchpadContainer.style.display = 'flex';
}

function showKeyboard() {
    touchpadContainer.style.display = 'none';
    keyboardContainer.style.display = 'flex';
}

function getDisplayedKey(key) {
    const shift = modifierState.Shift || modifierState.CapsLock;

    const shiftMap = {
        "`": "~", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
        "6": "^", "7": "&", "8": "*", "9": "(", "0": ")", "-": "_",
        "=": "+", "[": "{", "]": "}", "\\": "|", ";": ":", "'": "\"",
        ",": "<", ".": ">", "/": "?"
    };

    if (shiftMap[key]) {
        return shift ? shiftMap[key] : key;
    }

    if (key.length === 1 && key.match(/[a-z]/i)) {
        return shift ? key.toUpperCase() : key.toLowerCase();
    }

    return key;
}

function updateModifiers() {
    document.querySelectorAll(".btn").forEach(btn => {
        const key = btn.textContent;
        if (
            (key === "Shift" && modifierState.Shift) ||
            (key === "CapsLock" && modifierState.CapsLock) ||
            (key === "Ctrl" && modifierState.Ctrl) ||
            (key === "Alt" && modifierState.Alt)
        ) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function handleKeyPress(key, isDown) {
    const keyMap = {
        "←": "left",
        "→": "right",
        "↑": "up",
        "↓": "down",
        "Space": "space",
        "Backspace": "backspace",
        "Enter": "enter",
        "Tab": "tab",
        "CapsLock": "capslock",
        "Shift": "shift",
        "Ctrl": "ctrl",
        "Alt": "alt",
        "Win": "win",
        "Esc": "esc"
    };

    const mappedKey = keyMap[key] || key;
    const isModifier = ["Shift", "Ctrl", "Alt"].includes(key);
    const isSpecialKey = Object.keys(keyMap).includes(key);

    if (key === "CapsLock" && isDown) {
        modifierState.CapsLock = !modifierState.CapsLock;
        renderKeyboard();
        updateModifiers();
        return;
    }

    if (isModifier) {
        modifierState[key] = isDown;
        socket.emit("key", { key: mappedKey, down: isDown });
        renderKeyboard();
        updateModifiers();
        return;
    }

    if (isDown) {
        if (isSpecialKey) {
            socket.emit("key", { key: mappedKey, down: true });
            setTimeout(() => {
                socket.emit("key", { key: mappedKey, down: false });
            }, 20);
        } else {
            const displayKey = getDisplayedKey(key);
            socket.emit("type", { key: displayKey });
        }
    }
}

function renderKeyboard() {
    const keys = [
        ["Esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"],
        ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Backspace"],
        ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
        ["CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter"],
        ["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Shift"],
        ["Ctrl", "Win", "Alt", "Space", "Alt", "Fn", "Ctrl", "←", "↑", "↓", "→"]
    ];

    keyboardContainer.innerHTML = '';

    keys.forEach(row => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "row";
        row.forEach(rawKey => {
            const displayKey = getDisplayedKey(rawKey);
            const btn = document.createElement("button");
            btn.className = "btn";
            btn.textContent = displayKey;
            if (rawKey === "Space") btn.classList.add("space");

            btn.onmousedown = (e) => {
                e.preventDefault();
                if (!e.isTrusted) return;
                handleKeyPress(rawKey, true);
            };
            btn.onmouseup = (e) => {
                e.preventDefault();
                if (!e.isTrusted) return;
                handleKeyPress(rawKey, false);
            };
            btn.ontouchstart = (e) => {
                e.preventDefault();
                handleKeyPress(rawKey, true);
            };
            btn.ontouchend = (e) => {
                e.preventDefault();
                handleKeyPress(rawKey, false);
            };

            rowDiv.appendChild(btn);
        });
        keyboardContainer.appendChild(rowDiv);
    });
    attachPressVisuals();
    updateModifiers();
}

function attachPressVisuals() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousedown', () => {
            btn.classList.add('pressed');
        });
        btn.addEventListener('mouseup', () => {
            btn.classList.remove('pressed');
        });
        btn.addEventListener('touchstart', () => {
            btn.classList.add('pressed');
        });
        btn.addEventListener('touchend', () => {
            btn.classList.remove('pressed');
        });
    });
}

function checkOrientation() {
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if (isLandscape) {
        modeButtons.style.display = 'block';
        showTouchpad();
    } else {
        modeButtons.style.display = 'none';
        showTouchpad();
    }
}

renderKeyboard();
checkOrientation();
window.addEventListener("orientationchange", () => setTimeout(checkOrientation, 200));

const scrollBar = document.getElementById("scrollBar");

let isDraggingScroll = false;
let startY = 0;

scrollBar.addEventListener("mousedown", (e) => {
    isDraggingScroll = true;
    startY = e.clientY;
    scrollBar.style.cursor = "grabbing";
});

document.addEventListener("mousemove", (e) => {
    if (isDraggingScroll) {
        const dy = e.clientY - startY;
        socket.emit("scroll", { dy: dy });
        startY = e.clientY;
    }
});

document.addEventListener("mouseup", () => {
    if (isDraggingScroll) {
        isDraggingScroll = false;
        scrollBar.style.cursor = "grab";
    }
});

scrollBar.addEventListener("touchstart", (e) => {
    isDraggingScroll = true;
    startY = e.touches[0].clientY;
});

document.addEventListener("touchmove", (e) => {
    if (isDraggingScroll) {
        const dy = e.touches[0].clientY - startY;
        socket.emit("scroll", { dy: dy });
        startY = e.touches[0].clientY;
    }
}, { passive: false });

document.addEventListener("touchend", () => {
    isDraggingScroll = false;
});
