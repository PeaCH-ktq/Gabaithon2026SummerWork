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
- パス規則: `{user_id}/{material_id}/{file_name}`。
- Storage ポリシー: `(storage.foldername(name))[1] = auth.uid()::text` の本人のみ。
- アップロードはブラウザから**署名付き URL で直接** Storage へ行い、完了後に `materials` 行を
  insert する。現状の実装（Route Handler 経由、Vercel のボディ上限 4.5MB 弱）から移行し、
  大きい資料も扱えるようにする。
- 問題生成 API はファイル本体ではなく `materialId` を受け取り、サーバー側で Storage から
  ダウンロードして Gemini に渡す形に変更する。

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
- Supabase クライアントの scaffolding は実装済み・動作確認済み:
  [`lib/supabase/client.ts`](../lib/supabase/client.ts)（ブラウザ用）、
  [`lib/supabase/server.ts`](../lib/supabase/server.ts)（Server Component / Route Handler 用、
  RLS 前提）、[`lib/supabase/admin.ts`](../lib/supabase/admin.ts)（service-role 用）、
  [`lib/supabase/types.ts`](../lib/supabase/types.ts)（暫定の DB 型定義）。
- [`proxy.ts`](../proxy.ts)（Next.js 16 で `middleware.ts` から改名されたセッション更新用ファイル）
  を実装し、`npm run dev` で `/` と `/dev/generate` が正常応答することを確認済み。
- `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` を設定済み。`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` は未設定。

## 今後のタスク

1. **Google ログインの設定**
   - Supabase ダッシュボード（Authentication > Providers > Google）で Google OAuth を有効化。
   - Google Cloud Console 側で OAuth クライアントを作成し、`calendar.events` スコープを追加。
   - ログイン処理で `access_type=offline` + `prompt=consent` を指定し、
     初回ログイン時に返る `provider_refresh_token` を Route Handler で
     `google_credentials` テーブルへ保存する処理を実装する（[本ドキュメントの該当節](#6-google-カレンダー連携)参照）。

2. **`materials` バケットの作成**
   - Supabase Storage ダッシュボードで `materials` バケットを **private** で作成する
     （`0002_rls.sql` の Storage ポリシーはバケット作成前提で書かれている）。
   - ブラウザ → Storage への署名付き URL 直アップロードのフローを実装する
     （[Storage 節](#storage)参照）。現状の `app/api/questions/generate/route.ts` は
     ファイル本体を受け取る実装なので、`materialId` を受け取る形に変更する。

3. **棚（shelves）・資料（materials）の CRUD**
   - 棚の作成・一覧・編集・削除。
   - 資料アップロード（Storage 直アップロード完了後に `materials` へ insert）。

4. **問題生成結果の保存**
   - `generateQuestions` の戻り値（`QuestionSet`）を `question_sets.content` に保存する処理を
     `app/api/questions/generate/route.ts` に追加する。
   - 保存済み問題集の一覧・再表示（`components/QuestionPaper.tsx` への読み戻し）。

5. **グループ機能**
   - グループ作成（`invite_code` 発行）、`join_group_by_code` 経由の参加。
   - `shelf_shares` / `question_set_shares` による共有・非表示設定。

6. **勉強予定・課題**
   - `study_sessions` の作成・一覧。
   - Google Calendar への実書き込み（`google_credentials` の refresh token でサーバー側から
     Calendar API を呼び、`calendar_events` に `google_event_id` を保存）。
   - `assignments` / `assignment_reports` の作成・投稿・一覧
     （ホーム画面の「7 日以内の締切」は `assignments.due_at` を絞るだけで実装できる）。

7. **`supabase gen types typescript` への差し替え**
   - プロジェクトが安定してきたら、[`lib/supabase/types.ts`](../lib/supabase/types.ts) の
     暫定型を CLI 生成の型に差し替える（`question_sets.content` は `QuestionSet` 型への
     キャストが必要な点は変わらない）。
