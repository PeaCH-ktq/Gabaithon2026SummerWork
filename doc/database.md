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
| question_set_shares | 対象問題集の所有者 | 対象問題集の所有者 |
| groups | `is_group_member(id)` | 作成は誰でも可、更新・削除は `role = 'owner'` |
| group_members | `is_group_member(group_id)` | `join_group_by_code` 経由のみ insert、脱退は本人 |
| shelf_shares | `is_group_member(group_id)` | 対象棚の所有者 |
| study_sessions | `is_group_member(group_id)` | 作成はメンバー、更新・削除は作成者 |
| assignments | `is_group_member(group_id)`、または `shelf_id` の所有者 | 作成はメンバー、更新・削除は作成者 |
| assignment_reports | 対象課題のグループの `is_group_member` | 本人の行のみ |
| google_credentials | ポリシー無し（全拒否） | サーバー（service-role）のみ |
| calendar_events | 本人 | サーバーのみ |

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

`.env.example` に以下を追加する予定（Supabase プロジェクト作成後に値を埋める）。

| 変数 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon キー（クライアントで使用、RLS 前提） |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role キー（サーバー専用。`google_credentials` などの操作に使用） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth（ログイン＋カレンダー書き込み用） |

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
  - **残りはダッシュボード側の設定作業のみ**（タスク「Google ログインの設定」参照）。

## 担当範囲（BE / FE）

バックエンド（BE）とフロントエンド（FE）の担当を以下のように分ける。

### 基本原則: RLS 直叩き ＋ 必要な所だけ API

単純な CRUD（`shelves` / `materials` / `question_sets` / `groups` 等の作成・編集・削除・一覧）は
**フロント側が `supabase-js` でブラウザから直接叩き、RLS が認可を保証する**。
`supabase/migrations/0002_rls.sql` は元々この前提で全テーブルにポリシーが書かれており、
追加実装が最小で済む。

バックエンドが Route Handler を提供するのは、以下のいずれかに該当する場合**のみ**:

1. **サーバー専用の秘密が要る**: `GEMINI_API_KEY` / service-role キー / Google の refresh token
2. **RLS だけでは表現できない認可**: 招待コードでの参加（`join_group_by_code` RPC で解決済み）
3. **外部 API を叩く**: Gemini / Google Calendar

### バックエンド（BE）の成果物

- データベース: マイグレーション SQL（[supabase/migrations/](../supabase/migrations/)）
- RLS・Storage ポリシー: 認可ロジック（[0001_init.sql](../supabase/migrations/0001_init.sql) / 
  [0002_rls.sql](../supabase/migrations/0002_rls.sql)）
- Storage バケット `materials` の作成
- **型定義** [`lib/supabase/types.ts`](../lib/supabase/types.ts) —
  フロント・バック両者の契約（TypeScript で静的に型チェックできるように）
- クライアント scaffolding: [`lib/supabase/client.ts`](../lib/supabase/client.ts) /
  [`lib/supabase/server.ts`](../lib/supabase/server.ts) / [`lib/supabase/admin.ts`](../lib/supabase/admin.ts)
- **クライアント用ヘルパー** [`lib/supabase/auth.ts`](../lib/supabase/auth.ts) —
  `signInWithGoogle()` が唯一のクライアント公開関数
- Route Handler（下記参照）

### バックエンド提供の Route Handler

| エンドポイント | 状態 | 要件 | 用途 |
| --- | --- | --- | --- |
| `GET /auth/callback` | 既実装（未コミット） | service-role | Google OAuth コールバック処理 |
| `POST /api/questions/generate` | 要改修 | `GEMINI_API_KEY` | 資料から問題生成、保存済み問題集を返す |
| `POST /api/calendar/events` | 実装済み | refresh token + Google Calendar API | 勉強予定を**グループ全員**の Google Calendar へ書き込み |
| `DELETE /api/calendar/events/[id]` | 実装済み（`[id]` = `study_session_id`） | refresh token + Google Calendar API | 予定のカレンダー反映を全員ぶん取り消し |

### フロントエンド（FE）が `supabase-js` で直接叩いてよいテーブル

RLS ポリシーが認可を保証するため、以下のテーブル・Storage は**自由に CRUD できる**：

