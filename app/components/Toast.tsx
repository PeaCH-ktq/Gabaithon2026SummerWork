import { Icon } from "./ui";

export function Toast({ message }: { message: string }) {
  return (
    <div className={`message ${message ? "show" : ""}`}>
      <span>
        <Icon name="check" size={16} />
      </span>
      {message}
    </div>
  );
}
