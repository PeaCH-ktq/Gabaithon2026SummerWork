"use client";

import { useRef, useState } from "react";
import { Button, Icon } from "../ui";

type Props = {
  kind?: "lecture" | "misc";
  onClose: () => void;
  /** 1ファイルをアップロードする。進捗は 0〜1 で通知される。成功時はファイル名を返す。 */
  onUpload: (file: File, onProgress: (ratio: number) => void) => Promise<string>;
  /** 1件以上アップロードが完了するたびに呼ぶ（一覧の再読込・トーストは呼び出し側の責務）。 */
  onFinished: (uploadedNames: string[]) => void;
};

export function MaterialModal({ kind = "lecture", onClose, onUpload, onFinished }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRatio, setCurrentRatio] = useState(0);
  const [doneBytes, setDoneBytes] = useState(0);
  const [error, setError] = useState("");

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const ratio =
    totalBytes === 0
      ? 0
      : (doneBytes + (files[currentIndex]?.size ?? 0) * currentRatio) / totalBytes;
  const percent = Math.min(100, Math.round(ratio * 100));

  async function submit() {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setError("");
    setDoneBytes(0);

    const uploaded: string[] = [];
    const failed: { name: string; message: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i);
      setCurrentRatio(0);
      const file = files[i];
      try {
        uploaded.push(await onUpload(file, setCurrentRatio));
      } catch (cause) {
        failed.push({
          name: file.name,
          message: cause instanceof Error ? cause.message : String(cause),
        });
      }
      setDoneBytes((prev) => prev + file.size);
    }

    setUploading(false);

    if (uploaded.length > 0) {
      onFinished(uploaded);
    }

    if (failed.length > 0) {
      setError(
        `${uploaded.length}件成功 / ${failed.length}件失敗\n` +
          failed.map((f) => `・${f.name}: ${f.message}`).join("\n"),
      );
      // 失敗が残っているファイルだけを選び直せるようにする。
      setFiles(failed.map((f) => files.find((file) => file.name === f.name)).filter((f): f is File => !!f));
    } else {
      setFiles([]);
      onClose();
    }
  }

  const dropzoneLabel =
    files.length === 0
      ? "ファイルを選択"
      : files.length === 1
        ? files[0].name
        : `${files[0].name} ほか ${files.length - 1} 件`;

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && !uploading && onClose()}>
      <section className="modal small-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="閉じる" disabled={uploading}>
          <Icon name="close" />
        </button>
        <p className="eyebrow">NEW MATERIAL</p>
        <h2>{kind === "misc" ? "雑資料を追加" : "講義資料を追加"}</h2>
        <p>
          {kind === "misc"
            ? "棚を共有しているグループのメンバーも閲覧できます。"
            : "選択した資料は自分だけに表示されます。"}
        </p>
        <button className="upload-dropzone" onClick={() => input.current?.click()} disabled={uploading}>
          <Icon name="upload" />
          <b>{dropzoneLabel}</b>
          <small>PDF / TXT / Markdown / 画像（複数選択可）</small>
        </button>
        <input
          ref={input}
          hidden
          type="file"
          multiple
          accept=".pdf,.txt,.md,image/*"
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
        />
        {uploading && (
          <div className="upload-progress">
            <b>{`アップロード中（${currentIndex + 1}/${files.length}）… ${percent}%`}</b>
            <small>{files[currentIndex]?.name}</small>
            <div className="loading-bar determinate">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
        {error && (
          <p className="modal-error" role="alert" style={{ whiteSpace: "pre-line" }}>
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button subtle onClick={onClose} disabled={uploading}>
            キャンセル
          </Button>
          <Button primary icon="upload" onClick={() => void submit()} disabled={files.length === 0 || uploading}>
            {uploading ? `${percent}%` : files.length > 1 ? `${files.length}件を一覧に追加` : "一覧に追加"}
          </Button>
        </div>
      </section>
    </div>
  );
}
