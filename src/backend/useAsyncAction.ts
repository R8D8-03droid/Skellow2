import { useRef, useState } from "react";
import { errorMessage } from "./contracts";

/** Keep a draft open and prevent duplicate submissions until a write is confirmed. */
export function useAsyncAction() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try { await action(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setPending(false); }
  };
  return { pending, error, setError, run };
}
