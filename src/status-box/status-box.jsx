import { useStatus } from "./status-context";

// Full class names so Tailwind can detect them
const ALERT_CLASSNAME = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  error: "alert-error",
};
const STATUS_CLASSNAME = {
  info: "status-info",
  success: "status-success",
  warning: "status-warning",
  error: "status-error",
};

export function StatusBox() {
  const { status } = useStatus();

  if (!status.message) {
    return;
  }

  return (
    <div role="alert" className={`alert alert-soft ${ALERT_CLASSNAME[status.type]}`}>
      <span className={`status status-lg animate-pulse ${STATUS_CLASSNAME[status.type]}`} />
      <span className="font-medium">{status.message}</span>
    </div>
  );
}