- `shelves` —作成・編集・削除・一覧（本人 / 共有先グループメンバー）
- `materials` —作成・削除・一覧（本人のみ。所有者以外には見えない）
- `question_sets` —作成・編集・削除・一覧（本人 / 共有先グループメンバー）
- `groups` —作成・一覧・編集・削除（メンバーのみが見える、owner のみ編集可）
- `group_members` —一覧・削除（参加は `join_group_by_code` RPC のみ）
- `shelf_shares` / `question_set_shares` —作成・削除・一覧（所有者のみ）
- `study_sessions` —作成・編集・削除・一覧（グループメンバーのみ）
- `assignments` / `assignment_reports` —作成・編集・削除・一覧（権限に応じて）
- `profiles` —一覧・編集（自分の行のみ編集可、表示名・アイコン URL など）
- Storage バケット `materials` —アップロード・ダウンロード・削除（本人のみ。RLS で守られている）

### フロントエンド（FE）の成果物

本ドキュメントで「FE」と書かれたタスク（UI実装、画面遷移、`supabase-js` 呼び出し等）。
RLS と型定義が BE から提供されるため、**認可・検証ロジックの実装は不要**。

## 今後のタスク

### 1. Google ログインの設定（BE）

**対応**: コード側は完了。ダッシュボード設定のみ。

