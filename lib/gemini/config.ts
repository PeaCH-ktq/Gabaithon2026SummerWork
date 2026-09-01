/** 使用する Gemini モデル。env で差し替え可能（デフォルトは無料枠の gemini-2.5-flash）。 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/** 一時的な混雑時に切り替える、構造化出力対応の安定モデル。 */
export const GEMINI_FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash";

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
  timeoutMs: 60_000,
} as const;

/**
 * Route Handler で受け付ける講義資料の上限（バイト）。
 *
 * これは Gemini や Next.js の制限ではなく、Vercel にデプロイした際の
 * サーバーレス関数のリクエストボディ上限（約 4.5MB）に合わせたもの。
 * ブラウザ → 自前サーバー → Gemini とファイルが流れるため、この上限が実質の制約になる。
 * 大きい資料に対応する場合はブラウザから Storage へ直接アップロードする設計へ移行する。
 */
export const MAX_MATERIAL_BYTES = 4 * 1024 * 1024;

/** 受け付ける資料の MIME タイプ。 */
export const ALLOWED_MATERIAL_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
