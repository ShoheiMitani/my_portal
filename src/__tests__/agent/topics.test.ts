import { describe, expect, it } from "vitest";
import {
	buildGroupingPrompt,
	groupByCategory,
	markDemotedTopics,
	parseLLMResponse,
	splitIntoChunks,
	titleSimilarity,
} from "../../agent/topics";
import type { TopicPreference } from "../../agent/topics";

const ARTICLES = [
	{
		id: "a1",
		title: "仕様駆動開発の是非",
		description: "エンジニアの間で議論白熱",
		url: "https://example.com/1",
		published_at: "2026-03-15",
		channel_name: "はてなホットエントリ",
	},
	{
		id: "a2",
		title: "仕様駆動開発がXで話題に",
		description: "AI時代の実装シフト",
		url: "https://example.com/2",
		published_at: "2026-03-15",
		channel_name: "はてなホットエントリ",
	},
	{
		id: "a3",
		title: "Rails 8の新機能まとめ",
		description: "新しいフレームワーク機能",
		url: "https://example.com/3",
		published_at: "2026-03-14",
		channel_name: "TechRacho",
	},
	{
		id: "a4",
		title: "Rails 8のパフォーマンス改善",
		description: "ベンチマーク比較",
		url: "https://example.com/4",
		published_at: "2026-03-14",
		channel_name: "Rails Blog",
	},
];

describe("parseLLMResponse", () => {
	it("正常なJSON配列をパースできる", () => {
		const text = `[
			{"title": "仕様駆動開発が話題", "summary": "エンジニア間で議論白熱中", "article_ids": ["a1", "a2"]},
			{"title": "Rails 8の注目ポイント", "summary": "新機能とパフォーマンス改善", "article_ids": ["a3", "a4"]}
		]`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result).toHaveLength(2);
		expect(result[0].title).toBe("仕様駆動開発が話題");
		expect(result[0].article_ids).toEqual(["a1", "a2"]);
		expect(result[1].title).toBe("Rails 8の注目ポイント");
		expect(result[1].article_ids).toEqual(["a3", "a4"]);
	});

	it("JSON以外のテキストが前後にあっても抽出できる", () => {
		const text = `以下がグルーピング結果です。
[{"title": "仕様駆動開発", "summary": "概要", "article_ids": ["a1", "a2"]}]
以上です。`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("仕様駆動開発");
	});

	it("存在しないarticle_idは除去される", () => {
		const text = `[{"title": "テスト", "summary": "概要", "article_ids": ["a1", "a2", "nonexistent"]}]`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result[0].article_ids).toEqual(["a1", "a2"]);
	});

	it("article_idが1件のグループも含まれる（source_count降順でソートされる）", () => {
		const text = `[
			{"title": "1件だけ", "summary": "概要", "article_ids": ["a1"]},
			{"title": "2件以上", "summary": "概要", "article_ids": ["a3", "a4"]}
		]`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result).toHaveLength(2);
		expect(result[0].title).toBe("2件以上");
		expect(result[1].title).toBe("1件だけ");
	});

	it("article_idが0件のグループは除外される", () => {
		const text = `[
			{"title": "0件", "summary": "概要", "article_ids": []},
			{"title": "1件", "summary": "概要", "article_ids": ["a1"]}
		]`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("1件");
	});

	it("不正なJSONの場合は空配列を返す", () => {
		expect(parseLLMResponse("not json at all", ARTICLES)).toEqual([]);
		expect(parseLLMResponse("", ARTICLES)).toEqual([]);
	});

	it("不正な構造の要素はスキップされる", () => {
		const text = `[
			{"title": 123, "summary": "概要", "article_ids": ["a1", "a2"]},
			{"title": "正常", "summary": "概要", "article_ids": ["a3", "a4"]}
		]`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("正常");
	});

	it("トピックがsource_count降順でソートされる", () => {
		const text = `[
			{"title": "1件トピック", "summary": "概要", "article_ids": ["a1"]},
			{"title": "3件トピック", "summary": "概要", "article_ids": ["a1", "a2", "a3"]},
			{"title": "2件トピック", "summary": "概要", "article_ids": ["a3", "a4"]}
		]`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result).toHaveLength(3);
		expect(result[0].title).toBe("3件トピック");
		expect(result[0].article_ids).toHaveLength(3);
		expect(result[1].title).toBe("2件トピック");
		expect(result[1].article_ids).toHaveLength(2);
		expect(result[2].title).toBe("1件トピック");
		expect(result[2].article_ids).toHaveLength(1);
	});

	it("記事リストが空の場合は空配列を返す", () => {
		const text = `[{"title": "テスト", "summary": "概要", "article_ids": ["a1"]}]`;
		const result = parseLLMResponse(text, []);
		expect(result).toEqual([]);
	});

	it("前置きに[]が含まれていても最後のJSON配列を正しく抽出する", () => {
		const text = `以下の[ポイント]を踏まえてグルーピングしました。
[{"title": "仕様駆動開発", "summary": "概要", "article_ids": ["a1", "a2"]}]`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("仕様駆動開発");
	});

	it("シングルクォートのJS形式でもパースできる", () => {
		const text = `[
  {
    title: 'AIのセキュリティ',
    summary: '概要です',
    article_ids: [
      'a1',
      'a2'
    ]
  },
  {
    title: 'Rails 8',
    summary: '新機能',
    article_ids: [
      'a3',
      'a4'
    ]
  }
]`;

		const result = parseLLMResponse(text, ARTICLES);
		expect(result).toHaveLength(2);
		expect(result[0].title).toBe("AIのセキュリティ");
		expect(result[1].title).toBe("Rails 8");
	});
});

