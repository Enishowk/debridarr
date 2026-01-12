import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";

export const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [paths, setPaths] = useState({
    seriesPath: "/",
    moviesPath: "/",
  });
  const [user, setUser] = useState({});

  useEffect(() => {
    fetch("/config").then((response) => {
      response.json().then((config) => {
        setPaths({
          seriesPath: config.seriesPath,
          moviesPath: config.moviesPath,
        });
        setUser(config.user);
      });
    });
  }, []);

  const value = {
    paths,
    user,
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
