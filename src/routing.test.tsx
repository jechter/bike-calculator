// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { handleRouteLinkClick, getBasePath, routeHref, normalizeRoute, navigateTo, getHashQuery, useHashRoute, useHashConfigKey, useUrlConfigSync, updatePageMetadata } from "./useHashRoute";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("resolves page links relative to a nested installation, including index.html", () => {
  history.replaceState(null, "", "/bikeworkshopcalc/tire-pressure-calculator/index.html");
  expect(getBasePath()).toBe("/bikeworkshopcalc/");
  expect(routeHref("power")).toBe("/bikeworkshopcalc/cycling-power-calculator/");
});

it("migrates legacy links and their encoded settings without adding history", () => {
  history.replaceState(null, "", "/bikeworkshopcalc/#/tire?size=26x2.1&value=a%26b");
  const length = history.length;
  normalizeRoute();
  expect(location.pathname).toBe("/bikeworkshopcalc/tire-pressure-calculator/");
  expect(location.hash).toBe("");
  expect(getHashQuery().get("value")).toBe("a&b");
  expect(history.length).toBe(length);
});

it("normalizes legacy directory URLs to their canonical slug", () => {
  history.replaceState(null, "", "/bikeworkshopcalc/bicycle-component-compatibility/");
  normalizeRoute();
  expect(location.pathname).toBe("/bikeworkshopcalc/bicycle-component-database/");
});

it("routes navigation and popstate, including a same-page example", () => {
  const { result } = renderHook(() => ({ route: useHashRoute("drivetrain")[0], key: useHashConfigKey() }));
  act(() => navigateTo("wheel-building", { hub: "A~B" }));
  expect(result.current.route).toBe("wheel-building");
  const key = result.current.key;
  act(() => navigateTo("wheel-building", { hub: "C~D" }));
  expect(result.current.key).not.toBe(key);
  expect(getHashQuery().get("hub")).toBe("C~D");
  act(() => {
    history.replaceState(null, "", "/tire-pressure-calculator/?size=700x28C");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(result.current.route).toBe("tire");
});

it("syncs settings without remounting or adding history, and cancels stale writes", () => {
  vi.useFakeTimers();
  history.replaceState(null, "", "/bikeworkshopcalc/gear-ratio-chain-length-calculator/");
  const length = history.length;
  const { result, rerender } = renderHook(({ cr }) => {
    useUrlConfigSync("drivetrain", { cr });
    return useHashConfigKey();
  }, { initialProps: { cr: "50,34" } });
  const key = result.current;
  act(() => vi.advanceTimersByTime(250));
  expect(getHashQuery().get("cr")).toBe("50,34");
  expect(result.current).toBe(key);
  expect(history.length).toBe(length);
  rerender({ cr: "42" });
  act(() => { navigateTo("tire"); vi.advanceTimersByTime(250); });
  expect(location.pathname).toBe("/bikeworkshopcalc/tire-pressure-calculator/");
  expect(location.search).toBe("");
});

it("sets distinct metadata and excludes settings from canonical URLs", () => {
  updatePageMetadata("tire");
  expect(document.title).toContain("Tire Pressure");
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://rueckenwind.berlin/bikeworkshopcalc/tire-pressure-calculator/");
});

it("follows configured links within the app without a document navigation", () => {
  history.replaceState(null, "", "/bikeworkshopcalc/bicycle-component-database/");
  const { result } = renderHook(() => ({ route: useHashRoute("drivetrain")[0], key: useHashConfigKey() }));
  const link = document.createElement("a");
  link.href = routeHref("drivetrain") + "?cassette=Shimano%20CS-HG50&cr=50%2C34";
  const preventDefault = vi.fn();
  const event = { currentTarget: link, button: 0, preventDefault };
  const length = history.length;
  act(() => handleRouteLinkClick(event as unknown as Parameters<typeof handleRouteLinkClick>[0]));
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(result.current.route).toBe("drivetrain");
  expect(getHashQuery().get("cassette")).toBe("Shimano CS-HG50");
  expect(getHashQuery().get("cr")).toBe("50,34");
  expect(history.length).toBe(length + 1);
  const key = result.current.key;
  link.href = routeHref("drivetrain") + "?cr=42";
  act(() => handleRouteLinkClick(event as unknown as Parameters<typeof handleRouteLinkClick>[0]));
  expect(result.current.key).not.toBe(key);
  expect(getHashQuery().get("cr")).toBe("42");
});

it("leaves modified clicks, downloads, new tabs and external links to the browser", () => {
  const link = document.createElement("a");
  link.href = routeHref("tire") + "?size=700x28C";
  const preventDefault = vi.fn();
  const click = (extra = {}) => handleRouteLinkClick({ currentTarget: link, button: 0, preventDefault, ...extra } as unknown as Parameters<typeof handleRouteLinkClick>[0]);
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey", "defaultPrevented"]) click({ [modifier]: true });
  click({ button: 1 });
  link.target = "_blank";
  click();
  link.target = "";
  link.download = "calculator";
  click();
  link.removeAttribute("download");
  link.href = "https://example.com/";
  click();
  link.href = "/unrelated-page/";
  click();
  expect(preventDefault).not.toHaveBeenCalled();
});

function mockHomeScreen(mode: "ios" | "manifest") {
  if (mode === "ios") {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
  } else {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query === "(display-mode: standalone)" })));
  }
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "standalone");
  vi.unstubAllGlobals();
});

it.each(["ios", "manifest"] as const)("keeps %s home-screen navigation on the installed path", async mode => {
  mockHomeScreen(mode);
  const installedPath = "/bikeworkshopcalc/tire-pressure-calculator/";
  history.replaceState(null, "", installedPath + "?size=700x28C");
  const { result } = renderHook(() => ({ route: useHashRoute("drivetrain")[0], key: useHashConfigKey() }));
  expect(result.current.route).toBe("tire");
  expect(getHashQuery().get("size")).toBe("700x28C");
  expect(routeHref("power")).toBe("#/power");
  expect(location.pathname).toBe(installedPath);
  await act(async () => {
    navigateTo("power", { watts: 200, value: "a&b" });
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(location.pathname).toBe(installedPath);
  expect(result.current.route).toBe("power");
  expect(getHashQuery().get("value")).toBe("a&b");
  const key = result.current.key;
  // Simulate returning to an earlier configured hash via browser history.
  act(() => {
    history.replaceState(null, "", "#/tire?size=26x2.1");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(result.current.route).toBe("tire");
  expect(result.current.key).not.toBe(key);
  expect(getHashQuery().get("size")).toBe("26x2.1");
  expect(location.pathname).toBe(installedPath);
});

it("syncs home-screen settings without changing paths, remounting, or adding history", () => {
  mockHomeScreen("ios");
  vi.useFakeTimers();
  const installedPath = "/bikeworkshopcalc/spoke-length-calculator/index.html";
  history.replaceState(null, "", installedPath + "#/drivetrain?cr=50%2C34");
  normalizeRoute();
  const length = history.length;
  const { result } = renderHook(() => {
    useUrlConfigSync("drivetrain", { cr: "42", value: "a&b" });
    return useHashConfigKey();
  });
  const key = result.current;
  act(() => vi.advanceTimersByTime(250));
  expect(location.pathname).toBe(installedPath);
  expect(location.hash).toBe("#/drivetrain?cr=42&value=a%26b");
  expect(history.length).toBe(length);
  expect(result.current).toBe(key);
});
