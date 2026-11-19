"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A string kept in the page's query string (?key=value), so a view can be shared or reloaded.
 * The default value is left out of the URL. Reads after mount, so server and client render the same.
 */
export function useUrlParam(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    const read = () => setValue(new URLSearchParams(window.location.search).get(key) ?? fallback);
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [key, fallback]);

  const update = useCallback((next: string) => {
    setValue(next);
    const url = new URL(window.location.href);
    if (next === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, next);
    window.history.replaceState(null, "", url);
  }, [key, fallback]);

  return [value, update];
}
