# DB 設計（Supabase）

TanE の永続化層は Supabase（Postgres + Auth + Storage）で構築する。本ドキュメントは
テーブル定義・RLS 方針・Storage 方針をまとめたもの。実行可能なマイグレーション SQL は
[`supabase/migrations/`](../supabase/migrations/) に置く。

## 前提となる設計判断

- **棚の共有**: 棚は常に個人が所有し、`shelf_shares` 中間テーブルでグループへ共有する
  （所有権そのものは移動しない）。非表示設定は `shelf_shares.visible` で表現する。
- **問題集の保存**: 生成した `QuestionSet`（[`lib/gemini/schema.ts`](../lib/gemini/schema.ts)）を
  そのまま `question_sets.content jsonb` に保存する。PDF は保存せず、従来通り
  `components/QuestionPaper.tsx` をブラウザで `window.print()` して都度出力する。
- **講義資料の著作権**: `materials`（講義資料・過去問）は所有者本人のみ閲覧可能。
  グループへ共有できるのは生成された**問題集のみ**。
- **カレンダー連携**: Google OAuth で実際にユーザーの Google カレンダーへイベントを書き込む
  （リンク生成だけではない）。
- **認証**: Supabase Auth の Google ログインを唯一の認証手段とする。

## テーブル一覧

すべて `public` スキーマ。共通カラム（各テーブルの定義から省略）:

```sql
id uuid primary key default gen_random_uuid(),
created_at timestamptz not null default now()
```

### profiles — ユーザープロフィール

`auth.users` の 1:1 拡張。ユーザー名はここから解決し、他のテーブルに文字列としては持たない。

| カラム | 型 | 説明 |
| --- | --- | --- |
| id | uuid PK | `auth.users(id)` 参照 |
| display_name | text | 表示名（Google プロフィールから初期値） |
| avatar_url | text | アイコン URL |

`auth.users` insert 時にトリガー（`handle_new_user`）で自動作成する。

### shelves — 棚（講義単位）

| カラム | 型 | 説明 |
| --- | --- | --- |
| owner_id | uuid FK→profiles | 所有者 |
| course_name | text | 講義名 |
| year | int | 年度 |
| term | text | 学期（例: "前期" / "後期"） |
| day_of_week | smallint | 曜日（0=日〜6=土） |
| period | smallint | 時限 |

### materials — 講義資料・過去問

**所有者本人のみ閲覧可能**（共有しない）。

| カラム | 型 | 説明 |
| --- | --- | --- |
| shelf_id | uuid FK→shelves | 所属する棚 |
| owner_id | uuid FK→profiles | 所有者 |
| storage_path | text | Storage 上のパス |
| file_name | text | 元ファイル名 |
| mime_type | text | MIME タイプ |
| size_bytes | bigint | サイズ |

### question_sets — 生成された問題集

| カラム | 型 | 説明 |
| --- | --- | --- |
| shelf_id | uuid FK→shelves | 所属する棚 |
| owner_id | uuid FK→profiles | 所有者 |
| source_material_id | uuid FK→materials, nullable | 生成元の資料（削除されても NULL で残る） |
| title | text | `QuestionSet.title` |
| content | jsonb | `QuestionSet`（[`lib/gemini/schema.ts`](../lib/gemini/schema.ts)）をそのまま保存 |

`content` の型は新規に定義せず `QuestionSet` を再利用する。読み出し後はキャストするだけで
`components/QuestionPaper.tsx` にそのまま渡せる。

### question_set_shares — 問題集のグループ共有

| カラム | 型 | 説明 |
| --- | --- | --- |
| question_set_id | uuid FK→question_sets | 共有する問題集 |
| group_id | uuid FK→groups | 共有先グループ |

`unique (question_set_id, group_id)`。

### groups — グループ

| カラム | 型 | 説明 |
| --- | --- | --- |
| name | text | グループ名 |
| invite_code | text unique | シリアルコード（参加用） |
| created_by | uuid FK→profiles | 作成者 |

### group_members — グループ所属

