import { useEffect, useState } from "preact/hooks";

// Subdirectories of the last complete segment of the path, as full paths
export function useDirectories(path) {
  const [directories, setDirectories] = useState([]);
  const parent = path.slice(0, path.lastIndexOf("/") + 1);

  useEffect(() => {
    if (!parent) {
      setDirectories([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ path: parent });
        const response = await fetch(`/directories?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setDirectories([]);
          return;
        }
        const { directories } = await response.json();
        setDirectories(directories.map((name) => `${parent}${name}/`));
      } catch {
        // Aborted or network error, keep the previous suggestions
      }
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [parent]);

  return directories;
}
