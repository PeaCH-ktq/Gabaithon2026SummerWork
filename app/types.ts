export type View = "home" | "course" | "quiz" | "tasks" | "group" | "account";
export type Navigate = (view: View) => void;
export type Notify = (message: string) => void;

export type Course = {
  code: string;
  name: string;
  professor: string;
  schedule: string;
  room: string;
  docs: number;
  quizzes: number;
  tab: string;
  shared: boolean;
};
