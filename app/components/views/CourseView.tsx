import type { Course, Navigate } from "../../types";
import { Button, Icon } from "../ui";

type Props = {
  activeTab: "material" | "quiz";
  setActiveTab: (tab: "material" | "quiz") => void;
  navigate: Navigate;
  startCreate: () => void;
  course: Course;
  materials: string[];
  openMaterial: () => void;
  editCourse: () => void;
  toggleShare: () => void;
};

export function CourseView({
  activeTab,
  setActiveTab,
  navigate,
  startCreate,
  course,
  materials,
  openMaterial,
  editCourse,
  toggleShare,
}: Props) {
  return (
    <>
      <button className="back-link" onClick={() => navigate("home")}>
        ← 講義の棚
      </button>
      <header className="course-head">
        <div className="course-code">{course.code}</div>
        <div>
          <h1>{course.name}</h1>
          <p>{course.professor} ・ {course.schedule} ・ {course.room}</p>
        </div>
        <Button onClick={editCourse}>棚を編集</Button>
        <Button primary icon="sparkle" onClick={startCreate}>
          問題をつくる
        </Button>
      </header>
      <div className="privacy-note">
        <Icon name="check" />
        <div>
          <b>講義資料はあなただけに表示されます</b>
          <p>グループに共有されるのは、共有を許可した問題集だけです。</p>
        </div>
      </div>
      <div className="tabs">
        <button
          className={activeTab === "material" ? "active" : ""}
          onClick={() => setActiveTab("material")}
        >
          講義資料 <span>6</span>
        </button>
        <button
          className={activeTab === "quiz" ? "active" : ""}
          onClick={() => setActiveTab("quiz")}
        >
          問題集 <span>3</span>
        </button>
      </div>
      {activeTab === "material" ? (
        <div className="content-card">
          <div className="card-head">
            <div>
              <h2>講義資料</h2>
              <p>PDFやスライドを追加すると、出題範囲に選べます。</p>
            </div>
            <Button
              icon="upload"
              onClick={openMaterial}
            >
              資料を追加
            </Button>
          </div>
          <div className="file-list">
            {materials.length === 0 && <div className="empty-state"><b>資料はまだありません</b><p>「資料を追加」から最初のファイルを選んでください。</p></div>}
            {materials.map((name, i) => (
              <div className="file-row" key={name}>
                <span className="file-icon">PDF</span>
                <div>
                  <b>{name}</b>
                  <small>
                    {[42, 38, 51, 45][i]}ページ ・ 8月{[3, 10, 17, 24][i]}
                    日追加
                  </small>
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
            <Button primary icon="sparkle" onClick={startCreate}>
              新しくつくる
            </Button>
            <Button icon="share" onClick={toggleShare}>{course.shared ? "共有を解除" : "グループに共有"}</Button>
          </div>
          <div className="file-list">
            {[
              "第1回〜第4回 確認テスト",
              "正規化ドリル（記述式）",
              "2025年度中間 類似問題セット",
            ].map((name, i) => (
              <button
                className="file-row quiz-row"
                key={name}
                onClick={() => navigate("quiz")}
              >
                <span className="quiz-icon">Q</span>
                <div>
                  <b>{name}</b>
                  <small>
                    {i === 2
                      ? "過去問参照 ・ 選択式 10問"
                      : "選択・記述 混合 ・ 10問"}
                  </small>
                </div>
                <span className={i === 1 ? "private-pill" : "share-pill"}>
                  {i === 1 ? "自分のみ" : "グループ共有中"}
                </span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
