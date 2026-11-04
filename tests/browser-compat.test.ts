import { afterEach, describe, it, expect, vi } from "vitest";
import { fetchWithDeadline } from "../apps/web/lib/browser/fetch";
import { renderProfile } from "../apps/web/lib/browser/render-profile";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("older Safari browser support", () => {
  it("fetches without newer AbortSignal static helpers and clears its deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"ok":true}')),
    );
    const response = await fetchWithDeadline("/state");
    expect(await response.json()).toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels hung requests on deadline and parent cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init.signal!;
            const rejectAbort = () => reject(signal.reason);
            if (signal.aborted) rejectAbort();
            else signal.addEventListener("abort", rejectAbort, { once: true });
          }),
      ),
    );
    const timeout = fetchWithDeadline("/state", {}, 100);
    const failed = expect(timeout).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await vi.advanceTimersByTimeAsync(100);
    await failed;
    expect(vi.getTimerCount()).toBe(0);
    const parent = new AbortController();
    const request = fetchWithDeadline(
      "/state",
      { signal: parent.signal },
      3000,
    );
    const cancelled = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    parent.abort();
    await cancelled;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("uses a lighter profile for iPad and desktop-mode iPad browsers", () => {
    expect(
      renderProfile({
        userAgent: "Mozilla/5.0 (iPad; CPU OS 16_7 like Mac OS X)",
        platform: "iPad",
        maxTouchPoints: 5,
      }),
    ).toMatchObject({ name: "tablet", pixels: 260000, fps: 24 });
    expect(
      renderProfile({
        userAgent: "Mozilla/5.0 Macintosh",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }).name,
    ).toBe("tablet");
    expect(
      renderProfile({
        userAgent: "Mozilla/5.0 Macintosh",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }).name,
    ).toBe("desktop");
  });
});
