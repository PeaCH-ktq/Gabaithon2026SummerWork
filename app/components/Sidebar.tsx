import type { Navigate, View } from "../types";
import { Icon, type IconName } from "./ui";

type Props = { view: View; navigate: Navigate; groupName: string };

export function Sidebar({ view, navigate, groupName }: Props) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        onClick={() => navigate("home")}
        aria-label="Tan-E ホーム"
      >
        <span className="brand-mark">
          <span />
        </span>
        <span className="brand-copy">
          <b>Tan-E</b>
          <small>STUDY COMPANION</small>
        </span>
      </button>
      <nav aria-label="メインナビゲーション">
        <span className="nav-label">STUDY</span>
        {[
          { id: "home", label: "ホーム", icon: "home" },
          { id: "course", label: "講義の棚", icon: "book" },
          { id: "tasks", label: "課題", icon: "task" },
        ].map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id || (item.id === "course" && view === "quiz") ? "active" : ""}`}
            onClick={() => navigate(item.id as View)}
          >
            <Icon name={item.icon as IconName} />
            <span>{item.label}</span>
            {item.id === "tasks" && <em>3</em>}
          </button>
        ))}
        <span className="nav-label second">TOGETHER</span>
        <button
          className={`nav-item ${view === "group" ? "active" : ""}`}
          onClick={() => navigate("group")}
        >
          <Icon name="users" />
          <span>{groupName}</span>
          <span className="online-dot" />
        </button>
      </nav>
      <div className="sidebar-foot">
        <span className="avatar indigo">ゆ</span>
        <span>
          <b>ゆうた</b>
          <small>工学部 情報工学科</small>
        </span>
        <button aria-label="ユーザーメニュー" onClick={() => navigate("account")}>
          <Icon name="more" />
        </button>
      </div>
    </aside>
  );
}
