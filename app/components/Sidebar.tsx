"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { GroupRow, Navigate, View } from "../types";
import { Icon, type IconName } from "./ui";

type Props = {
  view: View;
  navigate: Navigate;
  openShelves: () => void;
  groups: GroupRow[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string) => void;
  onCreateGroup: () => void;
  displayName: string;
  profileLabel: string;
};

export function Sidebar({
  view,
  navigate,
  openShelves,
  groups,
  selectedGroupId,
  onSelectGroup,
  onCreateGroup,
  displayName,
  profileLabel,
}: Props) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  useEffect(() => {
    if (!switcherOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(e.target as Node)
      )
        setSwitcherOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [switcherOpen]);

  return (
    <aside className="sidebar">
      <button
        className="brand"
        onClick={() => navigate("home")}
        aria-label="Tan-E ホーム"
      >
        <span className="brand-mark-img">
          <img src="/Tan-E_icon.svg" alt="Tan-E" width={55} height={55} />
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
            onClick={() =>
              item.id === "course" ? openShelves() : navigate(item.id as View)
            }
          >
            <Icon name={item.icon as IconName} />
            <span>{item.label}</span>
            {item.id === "tasks" && <em>3</em>}
          </button>
        ))}
        <span className="nav-label second">TOGETHER</span>
        <div className="group-switcher-wrap" ref={switcherRef}>
          <button
            className={`nav-item ${view === "group" ? "active" : ""}`}
            onClick={() => {
              if (selectedGroup) {
                navigate("group");
              } else {
                onCreateGroup();
              }
            }}
          >
            <Icon name="users" />
            <span>{selectedGroup?.name ?? "グループを作る"}</span>
            {groups.length > 1 && (
              <span
                role="button"
                aria-label="グループを切り替える"
                className="group-switcher-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setSwitcherOpen((v) => !v);
                }}
              >
                <Icon name="arrow" size={12} />
              </span>
            )}
            {groups.length <= 1 && selectedGroup && (
              <span className="online-dot" />
            )}
          </button>
          {switcherOpen && (
            <ul className="group-switcher">
              {groups.map((group) => (
                <li key={group.id}>
                  <button
                    className={group.id === selectedGroupId ? "active" : ""}
                    onClick={() => {
                      onSelectGroup(group.id);
                      setSwitcherOpen(false);
                      navigate("group");
                    }}
                  >
                    {group.name}
                  </button>
                </li>
              ))}
              <li>
                <button
                  className="group-switcher-add"
                  onClick={() => {
                    setSwitcherOpen(false);
                    onCreateGroup();
                  }}
                >
                  <Icon name="plus" size={13} /> グループを作成 / 参加
                </button>
              </li>
            </ul>
          )}
        </div>
        <span className="nav-label second">ACCOUNT</span>
        <button
          className={`nav-item ${view === "account" ? "active" : ""}`}
          onClick={() => navigate("account")}
        >
          <Icon name="users" />
          <span>アカウント</span>
        </button>
      </nav>
      <div className="sidebar-foot">
        <span className="avatar indigo">{displayName.charAt(0) || "?"}</span>
        <span>
          <b>{displayName}</b>
          <small>{profileLabel}</small>
        </span>
        <Link href="/logout" aria-label="ログアウト" title="ログアウト">
          <Icon name="more" />
        </Link>
      </div>
    </aside>
  );
}
