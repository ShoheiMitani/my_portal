-- Migration number: 0003  Seed: 初期チャネル

INSERT INTO channels (id, slug, name, channel_type, config) VALUES
	('ch_hatena_hotentry', 'hatena_hotentry_rss', 'はてなホットエントリ', 'rss', '{"feed_url":"https://b.hatena.ne.jp/hotentry/it.rss"}'),
	('ch_openai', 'openai_blog_rss', 'OpenAI Engineering', 'rss', '{"feed_url":"https://openai.com/blog/rss.xml"}'),
	('ch_ml_bear', 'ml_bear_times_rss', 'ML Bear Times', 'rss', '{"feed_url":"https://www.ml-bear-times.com/feed"}'),
	('ch_techracho_rails', 'techracho_ruby_rails_rss', 'TechRacho Ruby/Rails', 'rss', '{"feed_url":"https://techracho.bpsinc.jp/category/ruby-rails-related/feed"}'),
	('ch_rails_blog', 'rails_blog_atom', 'Ruby on Rails Blog', 'atom', '{"feed_url":"https://rubyonrails.org/feed.xml"}'),
	('ch_ruby_news', 'ruby_news_rss', 'Ruby公式ニュース', 'rss', '{"feed_url":"https://www.ruby-lang.org/ja/feeds/news.rss"}'),
	('ch_dhh', 'dhh_blog_atom', 'DHH', 'atom', '{"feed_url":"https://world.hey.com/dhh/feed.atom"}');
