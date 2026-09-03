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
- **講義資料の著作権**: `materials` の `kind = 'lecture'`（講義資料・過去問）は所有者本人のみ
  閲覧可能。グループへ共有できるのは生成された**問題集**と、`kind = 'misc'`（雑資料。著作権に
  関係のない資料）のみ。雑資料の共有単位は棚の共有（`shelf_shares` / `is_shelf_shared`）に
  連動する。個別の資料単位で共有先を選ぶ機能はない。
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

### materials — 講義資料・過去問・雑資料

`kind = 'lecture'`（既定）は**所有者本人のみ閲覧可能**（共有しない）。
`kind = 'misc'`（雑資料。著作権に関係のない資料）は本人に加え、棚が共有されている
グループのメンバーも閲覧できる（`is_shelf_shared(shelf_id)`）。書き込み（追加・更新・削除）は
どちらの `kind` でも所有者のみ。

| カラム | 型 | 説明 |
| --- | --- | --- |
| shelf_id | uuid FK→shelves | 所属する棚 |
| owner_id | uuid FK→profiles | 所有者 |
| kind | text | `'lecture'`（既定）\| `'misc'` |
| storage_path | text | Storage 上のパス（unique） |
| file_name | text | 元ファイル名 |
| mime_type | text | MIME タイプ |
| size_bytes | bigint | サイズ |

Storage（バケット `materials`）は書き込みが引き続き所有者フォルダ限定
（`materials_storage_own`）。読み取りのみ、`is_shared_misc_material(name)`
（オブジェクト名 → `materials` 行を逆引きし、`kind='misc'` かつ `is_shelf_shared` を満たすか判定する
SECURITY DEFINER 関数）で非所有者にも許可する。
参照: [`20260903140000_misc_materials.sql`](../supabase/migrations/20260903140000_misc_materials.sql)

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
| role | text | `'owner'` \| `'member'`（既定 `'member'`）。作成者の記録用。認可には使わない |

PK は `(group_id, user_id)`。

行が削除されると `on_group_member_left` トリガー（`delete_empty_group`, SECURITY DEFINER）が
発火し、そのグループの残メンバーが 0 件なら `groups` 行を削除する（`shelf_shares` /
`question_set_shares` / `study_sessions` などは cascade で消える）。owner 概念は UI に出さず、
owner も自由に脱退できる。`pg_trigger_depth()` ガードで cascade 再入を防いでいる。
参照: [`20260903120000_delete_empty_group.sql`](../supabase/migrations/20260903120000_delete_empty_group.sql)

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

同様に、「棚を共有すると中身の問題集もすべて共有される」（タスク7）を `question_sets_select` から
直接 `shelf_shares` を参照する形で書くと、`shelf_shares_select` が `is_group_member` だけを見ているため
実際には再帰しないが、既存パターンに合わせて `is_shelf_shared(shelf_id)`（SECURITY DEFINER）に切り出した。
[`20260902091357_group_sharing.sql`](../supabase/migrations/20260902091357_group_sharing.sql) 参照。

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
| question_sets | 本人、または `is_shelf_shared(shelf_id)`（棚が可視共有されていれば中身の問題集も見える）、または `question_set_shares` 経由で `is_group_member` | 本人のみ |
| question_set_shares | `is_group_member` または `owns_question_set`（SECURITY DEFINER。再帰回避） | `owns_question_set` |
| groups | `is_group_member(id)` または `created_by = auth.uid()` | 作成は誰でも可、更新は `role = 'owner'`、削除はメンバー全員（`groups_delete_member`）。空グループの掃除は `on_group_member_left` トリガーが担う |
| group_members | `is_group_member(group_id)` | `join_group_by_code` 経由のみ insert、脱退は本人 |
| shelf_shares | `is_group_member(group_id)` | insert/update/delete とも対象棚の所有者 |
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
- **アップロードはブラウザから直接** Storage へ行う（自前サーバーを経由しない＝Vercel のボディ上限と無関係）。
  クライアントで `crypto.randomUUID()` で `material_id` を採番し、パスとして使用。
  進捗（実測 %）を出すため `createSignedUploadUrl` で発行した URL へ XHR で PUT する
  （`lib/data/uploadWithProgress.ts`）。署名付き URL の発行自体はユーザーセッション経由なので
  `materials_storage_own` ポリシーがそのまま効く。アップロード完了後に `materials` へ行を insert し、
  insert 失敗時はアップロード済みオブジェクトを `.remove()` でロールバックする。
