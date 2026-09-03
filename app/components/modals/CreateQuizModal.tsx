"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { QuestionSet } from "@/lib/gemini/schema";
import { uploadMaterial } from "@/lib/data/materials";
import { MAX_MATERIALS_PER_REQUEST, MAX_TOTAL_MATERIAL_BYTES } from "@/lib/gemini/config";
import { Button, Icon } from "../ui";

type Material = {
  id: string;
  shelf_id: string;
  kind: "lecture" | "misc";
  file_name: string;
  size_bytes: number;
};

type Props = {
  supabase: SupabaseClient<Database>;
  shelfId: string;
  step: number;
  generating: boolean;
  setStep: (step: number) => void;
  setGenerating: (value: boolean) => void;
  onGenerated: (questionSetId: string | null, questionSet: QuestionSet) => void;
  onClose: () => void;
};

const MAX_TOTAL_MB = Math.floor(MAX_TOTAL_MATERIAL_BYTES / 1024 / 1024);

export function CreateQuizModal({ supabase, shelfId, step, generating, setStep, setGenerating, onGenerated, onClose }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [sourceTab, setSourceTab] = useState<"lecture" | "misc">("lecture");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadRatio, setUploadRatio] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/materials")
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "資料を取得できませんでした。");
        if (active) setMaterials(json.materials as Material[]);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => active && setLoadingMaterials(false));
    return () => { active = false; };
  }, []);

  const tabMaterials = materials.filter((m) => m.kind === sourceTab);
  const shelfMaterials = tabMaterials.filter((m) => m.shelf_id === shelfId);
  const otherMaterials = tabMaterials.filter((m) => m.shelf_id !== shelfId);
  const lectureCount = materials.filter((m) => m.kind === "lecture").length;
  const miscCount = materials.filter((m) => m.kind === "misc").length;

  const selectedDbMaterials = materials.filter((m) => selectedIds.includes(m.id));
  const totalCount = selectedDbMaterials.length + localFiles.length;
  const totalBytes =
    selectedDbMaterials.reduce((sum, m) => sum + m.size_bytes, 0) +
    localFiles.reduce((sum, f) => sum + f.size, 0);

  function toggleMaterial(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setError("");
  }

  function pickLocalFiles(files: FileList | null) {
    setLocalFiles([...(files ?? [])]);
    setError("");
  }

  function validateSelection(): string | null {
    if (totalCount === 0) return "出題元の資料を1つ以上指定してください。";
    if (totalCount > MAX_MATERIALS_PER_REQUEST) {
      return `参照できる資料は最大${MAX_MATERIALS_PER_REQUEST}件です。`;
    }
    if (totalBytes > MAX_TOTAL_MATERIAL_BYTES) {
      return `資料の合計サイズが大きすぎます（上限 ${MAX_TOTAL_MB}MB）。`;
    }
    return null;
  }

  async function generate() {
    const validationError = validateSelection();
    if (validationError) {
      setError(validationError);
      setStep(1);
      return;
    }
    setGenerating(true);
    setError("");

    const uploadedIds: string[] = [];
    if (localFiles.length > 0) {
      setUploadingLocal(true);
      setUploadedBytes(0);
      for (let i = 0; i < localFiles.length; i++) {
        setUploadIndex(i);
        setUploadRatio(0);
        try {
          const material = await uploadMaterial(supabase, shelfId, localFiles[i], setUploadRatio, sourceTab);
          uploadedIds.push(material.id);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setGenerating(false);
          setUploadingLocal(false);
          return;
        }
        setUploadedBytes((prev) => prev + localFiles[i].size);
      }
      setUploadingLocal(false);
    }

    const body = new FormData();
    for (const id of [...selectedIds, ...uploadedIds]) body.append("materialIds", id);
    body.set("shelfId", shelfId);
    body.set("extraInstruction", instruction);

    try {
      const response = await fetch("/api/questions/generate", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      onGenerated(json.questionSetId as string | null, json.questionSet as QuestionSet);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setGenerating(false);
    }
  }

  const localFilesTotalBytes = localFiles.reduce((sum, f) => sum + f.size, 0);
  const uploadPercent =
    localFilesTotalBytes === 0
      ? 0
      : Math.round(
          Math.min(
            1,
            (uploadedBytes + (localFiles[uploadIndex]?.size ?? 0) * uploadRatio) / localFilesTotalBytes,
          ) * 100,
        );
  const localUploadLabel =
    localFiles.length === 0
      ? "ローカルファイルをアップロード"
      : localFiles.length === 1
        ? localFiles[0].name
        : `${localFiles[0].name} ほか ${localFiles.length - 1} 件`;

  return (
    <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && !generating && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="問題をつくる">
        <button className="modal-close" onClick={onClose} aria-label="閉じる" disabled={generating}><Icon name="close" /></button>
        {generating ? (
          <div className="generating">
            <div className="magic-loader"><Icon name="sparkle" size={28} /></div>
            <p className="eyebrow">GEMINI IS THINKING</p>
            <h2>
              {uploadingLocal
                ? `資料を保存しています（${uploadIndex + 1}/${localFiles.length}）… ${uploadPercent}%`
                : "問題を組み立てています"}
            </h2>
            <p>選択した資料を読み取り、指定された形式で問題を生成しています。</p>
            {uploadingLocal ? (
              <div className="loading-bar determinate">
                <span style={{ width: `${uploadPercent}%` }} />
              </div>
            ) : (
              <div className="loading-bar"><span /></div>
            )}
          </div>
        ) : (
          <>
            <div className="modal-steps"><span className="active" /><span className={step >= 2 ? "active" : ""} /></div>
            {step === 1 ? (
              <>
                <p className="eyebrow">STEP 1 OF 2</p>
                <h2>どの資料から出題する？</h2>
                <p>
                  DBに登録済みの資料とローカルファイルを、あわせて最大{MAX_MATERIALS_PER_REQUEST}件まで選べます。
                  過去問を混ぜると出題傾向を真似た問題になります。
                </p>
                <div className="tabs">
                  <button
                    type="button"
                    className={sourceTab === "lecture" ? "active" : ""}
                    onClick={() => setSourceTab("lecture")}
                  >
                    講義資料 <span>{lectureCount}</span>
                  </button>
                  <button
                    type="button"
                    className={sourceTab === "misc" ? "active" : ""}
                    onClick={() => setSourceTab("misc")}
                  >
                    雑資料 <span>{miscCount}</span>
                  </button>
                </div>
                <div className="selection-list">
                  {loadingMaterials && <p className="source-status">資料を読み込んでいます…</p>}
                  {!loadingMaterials && shelfMaterials.length === 0 && otherMaterials.length === 0 && <p className="source-status">DBに登録された資料はありません。</p>}
                  {shelfMaterials.map((material) => (
                    <label key={material.id}>
                      <input type="checkbox" checked={selectedIds.includes(material.id)} onChange={() => toggleMaterial(material.id)} />
                      <span className="custom-check"><Icon name="check" size={14} /></span>
                      <div><b>{material.file_name}</b><small>{(material.size_bytes / 1024 / 1024).toFixed(1)} MB</small></div>
                    </label>
                  ))}
                  {otherMaterials.length > 0 && (
                    <>
                      <p className="source-status">{sourceTab === "misc" ? "他の講義・共有された資料" : "他の講義の資料"}</p>
                      {otherMaterials.map((material) => (
                        <label key={material.id}>
                          <input type="checkbox" checked={selectedIds.includes(material.id)} onChange={() => toggleMaterial(material.id)} />
                          <span className="custom-check"><Icon name="check" size={14} /></span>
                          <div><b>{material.file_name}</b><small>{(material.size_bytes / 1024 / 1024).toFixed(1)} MB</small></div>
                        </label>
                      ))}
                    </>
                  )}
                </div>
                <label className={`local-upload ${localFiles.length > 0 ? "selected" : ""}`}>
                  <Icon name="upload" />
                  <div><b>{localUploadLabel}</b><small>PDF / TXT / Markdown / PNG / JPEG / WebP（最大50MB・複数選択可）</small></div>
                  <input ref={fileInput} type="file" multiple accept=".pdf,.txt,.md,image/png,image/jpeg,image/webp" onChange={(event) => pickLocalFiles(event.target.files)} />
                </label>
                {totalCount > 0 && (
                  <p className="source-status">
                    {totalCount}件選択中 ・ 合計 {(totalBytes / 1024 / 1024).toFixed(1)} MB / 最大{MAX_MATERIALS_PER_REQUEST}件
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="eyebrow">STEP 2 OF 2</p>
                <h2>どんな問題にする？</h2>
                <p>形式・問題数・難易度は資料の内容から Gemini が判断します。必要であれば指示を追加してください。</p>
                <label className="generation-instruction"><b>追加の指示（任意）</b><input value={instruction} maxLength={1000} onChange={(event) => setInstruction(event.target.value)} placeholder="例: 第3章を中心に、計算問題を多めに" /></label>
              </>
            )}
            {error && <p className="modal-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <Button subtle onClick={() => step === 1 ? onClose() : setStep(1)}>{step === 1 ? "キャンセル" : "もどる"}</Button>
              <Button
                primary
                icon={step === 2 ? "sparkle" : "arrow"}
                onClick={() => {
                  if (step === 1) {
                    const validationError = validateSelection();
                    if (validationError) setError(validationError);
                    else setStep(2);
                  } else {
                    void generate();
                  }
                }}
              >
                {step === 1 ? "つぎへ" : "つくる"}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
