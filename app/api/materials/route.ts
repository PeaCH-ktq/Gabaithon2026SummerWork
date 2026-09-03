import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });

  const { data, error } = await supabase
    .from("materials")
    .select("id, shelf_id, kind, file_name, mime_type, size_bytes, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[materials]", error);
    return Response.json({ error: "資料の一覧を取得できませんでした。" }, { status: 500 });
  }
  return Response.json({ materials: data });
}
