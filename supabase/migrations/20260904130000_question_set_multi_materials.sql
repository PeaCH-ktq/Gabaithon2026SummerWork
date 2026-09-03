-- 問題集は複数資料を参照して生成できる。FK は張らず、資料が消えても ID 列は残す
-- （既存の source_material_id は先頭1件との互換用にそのまま残す）。
alter table question_sets add column if not exists source_material_ids uuid[];

comment on column question_sets.source_material_ids is
  '生成元の資料ID配列（選択順）。FKなし。source_material_id は先頭1件と同じ値。';

update question_sets
   set source_material_ids = array[source_material_id]
 where source_material_id is not null
   and source_material_ids is null;
