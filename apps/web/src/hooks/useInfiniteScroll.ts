import { useCallback, useEffect, useRef } from "react";

export interface UseInfiniteScrollOptions {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

/**
 * Attaches an `IntersectionObserver` to a bottom sentinel element to trigger
 * `onLoadMore` automatically when the user scrolls near the end of the list.
 */
export function useInfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  rootMargin = "320px 0px",
}: UseInfiniteScrollOptions): (node: HTMLDivElement | null) => void {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (
      !node ||
      !hasMore ||
      loading ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      if (observerRef.current === observer) {
        observerRef.current = null;
      }
    };
  }, [hasMore, loading, onLoadMore, rootMargin]);

  return useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (
        !node ||
        !hasMore ||
        loading ||
        typeof IntersectionObserver === "undefined"
      ) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            onLoadMore();
          }
        },
        { rootMargin }
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [hasMore, loading, onLoadMore, rootMargin]
  );
}
