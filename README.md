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