| カラム | 型 | 説明 |
| --- | --- | --- |
| group_id | uuid FK→groups | — |
| user_id | uuid FK→profiles | — |
| role | text | `'owner'` \| `'member'`（既定 `'member'`） |

PK は `(group_id, user_id)`。

### shelf_shares — 棚のグループ共有

| カラム | 型 | 説明 |
| --- | --- | --- |
| shelf_id | uuid FK→shelves | 共有する棚 |
| group_id | uuid FK→groups | 共有先グループ |
| visible | boolean | 非表示設定（既定 `true`） |

`unique (shelf_id, group_id)`。

### study_sessions — グループ勉強の予定

| カラム | 型 | 説明 |
| --- | --- | --- |
| group_id | uuid FK→groups | — |
| created_by | uuid FK→profiles | 作成者 |
| title | text | 予定名 |
| location | text | 場所 |
| starts_at | timestamptz | 開始日時 |
| ends_at | timestamptz | 終了日時 |

### assignments — 課題

| カラム | 型 | 説明 |
| --- | --- | --- |
| shelf_id | uuid FK→shelves | 講義（棚）への参照 |
| group_id | uuid FK→groups, nullable | 所属グループ |
| created_by | uuid FK→profiles | 作成者 |
| title | text | レポート名 |
| due_at | timestamptz | 期限 |

ホーム画面の「7 日以内の締切」は `due_at` を絞り込むだけで取得できる。

### assignment_reports — 課題結果投稿

| カラム | 型 | 説明 |
| --- | --- | --- |
| assignment_id | uuid FK→assignments | — |
| user_id | uuid FK→profiles | 投稿者（「ユーザ名」の代わり） |
| minutes_spent | int | かかった時間（分） |
| comment | text | コメント |

`unique (assignment_id, user_id)`（1人1件、再投稿で上書き）。

### google_credentials — Google OAuth トークン

**クライアントには一切公開しない**（RLS ポリシーを 1 つも作らず全拒否とし、
service-role キーを持つサーバー側からのみアクセスする）。

| カラム | 型 | 説明 |
| --- | --- | --- |
| user_id | uuid PK, FK→profiles | — |
| refresh_token | text | Google の refresh token |
| updated_at | timestamptz | 更新日時 |

### calendar_events — カレンダー書き込み済みイベント

| カラム | 型 | 説明 |
| --- | --- | --- |
| study_session_id | uuid FK→study_sessions | — |
| user_id | uuid FK→profiles | どのユーザーのカレンダーに書いたか |
| google_event_id | text | Google Calendar 側のイベント ID（更新・削除に使う） |

`unique (study_session_id, user_id)`。

## RLS（Row Level Security）

全テーブルで `enable row level security` を有効化する。

### 落とし穴: ポリシーの自己再帰

「グループのメンバーだけが読める」を `group_members` を直接参照するポリシーで書くと、
`group_members` 自身のポリシー評価が再帰し `infinite recursion detected in policy` になる。
これを避けるため、`SECURITY DEFINER` 関数を経由させる。

```sql
create function is_group_member(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;
```

全てのグループ関連ポリシーはこの関数を経由する。

同じ理由で、`question_sets` ⟷ `question_set_shares` の相互参照も再帰する
（`question_sets_select` が `question_set_shares` を、`question_set_shares_select` が
`question_sets` を参照）。`question_set_shares` 側の所有者判定を
`owns_question_set(qs_id uuid)`（SECURITY DEFINER）に逃がして依存を断ち切る。
[`20260901133538_fix_question_set_shares_recursion.sql`](../supabase/migrations/20260901133538_fix_question_set_shares_recursion.sql)
で修正済み（`0002_rls.sql` 自体は歴史的経緯でそのまま）。

### グループ参加はポリシーではなく関数で制御

「招待コードを知っている人だけが参加できる」は RLS だけでは表現できないため、
`join_group_by_code(code text)`（SECURITY DEFINER）を用意し、参加はこの関数経由に限定する。
`group_members` への直接 insert は許可しない。

### ポリシー方針一覧

