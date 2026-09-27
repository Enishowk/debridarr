import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";

export const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [paths, setPaths] = useState({
    seriesPath: "/",
    moviesPath: "/",
  });
  const [user, setUser] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/config");
        if (!response.ok) {
          throw new Error(`Unable to load config (HTTP ${response.status})`);
        }
        const config = await response.json();
        setPaths({
          seriesPath: config.seriesPath,
          moviesPath: config.moviesPath,
        });
        setUser(config.user ?? {});
        setError(config.error ?? "");
      } catch (error) {
        setError(error.message);
      }
    };
    loadConfig();
  }, []);

  const value = {
    paths,
    user,
    error,
  };

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
