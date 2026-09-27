import { useState } from "preact/hooks";
import { useConfig } from "./config-context";
import { formatBytes, formatFilename, formatTime, isSeries } from "./utils";

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

const TRANSFER_INIT = {
  id: undefined,
  total: 0,
  downloaded: 0,
  progress: 0,
  speed: 0, // in bytes/s
  remainingTime: 0,
};

function DownloadItem({ unlockLink, onRemove }) {
  const { paths } = useConfig();
  const [error, setError] = useState("");
  const [downloadStatus, setDownloadStatus] = useState(
    DOWNLOAD_STATUS.NOT_STARTED,
  );
  const [filename, setFilename] = useState(unlockLink.data?.filename || "");
  const [path, setPath] = useState(
    isSeries(unlockLink.data?.filename) ? paths.seriesPath : paths.moviesPath,
  );
  const [eventSourceState, setEventSourceState] = useState(0);
  const [transfer, setTransfer] = useState(TRANSFER_INIT);

  const handleClick = () => {
    if (eventSourceState === 1) {
      return;
    }
    setError("");

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
        return;
      }

      if (data.canceled) {
        es.close();
        setDownloadStatus(DOWNLOAD_STATUS.NOT_STARTED);
        setEventSourceState(0);
        setTransfer(TRANSFER_INIT);
        setError("Canceled");
        return;
      }

      setTransfer({
        id: data.id,
        total: data.total,
        downloaded: data.downloaded,
        progress: data.progress,
        speed: data.speed,
        remainingTime: data.remainingTime,
      });

      if (data.done) {
        setDownloadStatus(DOWNLOAD_STATUS.COMPLETED);
        setEventSourceState(0);
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

  // The server confirms the cancellation through the event stream
  const handleCancelClick = async () => {
    try {
      const response = await fetch(`/cancel/${transfer.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const resp = await response.json();
        setError(resp.error);
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div
      className={`download-item ${DOWNLOAD_STATUS_CLASSNAME[downloadStatus]}`}
    >
      <button
        className="download-item-close"
        onClick={() => onRemove(unlockLink.id)}
        disabled={eventSourceState === 1}
      >
        ×
      </button>
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
          {eventSourceState === 1 ? (
            <button className="btn btn-error" onClick={handleCancelClick}>
              ❌ Cancel
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleClick}
              disabled={eventSourceState !== 0}
            >
              Download
            </button>
          )}
        </div>
        {transfer.downloaded > 0 && (
          <>
            <div className="download-progress">
              {/* Without total size (no content-length), the progress bar is indeterminate */}
              <progress
                value={transfer.total ? transfer.progress : undefined}
                max="100"
                style={{ marginRight: "8px" }}
              />
              {transfer.total > 0 && (
                <div className="download-percent">{transfer.progress}%</div>
              )}
            </div>
            <div className="download-transfer-info">
              {formatBytes(transfer.downloaded)}
              {transfer.total > 0 && <> / {formatBytes(transfer.total)}</>}
              {transfer.speed > 0 && (
                <span> ({formatBytes(transfer.speed)}/s)</span>
              )}
              {transfer.remainingTime > 0 && (
                <span> - {formatTime(transfer.remainingTime)} left</span>
              )}
            </div>
          </>
        )}
        {error && <div className="download-error">{error}</div>}
      </div>
    </div>
  );
}

function DownloadItemError({ unlockLink, onRemove }) {
  return (
    <div className={`download-item error`}>
      <button
        className="download-item-close"
        onClick={() => onRemove(unlockLink.id)}
      >
        ×
      </button>
      <div className="download-item-header">
        <span className="download-filename">
          {unlockLink.link || unlockLink.error.code}
        </span>
      </div>
      <div className="download-details error">
        <div className="download-error">
          {unlockLink.link && `${unlockLink.error.code}: `}
          {unlockLink.error.message}
        </div>
      </div>
    </div>
  );
}

export function DownloadList({ unlockLinks, removeUnlockLink }) {
  if (unlockLinks.length === 0) {
    return;
  }

  return (
    <section className="downloads-list">
      {unlockLinks.map((link) =>
        link.status === "error" ? (
          <DownloadItemError
            key={link.id}
            unlockLink={link}
            onRemove={removeUnlockLink}
          />
        ) : (
          <DownloadItem
            key={link.id}
            unlockLink={link}
            onRemove={removeUnlockLink}
          />
        ),
      )}
    </section>
  );
}