- バケットに `file_size_limit`（50MB）と `allowed_mime_types`（pdf / text/plain / text/markdown /
  png / jpeg / webp）を設定済み
  （[`20260903130000_material_limits.sql`](../supabase/migrations/20260903130000_material_limits.sql)）。
  RLS はサイズ・形式を検査できないため、クライアント検証をすり抜けた場合の最終防衛線。
  この値は `lib/gemini/config.ts` の `MAX_MATERIAL_BYTES` / `ALLOWED_MATERIAL_MIME_TYPES` と一致させる。
- 問題生成 API はファイル本体ではなく `materialId` を受け取り、サーバー側で Storage から
  ダウンロードして Gemini に渡す（実装済み）。`materials.size_bytes` に対して `MAX_MATERIAL_BYTES` を
  再検証し、超過時は 413 を返す。

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
  を実装し、`npm run dev` で `/` が正常応答することを確認済み。
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
- 問題生成 API は `materialId` 受け取りに改修済み。生成結果を `question_sets` へ
  insert し、レスポンスで `{ questionSet, questionSetId }` を返す（タスク 5 で対応済み）。
  現行実装は `materialId` ブランチのみで `file` ブランチは撤去済み。`getUser()` で
  未認証を 401 で弾く（落とし穴 2 も実質解消）。

## 既知の不整合・落とし穴（実装前に読む）

FE 調査で判明した、実装時に踏むと詰まる箇所。

1. ~~**グループ作成者が自分のグループを見られない**~~
   → **解消済み**。2 段構え:
   (a) `20260901131709_ui_alignment.sql` の `on_group_created` トリガー
   （`handle_new_group`, security definer）が insert 直後に owner 行を入れる（`role='owner'` 判定用）。
   (b) `20260901134102_groups_select_creator.sql` で `groups_select_member` に
   `created_by = auth.uid()` を追加。`insert into groups (...) returning *`（PostgREST の
   `.insert().select()`）は RETURNING 行に SELECT ポリシーを適用するが、同一ステートメント内の
   `is_group_member`（STABLE）は AFTER トリガーの挿入をまだ見ないため、(a) だけでは弾かれる。

2. ~~**`POST /api/questions/generate` の `file` ブランチが未認証で通る**~~
   → **解消済み**（タスク 5）。`file` ブランチを撤去し、`materialId` ブランチのみに統一。
   ハンドラ冒頭で `getUser()` を通し、未認証は 401。

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
   `materials_select` の `kind = 'lecture'` 分岐により、他人から共有された棚の
   `materialCount`（講義資料の件数）は必ず 0 になる（講義資料は共有しない設計なので正しい）。
   一方 `miscCount`（雑資料の件数）は `kind = 'misc'` かつ `is_shelf_shared` を満たせば
   非所有者でも実数が見える。`shares`（`sharedGroupIds` はここから導出）には
   `shelf_shares_select`（`is_group_member`）の都合で「自分が所属するグループへの共有」だけが載る。

8. **`shelf_shares` に UPDATE ポリシーが無かった** ~~→ 解消済み~~。
   `0002_rls.sql` は select/insert/delete のみで、`lib/data/shares.ts:setShelfVisible` の
   `.update({visible})` が 0 行更新で無言失敗していた。
   [`20260902091357_group_sharing.sql`](../supabase/migrations/20260902091357_group_sharing.sql)
   の `shelf_shares_update`（対象棚の所有者のみ）で解消。

9. **共有棚の非表示トグルは棚の所有者しか押せない**
   RLS 上 `shelf_shares` の insert/update/delete は対象棚の所有者のみに限定されているため
   （招待コードのように他メンバーが操作できる想定ではない）。`GroupView` は
   `shelf.owner_id === userId` のときだけ非表示トグルを表示する。