| テーブル | SELECT | INSERT/UPDATE/DELETE |
| --- | --- | --- |
| profiles | 全員 | 本人のみ |
| materials | `owner_id = auth.uid()` のみ | 本人のみ |
| shelves | 本人、または `shelf_shares` 経由で `is_group_member` かつ `visible = true` | 本人のみ |
| question_sets | 本人、または `question_set_shares` 経由で `is_group_member` | 本人のみ |
| question_set_shares | `is_group_member` または `owns_question_set`（SECURITY DEFINER。再帰回避） | `owns_question_set` |
| groups | `is_group_member(id)` | 作成は誰でも可、更新・削除は `role = 'owner'` |
| group_members | `is_group_member(group_id)` | `join_group_by_code` 経由のみ insert、脱退は本人 |
| shelf_shares | `is_group_member(group_id)` | 対象棚の所有者 |
| study_sessions | `is_group_member(group_id)` | 作成はメンバー、更新・削除は作成者 |
| assignments | `is_group_member(group_id)`、または `shelf_id` の所有者 | 作成はメンバー、更新・削除は作成者 |
| assignment_reports | 対象課題のグループの `is_group_member`（`group_id` が非 NULL の課題のみ） | 本人の行のみ |
| google_credentials | **ポリシー無し（全拒否）** | サーバー（service-role）のみ |
| calendar_events | **ポリシー無し（全拒否）** | サーバー（service-role）のみ |

> `google_credentials` / `calendar_events` は [`0002_rls.sql`](../supabase/migrations/0002_rls.sql) で
> `enable row level security` だけ行い、ポリシーを 1 つも作っていない（= 全クライアントアクセス拒否）。
> 読み書きは admin クライアント経由のサーバーコードからのみ。

## Storage

- バケット `materials`（**private**）。
  [`supabase/migrations/20260901100630_storage.sql`](../supabase/migrations/20260901100630_storage.sql)
  で作成済み・適用済み（後述「現状の進捗」参照）。
- パス規則: `{user_id}/{material_id}/{file_name}`。
- Storage ポリシー: `(storage.foldername(name))[1] = auth.uid()::text` の本人のみ
  （`materials_storage_own`、[`0002_rls.sql`](../supabase/migrations/0002_rls.sql) で定義済み）。
- **アップロードはブラウザから anon キー＋RLS で直接** Storage へ行う（署名付き URL は不要）。
  クライアントで `crypto.randomUUID()` で `material_id` を採番し、パスとして使用。
  アップロード完了後に `materials` テーブルへ行を insert する。
  署名付き URL 発行エンドポイントは不要であり、Vercel のボディ上限も回避できる。
- 問題生成 API はファイル本体ではなく `materialId` を受け取り、サーバー側で Storage から
  ダウンロードして Gemini に渡す形に変更する（詳細はタスク「問題生成 API を `materialId` 受け取りに変更」参照）。

## 必要な環境変数

[`.env.example`](../.env.example) に記載済み（値は `.env.local` に設定済み・gitignore）。

| 変数 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon キー（クライアントで使用、RLS 前提） |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role キー（サーバー専用。`google_credentials` などの操作に使用） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth（ログイン＋カレンダー書き込み用。サーバー側でも読む） |
| `GEMINI_API_KEY` | 問題生成 API 用 |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | 任意。既定は [`lib/gemini/config.ts`](../lib/gemini/config.ts)（`gemini-3.6-flash` / `gemini-2.5-flash`） |

Google ログイン時、Calendar への書き込み権限（`calendar.events` スコープ）と
`access_type=offline` + `prompt=consent` を要求しないと refresh token が取得できない点に注意。

## 現状の進捗（引き継ぎ用）

- [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) と
  [`0002_rls.sql`](../supabase/migrations/0002_rls.sql) は実際の Supabase プロジェクトに
  適用済み（`supabase db push` で反映、差分なしを確認済み）。
