"use client";

import { Button, Icon } from "../ui";

export function AssignmentDetailModal({
  course,
  title,
  date,
  canDelete,
  deleting,
  onClose,
  onReport,
  onDelete,
}: {
  course: string;
  title: string;
  date: string;
  canDelete: boolean;
  deleting?: boolean;
  onClose: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal small-modal"
        role="dialog"
        aria-modal="true"
        aria-label="課題の詳細"
      >
        <button className="modal-close" onClick={onClose} aria-label="閉じる">
          <Icon name="close" />
        </button>
        <p className="detail-line">{course}</p>
        <h2>{title}</h2>
        <p className="detail-line">
          <Icon name="calendar" size={14} />
          {date}
        </p>
        <div className="modal-actions">
          {canDelete ? (
            <Button danger onClick={onDelete} disabled={deleting}>
              課題を削除
            </Button>
          ) : (
            <span />
          )}
          <Button primary icon="clock" onClick={onReport} disabled={deleting}>
            課題の結果を投稿
          </Button>
        </div>
      </section>
    </div>
  );
}