- Supabase ダッシュボード（Authentication > Providers > Google）で Google OAuth を有効化
- Google Cloud Console 側で OAuth クライアントを作成し、`calendar.events` スコープを追加
- `.env.local` に `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を設定

**完了条件**: フロント側が `signInWithGoogle()` を呼ぶだけでログインでき、
ログイン完了時に `google_credentials.refresh_token` が DB に保存される。

**FE タスク**: 実装済み。

- [`app/login/page.tsx`](../app/login/page.tsx) — Google ログインボタン。
  `?next=` と `?auth_error=` を解釈する。
- [`app/logout/page.tsx`](../app/logout/page.tsx) — マウント時に `signOut()` を呼ぶ
  ログアウト画面。サイドバー右下のボタンからここへ遷移する。
- [`lib/supabase/auth.ts`](../lib/supabase/auth.ts) に `signOut()` を追加。
- [`proxy.ts`](../proxy.ts) — 未ログインで保護ページを開くと `/login?next=...` へ、
  ログイン済みで `/login` を開くと `/` へリダイレクト（`/auth/*`・`/api/*` は除外）。

### 2. `materials` Storage バケット作成（BE）

**対応**: 完了。マイグレーション SQL で作成・適用済み。

- [`supabase/migrations/20260901100630_storage.sql`](../supabase/migrations/20260901100630_storage.sql):
  ```sql
  insert into storage.buckets (id, name, public)
  values ('materials', 'materials', false)
  on conflict (id) do nothing;
  ```
- Supabase MCP の `apply_migration` で本番プロジェクトへ適用済み
  （`list_migrations` に `20260901100630 storage` として登録、
  `storage.buckets` に `materials`（`public = false`）が存在することを確認済み）。
- `storage.objects` の本人限定ポリシー `materials_storage_own` は
  [`0002_rls.sql`](../supabase/migrations/0002_rls.sql) で適用済みのため追加不要。

**完了条件**: 達成。フロント側がブラウザから `supabase.storage.from("materials").upload()` を呼べる。
[Storage 節](#storage)に記載のパス規則 `{user_id}/{material_id}/{file_name}` を守ること。

**FE タスク**:
- 資料アップロード UI
- クライアント側で `crypto.randomUUID()` で `material_id` を採番し、
  Storage パスと `materials` テーブルの `id` の両方に使用
- アップロード完了後に `materials.insert()` で DB に行を追加

### 3. 問題生成 API を `materialId` 受け取りに変更（BE）

**対応**: [app/api/questions/generate/route.ts](../app/api/questions/generate/route.ts) を改修。

- 現状: `multipart/form-data` でファイル本体を受け取る
- 変更後: `{ materialId: string, instruction?: string }` の JSON を受け取る
- **ダウンロード時は [lib/supabase/server.ts](../lib/supabase/server.ts) のセッション付きクライアントを使う**
  （admin クライアントを使うと他人の資料も読めてしまい、RLS の意味がない）
- 生成結果 `QuestionSet` をそのまま `question_sets.content` へ INSERT して、
  レスポンスで返す（保存も一度に行う）

**完了条件**: フロント側が `POST /api/questions/generate` に
`{ materialId, instruction }` を POST するだけで、
新規に保存された `question_sets` 行が返される（ID・title・content）。

**FE タスク**:
- 「問題を生成」ボタン・UI（資料選択 → 問題生成 API 呼び出し）
- 生成中のローディング表示
- 生成結果を `components/QuestionPaper.tsx` へ渡して A4 用紙として表示

### 4. Google Calendar 連携（BE）

**対応**: 完了。2 つの Route Handler を実装。Google API は依存追加せず raw `fetch`
（[`lib/google/calendar.ts`](../lib/google/calendar.ts) が
`oauth2.googleapis.com/token` と Calendar REST を直接叩く。
オーケストレーションは [`lib/google/calendarSync.ts`](../lib/google/calendarSync.ts)）。
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` をサーバー側でも読むようになった（`.env.example` 更新済み）。

- [`POST /api/calendar/events`](../app/api/calendar/events/route.ts)
  - ペイロード: `{ study_session_id: string }`
  - 認可: グループメンバーであること（`study_sessions` の RLS 通過）のみ
  - 動作: グループメンバー全員の `google_credentials` を引き、refresh token があるメンバーの
    Google カレンダーへイベント作成 → `calendar_events` に 1 メンバー 1 行 insert
    （`unique (study_session_id, user_id)`。既に行があるメンバーは再作成しない）
  - 返り値:
    ```json
    { "created": [{ "user_id": "…", "event_id": "…" }],
      "skipped": [{ "user_id": "…", "reason": "no_credentials" | "already_synced" }],
      "failed":  [{ "user_id": "…", "error": "…", "reauth_required": true }] }
    ```
- [`DELETE /api/calendar/events/[id]`](../app/api/calendar/events/[id]/route.ts)
  - パラメータ `[id]`: **`study_session_id`**（全員書き込みと対称にするため。Google イベント ID ではない）
  - 認可: 同上
  - 動作: その予定の `calendar_events` 全行をループし、各メンバーの Google イベントを削除 + 行削除。
    **`study_sessions` 行そのものは消さない**（予定レコード削除は FE の責務）
  - 返り値: `{ deleted: ["user_id", …], failed: [{ user_id, error, reauth_required? }] }`

**完了条件**: 達成。フロント側が `study_sessions` 作成後に `POST /api/calendar/events` を
呼ぶだけで、グループメンバー全員（Google 連携済みの人）のカレンダーへ書き込まれる。

**FE タスク**:
- 勉強予定作成画面（`title` / `location` / `starts_at` / `ends_at`）
- 「Google Calendar へ追加」ボタン（上記 API を呼び出し）
- 予定一覧・編集・キャンセル

### 5. 棚（shelves）・資料（materials）の CRUD（FE）

**対応**: フロント側が `supabase-js` で直接 CRUD。バックエンド実装は不要（RLS が守る）。

- 棚の作成・一覧・編集・削除画面
- 資料アップロード UI（タスク 2 に同じ）
- 各棚に属する資料一覧の表示

### 6. 問題集の共有（FE）

**対応**: フロント側が `supabase-js` で `question_set_shares` を直接操作。バックエンド実装は不要。

- 生成済み問題集の一覧
- グループへの共有ボタン
- 共有済み問題集の表示（[components/QuestionPaper.tsx](../components/QuestionPaper.tsx) へ読み戻し）

### 7. グループ機能（FE）

**対応**: フロント側が `supabase-js` で直接 CRUD。バックエンド実装は不要（RLS が守る）。

- グループ作成（`invite_code` 自動発行）
- 招待コード入力で参加（`join_group_by_code` RPC を呼び出し）
- グループメンバー一覧・脱退
- `shelf_shares` / `question_set_shares` による共有・非表示設定の UI

### 8. 課題（assignments）・課題結果投稿（FE）

**対応**: フロント側が `supabase-js` で直接 CRUD。バックエンド実装は不要。

- 課題作成・編集・削除画面
- 課題一覧（ホーム画面で「7 日以内の締切」は `assignments.due_at` を WHERE で絞るだけで取得可）
- 課題結果投稿画面（`minutes_spent` / `comment` の入力）
- 投稿済み結果の一覧

### 9. `supabase gen types typescript` への差し替え（BE）

**対応**: 暫定型を CLI 生成の型に差し替える。

- プロジェクトが安定してきたら、`supabase gen types typescript --project-id=<id>` を実行
- [lib/supabase/types.ts](../lib/supabase/types.ts) を自動生成のものに差し替え
- `question_sets.content` の型は `QuestionSet` へのキャストが必要（元々の型定義の方針は変わらない）
