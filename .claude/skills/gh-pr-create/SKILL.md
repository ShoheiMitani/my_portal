---
name: gh-pr-create
description: Creates a GitHub PR with the gh CLI. Generates title and body from the diff against main (intro, "This PR makes N main changes", Additionally), then runs gh pr create. Use when creating a PR, "ghでPR作成", "PRを出して", "mainとの差分でタイトルと本文を考えて", or when preparing a pull request.
---

# gh で PR 作成

main との差分から PR のタイトルと本文を生成し、`gh pr create` で PR を作成する。タイトル・本文は指定フォーマットに従う。

## 前提

- カレントブランチは main ではないこと（main の場合は PR 作成前にブランチを切るよう伝える）。
- `gh` CLI がインストール済みで認証済み（`gh auth status` で確認可能）。
- 差分が空（main と同一）の場合は PR 作成せず、「main との差分がありません」と伝える。

---

## Part 1: タイトルと本文の生成

### 1.1 差分の取得

- `git diff main...HEAD --stat` で変更ファイル一覧を把握する。
- `git diff main...HEAD` で内容を確認する（必要に応じて `git log main..HEAD --oneline` でコミット単位も把握する）。

### 1.2 変更の分類

- 機能追加・UI変更・リファクタ・設定変更など、**意味の塊**で 3〜5 個の「主な変更」にまとめる。
- 主な変更に含めない細かい修正（文言調整、ルート分割、日時表示の追加など）は「Additionally」に回す。

### 1.3 Description の構成

以下のテンプレートに沿って本文を書く。

```markdown
This PR makes [N] main changes:

1. **[変更の見出し]** — [1〜3文で内容。重要な箇所は file:line-line で参照]
2. **[変更の見出し]** — [同様]
3. ...

Additionally: [カンマ区切りまたは短文で、細かい変更を列挙]. [該当する場合は file:line-line を付ける]
```

- **主な変更**: 各項目は「見出し — 説明」形式。重要な定義・ロジックの場所を `path/to/file.ts:123-145` のように書く。
- **Additionally**: 1文または短い箇条書き。複数は「, and」や「;」でつなぐ。

### 1.4 PR Title のルール

- 50 文字前後で、**何をしたかが分かるように**書く。
- 動詞で始める（Add, Fix, Refactor, Introduce, Replace など）か、名詞句で要約する。
- 例: `Add think tool and subagent modes; redesign chat UI`

### 1.5 生成時の注意

- 差分に含まれていない変更は書かない。推測する場合は「差分からは未確認だが、〜の可能性」と明示する。
- 行番号は `git diff main...HEAD` に基づき可能な範囲で正確に。ずれる場合は「付近」と添える。

### 1.6 例（Guardie の場合）

**Title**: `Add think tool, subagent modes, and chat UI redesign`

**Description**:
```
This PR makes three main changes:

1. Chat UI redesign — The thread list sidebar is replaced with a compact header bar containing a dropdown selector. Threads are grouped by date ("Today", "Yesterday", etc.) instead of showing relative timestamps. Thread titles are auto-generated from the first user message via a lightweight LLM call in GeneralChatAgent.

2. New think tool — A structured planning tool (agent-tools.ts:1411-1415) that the agent must call before invoking any other tool. It captures user_intent, ambiguities (with candidates and impact), a plan, and optionally questions_for_user. This forces a clarification loop: think → ask user → think again with confirmed_understanding → proceed.

3. Subagent modes (explore / deep_dive) — The investigate_codebase and investigate_performance tools now accept a mode parameter that controls depth. explore allows max 5 tool calls for quick reconnaissance; deep_dive allows 15 for focused investigation. Each mode gets a tailored system prompt suffix and a hard tool-call budget. New SUBAGENT_USAGE_GUIDELINES (subagent-prompts.ts:211-269) enforce a "Working Out Loud" pattern: explain intent before calling a tool, interpret results after.

Additionally: prompts now include the current JST datetime (persona.ts:19-35), tool names in the chat UI show friendly Japanese labels instead of raw identifiers, and routes/api.ts was split into focused sub-routers.
```

---

## Part 2: Push & PR 作成の実行

### 2.1 コマンド実行

同梱のスクリプト `.claude/skills/gh-pr-create/scripts/push-and-create-pr.sh` を使って、push と PR 作成を一括で行う。

```bash
bash .claude/skills/gh-pr-create/scripts/push-and-create-pr.sh \
  --title "<生成したタイトル>" \
  --body "<生成した Description>" \
  [--base main] \
  [--draft]
```

スクリプトは以下を順番に実行する:
1. `git push -u origin <current-branch>` でリモートに push
2. `gh pr create` で PR を作成

**注意:**
- `--title` と `--body` は必須。
- `--body` に改行やマークダウンを含む場合は `$'...'` 記法またはヒアドキュメントで渡す。
- タイトルに `"` が含まれる場合はエスケープするかシングルクォートで囲む。

### 2.2 結果の確認

- 成功時: スクリプトが表示する PR URL をユーザーに伝える。
- 失敗時: `gh auth status` や `gh repo view` で認証・リポジトリを確認し、エラーに従って対処するよう案内する。

---

## オプション

| オプション | 意味 | 使いどころ |
|-----------|------|------------|
| `--base main` | ベースブランチ | デフォルトが main でないとき（デフォルト: main） |
| `--draft` | 下書き PR | ユーザーが「下書きで」「draft で」と言ったとき |

---

## タイトル・本文だけ欲しい場合

ユーザーが「PR は作らずタイトルと本文だけ出して」と言った場合は、Part 1 のみ実行し、Title 1 行 + 空行 + Description の形で出力する。Part 2 は実行しない。
