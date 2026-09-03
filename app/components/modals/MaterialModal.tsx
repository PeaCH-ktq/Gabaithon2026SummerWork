"use client";

import { useRef, useState } from "react";
import { Button, Icon } from "../ui";

type Props = {
  kind?: "lecture" | "misc";
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
};

export function MaterialModal({ kind = "lecture", onClose, onUpload }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    try {
      await onUpload(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setUploading(false);
    }
  }

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
          <b>{file?.name ?? "ファイルを選択"}</b>
          <small>PDF / TXT / Markdown / 画像</small>
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept=".pdf,.txt,.md,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {error && <p className="modal-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <Button subtle onClick={onClose} disabled={uploading}>
            キャンセル
          </Button>
          <Button primary icon="upload" onClick={() => void submit()} disabled={!file || uploading}>
            {uploading ? "アップロード中…" : "一覧に追加"}
          </Button>
        </div>
      </section>
    </div>
  );
}
