import { beforeEach } from "vitest";

// Pages mirror their config into the URL hash (see useUrlConfigSync), and jsdom
// shares one window.location across a test file — so start every test on a clean
// hash to keep one test's config from seeding the next one's render.
beforeEach(() => {
  if (typeof window !== "undefined") window.location.hash = "";
});
