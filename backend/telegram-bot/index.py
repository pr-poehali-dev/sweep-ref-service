"""
Telegram Bot Function — Sweep REF

Обрабатывает:
1. Webhook от Telegram (авторизация, команды в группах)
2. Отправку уведомлений через API
3. Команды сводок: /summary_today, /summary_all
4. Приветствие при добавлении в группу
"""

import json
import os
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional

import psycopg2
import telebot

MSK = timezone(timedelta(hours=3))

def now_msk():
    return datetime.now(MSK)

def get_bot_token() -> str:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN not configured")
    return token

def get_bot() -> telebot.TeleBot:
    return telebot.TeleBot(get_bot_token())

def get_schema() -> str:
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    return f"{schema}." if schema else ""

def get_cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Bot-Api-Secret-Token",
    }

def cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**get_cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps(body),
    }

def options_response() -> dict:
    return {"statusCode": 204, "headers": get_cors_headers(), "body": ""}


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def build_summary(conn, period="today"):
    """Собирает сводку по всем ресторанам."""
    schema = get_schema()
    cur = conn.cursor()
    cur.execute(f"SELECT id, name FROM {schema}restaurants ORDER BY id")
    restaurants = cur.fetchall()
    cur.execute(f"SELECT key, label FROM {schema}source_options WHERE active = true ORDER BY sort_order")
    source_map = {r[0]: r[1] for r in cur.fetchall()}

    lines = []
    total = 0
    for rid, rname in restaurants:
        if period == "today":
            cur.execute(
                f"SELECT source, COUNT(*) FROM {schema}responses WHERE restaurant_id = %s AND created_at::date = CURRENT_DATE GROUP BY source ORDER BY COUNT(*) DESC",
                (rid,),
            )
        else:
            cur.execute(
                f"SELECT source, COUNT(*) FROM {schema}responses WHERE restaurant_id = %s GROUP BY source ORDER BY COUNT(*) DESC",
                (rid,),
            )
        rows = cur.fetchall()
        if not rows:
            continue
        rcount = sum(r[1] for r in rows)
        total += rcount
        lines.append(f"\n🏪 <b>{rname}</b> — {rcount}")
        for skey, cnt in rows:
            lines.append(f"   • {source_map.get(skey, skey)}: {cnt}")

    cur.close()

    t = now_msk().strftime("%d.%m.%Y %H:%M")
    title = "📊 Сводка за сегодня" if period == "today" else "📊 Сводка за всё время"
    header = f"<b>{title}</b>\n🕐 {t} МСК\n📋 Всего ответов: {total}"
    return header + "".join(lines) if lines else header + "\n\nНет данных"


