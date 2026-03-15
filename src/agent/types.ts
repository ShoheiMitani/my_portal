export interface Env {
	AI: Ai;
	DB: D1Database;
	TrendCollector: DurableObjectNamespace;
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