10. **`groups_select_member` の `created_by` 抜け道により「幽霊グループ」が見えることがある**
    → **解消済み**（2026-09-03）。`groups_select_member` は
    `is_group_member(id) or created_by = auth.uid()`（落とし穴 1 参照）なので、
    グループ作成者が自分の `group_members` 行を削除して脱退しても、`groups` 自体は
    `created_by` 経由で見え続ける。`group_members` / `shelf_shares` は `is_group_member` のみで
    絞られるため、その作成者にはグループ名だけ見えてメンバーも共有棚も空、という状態になりうる。
    実際に本番で発生: グループ作成直後に作成者が脱退 → 当時 `delete_empty_group` トリガー未導入
    だったため空のまま残留 → 別ユーザーが招待コードで参加し棚を共有しても作成者側には何も見えない
    という不具合になった。[`lib/data/groups.ts`](../lib/data/groups.ts) の `listMyGroups` は
    `groups` を直接 select せず、`group_members` から自分の `group_id` を集めてから
    `groups.select("*").in("id", ids)` する方式に変更し、実際に所属していないグループは
    一覧に出さないようにした（メンバーでなければ `GroupView` の「グループに参加していません」に
    フォールバックし、招待コードで参加し直せる）。RLS 自体（`created_by` 抜け道）はグループ作成の
    `insert().select()` を通すために必要なので変更しない。

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
| `POST /api/questions/generate` | 実装済み。`materialId` 受け取り＋`question_sets` 保存＋`getUser()` 認証 | `GEMINI_API_KEY` | 資料から問題生成 |
| `POST /api/calendar/events` | 実装済み・UI 接続済み | refresh token + Calendar API | 勉強予定をグループ全員の Google Calendar へ |
| `DELETE /api/calendar/events/[id]` | 実装済み・UI 接続済み（`[id]` = `study_session_id`） | refresh token + Calendar API | 上記の全員ぶん取り消し |

`POST /api/questions/generate` の詳細ペイロード/エラーは既存実装
（`multipart/form-data`、`materialId` 必須、`extraInstruction` ≤1000 字、
429 / 503+`Retry-After` / 502）を参照。保存失敗時は `{ questionSet, questionSetId: null, saveError }` を 200 で返す。カレンダー API の返り値形は:

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
- **タスク 3（棚の実データ化）**: 本番 UI（`page.tsx` / `ShelfModal` / `HomeView` /
  `CourseView`）を `lib/data/shelves` ＋ `lib/data/materials` へ接続。詳細は下記タスク3節。
- **タスク 4（資料アップロード）**: `lib/data/materials.uploadMaterial` で Storage
  アップロード＋`materials` insert（失敗時ロールバック）。`MaterialModal` は File 本体を渡す。
  詳細は下記タスク4節。
- **タスク 5（問題集の永続化）**: `POST /api/questions/generate` が生成後
  `question_sets` へ insert し `{ questionSet, questionSetId }` を返す。`file` ブランチ撤去＋
  `getUser()` 認証（落とし穴 2 解消）。`CourseView` / `QuizView` を `lib/data/questionSets` へ
  接続。詳細は下記タスク5節。
- **RLS バグ修正 2 件**（いずれも既存スキーマの潜在バグ。タスク 2 の
  `lib/data/*` がクライアントから初めて該当テーブルを叩いて顕在化）:
  - [`20260901133538_fix_question_set_shares_recursion.sql`](../supabase/migrations/20260901133538_fix_question_set_shares_recursion.sql)
    — `question_sets` ⟷ `question_set_shares` の相互参照再帰を `owns_question_set` で解消。
  - [`20260901134102_groups_select_creator.sql`](../supabase/migrations/20260901134102_groups_select_creator.sql)
    — `groups_select_member` に `created_by = auth.uid()` を追加（グループ作成の
    `.insert().select()` が RLS で弾かれる問題。落とし穴 1 参照）。
