# 大学生単位取得特化型学習アプリ TanE（タンイー）

大学生は単位取得にお金を惜しまない！ということでそれを支援しつつお金もいただくことを目的とした、SNS型単位取得支援アプリです。

---
## 環境構築
### 前提要件 (Prerequisites)

ローカル環境に以下のツールがインストールされていることを確認してください。

- **Node.js**: `v20.x` 以上推奨 (LTS)
- **パッケージマネージャー**: `npm`, `pnpm`, または `yarn`
- **Git**

バージョン確認コマンド:
```bash
node -v
npm -v
git --version
```

### 依存パッケージのインストール
```bash
npm install
# または pnpm install / yarn install / bun install
```

### 環境変数の設定
`.env.example` をコピーして `.env.local` を作成し、値を埋めてください。

```bash
cp .env.example .env.local
```

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | Gemini API キー。[Google AI Studio](https://aistudio.google.com/apikey) で取得。**サーバー専用**（`NEXT_PUBLIC_` を付けない） |
| `GEMINI_MODEL` | - | 使用モデル。未設定時は `gemini-3.6-flash`（無料枠） |

> `.env.local` は Git 管理外です。API キーはクライアントには一切渡らず、Route Handler（サーバー）内でのみ使用されます。

### 動作確認
`npm run dev` 後、`http://localhost:3000/dev/generate` で問題生成 API を試せます。

<br>
<br>

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 概要

大学生は単位取得にお金を惜しまない！ということで、それを支援しつつお金もいただくアプリ。
AI をゴリゴリ活かしたい（無料枠だと Gemini API）。

## 機能

### 問題作成機能

- ユーザーは講義ごとに棚（フォルダ）を作ることができる
- 講義資料をアップすることで問題を作ることができる（Gemini API 無料枠を利用。プレゼンで実際に運用する想定では有料枠）
- テキストベースで問題が作れるだけでなく、PDF として出力できる（印刷までしたい）
- 過去問を参照し、それにそっくりな類似問題を出力できる（要確認）

### グループ参加

- 同じ学科の友人グループなどでアプリ上にグループを作成
- グループで同じ棚を使用できる（非表示設定可）（著作権の都合で、講義資料は各個人のみ閲覧可）
- 生成した問題集や個人で手に入れた資料を共有（著作権の注意書き）
- グループで勉強する時間・場所を決め、共有できる
- 共有された勉強タスクを Google カレンダーへエクスポート可能

### レポート対策

- レポートなどの課題に対して、期限とともに棚へ追加可能
- 課題に取り組むのにかかった時間とコメントをグループへ投稿可能

### 日頃復習割（実装はしない、プレゼンで口述）

- 学生の勉学向上心につけこむ制度
- テスト期間外の利用、継続的な課金を促すねらい
- 学期契約かつ週一度の利用を達成すると割引

## 技術スタック

- **言語**: HTML, CSS, TypeScript
- **フレームワーク**: Next.js
- **データベース (BaaS)**: Supabase（ストレージも）
- **API**: Gemini API, Google Calendar API
- **デプロイツール**: Vercel（予定）

## Gemini API 連携（問題生成）

問題生成はすべてサーバー側（Route Handler）で行い、API キーはクライアントに出さない。

### 構成

| パス | 役割 |
| --- | --- |
| `lib/gemini/client.ts` | `GoogleGenAI` のシングルトン。`GEMINI_API_KEY` を読む唯一の場所 |
| `lib/gemini/config.ts` | モデル名 / 生成パラメータ / ファイル上限などの設定値 |
| `lib/gemini/schema.ts` | 問題データの型（`Question` / `QuestionSet`）と構造化出力スキーマ |
| `lib/gemini/prompts.ts` | プロンプト生成 |
| `lib/gemini/files.ts` | Gemini Files API へのアップロードと ACTIVE 待ち |
| `lib/gemini/generateQuestions.ts` | 上記を束ねる中核関数。生成後に各図の SVG を検証する |
| `lib/svg/validateSvg.ts` | Gemini 生成 SVG のサーバー側バリデーション（書き換えず、怪しければ図ごと破棄） |
| `app/api/questions/generate/route.ts` | `POST` エンドポイント（`multipart/form-data`） |
| `components/QuestionPaper.tsx` | 問題セットを A4（コピー用紙）比率の問題用紙として描画。`window.print()` → 「PDF として保存」で出力 |
| `components/MathText.tsx` | LaTeX（`$...$` / `$$...$$`）混じりのテキストを KaTeX で描画 |
| `components/Figure.tsx` | 問題文に添える図（インライン SVG）。DOMPurify を通して描画 |

### 生成フロー

```
ブラウザ ──(FormData: file 1つ + 追加指示)──▶ POST /api/questions/generate
                                                  │  GEMINI_API_KEY はサーバーのみ
                                                  ▼
                                Gemini Files API にアップロード → ACTIVE 待ち
                                                  ▼
                        generateContent（responseSchema で JSON 構造化出力）
                                                  ▼
                        { questionSet } を返す（後片付けでファイル削除）
                                                  ▼
        フロント: A4 問題用紙 HTML に描画 ＋ 解答・解説をテキスト表示（数式は KaTeX）
```

### 入力

- ファイルは **1つ**（PDF / テキスト / 画像）。それが講義資料か過去問かは Gemini が中身から判断する
  - 講義資料と判断 → 資料の内容から問題を生成
  - 過去問と判断 → 傾向・形式・難易度を分析し、そっくりな類似問題を生成
- 問題数・難易度・出題形式は指定不要（資料の分量と内容から Gemini が自動決定。目安 5〜10問）
- 任意で「追加の指示」（範囲の限定など）を渡せる

### 出力

- `QuestionSet` = `{ title, questions: { prompt, figure?, answer?, explanation? }[] }` のフラット構造（採点機能は持たない）
- 選択式にする場合、選択肢は `prompt` 本文に `ア. / イ. / …` の形式で含まれる
- 問題文・解答・解説の数式はすべて LaTeX。`components/MathText.tsx` が KaTeX で描画する
- **図**: 幾何・グラフなど図が必須の問題にのみ `figure` が付く（問題文のみ。解説の図は対象外）
  - `figure.svg` は**図形・線・軸だけ**（`<text>` は使わせない）
  - 文字・数式ラベルは `figure.labels: { x, y, tex, anchor? }[]`（viewBox 座標＋LaTeX）で返させ、
    `components/Figure.tsx` が **KaTeX で描画して SVG の上に絶対配置で重ねる** → `y = x^2` や `\frac` も本文と同じ体裁で表示される
  - サーバー側 `lib/svg/validateSvg.ts` で SVG を検証（怪しければ図ごと破棄し問題文は残す）、
    描画直前に `components/Figure.tsx` が DOMPurify で再サニタイズ
- 問題用紙は `components/QuestionPaper.tsx` が A4 固定テンプレートに差し込む。`@page` 余白＋`@media print`（`app/globals.css`）で複数ページに流して印刷される

### モデルとコスト

- 開発 / デモは無料枠の `gemini-2.5-flash`（`GEMINI_MODEL` で差し替え可）
- 無料枠には RPM / RPD 制限があり、429 は API から `{ error }` (HTTP 429) で返す
- 本番運用時は有料枠へ

### 補足・制約

- Files API のファイルは API キー単位・48 時間で自動失効。問題集や資料の恒久保存は Supabase 側で行う（別タスク）
- 資料はブラウザ → 自前サーバー → Gemini と流れるため、Vercel デプロイ時はサーバーレス関数のボディ上限（約 4.5MB）が実質の上限（現状 4MB で制限）。大きい資料は将来ブラウザから Storage へ直接アップロードする設計に移行
- 著作権上、講義資料は各個人のみ閲覧（共有対象は生成された問題集など）

## ページ

- ボトムバー / サイドバー（画面比率で切り替えられるように）
- ホーム画面
- 課題一覧
- グループ情報
- ログアウト画面

### ホーム画面

- 上に締め切りの近い課題（7 日以内）
- その下に棚一覧を表示

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
