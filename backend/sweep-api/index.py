import json
import os
import hashlib
import hmac
import time
import psycopg2

SECRET_KEY = "sweep-ref-secret-2024"

def make_token(user_id):
    payload = f"{user_id}:{int(time.time()) + 86400 * 7}"
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload}:{sig}"

def verify_token(token):
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        user_id, exp, sig = parts
        if int(exp) < int(time.time()):
            return None
        expected = hmac.new(SECRET_KEY.encode(), f"{user_id}:{exp}".encode(), hashlib.sha256).hexdigest()[:16]
        if sig != expected:
            return None
        return int(user_id)
    except:
        return None

def check_auth(event):
    auth = event.get("headers", {}).get("X-Authorization", "") or event.get("headers", {}).get("Authorization", "")
    token = auth.replace("Bearer ", "")
    return verify_token(token)

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def handler(event, context):
    """API для Sweep REF — сервиса отслеживания источников гостей"""
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    cors = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}

    try:
        body = json.loads(event.get("body", "{}") or "{}")
    except:
        body = {}

    action = body.get("action", "")

    if action == "get_restaurants":
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name FROM restaurants ORDER BY id")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "statusCode": 200,
            "headers": cors,
            "body": json.dumps({"restaurants": [{"id": r[0], "name": r[1]} for r in rows]}),
        }

    if action == "add_response":
        restaurant_id = body.get("restaurant_id")
        source = body.get("source")
        if not restaurant_id or not source:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Missing fields"})}
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO responses (restaurant_id, source) VALUES (%s, %s)",
            (restaurant_id, source),
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True})}

    if action == "login":
        username = body.get("username", "")
        password = body.get("password", "")
        pw_hash = hashlib.sha256(password.encode()).hexdigest()
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM admin_users WHERE username = %s AND password_hash = %s",
            (username, pw_hash),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Invalid credentials"})}
        token = make_token(row[0])
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"token": token})}

    if action == "get_stats":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name FROM restaurants ORDER BY id")
        restaurants = [{"id": r[0], "name": r[1]} for r in cur.fetchall()]
        cur.execute("SELECT id, restaurant_id, source, created_at FROM responses ORDER BY created_at")
        responses = [
            {"id": r[0], "restaurant_id": r[1], "source": r[2], "created_at": r[3].isoformat()}
            for r in cur.fetchall()
        ]
        cur.close()
        conn.close()
        return {
            "statusCode": 200,
            "headers": cors,
            "body": json.dumps({"restaurants": restaurants, "responses": responses}),
        }

    if action == "create_restaurant":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        name = body.get("name", "").strip()
        if not name:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Name required"})}
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO restaurants (name) VALUES (%s) RETURNING id", (name,))
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "id": new_id})}

    if action == "rename_restaurant":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        rid = body.get("restaurant_id")
        name = body.get("name", "").strip()
        if not rid or not name:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Missing fields"})}
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE restaurants SET name = %s WHERE id = %s", (name, rid))
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True})}

    if action == "change_password":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        old_pw = body.get("old_password", "")
        new_pw = body.get("new_password", "")
        if not old_pw or not new_pw:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Missing fields"})}
        if len(new_pw) < 4:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Password too short"})}
        old_hash = hashlib.sha256(old_pw.encode()).hexdigest()
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM admin_users WHERE id = %s AND password_hash = %s", (user_id, old_hash))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Wrong old password"})}
        new_hash = hashlib.sha256(new_pw.encode()).hexdigest()
        cur.execute("UPDATE admin_users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True})}

    return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Unknown action"})}
