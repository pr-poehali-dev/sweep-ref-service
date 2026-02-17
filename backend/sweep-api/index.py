import json
import os
import hashlib
import hmac
import time
import secrets
import psycopg2
from datetime import datetime, timedelta

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

def resp(status, body_dict, cors):
    return {"statusCode": status, "headers": cors, "body": json.dumps(body_dict, default=str)}

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

    # === PUBLIC: get restaurant by slug ===
    if action == "get_restaurant_by_slug":
        slug = body.get("slug", "")
        if not slug:
            return resp(400, {"error": "Slug required"}, cors)
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name, slug FROM restaurants WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return resp(404, {"error": "Not found"}, cors)
        cur.execute("SELECT key, label, icon FROM source_options WHERE active = true ORDER BY sort_order")
        sources = [{"key": s[0], "label": s[1], "icon": s[2]} for s in cur.fetchall()]
        cur.close()
        conn.close()
        return resp(200, {"restaurant": {"id": row[0], "name": row[1], "slug": row[2]}, "sources": sources}, cors)

    # === PUBLIC: list restaurants ===
    if action == "get_restaurants":
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name, slug FROM restaurants ORDER BY id")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return resp(200, {"restaurants": [{"id": r[0], "name": r[1], "slug": r[2]} for r in rows]}, cors)

    # === PUBLIC: add response ===
    if action == "add_response":
        restaurant_id = body.get("restaurant_id")
        source = body.get("source")
        if not restaurant_id or not source:
            return resp(400, {"error": "Missing fields"}, cors)
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO responses (restaurant_id, source) VALUES (%s, %s) RETURNING id, created_at",
            (restaurant_id, source),
        )
        row = cur.fetchone()
        conn.commit()
        cur.execute(
            "SELECT COUNT(*) FROM responses WHERE restaurant_id = %s AND created_at::date = CURRENT_DATE",
            (restaurant_id,),
        )
        today_count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return resp(200, {"ok": True, "response_id": row[0], "today_count": today_count}, cors)

    # === PUBLIC: undo last response ===
    if action == "undo_response":
        response_id = body.get("response_id")
        restaurant_id = body.get("restaurant_id")
        if not response_id or not restaurant_id:
            return resp(400, {"error": "Missing fields"}, cors)
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM responses WHERE id = %s AND restaurant_id = %s AND created_at > NOW() - INTERVAL '5 minutes'",
            (response_id, restaurant_id),
        )
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return resp(400, {"error": "Cannot undo"}, cors)
        cur.execute("DELETE FROM responses WHERE id = %s", (response_id,))
        conn.commit()
        cur.execute(
            "SELECT COUNT(*) FROM responses WHERE restaurant_id = %s AND created_at::date = CURRENT_DATE",
            (restaurant_id,),
        )
        today_count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return resp(200, {"ok": True, "today_count": today_count}, cors)

    # === PUBLIC: get today count ===
    if action == "get_today_count":
        restaurant_id = body.get("restaurant_id")
        if not restaurant_id:
            return resp(400, {"error": "Missing restaurant_id"}, cors)
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM responses WHERE restaurant_id = %s AND created_at::date = CURRENT_DATE",
            (restaurant_id,),
        )
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return resp(200, {"today_count": count}, cors)

    # === PUBLIC: check restaurant password ===
    if action == "check_restaurant_password":
        rid = body.get("restaurant_id")
        password = body.get("password", "")
        if not rid or not password:
            return resp(400, {"error": "Missing fields"}, cors)
        pw_hash = hashlib.sha256(password.encode()).hexdigest()
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM restaurants WHERE id = %s AND password_hash = %s", (rid, pw_hash))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return resp(401, {"error": "Wrong password"}, cors)
        return resp(200, {"ok": True}, cors)

    # === PUBLIC: login ===
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
            return resp(401, {"error": "Invalid credentials"}, cors)
        token = make_token(row[0])
        return resp(200, {"token": token}, cors)

    # === ADMIN: get stats ===
    if action == "get_stats":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
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
        return resp(200, {"restaurants": restaurants, "responses": responses, "sources": sources}, cors)

    # === ADMIN: create restaurant ===
    if action == "create_restaurant":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        name = body.get("name", "").strip()
        if not name:
            return resp(400, {"error": "Name required"}, cors)
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
        return resp(200, {"ok": True, "id": new_id, "slug": slug, "password": pw}, cors)

    # === ADMIN: rename restaurant ===
    if action == "rename_restaurant":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        rid = body.get("restaurant_id")
        name = body.get("name", "").strip()
        slug = body.get("slug", "").strip()
        if not rid or not name:
            return resp(400, {"error": "Missing fields"}, cors)
        conn = get_db()
        cur = conn.cursor()
        if slug:
            cur.execute("SELECT id FROM restaurants WHERE slug = %s AND id != %s", (slug, rid))
            if cur.fetchone():
                cur.close()
                conn.close()
                return resp(400, {"error": "Slug already taken"}, cors)
            cur.execute("UPDATE restaurants SET name = %s, slug = %s WHERE id = %s", (name, slug, rid))
        else:
            cur.execute("UPDATE restaurants SET name = %s WHERE id = %s", (name, rid))
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {"ok": True}, cors)

    # === ADMIN: delete restaurant ===
    if action == "delete_restaurant":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        rid = body.get("restaurant_id")
        if not rid:
            return resp(400, {"error": "Missing restaurant_id"}, cors)
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM responses WHERE restaurant_id = %s", (rid,))
        cur.execute("DELETE FROM restaurants WHERE id = %s", (rid,))
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {"ok": True}, cors)

    # === ADMIN: reset restaurant password ===
    if action == "reset_restaurant_password":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        rid = body.get("restaurant_id")
        if not rid:
            return resp(400, {"error": "Missing restaurant_id"}, cors)
        pw = generate_password()
        pw_hash = hashlib.sha256(pw.encode()).hexdigest()
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE restaurants SET password_hash = %s WHERE id = %s", (pw_hash, rid))
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {"ok": True, "password": pw}, cors)

    # === ADMIN: change admin password ===
    if action == "change_password":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        old_pw = body.get("old_password", "")
        new_pw = body.get("new_password", "")
        if not old_pw or not new_pw:
            return resp(400, {"error": "Missing fields"}, cors)
        if len(new_pw) < 4:
            return resp(400, {"error": "Password too short"}, cors)
        old_hash = hashlib.sha256(old_pw.encode()).hexdigest()
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM admin_users WHERE id = %s AND password_hash = %s", (user_id, old_hash))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return resp(400, {"error": "Wrong old password"}, cors)
        new_hash = hashlib.sha256(new_pw.encode()).hexdigest()
        cur.execute("UPDATE admin_users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {"ok": True}, cors)

    # === ADMIN: update source ===
    if action == "update_source":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        sid = body.get("source_id")
        label = body.get("label", "").strip()
        icon = body.get("icon", "").strip()
        active = body.get("active")
        if not sid:
            return resp(400, {"error": "Missing source_id"}, cors)
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
        return resp(200, {"ok": True}, cors)

    # === ADMIN: create source ===
    if action == "create_source":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        key = body.get("key", "").strip().lower().replace(" ", "_")
        label = body.get("label", "").strip()
        icon = body.get("icon", "MessageCircle").strip()
        if not key or not label:
            return resp(400, {"error": "Key and label required"}, cors)
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
        return resp(200, {"ok": True, "id": new_id}, cors)

    # === ADMIN: delete source ===
    if action == "delete_source":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        sid = body.get("source_id")
        if not sid:
            return resp(400, {"error": "Missing source_id"}, cors)
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM source_options WHERE id = %s", (sid,))
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {"ok": True}, cors)

    # === ADMIN: reorder sources ===
    if action == "reorder_sources":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        order = body.get("order", [])
        if not order:
            return resp(400, {"error": "Order required"}, cors)
        conn = get_db()
        cur = conn.cursor()
        for i, sid in enumerate(order):
            cur.execute("UPDATE source_options SET sort_order = %s WHERE id = %s", (i, sid))
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {"ok": True}, cors)

    # === ADMIN: delete single response ===
    if action == "delete_response":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        response_id = body.get("response_id")
        if not response_id:
            return resp(400, {"error": "Missing response_id"}, cors)
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM responses WHERE id = %s", (response_id,))
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {"ok": True}, cors)

    # === ADMIN: bulk delete responses ===
    if action == "clear_responses":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        restaurant_id = body.get("restaurant_id")
        before_date = body.get("before_date")
        conn = get_db()
        cur = conn.cursor()
        if restaurant_id and before_date:
            cur.execute("DELETE FROM responses WHERE restaurant_id = %s AND created_at < %s", (restaurant_id, before_date))
        elif restaurant_id:
            cur.execute("DELETE FROM responses WHERE restaurant_id = %s", (restaurant_id,))
        elif before_date:
            cur.execute("DELETE FROM responses WHERE created_at < %s", (before_date,))
        else:
            return resp(400, {"error": "Specify restaurant_id or before_date"}, cors)
        deleted = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {"ok": True, "deleted": deleted}, cors)

    # === ADMIN: get hourly stats ===
    if action == "get_hourly_stats":
        user_id = check_auth(event)
        if not user_id:
            return resp(401, {"error": "Unauthorized"}, cors)
        restaurant_id = body.get("restaurant_id")
        conn = get_db()
        cur = conn.cursor()
        if restaurant_id:
            cur.execute(
                "SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as cnt "
                "FROM responses WHERE restaurant_id = %s GROUP BY hour ORDER BY hour",
                (restaurant_id,),
            )
        else:
            cur.execute(
                "SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as cnt "
                "FROM responses GROUP BY hour ORDER BY hour"
            )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        hourly = {h: 0 for h in range(24)}
        for r in rows:
            hourly[r[0]] = r[1]
        return resp(200, {"hourly": [{"hour": h, "count": c} for h, c in hourly.items()]}, cors)

    return resp(400, {"error": "Unknown action"}, cors)
