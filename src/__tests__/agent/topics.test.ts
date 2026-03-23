import { describe, expect, it } from "vitest";
import {
	groupByCategory,
	parseLLMResponse,
	splitIntoChunks,
} from "../../agent/topics";

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
