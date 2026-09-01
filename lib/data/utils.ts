import type { PostgrestError } from "@supabase/supabase-js";

/**
 * `lib/data/*` 共通のエラーハンドラ。
 * PostgREST の `{ data, error }` を受け取り、error があれば console に出して
 * 日本語メッセージで throw する。呼び出し側は data だけを扱えばよい。
 */
export function unwrap<T>(
  result: { data: T | null; error: PostgrestError | null },
  what: string,
): NonNullable<T> {
  if (result.error) {
    console.error(`[data] ${what}`, result.error);
    throw new Error(`${what}に失敗しました。`);
  }
  if (result.data === null || result.data === undefined) {
    throw new Error(`${what}の結果が空でした。`);
  }
  return result.data as NonNullable<T>;
}

/** 招待コード生成用の文字集合（紛らわしい 0/O/1/I/L を除外）。 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** `TANE-XXXX` 形式の招待コードを生成する。 */
export function generateInviteCode(): string {
  let body = "";
  for (let i = 0; i < 4; i += 1) {
    body += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `TANE-${body}`;
}
