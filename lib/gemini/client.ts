import { GoogleGenAI } from "@google/genai";

/**
 * Gemini クライアントのシングルトン。
 *
 * `GEMINI_API_KEY` はサーバー専用の環境変数。`NEXT_PUBLIC_` を付けていないため
 * クライアントバンドルには含まれない。このモジュールを import してよいのは
 * `lib/gemini/*` と Route Handler（サーバー実行）のみ。
 */
let client: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY が設定されていません。`.env.local` に設定してください（`.env.example` 参照）。",
    );
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}
