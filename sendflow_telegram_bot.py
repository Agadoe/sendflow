#!/usr/bin/env python3
"""
sendflow_telegram_bot.py
Combined SendFlow + @Baahee_bot Telegram daemon.

Responsibilities:
1. Reply to inbound /start with the SendFlow waitlist pitch
2. Capture phone numbers shared via Telegram contact
3. Forward any inbound lead to the SendFlow /api/lead-push endpoint
4. Handle /status, /ping, /help commands for health checks
5. Persist state to ~/.sendflow-bot/state.json (offset, contacts)

Run modes:
  python3 sendflow_telegram_bot.py          # foreground
  python3 sendflow_telegram_bot.py --once   # single poll then exit (for cron)
"""
import os, sys, json, time, signal, requests
from datetime import datetime
from pathlib import Path

BOT_TOKEN = "8624774319:AAEbZe84cIRecSLH0fJbGApWWGHHiRcY0cg"
DON_CHAT = "6522328613"  # alerts / control
SENDFLOW_API = "https://sendflow-two.vercel.app"
STATE_PATH = Path.home() / ".sendflow-bot" / "state.json"
LOG_PATH = Path.home() / ".sendflow-bot" / "bot.log"

BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"

# ---------- state ----------
def load_state():
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text())
    return {"offset": 0, "contacts": []}

def save_state(s):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(s, indent=2))

def log(msg):
    ts = datetime.now().isoformat(timespec="seconds")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a") as f:
        f.write(line + "\n")

# ---------- telegram helpers ----------
def tg(method, **params):
    r = requests.get(f"{BASE}/{method}", params=params, timeout=30)
    return r.json()

def send(chat_id, text, parse_mode=None, reply_markup=None):
    payload = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup)
    return requests.post(f"{BASE}/sendMessage", json=payload, timeout=10).json()

# ---------- handlers ----------
WELCOME = (
    "👋 Welcome to *SendFlow* — bulk WhatsApp marketing for African SMBs.\n\n"
    "You're in the right place if you run a salon, restaurant, retail shop, "
    "boutique, church, school, or any business that talks to customers one-by-one.\n\n"
    "📋 *What's next?*\n"
    "1. Share your WhatsApp number so we can text you at launch (tap the 📎 → Contact)\n"
    "2. Or join the waitlist: https://sendflow-two.vercel.app\n\n"
    "Send /help for commands. Questions? Just reply here."
)

HELP = (
    "🤖 *SendFlow bot commands*\n\n"
    "/start — welcome + waitlist pitch\n"
    "/waitlist — direct link to the signup form\n"
    "/status — bot health check\n"
    "/ping — liveness test\n"
    "/help — this message\n\n"
    "Or just send your WhatsApp contact 📎 to be added to the launch list."
)

def handle_start(chat_id, name):
    send(chat_id, WELCOME, parse_mode="Markdown")
    log(f"/start from {name} (chat {chat_id})")

def handle_help(chat_id):
    send(chat_id, HELP, parse_mode="Markdown")

def handle_ping(chat_id):
    send(chat_id, "🏓 pong")

def handle_status(chat_id):
    state = load_state()
    msg = (
        f"📊 *SendFlow bot status*\n\n"
        f"⏱ Uptime: {datetime.now().isoformat(timespec='seconds')}\n"
        f"📨 Last offset: {state.get('offset', 0)}\n"
        f"📇 Contacts captured: {len(state.get('contacts', []))}\n"
    )
    send(chat_id, msg, parse_mode="Markdown")

