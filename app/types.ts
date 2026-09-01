export type View = "home" | "course" | "quiz" | "tasks" | "group" | "account" | "profile-edit" | "logout";
export type Navigate = (view: View) => void;
export type Notify = (message: string) => void;

export type Assignment = {
  title: string;
  course: string;
  date: string;
  left: string;
  color: string;
};

export type Profile = {
  displayName: string;
  faculty: string;
  department: string;
  email: string;
};

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