def save_auth_token(telegram_id, username, first_name, last_name):
    token = str(uuid.uuid4())
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    schema = get_schema()
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(f"""
            INSERT INTO {schema}telegram_auth_tokens
            (token_hash, telegram_id, telegram_username, telegram_first_name,
             telegram_last_name, telegram_photo_url, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (token_hash, telegram_id, username, first_name, last_name, None,
              datetime.now(timezone.utc) + timedelta(minutes=5)))
        conn.commit()
    finally:
        conn.close()
    return token


def handle_web_auth(chat_id, user):
    telegram_id = str(user.get("id", ""))
    token = save_auth_token(telegram_id, user.get("username"), user.get("first_name"), user.get("last_name"))
    site_url = os.environ["SITE_URL"].rstrip("/")
    auth_url = f"{site_url}/auth/telegram/callback?token={token}"
    bot = get_bot()
    bot.send_message(
        chat_id,
        "Авторизация готова!\n\nНажмите кнопку ниже, чтобы войти на сайт 👇\n\nСсылка действительна 5 минут.",
        reply_markup=telebot.types.InlineKeyboardMarkup().add(
            telebot.types.InlineKeyboardButton("Войти на сайт", url=auth_url)
        ),
    )


def handle_start(chat_id):
    bot = get_bot()
    markup = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)
    markup.add(
        telebot.types.KeyboardButton("📊 Сводка за день"),
        telebot.types.KeyboardButton("📈 Сводка за всё время"),
    )
    bot.send_message(
        chat_id,
        "👋 Привет! Я бот <b>Sweep REF</b>.\n\n"
        "Я отслеживаю откуда приходят гости в ваши рестораны.\n\n"
        "📊 <b>Что я умею:</b>\n"
        "• Присылать уведомления о каждом новом ответе\n"
        "• Формировать сводки за день и за всё время\n\n"
        "Используйте кнопки ниже или команды:\n"
        "/summary_today — сводка за сегодня\n"
        "/summary_all — сводка за всё время",
        parse_mode="HTML",
        reply_markup=markup,
    )


def handle_summary(chat_id, period="today"):
    try:
        conn = get_db()
        text = build_summary(conn, period)
        conn.close()
        bot = get_bot()
        bot.send_message(chat_id, text, parse_mode="HTML")
    except Exception as e:
        print(f"Summary error: {e}")
        bot = get_bot()
        bot.send_message(chat_id, "❌ Ошибка при получении сводки")


def handle_new_member(message):
    """Приветствие при добавлении бота в группу."""
    bot = get_bot()
    chat_id = message.get("chat", {}).get("id")
    bot_username = os.environ.get("TELEGRAM_BOT_USERNAME", "")

    new_members = message.get("new_chat_members", [])
    for member in new_members:
        if member.get("username") == bot_username or member.get("is_bot"):
            markup = telebot.types.InlineKeyboardMarkup()
            markup.add(
                telebot.types.InlineKeyboardButton("📊 Сводка за день", callback_data="summary_today"),
                telebot.types.InlineKeyboardButton("📈 За всё время", callback_data="summary_all"),
            )
            bot.send_message(
                chat_id,
                "👋 Привет! Я бот <b>Sweep REF</b>.\n\n"
                "Я буду присылать сюда уведомления о новых ответах гостей.\n\n"
                f"📌 <b>Чтобы подключить:</b>\n"
                f"1. Скопируйте ID этого чата: <code>{chat_id}</code>\n"
                f"2. Вставьте его в настройках админ-панели → Telegram\n"
                f"3. Включите уведомления\n\n"
                "Команды:\n"
                "/summary_today — сводка за сегодня\n"
                "/summary_all — сводка за всё время",
                parse_mode="HTML",
                reply_markup=markup,
            )
            return


def process_webhook(body):
    message = body.get("message")
    callback_query = body.get("callback_query")

    if callback_query:
        data = callback_query.get("data", "")
        chat_id = callback_query.get("message", {}).get("chat", {}).get("id")
        if chat_id:
            if data == "summary_today":
                handle_summary(chat_id, "today")
            elif data == "summary_all":
                handle_summary(chat_id, "all")
        try:
            bot = get_bot()
            bot.answer_callback_query(callback_query.get("id"))
        except:
            pass
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    if not message:
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    if message.get("new_chat_members"):
        try:
            handle_new_member(message)
        except Exception as e:
            print(f"New member error: {e}")
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    text = message.get("text", "")
    user = message.get("from", {})
    chat_id = message.get("chat", {}).get("id")

    if not chat_id:
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    try:
        if text.startswith("/start"):
            parts = text.split(" ", 1)
            if len(parts) > 1 and parts[1] == "web_auth":
                handle_web_auth(chat_id, user)
            else:
                handle_start(chat_id)
        elif text in ("/summary_today", "📊 Сводка за день"):
            handle_summary(chat_id, "today")
        elif text in ("/summary_all", "📈 Сводка за всё время"):
            handle_summary(chat_id, "all")
    except telebot.apihelper.ApiTelegramException as e:
        print(f"Telegram API error: {e}")
    except Exception as e:
        print(f"Error processing webhook: {e}")

    return {"statusCode": 200, "body": json.dumps({"ok": True})}


def handle_send(body):
    text = body.get("text", "").strip()
    chat_id = body.get("chat_id", "")
    parse_mode = body.get("parse_mode", "HTML")
    silent = body.get("silent", False)
    if not text:
        return cors_response(400, {"error": "text is required"})
    if not chat_id:
        return cors_response(400, {"error": "chat_id is required"})
    try:
        bot = get_bot()
        result = bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode,
                                   disable_notification=silent, disable_web_page_preview=True)
        return cors_response(200, {"success": True, "message_id": result.message_id})
    except telebot.apihelper.ApiTelegramException as e:
        return cors_response(400, {"error": e.description, "error_code": e.error_code})
    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handler(event: dict, context) -> dict:
    """Telegram Bot для Sweep REF — уведомления и сводки"""
    method = event.get("httpMethod", "POST")
    if method == "OPTIONS":
        return options_response()

    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    if action:
        raw_body = event.get("body") or "{}"
        try:
            body = json.loads(raw_body)
        except:
            body = {}
        if action == "send" and method == "POST":
            return handle_send(body)
        return cors_response(400, {"error": f"Unknown action: {action}"})

    raw_body = event.get("body") or "{}"
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        body = {}
    return process_webhook(body)
