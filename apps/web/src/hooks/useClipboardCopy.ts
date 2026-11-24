import { useCallback, useEffect, useRef, useState } from "react";

export interface UseClipboardCopyOptions {
  copy?: (text: string) => Promise<void>;
  resetMs?: number;
}

export function useClipboardCopy(options: UseClipboardCopyOptions = {}) {
  const { copy, resetMs = 1500 } = options;
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copyText = useCallback(
    async (text: string) => {
      const write =
        copy ?? ((value: string) => navigator.clipboard.writeText(value));
      await write(text);
      setCopied(true);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, resetMs);
    },
    [copy, resetMs]
  );

  return { copied, copyText };
}
