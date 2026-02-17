
ALTER TABLE restaurants ADD COLUMN slug VARCHAR(100) UNIQUE;
ALTER TABLE restaurants ADD COLUMN password_hash VARCHAR(255);

UPDATE restaurants SET slug = 'ispanskiy' WHERE name = 'Испанский';
UPDATE restaurants SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;

CREATE TABLE source_options (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'MessageCircle',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO source_options (key, label, icon, sort_order) VALUES
('instagram', 'Instagram / соцсети', 'Instagram', 1),
('friends', 'Рекомендация друзей', 'Users', 2),
('internet_ads', 'Реклама в интернете', 'Globe', 3),
('banner', 'Баннер / вывеска', 'Signpost', 4),
('passerby', 'Проходил(а) мимо', 'Footprints', 5),
('other', 'Другое', 'MessageCircle', 6);
