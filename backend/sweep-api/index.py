import json
import os
import hashlib
import hmac
import time
import secrets
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

def generate_password():
    return secrets.token_urlsafe(8)

def transliterate(text):
    mapping = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
        'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
        'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
        'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    }
    result = []
    for ch in text.lower():
        if ch in mapping:
            result.append(mapping[ch])
        elif ch.isalnum():
            result.append(ch)
        elif ch in (' ', '-', '_'):
            result.append('-')
    slug = '-'.join(filter(None, ''.join(result).split('-')))
    return slug or 'restaurant'

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

    if action == "get_restaurant_by_slug":
        slug = body.get("slug", "")
        if not slug:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Slug required"})}
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name, slug FROM restaurants WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {"statusCode": 404, "headers": cors, "body": json.dumps({"error": "Not found"})}
        cur.execute("SELECT key, label, icon FROM source_options WHERE active = true ORDER BY sort_order")
        sources = [{"key": s[0], "label": s[1], "icon": s[2]} for s in cur.fetchall()]
        cur.close()
        conn.close()
        return {
            "statusCode": 200,
            "headers": cors,
            "body": json.dumps({"restaurant": {"id": row[0], "name": row[1], "slug": row[2]}, "sources": sources}),
        }

    if action == "get_restaurants":
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name, slug FROM restaurants ORDER BY id")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "statusCode": 200,
            "headers": cors,
            "body": json.dumps({"restaurants": [{"id": r[0], "name": r[1], "slug": r[2]} for r in rows]}),
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
        cur.execute("SELECT id, name, slug, password_hash FROM restaurants ORDER BY id")
        restaurants = [{"id": r[0], "name": r[1], "slug": r[2], "has_password": bool(r[3])} for r in cur.fetchall()]
        cur.execute("SELECT id, restaurant_id, source, created_at FROM responses ORDER BY created_at")
        responses = [
            {"id": r[0], "restaurant_id": r[1], "source": r[2], "created_at": r[3].isoformat()}
            for r in cur.fetchall()
        ]
        cur.execute("SELECT id, key, label, icon, sort_order, active FROM source_options ORDER BY sort_order")
        sources = [{"id": r[0], "key": r[1], "label": r[2], "icon": r[3], "sort_order": r[4], "active": r[5]} for r in cur.fetchall()]
        cur.close()
        conn.close()
        return {
            "statusCode": 200,
            "headers": cors,
            "body": json.dumps({"restaurants": restaurants, "responses": responses, "sources": sources}),
        }

    if action == "create_restaurant":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        name = body.get("name", "").strip()
        if not name:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Name required"})}
        slug = transliterate(name)
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM restaurants WHERE slug = %s", (slug,))
        if cur.fetchone():
            slug = slug + "-" + secrets.token_hex(3)
        pw = generate_password()
        pw_hash = hashlib.sha256(pw.encode()).hexdigest()
        cur.execute("INSERT INTO restaurants (name, slug, password_hash) VALUES (%s, %s, %s) RETURNING id", (name, slug, pw_hash))
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "id": new_id, "slug": slug, "password": pw})}

    if action == "rename_restaurant":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        rid = body.get("restaurant_id")
        name = body.get("name", "").strip()
        slug = body.get("slug", "").strip()
        if not rid or not name:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Missing fields"})}
        conn = get_db()
        cur = conn.cursor()
        if slug:
            cur.execute("SELECT id FROM restaurants WHERE slug = %s AND id != %s", (slug, rid))
            if cur.fetchone():
                cur.close()
                conn.close()
                return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Slug already taken"})}
            cur.execute("UPDATE restaurants SET name = %s, slug = %s WHERE id = %s", (name, slug, rid))
        else:
            cur.execute("UPDATE restaurants SET name = %s WHERE id = %s", (name, rid))
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True})}

    if action == "reset_restaurant_password":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        rid = body.get("restaurant_id")
        if not rid:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Missing restaurant_id"})}
        pw = generate_password()
        pw_hash = hashlib.sha256(pw.encode()).hexdigest()
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE restaurants SET password_hash = %s WHERE id = %s", (pw_hash, rid))
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "password": pw})}

    if action == "check_restaurant_password":
        rid = body.get("restaurant_id")
        password = body.get("password", "")
        if not rid or not password:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Missing fields"})}
        pw_hash = hashlib.sha256(password.encode()).hexdigest()
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM restaurants WHERE id = %s AND password_hash = %s", (rid, pw_hash))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Wrong password"})}
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

    if action == "update_source":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        sid = body.get("source_id")
        label = body.get("label", "").strip()
        icon = body.get("icon", "").strip()
        active = body.get("active")
        if not sid:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Missing source_id"})}
        conn = get_db()
        cur = conn.cursor()
        if label:
            cur.execute("UPDATE source_options SET label = %s WHERE id = %s", (label, sid))
        if icon:
            cur.execute("UPDATE source_options SET icon = %s WHERE id = %s", (icon, sid))
        if active is not None:
            cur.execute("UPDATE source_options SET active = %s WHERE id = %s", (active, sid))
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True})}

    if action == "create_source":
        user_id = check_auth(event)
        if not user_id:
            return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Unauthorized"})}
        key = body.get("key", "").strip().lower().replace(" ", "_")
        label = body.get("label", "").strip()
        icon = body.get("icon", "MessageCircle").strip()
        if not key or not label:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Key and label required"})}
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT MAX(sort_order) FROM source_options")
        max_order = cur.fetchone()[0] or 0
        cur.execute(
            "INSERT INTO source_options (key, label, icon, sort_order) VALUES (%s, %s, %s, %s) RETURNING id",
            (key, label, icon, max_order + 1),
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "id": new_id})}

    return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Unknown action"})}
