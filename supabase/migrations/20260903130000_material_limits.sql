-- TanE: materials バケットにサイズ上限と MIME 制限を付ける
--
-- 資料はブラウザから Storage へ直接アップロードされる（lib/data/materials.ts）。
-- RLS（0002_rls.sql の materials_storage_own）は本人のフォルダかどうかしか
-- 検査できず、サイズや形式は検査できない。クライアント側の検証を
-- すり抜けた場合の最終防衛線として、バケット本体に制限を設定する。
--
-- file_size_limit は lib/gemini/config.ts の MAX_MATERIAL_BYTES と一致させること。
-- allowed_mime_types は同ファイルの ALLOWED_MATERIAL_MIME_TYPES と一致させること。

update storage.buckets
set
  file_size_limit = 52428800, -- 50MB
  allowed_mime_types = array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
where id = 'materials';
