"use client";

import { useEffect, useState } from "react";

type View = "home" | "course" | "quiz" | "tasks" | "group";
type IconName = "home" | "book" | "task" | "users" | "plus" | "clock" | "calendar" | "upload" | "sparkle" | "file" | "share" | "arrow" | "check" | "close" | "more";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16"/></>,
    task: <><path d="M9 11l2 2 4-4"/><path d="M6 4h12a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2Z"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 15v5h14v-5"/></>,
    sparkle: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7zM19 14l.5 1.5L21 16l-1.5.5L19 18l-.5-1.5L17 16l1.5-.5z"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5"/></>, share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>, check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M18 6 6 18"/>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const courses = [
  { code: "CS-302", name: "データベース論", professor: "松本 教授", docs: 6, quizzes: 3, tab: "#5866c5", shared: true },
  { code: "CS-305", name: "オペレーティングシステム", professor: "佐藤 准教授", docs: 9, quizzes: 2, tab: "#ea8e72", shared: true },
  { code: "MA-211", name: "確率統計", professor: "中村 教授", docs: 5, quizzes: 1, tab: "#54a887", shared: false },
  { code: "CS-314", name: "機械学習基礎", professor: "山本 准教授", docs: 8, quizzes: 4, tab: "#b17fb6", shared: true },
];
const deadlines = [
  { left: "あと 2日", date: "8月31日 23:59", title: "正規化レポート", course: "データベース論", color: "coral" },
  { left: "あと 6日", date: "9月4日 17:00", title: "デッドロック演習", course: "オペレーティングシステム", color: "yellow" },
  { left: "あと 11日", date: "9月9日 12:00", title: "論文要約", course: "機械学習基礎", color: "green" },
];
const materials = ["第01回 データベースとは・3層スキーマ", "第02回 関係代数", "第03回 SQL基礎", "第04回 正規化理論"];
const questions = [
  { type: "選択", text: "3層スキーマ構造において、利用者ごとの見え方を定義するのはどれか。", options: ["外部スキーマ", "概念スキーマ", "内部スキーマ", "物理スキーマ"] },
  { type: "記述", text: "関係代数において、2つの関係から共通の属性値をもつ組を結合する演算の名称を答えよ。" },
  { type: "類似問題", text: "次の関係 R(学籍番号, 氏名, 学科コード, 学科名) が第3正規形を満たさない理由として最も適切なものはどれか。", options: ["部分関数従属が存在する", "推移的関数従属が存在する", "多値従属性が存在する", "候補キーが複数存在する"] },
  { type: "記述", text: "SQLにおいて、GROUP BY句で集約した結果に対して条件を指定する句を答えよ。" },
];

