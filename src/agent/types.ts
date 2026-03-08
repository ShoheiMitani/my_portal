export interface RssArticle {
	url: string;
	title: string;
	description: string;
	publishedAt: string;
	bookmarkCount: number;
}

export interface StoredArticle {
	id: string;
	url: string;
	title: string;
	description: string;
	published_at: string;
	bookmark_count: number;
	source: string;
	created_at: string;
}

export interface Interest {
	id: string;
	keyword: string;
	description: string;
}