- **タスク 6（グループ）・タスク 7（共有）**: 下記「6. グループ」「7. 共有」節を参照。
  [`20260902091357_group_sharing.sql`](../supabase/migrations/20260902091357_group_sharing.sql) を
  MCP `apply_migration` で適用済み（`shelf_shares_update` ポリシー追加、`is_shelf_shared` 関数と
  `question_sets_select` の書き換え）。

---

### 3. 棚（shelves）の実データ化 ✅ 完了

- **対象**: [`app/page.tsx`](../app/page.tsx)、
  [`app/components/modals/ShelfModal.tsx`](../app/components/modals/ShelfModal.tsx)、
  [`app/components/views/CourseView.tsx`](../app/components/views/CourseView.tsx)、
  [`app/components/views/HomeView.tsx`](../app/components/views/HomeView.tsx)
- **実装内容**:
  - `page.tsx` を `createClient()` ＋ `lib/data/shelves` へ移行。
    `shelves` / `shelvesState`（`loading | error | ready`）/ `selectedShelfId`（nullable）を state 化。
    初期表示は `listShelves` を `useEffect` で読み込み、棚 0 件でもクラッシュしない。
    講義詳細は `selectedShelf` が `null` の場合フォールバック表示。
  - `courseMaterials` は `Record<shelfId, MaterialRow[]>`。棚を開くたび
    `listMaterialsByShelf` で取得（`materialsState` の 3 状態つき）。
  - `ShelfModal` は `Shelf` / `ShelfFormValues` ベースに刷新。曜日・時限は
    `<select>`（`DAY_LABELS` / `PERIOD_OPTIONS`）で数値を直接持つ。
    `onSave(values, id?)` で親が `createShelf` / `updateShelf` を出し分け。
    新規作成時の色は `pickShelfColor(shelves.length)`。
  - `HomeView` / `CourseView` は `Course` → `Shelf` へ。件数タブ・棚カードの
    資料/問題集数は `materialCount` / `questionSetCount` の実カウント。
    スケジュール文字列は `formatSchedule(day_of_week, period)`。
    資料行は `file_name` ＋ `created_at`（`size_bytes` 由来のページ数リテラルは削除）。
  - `app/types.ts` に `MaterialRow` / `ShelfFormValues` / `LoadState` を追加。
    `Course` はデモ 3 画面（GroupView / QuizView / TasksView）専用として残置。
  - `.muted` ユーティリティを [`app/styles/common.css`](../app/styles/common.css) に追加。
- **未対応（後続タスク）**: `CourseView` の共有ボタン（タスク7。暫定でトースト通知のみ）。
- **完了条件**: 棚の作成・編集がリロード後も残る（削除 UI は本番画面には未配置。
  `lib/data/shelves.deleteShelf` と検証ハーネス [`app/dev/shelves/page.tsx`](../app/dev/shelves/page.tsx) にはあり）。

### 4. 資料アップロードの実装 ✅ 完了

- **対象**: [`app/components/modals/MaterialModal.tsx`](../app/components/modals/MaterialModal.tsx)、
  [`app/page.tsx`](../app/page.tsx)（`MaterialModal` の `onUpload`）、`lib/data/materials.ts`
- **実装内容**:
  - `MaterialModal` は `onUpload(file: File)` で File 本体を親へ渡す（アップロード中・
    エラー表示つき）。
  - [`lib/data/materials.ts`](../lib/data/materials.ts) `uploadMaterial(supabase, shelfId, file)`:
    `crypto.randomUUID()` で material_id 採番 → `{user_id}/{material_id}/{safeFileName}` へ
    `supabase.storage.from("materials").upload()` → `createMaterial` で
    `materials.insert({ id, shelf_id, owner_id, storage_path, file_name, mime_type, size_bytes })`。
    行 insert に失敗したらアップロード済みファイルを削除して孤児を残さない。
  - サイズ上限（`MAX_MATERIAL_BYTES`）・MIME 検証（`ALLOWED_MATERIAL_MIME_TYPES`）、
    `file.type` が空の場合の拡張子補完、非 ASCII ファイル名の Storage キー sanitize
    （表示名は `file_name` に原文保存）。
  - [`app/page.tsx`](../app/page.tsx) の `MaterialModal` `onUpload` が
    `uploadMaterial(supabase, selectedShelf.id, file)` を呼び、`courseMaterials` を更新。