def handle_contact(msg, state):
    """Someone sent us their phone number via Telegram contact."""
    c = msg.get("contact", {})
    phone = c.get("phone_number", "")
    name = (c.get("first_name", "") + " " + c.get("last_name", "")).strip() or "Telegram contact"
    user = msg.get("from", {})
    username = user.get("username", "")
    chat_id = msg.get("chat", {}).get("id")

    state["contacts"].append({
        "phone": phone,
        "name": name,
        "username": f"@{username}" if username else "",
        "telegram_id": str(user.get("id", "")),
        "captured_at": datetime.now().isoformat(),
    })
    save_state(state)

    # Push to SendFlow lead-push API
    payload = {
        "name": name,
        "phone": phone,
        "email": "",
        "company": "",
        "source": "telegram_bot",
        "notes": f"Captured via @Baahee_bot (telegram_id={user.get('id','')})",
        "stage": "NEW",
    }
    try:
        r = requests.post(f"{SENDFLOW_API}/api/lead-push", json=payload, timeout=10)
        ok = r.ok
        err = None if ok else r.text[:200]
    except Exception as e:
        ok = False
        err = str(e)
    log(f"contact capture: {phone} ({name}) -> SendFlow {'OK' if ok else 'FAIL: '+(err or '?')}")

    # Confirm to user
    send(chat_id, (
        f"✅ Got it, {name.split()[0]}!\n\n"
        f"📱 Added {phone} to the SendFlow launch list.\n"
        f"We'll text you the moment we open doors.\n\n"
        f"Want the early-bird pricing? Join the waitlist: https://sendflow-two.vercel.app"
    ))

    # Notify Don
    send(DON_CHAT, (
        f"🆕 *Telegram contact captured*\n\n"
        f"👤 {name}\n"
        f"📱 {phone}\n"
        f"🔗 @{username}\n"
        f"→ SendFlow: {'✅' if ok else '❌ ' + (err or '')}"
    ), parse_mode="Markdown")

def handle_text(msg, state):
    text = msg.get("text", "").strip()
    chat_id = msg.get("chat", {}).get("id")
    name = (msg.get("from", {}).get("first_name") or "there")
    if not text or not chat_id:
        return
    cmd = text.split()[0].lower() if text else ""
    if cmd == "/start" or cmd == "/start@baahee_bot":
        handle_start(chat_id, name)
    elif cmd == "/help":
        handle_help(chat_id)
    elif cmd == "/ping":
        handle_ping(chat_id)
    elif cmd == "/status":
        handle_status(chat_id)
    elif cmd == "/waitlist":
        send(chat_id, "📋 Join the SendFlow waitlist: https://sendflow-two.vercel.app")
    else:
        # Default: any other text from a real user, ack and point to the form
        # Don't spam — only reply if first time
        if chat_id != DON_CHAT:
            send(chat_id, (
                f"Hey {name} 👋\n\n"
                f"To join the SendFlow waitlist, tap: https://sendflow-two.vercel.app\n"
                f"Or send /help to see what I can do."
            ))

# ---------- main loop ----------
def process_updates(state, once=False):
    try:
        r = tg("getUpdates", offset=state["offset"], timeout=10, allowed_updates='["message"]')
    except Exception as e:
        log(f"getUpdates error: {e}")
        return False

    if not r.get("ok"):
        log(f"getUpdates not ok: {r}")
        return False

    for u in r.get("result", []):
        state["offset"] = max(state["offset"], u["update_id"] + 1)
        msg = u.get("message")
        if not msg:
            continue
        # Always log inbound to DON_CHAT for visibility
        chat = msg.get("chat", {})
        sender = msg.get("from", {})
        if chat.get("id") != int(DON_CHAT):
            preview = msg.get("text") or msg.get("contact", {}).get("phone_number") or "[non-text]"
            log(f"inbound from {sender.get('first_name','')} (@{sender.get('username','?')}, chat {chat.get('id')}): {str(preview)[:60]}")
        if "contact" in msg:
            handle_contact(msg, state)
        else:
            handle_text(msg, state)
    save_state(state)
    if once:
        return True
    return True

def main():
    once = "--once" in sys.argv
    state = load_state()
    log(f"starting sendflow_telegram_bot (mode={'once' if once else 'loop'})")
    if once:
        process_updates(state, once=True)
        return
    running = True
    def stop(*a):
        nonlocal running
        running = False
        log("stop signal received")
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    # Initial liveness ping
    try:
        me = tg("getMe")
        if me.get("ok"):
            log(f"authenticated as @{me['result']['username']}")
        send(DON_CHAT, "🟢 SendFlow Telegram bot is online. /status for health.", parse_mode=None)
    except Exception as e:
        log(f"startup error: {e}")
    while running:
        try:
            process_updates(state)
        except Exception as e:
            log(f"loop error: {e}")
        time.sleep(1)
    save_state(state)
    log("exited cleanly")

if __name__ == "__main__":
    main()
