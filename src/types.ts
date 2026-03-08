export interface FeedEntry {
	title: string;
	link: string;
	date: Date;
	source: "Blog" | "Slide" | "Article";
	thumbnail: string;
}

export interface ArticleYmlEntry {
	title: string;
	date: string;
	link: string;
	thumbnail: string;
}

export interface TalkEntry {
	title: string;
	event: string;
	date: string;
	link: string;
	thumbnail: string;
}
