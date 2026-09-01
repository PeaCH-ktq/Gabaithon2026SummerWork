import type { Course } from "./types";

export const courses: Course[] = [
  {
    code: "CS-302",
    name: "データベース論",
    professor: "松本 教授",
    schedule: "火曜 3限",
    room: "情報棟 204",
    docs: 6,
    quizzes: 3,
    tab: "#5866c5",
    shared: true,
  },
  {
    code: "CS-305",
    name: "オペレーティングシステム",
    professor: "佐藤 准教授",
    schedule: "水曜 2限",
    room: "情報棟 301",
    docs: 9,
    quizzes: 2,
    tab: "#ea8e72",
    shared: true,
  },
  {
    code: "MA-211",
    name: "確率統計",
    professor: "中村 教授",
    schedule: "木曜 1限",
    room: "講義棟 A102",
    docs: 5,
    quizzes: 1,
    tab: "#54a887",
    shared: false,
  },
  {
    code: "CS-314",
    name: "機械学習基礎",
    professor: "山本 准教授",
    schedule: "金曜 4限",
    room: "情報棟 205",
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