- **完了条件（達成）**: アップした資料が `CourseView` の資料タブと `CreateQuizModal`
  の資料一覧（`GET /api/materials`）の両方に出る。

### 5. 問題集の永続化 ✅ 完了

- **対象**: [`app/api/questions/generate/route.ts`](../app/api/questions/generate/route.ts)、
  [`app/components/views/QuizView.tsx`](../app/components/views/QuizView.tsx)、
  [`app/components/views/CourseView.tsx`](../app/components/views/CourseView.tsx)、
  [`app/page.tsx`](../app/page.tsx)、[`lib/data/questionSets.ts`](../lib/data/questionSets.ts)
- **実装内容**:
  - Route Handler は資料行から `shelf_id` を解決し、生成後 `saveQuestionSet` で
    `question_sets.insert({ shelf_id, owner_id, source_material_id: materialId, title, content })`。
    レスポンスは `{ questionSet, questionSetId }`（保存失敗時は `questionSetId: null` ＋ `saveError` を 200）。
  - `file` ブランチは撤去し `materialId` のみに統一。冒頭で `getUser()`、未認証は 401（落とし穴 2 解消）。
  - `page.tsx` は生成結果を「保存済み ID」（`selectedQuestionSetId`）で保持。`finishGeneration` 経由。
  - [`lib/data/questionSets.ts`](../lib/data/questionSets.ts): `listQuestionSetsByShelf` /
    `getQuestionSet`（`content` を `QuestionSet` にキャストして返す）。
  - `CourseView` の問題集リストは `listQuestionSetsByShelf` の実クエリ（`questionSets` /
    `questionSetsState`）。行クリックで `openQuiz(qs.id)` → `navigate("quiz")`。
  - `QuizView` は `questionSetId` で `getQuestionSet` を読み、`content` を
    [`components/QuestionPaper.tsx`](../components/QuestionPaper.tsx) へ渡す。
- **完了条件（達成）**: 生成 → リロード → 同じ問題集が `QuestionPaper` に再表示される。

### 6. グループ（作成・参加・メンバー） ✅ 完了

- **対象**: [`app/components/views/GroupView.tsx`](../app/components/views/GroupView.tsx)、
  [`app/components/Sidebar.tsx`](../app/components/Sidebar.tsx)、
  [`app/components/modals/GroupModal.tsx`](../app/components/modals/GroupModal.tsx)、
  [`app/page.tsx`](../app/page.tsx)、`lib/data/groups.ts`
- **実装内容**:
  - `page.tsx` に `groups` / `groupsState` / `selectedGroupId` state を追加。`loadGroups` で
    `listMyGroups` を読み、選択中グループが一覧から消えたら先頭グループへフォールバック。
  - `Sidebar` は `groupName` 固定 prop を廃し、`groups` / `selectedGroupId` / `onSelectGroup` /
    `onCreateGroup` を受け取る。TOGETHER の nav-item は 1 つのまま、複数グループがあるときだけ
    矢印から `.group-switcher` ポップオーバー（外側クリックで閉じる）を開いて切り替える。
  - `GroupModal`（新規）: グループ作成（`createGroup`）と招待コード参加（`joinGroupByCode`）を
    1 モーダルにまとめた。成功時は `loadGroups` → 新/参加先グループを選択 → `group` 画面へ遷移。
  - `GroupView` は `group: GroupRow | null` を受け取る実データ表示に刷新。アバター・
    `${members.length} MEMBERS`・招待コード・メンバー一覧は `listGroupMembers` から。
    グループ未所属時は空状態、グループ読み込み中は専用メッセージを出す。
    「グループを抜ける」ボタンを追加（`leaveGroup`）。
  - **空グループの自動削除**（[`20260903120000_delete_empty_group.sql`](../supabase/migrations/20260903120000_delete_empty_group.sql)）:
    `group_members` の AFTER DELETE トリガー `on_group_member_left` / `delete_empty_group`
    （SECURITY DEFINER）が、残メンバー 0 件のときに `groups` 行を削除する。owner 概念は
    UI に出さず、owner も自由に脱退できる。`GroupView` は最後の1人（`members.length === 1`）
    のとき警告文と強い確認ダイアログを出し、脱退前に今後の勉強会を
    `unsyncSessionFromCalendar` で片付ける。`groups_delete_owner` は `groups_delete_member`
    （メンバー全員可）へ緩めた。