describe("splitIntoChunks", () => {
	it("配列をチャンクサイズで分割する", () => {
		const items = [1, 2, 3, 4, 5];
		const chunks = splitIntoChunks(items, 2);
		expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
	});

	it("チャンクサイズ以下の配列はそのまま1チャンクになる", () => {
		const items = [1, 2];
		const chunks = splitIntoChunks(items, 5);
		expect(chunks).toEqual([[1, 2]]);
	});

	it("空配列は空配列を返す", () => {
		expect(splitIntoChunks([], 3)).toEqual([]);
	});
});

describe("groupByCategory", () => {
	it("同一カテゴリの記事をグルーピングする", () => {
		const annotations = [
			{ id: "a1", category: "AI", summary: "OpenAIの新モデル発表" },
			{ id: "a2", category: "AI", summary: "GPT-5の性能比較" },
			{ id: "a3", category: "Rails", summary: "Rails 8の新機能" },
			{ id: "a4", category: "Rails", summary: "Rails移行ガイド" },
			{ id: "a5", category: "AI", summary: "AI安全性の議論" },
		];

		const groups = groupByCategory(annotations);
		expect(groups).toHaveLength(2);

		const aiGroup = groups.find((g) => g.category === "AI");
		expect(aiGroup?.articles).toHaveLength(3);
		expect(aiGroup?.articles.map((a) => a.id)).toEqual(["a1", "a2", "a5"]);

		const railsGroup = groups.find((g) => g.category === "Rails");
		expect(railsGroup?.articles).toHaveLength(2);
	});

	it("空配列は空配列を返す", () => {
		expect(groupByCategory([])).toEqual([]);
	});

	it("1記事のカテゴリも含まれる", () => {
		const annotations = [
			{ id: "a1", category: "AI", summary: "要約" },
			{ id: "a2", category: "Go", summary: "要約" },
		];

		const groups = groupByCategory(annotations);
		expect(groups).toHaveLength(2);
	});
});

describe("titleSimilarity", () => {
	it("同一タイトルは1を返す", () => {
		expect(titleSimilarity("GPT-5.4 Omni発表", "GPT-5.4 Omni発表")).toBe(1);
	});

	it("表記ゆれ程度の差分は高い類似度になる", () => {
		const sim = titleSimilarity("GPT-5.4 Omni発表", "GPT-5.4 Omniが発表");
		expect(sim).toBeGreaterThan(0.6);
	});

	it("無関係なタイトルは低い類似度になる", () => {
		const sim = titleSimilarity("Rails 8リリース", "GPT-5.4 Omni発表");
		expect(sim).toBeLessThan(0.2);
	});

	it("空文字は0を返す", () => {
		expect(titleSimilarity("", "GPT-5.4")).toBe(0);
	});
});