- [`supabase/migrations/20260901100630_storage.sql`](../supabase/migrations/20260901100630_storage.sql)
  も適用済み。`materials` バケット（private）を作成した。Supabase MCP の `apply_migration`
  経由で適用したため、ファイル名は CLI 互換のタイムスタンプ版バージョン
  （`0003` ではなく `20260901100630`）になっている。以降のマイグレーションもこの形式に合わせること。
- Supabase クライアントの scaffolding は実装済み・動作確認済み:
  [`lib/supabase/client.ts`](../lib/supabase/client.ts)（ブラウザ用）、
  [`lib/supabase/server.ts`](../lib/supabase/server.ts)（Server Component / Route Handler 用、
  RLS 前提）、[`lib/supabase/admin.ts`](../lib/supabase/admin.ts)（service-role 用）、
  [`lib/supabase/types.ts`](../lib/supabase/types.ts)（暫定の DB 型定義）。
- [`proxy.ts`](../proxy.ts)（Next.js 16 で `middleware.ts` から改名されたセッション更新用ファイル）
  を実装し、`npm run dev` で `/` と `/dev/generate` が正常応答することを確認済み。
- `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` を設定済み。
- **Google ログイン実装は完了**（コード側）:
  - [`lib/supabase/auth.ts`](../lib/supabase/auth.ts) — `signInWithGoogle()` ヘルパー関数。
    `calendar.events` スコープ ＋ `access_type=offline` ＋ `prompt=consent` を指定済み。
    フロント側はログインボタンの `onClick` からこれを呼ぶだけでよい。
  - [`app/auth/callback/route.ts`](../app/auth/callback/route.ts) — OAuth コールバック Route Handler。
    `provider_refresh_token` を `google_credentials` へ upsert 済み。オープンリダイレクト対策あり。
  - `.env.example` に `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` の注記を追加済み
    （値はアプリから読まれず Supabase ダッシュボードに設定するもの）。
  - `app/auth/callback/route.ts` はコミット済み（`6058e7e`）。
  - **残りはダッシュボード側の設定作業のみ**（「完了済み」節参照）。
- 問題生成 API は `materialId` 受け取りに改修済み。ただし
  **生成結果を `question_sets` に保存する処理は未実装**（レスポンスで `{ questionSet }` を返すのみ）。
  → 今後のタスク 5 で対応。

## 既知の不整合・落とし穴（実装前に読む）

FE 調査で判明した、実装時に踏むと詰まる箇所。

1. ~~**グループ作成者が自分のグループを見られない**~~
   → **解消済み**（タスク 1）。`20260901131709_ui_alignment.sql` の `on_group_created` トリガー
   （`handle_new_group`, security definer）が insert 直後に owner 行を入れる。

2. **`POST /api/questions/generate` の `file` ブランチが未認証で通る**
   [`proxy.ts`](../proxy.ts) が `/api/*` を除外しているため。`materialId` ブランチだけが
   `getUser()` を通る（[`app/api/questions/generate/route.ts`](../app/api/questions/generate/route.ts) の `materialFromDatabase`）。
   → タスク 5 で `file` ブランチにも認証を入れる。

3. ~~**`lib/supabase/types.ts` の `Functions` が `Record<string, never>`**~~
   → **解消済み**（タスク 1）。`Functions` に `is_group_member` / `join_group_by_code` を手書き追加。

4. **`google_credentials.updated_at` が再ログインで更新されない**
   [`app/auth/callback/route.ts`](../app/auth/callback/route.ts) の upsert が `updated_at` を書いていない。
   自動更新トリガーも無い。実害は小さいが将来のトークン鮮度判定に注意。

5. **問題モデルが二重に存在する**
   [`app/demo-data.ts`](../app/demo-data.ts) の `questions`（`{ type, text, options }`）と
   [`lib/gemini/schema.ts`](../lib/gemini/schema.ts) の `QuestionSet`
   （`{ title, questions[].prompt / figure / answer / explanation }`）は別物。
   実データ化の際にデモ側（`questions` / `materials` / `deadlines` / `courses`）を捨てる。

