export type View = "home" | "course" | "quiz" | "tasks" | "group";
export type Navigate = (view: View) => void;
export type Notify = (message: string) => void;
