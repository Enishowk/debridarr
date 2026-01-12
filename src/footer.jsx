import { useEffect } from "preact/hooks";
import { useConfig } from "./config-context";
import { useStatus } from "./status-box/status-context";

const getClassnamePremium = (daysLeft) => {
  if (daysLeft <= 7) return "danger";
  if (daysLeft <= 15) return "warning";
  return "";
};

export function Footer() {
  const { user } = useConfig();
  const { setStatus } = useStatus();

  useEffect(() => {
    if (!user.username) return;
    if (user.daysLeft <= 0) {
      return setStatus("error", "Premium expired.");
    }
    if (user.daysLeft <= 15) {
      return setStatus("warning", "Premium expires soon.");
    }
  }, [user]);

  return (
    <footer className="footer">
      {user?.username && (
        <div className="user-info">
          {user.username} ({user.fidelityPoints} points){" "}
          {user.isPremium && (
            <>
              -{" "}
              <span
                className={`premium-info ${getClassnamePremium(user.daysLeft)}`}
              >
                {user.daysLeft} days of premium remaining.
              </span>
            </>
          )}
        </div>
      )}
      <a href="https://github.com/enishowk/debridarr">
        Debridarr v{APP_VERSION}
      </a>
    </footer>
  );
}