6. **UI の `Course` 型と `shelves` テーブルがほぼ重ならない**
   [`app/types.ts`](../app/types.ts) の `Course`（`code / professor / room / tab / docs / quizzes / shared`）
   に対し `shelves` は `course_name / year / term / day_of_week / period`。
   → タスク 1 で `shelves` に `course_code` / `professor` / `room` / `color` を追加済み。
   タスク 2 で `Shelf` 型（`ShelfRow` ＋ 件数）を追加。`Course` の削除と差し替えはタスク 3。
   `schedule` 文字列は [`lib/format/schedule.ts`](../lib/format/schedule.ts) の
   `formatSchedule(day_of_week, period)` で組み立てる（逆パーサは作らない。入力は `<select>`）。

7. **共有された棚の件数表示に注意**（`lib/data/shelves.ts:listShelves`）
   `materials_all_own` により、他人から共有された棚の `materialCount` は必ず 0 になる
   （講義資料は共有しない設計なので正しい）。`sharedGroupIds` には
   `shelf_shares_select`（`is_group_member`）の都合で「自分が所属するグループへの共有」だけが載る。

## 開発方針

BE / FE は分けず、一貫して開発する。以下は残す技術判断。

### 原則: RLS 直叩き ＋ 必要な所だけ Route Handler

単純な CRUD（`shelves` / `materials` / `question_sets` / `groups` / `study_sessions` /
`shelf_shares` / `question_set_shares` / `profiles` 等）は
**ブラウザから `supabase-js` で直接叩き、RLS が認可を保証する**。
[`0002_rls.sql`](../supabase/migrations/0002_rls.sql) は全テーブルにポリシー済み。

Route Handler を置くのは以下のいずれかに該当する場合**のみ**:

1. **サーバー専用の秘密が要る**: `GEMINI_API_KEY` / service-role キー / Google refresh token
2. **RLS だけでは表現できない認可**: 招待コードでの参加（`join_group_by_code` RPC で解決済み）
3. **外部 API を叩く**: Gemini / Google Calendar

### 共通データアクセス層 `lib/data/`

各画面が生クエリを散らすと重複するため、テーブル単位で
`lib/data/{shelves,materials,questionSets,groups,studySessions,shares}.ts` に集約する。
戻り値は [`lib/supabase/types.ts`](../lib/supabase/types.ts) の `Row` 型をそのまま UI へ流す
（UI 独自の型 `app/types.ts:Course` は廃止）。

### Route Handler 一覧（現状）

| エンドポイント | 状態 | 要件 | 用途 |
| --- | --- | --- | --- |
| `GET /auth/callback` | 実装済み・コミット済み | service-role | Google OAuth コールバック（`google_credentials` upsert） |
| `GET /api/materials` | 実装済み | セッション | 自分の資料一覧（`CreateQuizModal` が使用） |
| `POST /api/questions/generate` | `materialId` 対応済み。**`question_sets` 保存は未実装** | `GEMINI_API_KEY` | 資料から問題生成 |
| `POST /api/calendar/events` | 実装済み・**UI 未接続** | refresh token + Calendar API | 勉強予定をグループ全員の Google Calendar へ |
| `DELETE /api/calendar/events/[id]` | 実装済み・**UI 未接続**（`[id]` = `study_session_id`） | refresh token + Calendar API | 上記の全員ぶん取り消し |

`POST /api/questions/generate` の詳細ペイロード/エラーは既存実装
（`multipart/form-data`、`file` か `materialId` の排他、`extraInstruction` ≤1000 字、
429 / 503+`Retry-After` / 502）を参照。カレンダー API の返り値形は:

```json
{ "created": [{ "user_id": "…", "event_id": "…" }],
  "skipped": [{ "user_id": "…", "reason": "no_credentials" | "already_synced" }],
  "failed":  [{ "user_id": "…", "error": "…", "reauth_required": true }] }
```

## 今後のタスク

デモ導線（**ログイン → 棚 → 資料アップロード → 問題生成 → 保存 → グループ共有 → 勉強会カレンダー**）
が通る順に並べる。各タスクは「対象 / やること / 完了条件」。

