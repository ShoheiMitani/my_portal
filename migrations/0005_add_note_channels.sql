-- Migration number: 0005  Seed: note.com テクノロジーカテゴリチャネル

INSERT INTO channels (id, slug, name, channel_type, config) VALUES
	('ch_note_tech', 'note_tech', 'note テクノロジー', 'note_api', '{"api_url":"https://note.com/api/v1/categories/tech?note_intro_only=true","content_type":"blog"}');
