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
        <div className="card bg-base-200 shadow-2xl p-5 sm:p-10">
          <header className="mb-10 text-center">
            <div className="flex items-center justify-center gap-2">
              <img src="/debridarr.svg" width="36" alt="Debridarr Logo" />
              <h1 className="text-3xl sm:text-4xl font-bold">Debridarr</h1>
            </div>
            <p className="text-lg text-base-content/60">
              Unlock links and download files in the mounted directory
            </p>
          </header>

          <main className="mb-5 flex flex-col gap-8">
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
