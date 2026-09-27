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
  NOT_STARTED: "border-base-content/20",
  IN_PROGRESS: "border-primary",
  COMPLETED: "border-success bg-success/10",
  ERROR: "border-error bg-error/10",
};

const ITEM_CLASSNAME = "relative rounded-box border-l-4 bg-base-100 p-4 shadow-sm";

const CLOSE_BUTTON_CLASSNAME =
  "btn btn-ghost btn-xs btn-circle absolute top-2 right-2 text-lg hover:text-error";

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
      className={`${ITEM_CLASSNAME} ${DOWNLOAD_STATUS_CLASSNAME[downloadStatus]}`}
    >
      <button
        className={CLOSE_BUTTON_CLASSNAME}
        onClick={() => onRemove(unlockLink.id)}
        disabled={eventSourceState === 1}
      >
        ×
      </button>
      <div className="mb-3 pr-8 font-semibold break-words">
        <a className="link link-hover" href={unlockLink.data.link}>
          {unlockLink.data.filename}
        </a>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="join w-full">
          <input
            type="text"
            className="input input-sm join-item w-full"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
          <button
            className="btn btn-sm join-item w-36"
            onClick={handleAutoRenameClick}
            disabled={eventSourceState !== 0}
          >
            Auto Rename
          </button>
        </div>
        <div className="join w-full">
          <input
            type="text"
            className="input input-sm join-item w-full"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          {eventSourceState === 1 ? (
            <button
              className="btn btn-sm btn-neutral join-item w-36"
              onClick={handleCancelClick}
            >
              Cancel
            </button>
          ) : (
            <button
              className="btn btn-sm btn-primary join-item w-36"
              onClick={handleClick}
              disabled={eventSourceState !== 0}
            >
              Download
            </button>
          )}
        </div>
        {transfer.downloaded > 0 && (
          <>
            <div className="flex items-center gap-2">
              {/* Without total size (no content-length), the progress bar is indeterminate */}
              <progress
                className="progress progress-primary w-full"
                value={transfer.total ? transfer.progress : undefined}
                max="100"
              />
              {transfer.total > 0 && (
                <div className="text-xs">{transfer.progress}%</div>
              )}
            </div>
            <div className="text-right text-xs text-base-content/60">
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
        {error && <div className="font-bold text-error">{error}</div>}
      </div>
    </div>
  );
}

function DownloadItemError({ unlockLink, onRemove }) {
  return (
    <div className={`${ITEM_CLASSNAME} ${DOWNLOAD_STATUS_CLASSNAME.ERROR}`}>
      <button
        className={CLOSE_BUTTON_CLASSNAME}
        onClick={() => onRemove(unlockLink.id)}
      >
        ×
      </button>
      <div className="mb-3 pr-8 font-semibold break-words">
        {unlockLink.link || unlockLink.error.code}
      </div>
      <div className="text-sm font-bold text-error">
        {unlockLink.link && `${unlockLink.error.code}: `}
        {unlockLink.error.message}
      </div>
    </div>
  );
}

export function DownloadList({ unlockLinks, removeUnlockLink }) {
  if (unlockLinks.length === 0) {
    return;
  }

  return (
    <section className="flex flex-col gap-3">
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
