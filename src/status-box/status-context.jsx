import { createContext } from "preact";
import { useCallback, useContext, useRef, useState } from "preact/hooks";

export const StatusContext = createContext(null);

export function StatusProvider({ children }) {
  const [status, setStatusState] = useState({
    type: "info", // 'success', 'error', 'warning', 'info'
    message: "",
  });

  const timeoutRef = useRef(null);
  const setStatus = useCallback((type, message) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef);
    }

    setStatusState({ type, message });

    timeoutRef.current = setTimeout(() => {
      setStatusState({ type: "ok", message: "" });
    }, 5000);
  }, []);

  const value = {
    status,
    setStatus,
  };

  return (
    <StatusContext.Provider value={value}>{children}</StatusContext.Provider>
  );
}

export function useStatus() {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatus must be used within a StatusProvider");
  }
  return context;
}
