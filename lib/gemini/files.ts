import { FileState } from "@google/genai";
import { getGeminiClient } from "./client";
import { FILE_POLL } from "./config";

export interface UploadedMaterial {
  /** Files API 上のリソース名（削除時に使う）。 */
  name: string;
  /** generateContent の contents に渡す URI。 */
  uri: string;
  mimeType: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * ファイルを Gemini Files API にアップロードし、ACTIVE になるまで待つ。
 *
 * Files API のファイルは API キー単位で保持され、48時間で自動失効する。
 * 恒久保存は別途アプリ側（Supabase 等）で行う想定。
 */
export async function uploadMaterial(
  file: Blob,
  mimeType: string,
  displayName?: string,
): Promise<UploadedMaterial> {
  const ai = getGeminiClient();

  let uploaded = await ai.files.upload({
    file,
    config: { mimeType, displayName },
  });

  const deadline = Date.now() + FILE_POLL.timeoutMs;
  while (uploaded.state === FileState.PROCESSING) {
    if (Date.now() > deadline) {
      throw new Error("アップロードしたファイルの処理がタイムアウトしました。");
    }
    await sleep(FILE_POLL.intervalMs);
    if (!uploaded.name) break;
    uploaded = await ai.files.get({ name: uploaded.name });
  }

  if (uploaded.state === FileState.FAILED) {
    throw new Error("アップロードしたファイルの処理に失敗しました。");
  }
  if (!uploaded.uri || !uploaded.name) {
    throw new Error("Files API から有効なファイル情報が返りませんでした。");
  }

  return {
    name: uploaded.name,
    uri: uploaded.uri,
    mimeType: uploaded.mimeType ?? mimeType,
  };
}

/** アップロード済みファイルを削除する。失敗しても無視（48hで自動失効するため）。 */
export async function deleteMaterial(name: string): Promise<void> {
  try {
    await getGeminiClient().files.delete({ name });
  } catch {
    // ベストエフォート
  }
}