### 完了済み（コード側）

- **Google ログイン**: [`lib/supabase/auth.ts`](../lib/supabase/auth.ts)（`signInWithGoogle` / `signOut`）、
  [`app/login/page.tsx`](../app/login/page.tsx)、[`app/logout/page.tsx`](../app/logout/page.tsx)、
  [`app/auth/callback/route.ts`](../app/auth/callback/route.ts)、[`proxy.ts`](../proxy.ts)。
  残りは Supabase / Google Cloud のダッシュボード設定のみ。
- **`materials` Storage バケット**（private）: [`20260901100630_storage.sql`](../supabase/migrations/20260901100630_storage.sql) 適用済み。
- **Google Calendar Route Handler 2 本**: 実装済み（UI 未接続。タスク 7 で接続）。
- **Supabase クライアント scaffolding**: `lib/supabase/{client,server,admin,types}.ts`。
- **タスク 1（スキーマ差分）**: [`20260901131709_ui_alignment.sql`](../supabase/migrations/20260901131709_ui_alignment.sql)
  を MCP `apply_migration` で本番へ適用済み。`shelves` に `course_code` / `professor` /
  `room` / `color`（default `#5866c5`）を追加。`on_group_created` / `handle_new_group`
  トリガーで作成者を owner として `group_members` へ入れる（落とし穴 1 の解消）。
  [`lib/supabase/types.ts`](../lib/supabase/types.ts) の `shelves` 型と `Functions`
  （`is_group_member` / `join_group_by_code`）を手書き追随。
- **タスク 2（型・データアクセス層）**:
  - [`app/types.ts`](../app/types.ts) に `ShelfRow` / `Shelf`（= `ShelfRow` ＋ `materialCount` /
    `questionSetCount` / `sharedGroupIds`）を追加。`Course` は `@deprecated` 付きで残置（削除はタスク 3）。
  - [`lib/format/schedule.ts`](../lib/format/schedule.ts): `formatSchedule` / `DAY_LABELS` /
    `PERIOD_OPTIONS` / `SHELF_COLORS` / `pickShelfColor`。逆パーサは作らない。
  - [`lib/data/`](../lib/data/): `utils`（`unwrap` / `generateInviteCode`）、`shelves`、
    `materials`、`questionSets`、`groups`、`studySessions`、`shares`。
    全関数が `(supabase, …args)` シグネチャでブラウザ・サーバー両対応。
  - `listShelves` の件数集計は PostgREST 埋め込みを使わず単純クエリ 4 本を JS で畳む
    （手書き `Relationships: []` だと埋め込みで型が壊れるため）。
  - 検証用ハーネス [`app/dev/shelves/page.tsx`](../app/dev/shelves/page.tsx)。
- **RLS 再帰バグ修正**: [`20260901133538_fix_question_set_shares_recursion.sql`](../supabase/migrations/20260901133538_fix_question_set_shares_recursion.sql)。
  `question_sets` ⟷ `question_set_shares` の相互参照再帰を `owns_question_set` で解消（適用済み）。
  タスク 2 の `lib/data/shelves.ts:listShelves` がクライアントから初めて `question_sets` を
  SELECT したことで顕在化した既存バグ。

---

### 3. 棚（shelves）の実データ化

- **対象**: [`app/page.tsx`](../app/page.tsx)（`L26-28` の `useState(initialCourses)` 周辺）、
  [`app/components/modals/ShelfModal.tsx`](../app/components/modals/ShelfModal.tsx)、
  [`app/components/views/CourseView.tsx`](../app/components/views/CourseView.tsx)
- **やること**:
  - `courses` / `selectedCode` / `courseMaterials` を実クエリへ。
    **空配列・ローディング・エラーの 3 状態を追加**（現在 `selectedCode = initialCourses[0].code`
    は空配列でクラッシュする）
  - `ShelfModal` → `shelves` の insert / update。`page.tsx:saveCourse` は `id` ベースの upsert に
  - `CourseView.tsx` のタブ数値リテラル（`講義資料 <span>6</span>` / `問題集 <span>3</span>`）を実カウントに
  - `CourseView.tsx` の資料行のダミー値（`[42,38,51,45]ページ` / `8月[3,10,17,24]日追加`）を
    実列（`size_bytes` は無いので削除、`created_at`）へ