describe("markDemotedTopics", () => {
	const dislikes: TopicPreference[] = [
		{
			preference: "dislike",
			topic_title: "OpenAIの新モデル発表",
			topic_summary: "OpenAIが新モデルを発表した",
			category: "AI",
		},
	];

	it("dislikeとタイトルが強く類似するトピックにdemotedを立てる", () => {
		const topics = [
			{
				title: "OpenAIが新モデルを発表",
				summary: "概要",
				article_ids: ["a1", "a2", "a3"],
				category: "AI",
			},
			{
				title: "Rails 8リリース",
				summary: "概要",
				article_ids: ["a4"],
				category: "Rails",
			},
		];

		const result = markDemotedTopics(topics, dislikes);
		expect(result[0].title).toBe("OpenAIが新モデルを発表");
		expect(result[0].demoted).toBe(true);
		expect(result[1].title).toBe("Rails 8リリース");
		expect(result[1].demoted).toBe(false);
	});

	it("カテゴリが一致する場合は中程度の類似度でも降格する", () => {
		const railsDislike: TopicPreference[] = [
			{
				preference: "dislike",
				topic_title: "Rails 8の新機能まとめ",
				topic_summary: "新機能の概要",
				category: "Rails",
			},
		];
		const topics = [
			{
				title: "Rails 8.1の機能解説",
				summary: "概要",
				article_ids: ["a1", "a2"],
				category: "Rails",
			},
			{
				title: "GoのWebフレームワーク比較",
				summary: "概要",
				article_ids: ["a3"],
				category: "Go",
			},
		];

		const result = markDemotedTopics(topics, railsDislike);
		expect(result[0].demoted).toBe(true);
		expect(result[1].demoted).toBe(false);
	});

	it("カテゴリが異なる場合は中程度の類似度では降格しない", () => {
		const topics = [
			{
				title: "Rails 8.1の機能解説",
				summary: "概要",
				article_ids: ["a1"],
				category: "AI",
			},
		];
		const railsDislike: TopicPreference[] = [
			{
				preference: "dislike",
				topic_title: "Rails 8の新機能まとめ",
				topic_summary: "新機能の概要",
				category: "Rails",
			},
		];

		const result = markDemotedTopics(topics, railsDislike);
		expect(result[0].demoted).toBe(false);
	});

	it("dislikeがなければ全トピックがdemoted=falseになる", () => {
		const topics = [
			{ title: "1件", summary: "概要", article_ids: ["a1"], category: "AI" },
			{
				title: "3件",
				summary: "概要",
				article_ids: ["a1", "a2", "a3"],
				category: "AI",
			},
		];

		const result = markDemotedTopics(topics, []);
		expect(result.every((t) => t.demoted === false)).toBe(true);
	});
});

describe("buildGroupingPrompt", () => {
	const group = {
		category: "AI",
		articles: [
			{ id: "a1", summary: "GPT-5.4 Omniの発表について" },
			{ id: "a2", summary: "NVIDIAのAIインフラ投資" },
		],
	};

	it("好みが未登録なら好みセクションを含まない", () => {
		const prompt = buildGroupingPrompt(group, []);
		expect(prompt).not.toContain("## ユーザーの好み");
		expect(prompt).toContain(
			"すべての記事を必ずいずれかのトピックに割り当ててください。どのトピックにも属さない記事があってはいけません",
		);
	});

	it("dislikeが除外指示として含まれる", () => {
		const prompt = buildGroupingPrompt(group, [
			{
				preference: "dislike",
				topic_title: "暗号資産の価格変動",
				topic_summary: "ビットコイン価格の乱高下",
				category: "ビジネス",
			},
		]);
		expect(prompt).toContain("## ユーザーの好み");
		expect(prompt).toContain("「興味なし」と登録した過去の話題");
		expect(prompt).toContain("- 暗号資産の価格変動: ビットコイン価格の乱高下");
		// 全記事割り当ての原則は維持しつつ、dislike該当分のみ除外を許可する
		expect(prompt).toContain(
			"すべての記事を必ずいずれかのトピックに割り当ててください。ただし下記「ユーザーの好み」の「興味なし」に明確に該当する記事だけは除外して構いません",
		);
		expect(prompt).toContain("それ以外の記事を除外してはいけません");
	});

	it("likeが優先指示として含まれる", () => {
		const prompt = buildGroupingPrompt(group, [
			{
				preference: "like",
				topic_title: "Rustの非同期ランタイム",
				topic_summary: "tokioの新バージョン",
				category: "Rust",
			},
		]);
		expect(prompt).toContain("「興味あり」と登録した過去の話題");
		expect(prompt).toContain("- Rustの非同期ランタイム");
		// likeのみの場合は全記事割り当てルールは維持される
		expect(prompt).toContain(
			"すべての記事を必ずいずれかのトピックに割り当ててください。どのトピックにも属さない記事があってはいけません",
		);
	});
});
