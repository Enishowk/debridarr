import { useState } from "preact/hooks";
import {
  formatBytes,
  formatFilename,
  formatTime,
  getDefaultPath,
} from "./utils";

const DOWNLOAD_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR",
};
const DOWNLOAD_STATUS_CLASSNAME = {
  NOT_STARTED: "",
  IN_PROGRESS: "progress",
  COMPLETED: "success",
  ERROR: "error",
};

function DownloadItem({ unlockLink }) {
  const [error, setError] = useState("");
  const [downloadStatus, setDownloadStatus] = useState(
    DOWNLOAD_STATUS.NOT_STARTED,
  );
  const [filename, setFilename] = useState(unlockLink.data?.filename || "");
  const [path, setPath] = useState(getDefaultPath(unlockLink.data?.filename));

  const [eventSourceState, setEventSourceState] = useState(0);
  const [transfer, setTransfer] = useState({
    total: 0,
    downloaded: 0,
    progress: 0,
    speedMbps: 0,
    remainingTime: 0,
  });

  const handleClick = () => {
    if (eventSourceState === 1) {
      return;
    }

    const params = new URLSearchParams({
      url: unlockLink.data.link,
      dirPath: path,
      filename,
    });
    const es = new EventSource(`/download?${params.toString()}`);

    es.onopen = () => {
      setEventSourceState(es.readyState);
      setDownloadStatus(DOWNLOAD_STATUS.IN_PROGRESS);
    };
    es.onerror = () => {
      setEventSourceState(es.readyState);
      setDownloadStatus(DOWNLOAD_STATUS.ERROR);
      setError("An error occurred while attempting to connect.");
      es.close();
    };
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.error) {
        es.close();
        setDownloadStatus(DOWNLOAD_STATUS.ERROR);
        setEventSourceState(0);
        setError(data.error);
      }

      setTransfer({
        total: data.total,
        downloaded: data.downloaded,
        progress: data.progress,
        speedMbps: data.speedMbps,
        remainingTime: data.remainingTime,
      });

      if (data.done) {
        setDownloadStatus(DOWNLOAD_STATUS.COMPLETED);
        es.close();
      }
    };
  };

  const handleAutoRenameClick = () => {
    if (!filename) {
      return;
    }
    setFilename(formatFilename(filename));
  };

  return (
    <div
      className={`download-item ${DOWNLOAD_STATUS_CLASSNAME[downloadStatus]}`}
    >
      <div className="download-item-header">
        {/* <span className="download-icon"></span>*/}
        <span className="download-filename">
          <a href={unlockLink.data.link}>{unlockLink.data.filename}</a>
        </span>
      </div>
      <div className="download-details error">
        <div className="download-rename">
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
          <button
            className="btn"
            onClick={handleAutoRenameClick}
            disabled={eventSourceState !== 0}
          >
            🪄 Rename
          </button>
        </div>
        <div className="download-path">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={handleClick}
            disabled={eventSourceState !== 0}
          >
            Download
          </button>
        </div>
        {transfer.progress > 0 && (
          <>
            <div className="download-progress">
              <progress
                value={transfer.progress}
                max="100"
                style={{ marginRight: "8px" }}
              />
              <div className="download-percent">{transfer.progress}%</div>
            </div>
            <div className="download-transfer-info">
              {transfer.downloaded > 0 && (
                <span>
                  {formatBytes(transfer.downloaded)} /{" "}
                  {formatBytes(transfer.total)}
                  {transfer.speedMbps && (
                    <span> ({transfer.speedMbps} MB/s)</span>
                  )}
                  {transfer.remainingTime && (
                    <span> - {formatTime(transfer.remainingTime)} left</span>
                  )}
                </span>
              )}
            </div>
          </>
        )}
        {error && <div className="download-error">{error}</div>}
      </div>
    </div>
  );
}

function DownloadItemError({ unlockLink }) {
  return (
    <div className={`download-item error`}>
      <div className="download-item-header">
        <span className="download-filename">{unlockLink.error.code}</span>
      </div>
      <div className="download-details error">
        <div className="download-error">{unlockLink.error.message}</div>
      </div>
    </div>
  );
}

export function DownloadList({ unlockLinks }) {
  if (unlockLinks.length === 0) {
    return;
  }

  return (
    <section className="downloads-list">
      {unlockLinks.map((link, index) =>
        link.status === "error" ? (
          <DownloadItemError key={link.data?.id || index} unlockLink={link} />
        ) : (
          <DownloadItem key={link.data?.id || index} unlockLink={link} />
        ),
      )}
    </section>
  );
}
