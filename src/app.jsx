import { useState } from "preact/hooks";
import { ConfigProvider } from "./config-context";
import { DownloadList } from "./download-list";
import { Footer } from "./footer";
import { StatusBox } from "./status-box/status-box";
import { StatusProvider } from "./status-box/status-context";
import { UnlockForm } from "./unlock-form";

export function App() {
  const [unlockLinks, setUnlockLinks] = useState([]);

  const addUnlockLinks = (links) => {
    setUnlockLinks((prevLinks) => {
      const newLinks = links.map((link) => ({
        ...link,
        id: crypto.randomUUID(),
      }));
      return [...prevLinks, ...newLinks];
    });
  };

  const removeUnlockLink = (id) => {
    setUnlockLinks((prevArray) => prevArray.filter((link) => link.id !== id));
  };

  return (
    <ConfigProvider>
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
            <UnlockForm addUnlockLinks={addUnlockLinks} />

            <DownloadList
              unlockLinks={unlockLinks}
              removeUnlockLink={removeUnlockLink}
            />
          </main>

          <Footer />
        </div>
      </StatusProvider>
    </ConfigProvider>
  );
}