- **完了条件**: 棚の作成・編集・削除がリロード後も残る。

### 4. 資料アップロードの実装

- **対象**: [`app/components/modals/MaterialModal.tsx`](../app/components/modals/MaterialModal.tsx)、
  [`app/page.tsx`](../app/page.tsx)（`MaterialModal` の `onAdd`）、`lib/data/materials.ts`
- **やること**:
  - `MaterialModal` は現在 `file.name` だけを親へ渡して **File 本体を捨てている**。
    `crypto.randomUUID()` で material_id を採番 →
    `supabase.storage.from("materials").upload("{user_id}/{material_id}/{file_name}")` →
    `materials.insert({ id, shelf_id, owner_id, storage_path, file_name, mime_type, size_bytes })`
  - アップロード中／失敗の表示
- **完了条件**: アップした資料が `CourseView` の資料タブと `CreateQuizModal`
  の資料一覧（`GET /api/materials`）の両方に出る。

### 5. 問題集の永続化

- **対象**: [`app/api/questions/generate/route.ts`](../app/api/questions/generate/route.ts)、
  [`app/components/modals/CreateQuizModal.tsx`](../app/components/modals/CreateQuizModal.tsx)、
  [`app/page.tsx`](../app/page.tsx)（`generatedQuiz`）、
  [`app/components/views/QuizView.tsx`](../app/components/views/QuizView.tsx)、
  [`app/components/views/CourseView.tsx`](../app/components/views/CourseView.tsx)
- **やること**:
  - Route Handler に `shelfId` を受け取らせ、生成後 `question_sets` へ insert して行を返す
    （`source_material_id` も埋める。`materialId` ブランチならその値）
  - 同時に `file` ブランチにも `getUser()` を入れて未認証穴（落とし穴 2）を塞ぐ
  - `page.tsx:generatedQuiz` をメモリ保持から「保存済み ID」へ
  - `CourseView` の問題集リテラル 3 件を実クエリへ。`navigate("quiz")` に `question_set_id` を渡す
    （現在 id を渡していない）
  - `QuizView` は id で `question_sets` を読み、`content` を `QuestionSet` にキャストして
    [`components/QuestionPaper.tsx`](../components/QuestionPaper.tsx) へ
- **完了条件**: 生成 → リロード → 同じ問題集が `QuestionPaper` に再表示される。

### 6. グループ（作成・参加・メンバー）

- **対象**: [`app/components/views/GroupView.tsx`](../app/components/views/GroupView.tsx)、
  [`app/components/Sidebar.tsx`](../app/components/Sidebar.tsx)、
  [`app/page.tsx`](../app/page.tsx)（`groupName="情報工学3年"` 固定）、`lib/data/groups.ts`
- **やること**:
  - 1 ユーザー複数グループ対応。サイドバーにグループ切替を追加（`page.tsx` に `selectedGroupId` state）
  - `GroupView` のアバター / `7 MEMBERS` / 招待コード `TANE-3Y7K` を
    `group_members` + `profiles` + `groups.invite_code` に置換
  - グループ作成 UI（`groups.insert` → 落とし穴 1 のトリガーで owner 行が入る）
  - 招待コード入力 → `supabase.rpc("join_group_by_code", { code })`
  - メンバー脱退（`group_members.delete`、本人のみ）
- **完了条件**: 別アカウントが招待コードで参加し、両者のメンバー一覧に出る。

### 7. 共有（shelf_shares / question_set_shares）

- **対象**: [`app/page.tsx`](../app/page.tsx)（`toggleShare`）、
  [`app/components/views/CourseView.tsx`](../app/components/views/CourseView.tsx)、
  [`app/components/views/QuizView.tsx`](../app/components/views/QuizView.tsx)、
  [`app/components/views/GroupView.tsx`](../app/components/views/GroupView.tsx)、`lib/data/shares.ts`
