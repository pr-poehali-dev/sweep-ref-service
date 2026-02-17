
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_settings (key, value) VALUES ('telegram_chat_id', '') ON CONFLICT DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('telegram_notifications_enabled', 'false') ON CONFLICT DO NOTHING;
