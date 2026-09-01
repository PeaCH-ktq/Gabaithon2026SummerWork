"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestionSet } from "@/lib/gemini/schema";
import { Button, Icon } from "../ui";

type Material = {
  id: string;
  file_name: string;
  size_bytes: number;
};

type Props = {
  step: number;
  generating: boolean;
  setStep: (step: number) => void;
  setGenerating: (value: boolean) => void;
  onGenerated: (questionSet: QuestionSet) => void;
  onClose: () => void;
};

const formats = ["選択式", "記述式", "混合"] as const;
const counts = [5, 10, 20] as const;
const difficulties = ["基礎", "標準", "試験レベル"] as const;

export function CreateQuizModal({ step, generating, setStep, setGenerating, onGenerated, onClose }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [materialId, setMaterialId] = useState("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [format, setFormat] = useState<(typeof formats)[number]>("混合");
  const [count, setCount] = useState<(typeof counts)[number]>(10);
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("標準");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");

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

  function selectMaterial(id: string) {
    setMaterialId(id);
    setLocalFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setError("");
  }

  function selectFile(file: File | null) {
    setLocalFile(file);
    if (file) setMaterialId("");
    setError("");
  }

  async function generate() {
    if (!materialId && !localFile) {
      setError("DBの資料を選ぶか、ローカルファイルをアップロードしてください。");
      setStep(1);
      return;
    }
    setGenerating(true);
    setError("");
    const body = new FormData();
    if (localFile) body.set("file", localFile);
    else body.set("materialId", materialId);
    body.set("extraInstruction", [
      `問題形式は${format}。`,
      `問題数は${count}問。`,
      `難易度は${difficulty}。`,
      instruction,
    ].filter(Boolean).join("\n"));

    try {
      const response = await fetch("/api/questions/generate", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      onGenerated(json.questionSet as QuestionSet);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setGenerating(false);
    }
  }

  const hasSource = Boolean(materialId || localFile);
  return (
    <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && !generating && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="問題をつくる">
        <button className="modal-close" onClick={onClose} aria-label="閉じる" disabled={generating}><Icon name="close" /></button>
        {generating ? (
          <div className="generating">
            <div className="magic-loader"><Icon name="sparkle" size={28} /></div>
            <p className="eyebrow">GEMINI IS THINKING</p>
            <h2>問題を組み立てています</h2>
            <p>選択した資料を読み取り、指定された形式で問題を生成しています。</p>
            <div className="loading-bar"><span /></div>
          </div>
        ) : (
          <>
            <div className="modal-steps"><span className="active" /><span className={step >= 2 ? "active" : ""} /></div>
            {step === 1 ? (
              <>
                <p className="eyebrow">STEP 1 OF 2</p>
                <h2>どの資料から出題する？</h2>
                <p>DBに登録済みの講義資料・過去問、またはローカルファイルを1つ指定します。</p>
                <div className="selection-list">
                  {loadingMaterials && <p className="source-status">資料を読み込んでいます…</p>}
                  {!loadingMaterials && materials.length === 0 && <p className="source-status">DBに登録された資料はありません。</p>}
                  {materials.map((material) => (
                    <label key={material.id}>
                      <input type="radio" name="source" checked={materialId === material.id} onChange={() => selectMaterial(material.id)} />
                      <span className="custom-check"><Icon name="check" size={14} /></span>
                      <div><b>{material.file_name}</b><small>{(material.size_bytes / 1024 / 1024).toFixed(1)} MB</small></div>
                    </label>
                  ))}
                </div>
                <label className={`local-upload ${localFile ? "selected" : ""}`}>
                  <Icon name="upload" />
                  <div><b>{localFile?.name ?? "ローカルファイルをアップロード"}</b><small>PDF / TXT / Markdown / PNG / JPEG / WebP（最大4MB）</small></div>
                  <input ref={fileInput} type="file" accept=".pdf,.txt,.md,image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
                </label>
              </>
            ) : (
              <>
                <p className="eyebrow">STEP 2 OF 2</p>
                <h2>どんな問題にする？</h2>
                <p>形式と量を決めます。生成後に印刷・PDF保存できます。</p>
                <OptionGroup label="形式" options={formats} value={format} setValue={(value) => setFormat(value as typeof format)} />
                <OptionGroup label="問題数" options={counts.map(String)} value={String(count)} suffix="問" setValue={(value) => setCount(Number(value) as typeof count)} />
                <OptionGroup label="難易度" options={difficulties} value={difficulty} setValue={(value) => setDifficulty(value as typeof difficulty)} />
                <label className="generation-instruction"><b>追加の指示（任意）</b><input value={instruction} maxLength={800} onChange={(event) => setInstruction(event.target.value)} placeholder="例: 第3章を中心に、計算問題を多めに" /></label>
              </>
            )}
            {error && <p className="modal-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <Button subtle onClick={() => step === 1 ? onClose() : setStep(1)}>{step === 1 ? "キャンセル" : "もどる"}</Button>
              <Button primary icon={step === 2 ? "sparkle" : "arrow"} onClick={() => step === 1 ? (hasSource ? setStep(2) : setError("出題元の資料を指定してください。")) : void generate()}>{step === 1 ? "つぎへ" : `${count}問つくる`}</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function OptionGroup({ label, options, value, suffix = "", setValue }: { label: string; options: readonly string[]; value: string; suffix?: string; setValue: (value: string) => void }) {
  return <div className="option-group"><b>{label}</b><div>{options.map((option) => <button type="button" className={option === value ? "active" : ""} key={option} onClick={() => setValue(option)}>{option}{suffix}</button>)}</div></div>;
}
