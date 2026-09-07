import { useEffect, useState } from "react";

/** Read a query param from the hash, e.g. "size" from `#/tire?size=700x28C`. */
export function getHashQueryParam(name: string): string | null {
  const hash = window.location.hash;
  const qi = hash.indexOf("?");
  if (qi < 0) return null;
  return new URLSearchParams(hash.slice(qi + 1)).get(name);
}

/** Minimal hash router: returns the current route id and a setter. */
export function useHashRoute(defaultId: string): [string, (id: string) => void] {
  // The route is the path portion of the hash; a `?query` (see getHashQueryParam)
  // is ignored here so `#/tire?size=…` still resolves to the "tire" route.
  const read = () => window.location.hash.replace(/^#\/?/, "").split("?")[0] || defaultId;
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (id: string) => {
    window.location.hash = `/${id}`;
  };

  return [route, navigate];
}
