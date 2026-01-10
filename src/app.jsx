import { useState } from "preact/hooks";
import { DownloadList } from "./download-list";
import { StatusBox } from "./status-box/status-box";
import { StatusProvider } from "./status-box/status-context";
import { UnlockForm } from "./unlock-form";

export function App() {
  const [unlockLinks, setUnlockLinks] = useState([]);

  return (
    <StatusProvider>
      <div className="container">
        <header className="header">
          <div className="header-title">
            <img src="/debridarr.svg" width="36" alt="Debridarr Logo" />
            <h1>Debridarr</h1>
          </div>
          <div className="header-subtitle">
            Unlock links and download files in the mounted directory
          </div>
        </header>

        <main>
          <StatusBox />
          <UnlockForm setUnlockLinks={setUnlockLinks} />

          <DownloadList unlockLinks={unlockLinks} />
        </main>

        <footer className="footer">
          <p>Debridarr v{APP_VERSION}</p>
        </footer>
      </div>
    </StatusProvider>
  );
}
