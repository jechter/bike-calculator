import { beforeEach } from "vitest";

// Pages mirror their config into the URL (see useUrlConfigSync), and jsdom
// shares one window.location across a test file — so start every test on a clean
// URL to keep one test's config from seeding the next one's render.
beforeEach(() => {
  if (typeof window !== "undefined") window.history.replaceState(null, "", "/");
});
