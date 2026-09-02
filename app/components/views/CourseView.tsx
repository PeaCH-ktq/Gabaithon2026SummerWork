import type { Assignment, LoadState, MaterialRow, Navigate, QuestionSetRow, Shelf } from "../../types";
import { formatSchedule } from "@/lib/format/schedule";
import { Button, Icon } from "../ui";

type Props = {
  activeTab: "material" | "quiz";
  setActiveTab: (tab: "material" | "quiz") => void;
  navigate: Navigate;
  startCreate: () => void;
  shelf: Shelf;
  materials: MaterialRow[];
  materialsState: LoadState;
  questionSets: QuestionSetRow[];
  questionSetsState: LoadState;
  openMaterial: () => void;
  openQuiz: (id: string) => void;
  editCourse: () => void;
  openShare: () => void;
  assignments: Assignment[];
  openShelves: () => void;
  isOwner: boolean;
};

const DATE_FMT = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric" });

export function CourseView({
  activeTab,
  setActiveTab,
  navigate,
  startCreate,
  shelf,
  materials,
  materialsState,
  questionSets,
  questionSetsState,
  openMaterial,
  openQuiz,
  editCourse,
  openShare,
  assignments,
  openShelves,
  isOwner,
}: Props) {
  return (
    <>
      <button className="back-link" onClick={openShelves}>
        ← 講義の棚
      </button>
      <header className="course-head">
        <div className="course-code">{shelf.course_code ?? "—"}</div>
        <div>
          <h1>{shelf.course_name}</h1>
          <p>{shelf.professor ?? "担当教員未設定"} ・ {formatSchedule(shelf.day_of_week, shelf.period)} ・ {shelf.room ?? "教室未設定"}</p>
        </div>
        {isOwner && <Button onClick={editCourse}>棚を編集</Button>}
        {isOwner && (
          <Button primary icon="sparkle" onClick={startCreate}>
            問題をつくる
          </Button>
        )}
      </header>
      <div className="privacy-note">
        <Icon name="check" />
        <div>
          <b>講義資料はあなただけに表示されます</b>
          <p>{isOwner ? "グループに共有されるのは、共有を許可した棚の問題集だけです。" : "この棚はグループに共有されています。講義資料は所有者だけが閲覧できます。"}</p>
        </div>
      </div>
      <section className="course-assignments">
        <div className="card-head"><div><p className="eyebrow">ASSIGNMENTS</p><h2>この講義の課題</h2></div><Button icon="arrow" onClick={() => navigate("tasks")}>課題一覧へ</Button></div>
        {assignments.length === 0 ? <div className="empty-state"><b>この講義の未完了課題はありません</b></div> : <div className="course-assignment-list">{assignments.map((assignment) => <button key={assignment.title} onClick={() => navigate("tasks")}><span className={`date-box ${assignment.color}`}><b>{assignment.left}</b><small>{assignment.date}</small></span><span><b>{assignment.title}</b><small>{assignment.course}</small></span><Icon name="arrow" size={15} /></button>)}</div>}
      </section>
      <div className="tabs">
        <button
          className={activeTab === "material" ? "active" : ""}
          onClick={() => setActiveTab("material")}
        >
          講義資料 <span>{shelf.materialCount}</span>
        </button>
        <button
          className={activeTab === "quiz" ? "active" : ""}
          onClick={() => setActiveTab("quiz")}
        >
          問題集 <span>{shelf.questionSetCount}</span>
        </button>
      </div>
      {activeTab === "material" ? (
        <div className="content-card">
          <div className="card-head">
            <div>
              <h2>講義資料</h2>
              <p>PDFやスライドを追加すると、出題範囲に選べます。</p>
            </div>
            {isOwner && (
              <Button
                icon="upload"
                onClick={openMaterial}
              >
                資料を追加
              </Button>
            )}
          </div>
          <div className="file-list">
            {materialsState === "loading" && <div className="empty-state"><b>読み込み中…</b></div>}
            {materialsState === "error" && <div className="empty-state"><b>資料の読み込みに失敗しました</b></div>}
            {materialsState === "ready" && materials.length === 0 && (
              <div className="empty-state">
                <b>資料はまだありません</b>
                <p>{isOwner ? "「資料を追加」から最初のファイルを選んでください。" : "この棚の資料は所有者だけが閲覧できます。"}</p>
              </div>
            )}
            {materials.map((material) => (
              <div className="file-row" key={material.id}>
                <span className="file-icon">{extLabel(material.file_name, material.mime_type)}</span>
                <div>
                  <b>{material.file_name}</b>
                  <small>{DATE_FMT.format(new Date(material.created_at))}追加</small>
                </div>
                <span className="private-pill">自分のみ</span>
                <button aria-label="その他">
                  <Icon name="more" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="content-card">
          <div className="card-head">
            <div>
              <h2>作成した問題集</h2>
              <p>印刷、PDF保存、グループ共有ができます。</p>
            </div>
            {isOwner && (
              <>
                <Button primary icon="sparkle" onClick={startCreate}>
                  新しくつくる
                </Button>
                <Button icon="share" onClick={openShare}>{shelf.shares.length > 0 ? "共有設定" : "グループに共有"}</Button>
              </>
            )}
          </div>
          <div className="file-list">
            {questionSetsState === "loading" && <div className="empty-state"><b>読み込み中…</b></div>}
            {questionSetsState === "error" && <div className="empty-state"><b>問題集の読み込みに失敗しました</b></div>}
            {questionSetsState === "ready" && questionSets.length === 0 && <div className="empty-state"><b>問題集はまだありません</b><p>「新しくつくる」から最初の問題集を作成してください。</p></div>}
            {questionSets.map((qs) => (
              <button
                className="file-row quiz-row"
                key={qs.id}
                onClick={() => { openQuiz(qs.id); navigate("quiz"); }}
              >
                <span className="quiz-icon">Q</span>
                <div>
                  <b>{qs.title}</b>
                  <small>{qs.content.questions.length}問 ・ {DATE_FMT.format(new Date(qs.created_at))}作成</small>
                </div>
                <span className="private-pill">{shelf.shares.length > 0 ? "共有中" : "自分のみ"}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** ファイル名の拡張子（なければ MIME から）を短いラベルにする。 */
function extLabel(fileName: string, mimeType: string | null): string {
  const ext = fileName.split(".").pop();
  if (ext && ext !== fileName) return ext.slice(0, 4).toUpperCase();
  if (mimeType?.includes("pdf")) return "PDF";
  return "FILE";
}
