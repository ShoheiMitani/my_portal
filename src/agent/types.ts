export interface Env {
	AI: Ai;
	DB: D1Database;
	TrendCollector: DurableObjectNamespace;
	SLACK_SIGNING_SECRET: string;
	SLACK_BOT_TOKEN: string;
	X_CLIENT_ID: string;
	X_CLIENT_SECRET: string;
	X_USER_ID: string;
}

export interface FeedArticle {
	url: string;
	title: string;
	description: string;
	publishedAt: string;
	metadata: Record<string, unknown>;
}

export interface ArticleWithContent extends FeedArticle {
	content: string;
}

export interface Channel {
	id: string;
	slug: string;
	name: string;
	channel_type: string;
	config: string;
}
