/**
 * 署名付きアップロード URL へ XHR で PUT する。
 *
 * supabase-js の `upload()` / `uploadToSignedUrl()` は内部が fetch のため
 * アップロード進捗を取得できない。大きい資料でも待ち時間がわかるよう、
 * 実測の進捗（0〜1）を出す目的でこちらを使う。
 *
 * リクエストの形は `uploadToSignedUrl`（storage-js）に合わせる:
 *   PUT {signedUrl（token をクエリに含む）}
 *   ヘッダ: x-upsert: false（content-type は multipart 境界のためブラウザに任せる）
 *   ボディ: multipart/form-data（cacheControl フィールド ＋ 空フィールド名でファイル本体）
 */
export function putWithProgress(
  signedUrl: string,
  file: File,
  contentType: string,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", new Blob([file], { type: contentType }), file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error(`資料のアップロードに失敗しました（HTTP ${xhr.status}）。`));
      }
    };
    xhr.onerror = () => reject(new Error("アップロード中に通信エラーが発生しました。"));
    xhr.onabort = () => reject(new Error("アップロードが中断されました。"));

    xhr.send(body);
  });
}