- **完了条件（達成）**: 別アカウントが招待コードで参加すると、両者のメンバー一覧に出る。

### 7. 共有（shelf_shares / question_set_shares） ✅ 完了

- **対象**: [`app/page.tsx`](../app/page.tsx)、
  [`app/components/views/CourseView.tsx`](../app/components/views/CourseView.tsx)、
  [`app/components/views/QuizView.tsx`](../app/components/views/QuizView.tsx)、
  [`app/components/views/GroupView.tsx`](../app/components/views/GroupView.tsx)、
  [`app/components/modals/ShareModal.tsx`](../app/components/modals/ShareModal.tsx)、`lib/data/shares.ts`
- **仕様（実装前に決定）**:
  - 共有の単位は**棚**。棚を共有すると、その棚の問題集はすべて自動的に共有される
    （個別の `question_set_shares` は今回 UI から書かない。テーブル・RLS・
    `lib/data/shares.ts` の `shareQuestionSet` / `unshareQuestionSet` は将来の個別共有用に残置）。
    これを表現するため [`20260902091357_group_sharing.sql`](../supabase/migrations/20260902091357_group_sharing.sql)
    で `question_sets_select` に `is_shelf_shared(shelf_id)` を追加。
  - UI はモーダル方式。`CourseView` の共有ボタン・`QuizView` の共有ボタンはどちらも
    `ShareModal`（自分の所属グループをチェックボックスで選ぶ）を開く。
- **実装内容**:
  - `ShareModal`（新規）: 初期チェックは `shelf.shares`。保存時は親（`page.tsx:saveShares`）が
    チェック差分を取り、追加分 `shareShelf` / 削除分 `unshareShelf` を並列実行して `loadShelves` で再読込。
  - `CourseView` / `QuizView` は所有者（`shelf.owner_id === userId`）だけに編集系ボタン
    （棚を編集・資料を追加・問題をつくる・共有）を出す。非所有者が開いた共有棚は
    講義資料タブが常に 0 件（`materials_all_own` により正しい）になるため、空状態文言を出し分ける。
  - `GroupView` の共有棚一覧は `shelves` prop（親の `listShelves` 結果）を
    `shelf.shares.some(s => s.group_id === group.id)` で絞る。非表示トグルは
    `shelf.owner_id === userId` のときだけ表示し、`setShelfVisible` を呼ぶ
    （`shelf_shares` に UPDATE ポリシーが無かったため同マイグレーションで追加）。
- **完了条件（達成）**: 共有した棚の問題集が他メンバーの画面に出て、共有解除・非表示で消える。

### 8. 勉強会とカレンダー連携 ✅ 完了

- **対象**: [`app/components/modals/ScheduleModal.tsx`](../app/components/modals/ScheduleModal.tsx)、
  [`app/components/views/GroupView.tsx`](../app/components/views/GroupView.tsx)、
  [`app/page.tsx`](../app/page.tsx)、[`lib/data/studySessions.ts`](../lib/data/studySessions.ts)、
  [`lib/api/calendar.ts`](../lib/api/calendar.ts)（新規）、[`lib/format/datetime.ts`](../lib/format/datetime.ts)（新規）
