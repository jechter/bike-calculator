import { useEffect, useState } from "react";

/** Minimal hash router: returns the current route id and a setter. */
export function useHashRoute(defaultId: string): [string, (id: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, "") || defaultId;
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
