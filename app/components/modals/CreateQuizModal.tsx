import { materials } from "../../demo-data";
import { Button, Icon } from "../ui";

type Props = {
  step: number;
  generating: boolean;
  setStep: (step: number) => void;
  generate: () => void;
  onClose: () => void;
};

export function CreateQuizModal({
  step,
  generating,
  setStep,
  generate,
  onClose,
}: Props) {
  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="問題をつくる"
      >
        <button
          className="modal-close"
          onClick={() => onClose()}
          aria-label="閉じる"
        >
          <Icon name="close" />
        </button>
        {generating ? (
          <div className="generating">
            <div className="magic-loader">
              <Icon name="sparkle" size={28} />
            </div>
            <p className="eyebrow">GEMINI IS THINKING</p>
            <h2>問題を組み立てています</h2>
            <p>資料の要点と過去問の出題傾向を照らし合わせています。</p>
            <div className="loading-bar">
              <span />
            </div>
          </div>
        ) : (
          <>
            <div className="modal-steps">
              <span className={step >= 1 ? "active" : ""} />
              <span className={step >= 2 ? "active" : ""} />
            </div>
            {step === 1 ? (
              <>
                <p className="eyebrow">STEP 1 OF 2</p>
                <h2>どの資料から出題する？</h2>
                <p>選んだ資料の範囲だけから問題をつくります。</p>
                <div className="selection-list">
                  {materials.map((m, i) => (
                    <label key={m}>
                      <input type="checkbox" defaultChecked={i < 4} />
                      <span className="custom-check">
                        <Icon name="check" size={14} />
                      </span>
                      <div>
                        <b>{m}</b>
                        <small>{[42, 38, 51, 45][i]}ページ</small>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">STEP 2 OF 2</p>
                <h2>どんな問題にする？</h2>
                <p>形式と量を決めます。作成後に編集できます。</p>
                {[
                  ["形式", "選択式", "記述式", "混合"],
                  ["問題数", "5問", "10問", "20問"],
                  ["難易度", "基礎", "標準", "試験レベル"],
                ].map((group, gi) => (
                  <div className="option-group" key={group[0]}>
                    <b>{group[0]}</b>
                    <div>
                      {group.slice(1).map((x, i) => (
                        <button
                          className={i === (gi === 0 ? 2 : 1) ? "active" : ""}
                          key={x}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <label className="reference-past">
                  <input type="checkbox" defaultChecked />
                  <span className="custom-check">
                    <Icon name="check" size={14} />
                  </span>
                  <div>
                    <b>2025年度 中間試験を参照</b>
                    <small>出題傾向と形式を似せます</small>
                  </div>
                </label>
              </>
            )}
            <div className="modal-actions">
              <Button
                subtle
                onClick={() => (step === 1 ? onClose() : setStep(1))}
              >
                {step === 1 ? "キャンセル" : "もどる"}
              </Button>
              <Button
                primary
                icon={step === 2 ? "sparkle" : "arrow"}
                onClick={() => (step === 1 ? setStep(2) : generate())}
              >
                {step === 1 ? "つぎへ" : "10問つくる"}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