- **やること**:
  - `toggleShare` / `CourseView` の共有ボタン / `QuizView` の共有ボタンを
    `question_set_shares` / `shelf_shares` の insert・delete へ
  - `GroupView` の共有棚（現在 `courses.slice(0,3)` のデモ import）を
    `shelf_shares` 経由のクエリへ。非表示トグル（`hiddenShelves` ローカル state）を
    `shelf_shares.visible` の update へ
- **完了条件**: 共有した問題集が他メンバーの画面に出て、共有解除で消える。

### 8. 勉強会とカレンダー連携

- **対象**: [`app/components/modals/ScheduleModal.tsx`](../app/components/modals/ScheduleModal.tsx)、
  [`app/components/views/GroupView.tsx`](../app/components/views/GroupView.tsx)、`lib/data/studySessions.ts`
- **やること**:
  - `ScheduleModal` は現在 **非制御入力で値を一切読んでいない**（`defaultValue` のハードコード）。
    制御化し、`日付 + 開始/終了時刻` を `starts_at` / `ends_at`（timestamptz）へ組み立てて
    `study_sessions.insert({ group_id, created_by, title, location, starts_at, ends_at })`
  - `GroupView` の予定リテラル配列（「つぎの勉強会」）を実クエリへ
  - 「カレンダーへ」ボタン（現在「バックエンド接続後に利用できます」と notify するだけ）を
    **実装済みの** `POST /api/calendar/events` に接続。返り値 `{created, skipped, failed}` を
    toast に反映（`reauth_required` は再ログイン導線へ）
  - キャンセルは `DELETE /api/calendar/events/{study_session_id}` → その後 `study_sessions` 行削除
- **完了条件**: 予定作成 → 「カレンダーへ」→ 参加者の Google カレンダーに実際に入る。

### 9. アカウント画面

- **対象**: [`app/components/views/AccountView.tsx`](../app/components/views/AccountView.tsx)、
  [`app/components/Sidebar.tsx`](../app/components/Sidebar.tsx)
- **やること**:
  - `ゆうた` / `工学部 情報工学科` / `yuta@example.jp` / `未接続` を
    `supabase.auth.getUser()` + `profiles` + `google_credentials` 行の有無から
  - 「ログアウト」ボタンを `notify()` スタブから既存の `signOut()`（`/logout` 遷移）へ
  - サイドバーのアバター・氏名も同様に実データ化
- **完了条件**: 表示名・メール・カレンダー連携状態が実アカウントを反映する。

## 今回のスコープ外（将来）

UI に存在するが、デモ導線から外れるため今回は触らない。

- **学習時間タイマー** — [`HomeView.tsx`](../app/components/views/HomeView.tsx) /
  [`TasksView.tsx`](../app/components/views/TasksView.tsx) の「時間を記録」。
  対応テーブルが無い（事後入力の `assignment_reports.minutes_spent` のみ存在）。
- **課題（assignments）と TasksView** — `assignments` / `assignment_reports` はテーブルだけ存在。
  [`AssignmentReportModal.tsx`](../app/components/modals/AssignmentReportModal.tsx) の
  `{ minutesSpent, comment }` はそのまま `minutes_spent` / `comment` に対応する。
  `assignments.shelf_id` は NOT NULL なので、課題作成 UI には棚ピッカーが要る点に注意。
- **勉強会の参加者数**（`GroupView` の「参加 5人」）— 出欠テーブルが無い。
- **アクティビティフィード**（`GroupView` の「みんなの学習記録」）—
  `assignment_reports` + `profiles` join に依存するため課題機能とセット。
- **`supabase gen types typescript` への差し替え** — 当面は `lib/supabase/types.ts` を手書きで延命
  （タスク 1 で新列と `Functions` を手で追加）。プロジェクトが安定したら
  `supabase gen types typescript --project-id=<id>` の出力に差し替える。
  `question_sets.content` は `QuestionSet` へのキャストが引き続き必要。
