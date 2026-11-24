import { useEffect, useState } from "react";

export function useCountdown(
  targetTimestampMs: number | null | undefined,
  active = true
): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!active || targetTimestampMs == null) return;
    setNowMs(Date.now());
    const intervalId = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= targetTimestampMs) {
        clearInterval(intervalId);
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [active, targetTimestampMs]);

  if (!active || targetTimestampMs == null) return 0;
  return Math.max(0, Math.ceil((targetTimestampMs - nowMs) / 1000));
}
