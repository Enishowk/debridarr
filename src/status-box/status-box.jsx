import "./status-box.css";
import { useStatus } from "./status-context";

export function StatusBox() {
  const { status } = useStatus();

  const getStatusClass = () => {
    return `status-box status-${status.type}`;
  };

  if (!status.message) {
    return;
  }

  return (
    <div className={getStatusClass()}>
      <span className="status-indicator" />
      <span className="status-text">{status.message}</span>
    </div>
  );
}
