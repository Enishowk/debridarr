import { useEffect } from "preact/hooks";
import { useConfig } from "./config-context";
import { useStatus } from "./status-box/status-context";

const getClassnamePremium = (daysLeft) => {
  if (daysLeft <= 7) return "text-error";
  if (daysLeft <= 15) return "text-warning";
  return "";
};

export function Footer() {
  const { user, authEnabled, error } = useConfig();
  const { setStatus } = useStatus();

  useEffect(() => {
    if (error) {
      setStatus("error", error);
    }
  }, [error]);

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
    <footer className="border-t border-base-content/10 pt-5 text-center text-sm text-base-content/50">
      {user?.username && (
        <div className="text-xs">
          {user.username} ({user.fidelityPoints} points){" "}
          {user.isPremium && (
            <>
              -{" "}
              <span className={getClassnamePremium(user.daysLeft)}>
                {user.daysLeft} days of premium remaining.
              </span>
            </>
          )}
        </div>
      )}
      <a className="link link-hover" href="https://github.com/enishowk/debridarr">
        Debridarr v{APP_VERSION}
      </a>
      {authEnabled && (
        <form className="ml-2 inline" method="post" action="/logout">
          <button type="submit" className="link hover:text-primary">
            Logout
          </button>
        </form>
      )}
    </footer>
  );
}
