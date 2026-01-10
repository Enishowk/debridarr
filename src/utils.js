export const extractLinks = (text) => {
  return text
    .split("\n")
    .map((link) => link.trim())
    .filter(
      (link) =>
        link.length > 0 &&
        (link.startsWith("http://") || link.startsWith("https://")),
    );
};

export const getDefaultPath = (filename) => {
  if (!filename) {
    return;
  }
  const pattern = /S(\d{1,2})E(\d{1,2})|S(\d{1,2})/i; // Detect if filename is a serie
  return filename.match(pattern)
    ? import.meta.env.VITE_SERIES_PATH
    : import.meta.env.VITE_MOVIES_PATH;
};

export const formatBytes = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export const formatTime = (seconds) => {
  if (seconds <= 0 || !isFinite(seconds)) {
    return "calculating...";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

export const formatFilename = (filename) => {
  const extensionMatch = filename.match(/\.[^/.]+$/);
  const extension = extensionMatch ? extensionMatch[0] : "";

  const title = filename.replace(/\.[^/.]+$/, "");

  const yearMatch = title.match(/(\d{4})/);
  const year = yearMatch ? ` (${yearMatch[1]})` : "";

  const qualityMatch = title.match(/(720p|1080p|2160p|4K)/i);
  const quality = qualityMatch
    ? ` ${qualityMatch[0].split(".").slice(0, 2).join(".").replace(/4K/g, "2160p")}`
    : "";

  const codecMatch = title.match(/(DV|HDR)/gi);
  const codec = codecMatch ? ` ${codecMatch?.sort()?.shift()}` : "";

  const name = title
    .split(/\(?\d{4}/)[0]
    .replace(/\.|\_/g, " ")
    .trim();

  return `${name}${year}${quality}${codec}${extension}`;
};