- **実装内容**:
  - `ScheduleModal` を `ShelfModal` と同じ形で制御化（`title` / `date` / `startTime` / `endTime` / `location` を
    `useState`）。`lib/format/datetime.ts` の `toISOFromLocal` で `starts_at` / `ends_at` を組み立て、
    終了 ≤ 開始はモーダル内エラー表示で弾く。`groupName` / `saving` / `onSave` を受け取る形に刷新し、
    `notify` prop は廃止。
  - `page.tsx` に `sessions` / `sessionsState`（`listUpcomingSessions(supabase, selectedGroupId)`）と
    `saveSession`（`createStudySession` → `loadSessions` → モーダルを閉じる）を追加。`shelves` / `groups` と
    同じ「`useCallback` ローダー＋`LoadState`」パターン。`modal === "schedule"` の描画に `selectedGroup` の
    ガードを追加（グループ未所属では開けない）。
  - `GroupView` の「つぎの勉強会」は `sessions` prop の実データ描画に刷新
    （`formatSessionDate` / `formatSessionRange`、`lib/format/datetime.ts`）。「参加 N人」表示は
    出欠テーブルが無いため削除。
  - `lib/api/calendar.ts`（新規）: `POST /api/calendar/events` / `DELETE /api/calendar/events/{id}` を叩く
    薄いクライアント。`summarizeSync` が `{created, skipped, failed}` をトースト用の1文にまとめ、
    `needsReauth` が自分ぶんの `reauth_required` を判定する。
  - 「カレンダーへ」ボタンは `syncSessionToCalendar` を呼び、結果を `notify` へ。自分が再連携必要な場合は
    `signInWithGoogle()`（`lib/supabase/auth.ts` 既存）への導線を表示。
  - 「キャンセル」ボタンは `session.created_by === userId` のときだけ表示（RLS の delete ポリシーと一致）。
    `window.confirm` の後、`unsyncSessionFromCalendar` → `deleteStudySession` の順に実行。
- **完了条件（達成）**: 予定作成 → リロード後も残る → 「カレンダーへ」→ 参加者の Google カレンダーに
  実際に入る → 作成者の「キャンセル」で Google 側・`study_sessions` 行とも消える。

### 9. アカウント画面 ✅ 完了

- **対象**: [`app/components/views/AccountView.tsx`](../app/components/views/AccountView.tsx)、
  [`app/components/views/ProfileEditView.tsx`](../app/components/views/ProfileEditView.tsx)、
  [`app/components/Sidebar.tsx`](../app/components/Sidebar.tsx)、[`app/page.tsx`](../app/page.tsx)、
  `lib/data/profiles.ts`、`lib/api/account.ts`、`app/api/account/google-status/route.ts`
- **実装内容**:
  - `学部` / `学科` は `profiles` に列が無いため UI から削除（`Profile` 型を廃止し
    `AccountProfile`（`id / displayName / avatarUrl / email`）に統一）。
  - `lib/data/profiles.ts` の `getMyProfile` が `supabase.auth.getUser()` ＋
    `profiles` 行（無ければ Google の `user_metadata` にフォールバック）から
    表示名・アイコン URL・メールを組み立てる。`updateDisplayName` で表示名のみ更新可能
    （RLS `profiles_update_own`）。
  - アイコンは `profiles.avatar_url`（Google プロフィール画像 URL）を新規 `ProfileIcon`
    コンポーネント（`app/components/ui.tsx`）で `<img>` 表示。URL が無い場合のみ
    従来の頭文字タイルにフォールバック。アップロード機能・`avatars` バケットは対象外。
  - Google カレンダー連携状態は `google_credentials`（RLS 全拒否）を読む必要があるため
    `GET /api/account/google-status`（service-role）を新設し、`lib/api/account.ts` の
    `fetchGoogleStatus()` から叩く。
  - 「ログアウト」ボタンは偽の `LogoutView`（削除済み）ではなく `<Link href="/logout">`
    で本物の `signOut()` 画面へ遷移。
  - `page.tsx` に `loadProfile` / `saveProfile`（`shelves` 等と同じ `LoadState` パターン）を
    追加し、既存の `getUser()` だけの `userId` 取得 effect を統合。サイドバーは
    `profile: AccountProfile | null` を丸ごと受け取る。
- **完了条件（達成）**: 表示名・メールアドレス・アイコンが実際の Google アカウントを反映し、
  表示名の変更はリロード後も残る。カレンダー連携状態は `google_credentials` 行の有無と一致する。

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
