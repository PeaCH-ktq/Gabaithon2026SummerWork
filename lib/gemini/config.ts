/** 使用する Gemini モデル。env で差し替え可能（デフォルトは無料枠の gemini-3.6-flash）。 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/** 一時的な混雑時に切り替える、構造化出力対応の安定モデル。 */
export const GEMINI_FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3-flash";

/** 生成パラメータのデフォルト。 */
export const GENERATION_DEFAULTS = {
  /** 問題は多少の多様性が欲しいが暴走させたくないので低め。 */
  temperature: 0.4,
} as const;

/** 503 UNAVAILABLE に対する指数バックオフ設定（各モデルごと）。 */
export const GENERATION_RETRY = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 4_000,
} as const;

/** Files API のアップロード後、ファイルが ACTIVE になるまでのポーリング設定。 */
export const FILE_POLL = {
  intervalMs: 1_500,
  // ページ数の多い PDF は ACTIVE になるまで時間がかかるため長め。
  timeoutMs: 120_000,
} as const;

/**
 * 受け付ける講義資料の上限（バイト）。
 *
 * ファイルはブラウザから Supabase Storage へ直接アップロードされるため、
 * かつての Vercel サーバーレス関数のリクエストボディ上限（約 4.5MB）はもう効かない。
 * 現在の実質的な制約は Storage バケットの `file_size_limit`
 * （supabase/migrations/20260903_material_limits.sql で 50MB に設定）で、
 * この定数はそれと一致させること。
 *
 * 使われる場所:
 * - lib/data/materials.ts: ブラウザ側でアップロード前に検証
 * - app/api/questions/generate/route.ts: materials.size_bytes に対して再検証
 *   （リクエストボディではなく DB の値を見る）
 */
export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;

/** 受け付ける資料の MIME タイプ。 */
export const ALLOWED_MATERIAL_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
