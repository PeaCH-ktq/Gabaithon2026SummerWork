export const courses = [
  {
    code: "CS-302",
    name: "データベース論",
    professor: "松本 教授",
    docs: 6,
    quizzes: 3,
    tab: "#5866c5",
    shared: true,
  },
  {
    code: "CS-305",
    name: "オペレーティングシステム",
    professor: "佐藤 准教授",
    docs: 9,
    quizzes: 2,
    tab: "#ea8e72",
    shared: true,
  },
  {
    code: "MA-211",
    name: "確率統計",
    professor: "中村 教授",
    docs: 5,
    quizzes: 1,
    tab: "#54a887",
    shared: false,
  },
  {
    code: "CS-314",
    name: "機械学習基礎",
    professor: "山本 准教授",
    docs: 8,
    quizzes: 4,
    tab: "#b17fb6",
    shared: true,
  },
];

export const deadlines = [
  {
    left: "あと 2日",
    date: "8月31日 23:59",
    title: "正規化レポート",
    course: "データベース論",
    color: "coral",
  },
  {
    left: "あと 6日",
    date: "9月4日 17:00",
    title: "デッドロック演習",
    course: "オペレーティングシステム",
    color: "yellow",
  },
  {
    left: "あと 11日",
    date: "9月9日 12:00",
    title: "論文要約",
    course: "機械学習基礎",
    color: "green",
  },
];

export const materials = [
  "第01回 データベースとは・3層スキーマ",
  "第02回 関係代数",
  "第03回 SQL基礎",
  "第04回 正規化理論",
];

export const questions = [
  {
    type: "選択",
    text: "3層スキーマ構造において、利用者ごとの見え方を定義するのはどれか。",
    options: ["外部スキーマ", "概念スキーマ", "内部スキーマ", "物理スキーマ"],
  },
  {
    type: "記述",
    text: "関係代数において、2つの関係から共通の属性値をもつ組を結合する演算の名称を答えよ。",
  },
  {
    type: "類似問題",
    text: "次の関係 R(学籍番号, 氏名, 学科コード, 学科名) が第3正規形を満たさない理由として最も適切なものはどれか。",
    options: [
      "部分関数従属が存在する",
      "推移的関数従属が存在する",
      "多値従属性が存在する",
      "候補キーが複数存在する",
    ],
  },
  {
    type: "記述",
    text: "SQLにおいて、GROUP BY句で集約した結果に対して条件を指定する句を答えよ。",
  },
];
