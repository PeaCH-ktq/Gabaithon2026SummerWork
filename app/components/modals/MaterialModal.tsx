"use client";
import { useRef, useState } from "react";
import { Button, Icon } from "../ui";
export function MaterialModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const input = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null);
  return <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal small-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="閉じる"><Icon name="close" /></button><p className="eyebrow">NEW MATERIAL</p><h2>講義資料を追加</h2><p>選択した資料は自分だけに表示されます。</p><button className="upload-dropzone" onClick={() => input.current?.click()}><Icon name="upload" /><b>{file?.name ?? "ファイルを選択"}</b><small>PDF / TXT / Markdown / 画像</small></button><input ref={input} hidden type="file" accept=".pdf,.txt,.md,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><div className="modal-actions"><Button subtle onClick={onClose}>キャンセル</Button><Button primary icon="upload" onClick={() => file && onAdd(file.name)}>一覧に追加</Button></div></section></div>;
}