function Button({ children, primary, subtle, onClick, icon }: { children: React.ReactNode; primary?: boolean; subtle?: boolean; onClick?: () => void; icon?: IconName }) {
  return <button className={`button ${primary ? "primary" : ""} ${subtle ? "subtle" : ""}`} onClick={onClick}>{icon && <Icon name={icon} size={16}/>}<span>{children}</span></button>;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [modal, setModal] = useState<"none" | "create" | "schedule">("none");
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"material" | "quiz">("material");
  const [generating, setGenerating] = useState(false);
  const notify = (message: string) => setToast(message);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2600); return () => clearTimeout(timer); }, [toast]);
  function navigate(next: View) { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function startCreate() { setStep(1); setGenerating(false); setModal("create"); }
  function generate() { setGenerating(true); setTimeout(() => { setModal("none"); setGenerating(false); navigate("quiz"); notify("10問の問題集を作成しました"); }, 2200); }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("home")} aria-label="Tan-E ホーム"><span className="brand-mark"><span/></span><span className="brand-copy"><b>Tan-E</b><small>STUDY COMPANION</small></span></button>
      <nav aria-label="メインナビゲーション"><span className="nav-label">STUDY</span>
        {[{id:"home",label:"ホーム",icon:"home"},{id:"course",label:"講義の棚",icon:"book"},{id:"tasks",label:"課題",icon:"task"}].map(item => <button key={item.id} className={`nav-item ${view === item.id || (item.id === "course" && view === "quiz") ? "active" : ""}`} onClick={() => navigate(item.id as View)}><Icon name={item.icon as IconName}/><span>{item.label}</span>{item.id === "tasks" && <em>3</em>}</button>)}
        <span className="nav-label second">TOGETHER</span><button className={`nav-item ${view === "group" ? "active" : ""}`} onClick={() => navigate("group")}><Icon name="users"/><span>情報工学3年</span><span className="online-dot"/></button>
      </nav>
      <div className="sidebar-foot"><span className="avatar indigo">ゆ</span><span><b>ゆうた</b><small>工学部 情報工学科</small></span><button aria-label="ユーザーメニュー"><Icon name="more"/></button></div>
    </aside>
    <main className="main">
      {view === "home" && <>
        <header className="page-head"><div><p className="eyebrow">2026 AUTUMN SEMESTER</p><h1>おかえりなさい、ゆうたさん。</h1><p>試験まで、あと少し。今日もひとつ進めよう。</p></div><Button primary icon="sparkle" onClick={startCreate}>問題をつくる</Button></header>
        <section className="focus-card"><div className="focus-copy"><span className="tiny-label">TODAY&apos;S FOCUS</span><h2>データベース論・中間対策</h2><p>第1回〜第4回の資料から、試験レベルの問題に挑戦できます。</p><div className="focus-actions"><Button primary onClick={() => navigate("quiz")}>問題集をひらく</Button><button className="text-link" onClick={() => navigate("course")}>棚を見る <Icon name="arrow" size={15}/></button></div></div><div className="progress-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="49"/><circle className="progress" cx="60" cy="60" r="49"/></svg><strong>72<small>%</small></strong><span>学習進捗</span></div></section>
        <section className="section"><div className="section-head"><div><p className="eyebrow">MY COURSES</p><h2>講義の棚</h2></div><button className="text-link" onClick={() => navigate("course")}>すべて見る <Icon name="arrow" size={15}/></button></div><div className="shelf-grid">{courses.map(course => <button key={course.code} className="shelf" style={{"--tab": course.tab} as React.CSSProperties} onClick={() => navigate("course")}><div className="shelf-top"><span>{course.code}</span>{course.shared && <span className="shared"><Icon name="users" size={12}/>共有中</span>}</div><h3>{course.name}</h3><p>{course.professor}</p><div className="shelf-meta"><span><b>{course.docs}</b> 資料</span><span><b>{course.quizzes}</b> 問題集</span><Icon name="arrow" size={17}/></div></button>)}</div></section>
        <section className="section"><div className="section-head"><div><p className="eyebrow">UPCOMING</p><h2>もうすぐ締切</h2></div><button className="text-link" onClick={() => navigate("tasks")}>課題をすべて見る <Icon name="arrow" size={15}/></button></div><div className="deadline-list">{deadlines.map(item => <div className="deadline" key={item.title}><span className={`date-box ${item.color}`}><b>{item.left}</b><small>{item.date}</small></span><span className="deadline-title"><b>{item.title}</b><small>{item.course}</small></span><button onClick={() => notify("取り組み時間の記録を開始しました")} aria-label={`${item.title}の時間を記録`}><Icon name="clock"/></button></div>)}</div></section>
      </>}
      {view === "course" && <>
        <button className="back-link" onClick={() => navigate("home")}>← 講義の棚</button><header className="course-head"><div className="course-code">CS-302</div><div><h1>データベース論</h1><p>松本 教授 ・ 火曜 3限 ・ 情報棟 204</p></div><Button primary icon="sparkle" onClick={startCreate}>問題をつくる</Button></header>
        <div className="privacy-note"><Icon name="check"/><div><b>講義資料はあなただけに表示されます</b><p>グループに共有されるのは、共有を許可した問題集だけです。</p></div></div><div className="tabs"><button className={activeTab === "material" ? "active" : ""} onClick={() => setActiveTab("material")}>講義資料 <span>6</span></button><button className={activeTab === "quiz" ? "active" : ""} onClick={() => setActiveTab("quiz")}>問題集 <span>3</span></button></div>
        {activeTab === "material" ? <div className="content-card"><div className="card-head"><div><h2>講義資料</h2><p>PDFやスライドを追加すると、出題範囲に選べます。</p></div><Button icon="upload" onClick={() => notify("ファイル選択を開きました（デモ）")}>資料を追加</Button></div><div className="file-list">{materials.map((name, i) => <div className="file-row" key={name}><span className="file-icon">PDF</span><div><b>{name}</b><small>{[42,38,51,45][i]}ページ ・ 8月{[3,10,17,24][i]}日追加</small></div><span className="private-pill">自分のみ</span><button aria-label="その他"><Icon name="more"/></button></div>)}</div></div> : <div className="content-card"><div className="card-head"><div><h2>作成した問題集</h2><p>印刷、PDF保存、グループ共有ができます。</p></div><Button primary icon="sparkle" onClick={startCreate}>新しくつくる</Button></div><div className="file-list">{["第1回〜第4回 確認テスト","正規化ドリル（記述式）","2025年度中間 類似問題セット"].map((name,i)=><button className="file-row quiz-row" key={name} onClick={() => navigate("quiz")}><span className="quiz-icon">Q</span><div><b>{name}</b><small>{i === 2 ? "過去問参照 ・ 選択式 10問" : "選択・記述 混合 ・ 10問"}</small></div><span className={i === 1 ? "private-pill" : "share-pill"}>{i === 1 ? "自分のみ" : "グループ共有中"}</span><Icon name="arrow"/></button>)}</div></div>}
      </>}
      {view === "quiz" && <><div className="quiz-toolbar"><button className="back-link" onClick={() => navigate("course")}>← データベース論</button><div><Button icon="share" onClick={() => notify("グループに共有しました")}>共有</Button><Button primary icon="file" onClick={() => window.print()}>印刷 / PDF保存</Button></div></div><article className="quiz-sheet"><header><div><span>CS-302 ・ DATABASE</span><h1>データベース論　確認テスト</h1><p>第1回〜第4回 ／ 選択・記述 混合 ／ 全10問</p></div><span className="name-line">氏名</span></header>{questions.map((q,i)=><section className="question" key={q.text}><div className="question-label"><span>QUESTION {String(i+1).padStart(2,"0")}</span><em>{q.type}</em></div><h2>{q.text}</h2>{q.options ? <ol>{q.options.map((o,j)=><li key={o}><span>{String.fromCharCode(65+j)}</span>{o}</li>)}</ol> : <div className="answer-lines"><i/><i/></div>}</section>)}</article></>}
      {view === "tasks" && <><header className="page-head"><div><p className="eyebrow">DEADLINES</p><h1>課題を、ひとつずつ。</h1><p>かかった時間を記録すると、グループのみんなの目安になります。</p></div><Button primary icon="plus" onClick={() => notify("課題の追加画面を開きました（デモ）")}>課題を追加</Button></header><div className="task-board"><section><h2>これから <span>3</span></h2>{deadlines.map((item,i)=><article className="task-card" key={item.title}><div className={`task-check ${i===0?"urgent":""}`}/><div><span className="task-course">{item.course}</span><h3>{item.title}</h3><p><Icon name="calendar" size={14}/>{item.date}</p></div><span className={`due-tag ${i===0?"urgent":""}`}>{item.left}</span><Button subtle icon="clock" onClick={() => notify("タイマーを開始しました")}>時間を記録</Button></article>)}</section><section><h2>終わった課題 <span>2</span></h2>{["SQL演習課題 第2回","プロセススケジューリング演習"].map((t,i)=><article className="task-card done" key={t}><div className="task-check"><Icon name="check" size={15}/></div><div><span className="task-course">{i ? "オペレーティングシステム" : "データベース論"}</span><h3>{t}</h3><p>かかった時間 {i ? "1時間45分" : "3時間20分"}</p></div><span className="complete-tag">完了</span></article>)}</section></div></>}
      {view === "group" && <><header className="group-hero"><div className="avatar-stack"><span>ゆ</span><span>あ</span><span>け</span><span>み</span><span>+3</span></div><p className="eyebrow">STUDY GROUP ・ 7 MEMBERS</p><h1>情報工学3年</h1><p>一緒なら、試験までの道のりも少し軽くなる。</p><Button icon="share" onClick={() => notify("招待リンクをコピーしました")}>招待する</Button></header><div className="group-grid"><section className="content-card meetings"><div className="card-head"><div><p className="eyebrow">NEXT SESSIONS</p><h2>つぎの勉強会</h2></div><Button primary icon="plus" onClick={() => setModal("schedule")}>予定を決める</Button></div>{[{date:"8月30日（日）",time:"14:00 – 18:00",title:"データベース論 中間対策",place:"中央図書館 グループ学習室B",people:"5人"},{date:"9月2日（水）",time:"10:00 – 12:00",title:"OS 演習もくもく会",place:"情報棟3F ラウンジ",people:"3人"}].map((m,i)=><article className="meeting" key={m.title}><div className="meeting-date"><strong>{m.date}</strong><span>{m.time}</span></div><div className="meeting-info"><h3>{m.title}</h3><p>{m.place} ・ 参加 {m.people}</p></div><Button primary={i===0} icon="calendar" onClick={() => notify("Google カレンダー用の予定を書き出しました")}>カレンダーへ</Button></article>)}</section><aside className="content-card shared-card"><p className="eyebrow">SHARED LIBRARY</p><h2>共有中の棚</h2><div className="copyright-note">講義資料そのものは共有されません。過去問などを共有する前に、再配布が許可されているか確認してください。</div>{courses.slice(0,3).map(c=><button className="shared-shelf" key={c.code} onClick={() => navigate("course")}><span style={{background:c.tab}}/><div><b>{c.name}</b><small>問題集 {c.quizzes} ・ {c.shared?"共有中":"非表示"}</small></div><Icon name="arrow"/></button>)}</aside><section className="content-card activity"><p className="eyebrow">ACTIVITY</p><h2>みんなの学習記録</h2>{[{who:"あかり",initial:"あ",color:"coral",task:"正規化レポート",time:"4時間10分",note:"第3正規形の具体例で時間がかかったので、先に例を決めてから書くのがおすすめ。"},{who:"けんた",initial:"け",color:"green",task:"デッドロック演習",time:"2時間30分",note:"第6回の資料スライド18を読むと進めやすかった。"}].map(p=><article className="activity-row" key={p.who}><span className={`avatar ${p.color}`}>{p.initial}</span><div><p><b>{p.who}</b><small>3時間前</small></p><h3>{p.task}</h3><span className="spent">{p.time}</span><p className="note">{p.note}</p></div></article>)}</section></div></>}
    </main>
    {modal === "create" && <div className="modal-scrim" onMouseDown={e => e.target === e.currentTarget && setModal("none")}><section className="modal" role="dialog" aria-modal="true" aria-label="問題をつくる"><button className="modal-close" onClick={() => setModal("none")} aria-label="閉じる"><Icon name="close"/></button>{generating ? <div className="generating"><div className="magic-loader"><Icon name="sparkle" size={28}/></div><p className="eyebrow">GEMINI IS THINKING</p><h2>問題を組み立てています</h2><p>資料の要点と過去問の出題傾向を照らし合わせています。</p><div className="loading-bar"><span/></div></div> : <><div className="modal-steps"><span className={step>=1?"active":""}/><span className={step>=2?"active":""}/></div>{step===1?<><p className="eyebrow">STEP 1 OF 2</p><h2>どの資料から出題する？</h2><p>選んだ資料の範囲だけから問題をつくります。</p><div className="selection-list">{materials.map((m,i)=><label key={m}><input type="checkbox" defaultChecked={i<4}/><span className="custom-check"><Icon name="check" size={14}/></span><div><b>{m}</b><small>{[42,38,51,45][i]}ページ</small></div></label>)}</div></>:<><p className="eyebrow">STEP 2 OF 2</p><h2>どんな問題にする？</h2><p>形式と量を決めます。作成後に編集できます。</p>{[["形式","選択式","記述式","混合"],["問題数","5問","10問","20問"],["難易度","基礎","標準","試験レベル"]].map((group,gi)=><div className="option-group" key={group[0]}><b>{group[0]}</b><div>{group.slice(1).map((x,i)=><button className={i===(gi===0?2:1)?"active":""} key={x}>{x}</button>)}</div></div>)}<label className="reference-past"><input type="checkbox" defaultChecked/><span className="custom-check"><Icon name="check" size={14}/></span><div><b>2025年度 中間試験を参照</b><small>出題傾向と形式を似せます</small></div></label></>}<div className="modal-actions"><Button subtle onClick={() => step===1?setModal("none"):setStep(1)}>{step===1?"キャンセル":"もどる"}</Button><Button primary icon={step===2?"sparkle":"arrow"} onClick={() => step===1?setStep(2):generate()}>{step===1?"つぎへ":"10問つくる"}</Button></div></>}</section></div>}
    {modal === "schedule" && <div className="modal-scrim" onMouseDown={e=>e.target===e.currentTarget&&setModal("none")}><section className="modal small-modal"><button className="modal-close" onClick={()=>setModal("none")} aria-label="閉じる"><Icon name="close"/></button><p className="eyebrow">NEW STUDY SESSION</p><h2>勉強会を決める</h2><p>グループのみんなに共有されます。</p><label className="text-field">テーマ<input defaultValue="データベース論 中間対策"/></label><div className="field-pair"><label className="text-field">日付<input type="date" defaultValue="2026-09-06"/></label><label className="text-field">時刻<input type="time" defaultValue="14:00"/></label></div><label className="text-field">場所<input defaultValue="中央図書館 グループ学習室B"/></label><div className="modal-actions"><Button subtle onClick={()=>setModal("none")}>キャンセル</Button><Button primary icon="calendar" onClick={()=>{setModal("none");notify("勉強会を作成し、グループに共有しました")}}>予定を作成</Button></div></section></div>}
    <div className={`toast ${toast ? "show" : ""}`}><span><Icon name="check" size={16}/></span>{toast}</div>
  </div>;
}

