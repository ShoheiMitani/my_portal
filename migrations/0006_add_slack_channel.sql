-- Slack共有リンク用チャネルを追加
INSERT INTO channels (id, slug, name, channel_type, config) VALUES
  ('ch_slack_shared', 'slack_shared', 'Slack共有リンク', 'slack', '{"content_type":"blog"}');
