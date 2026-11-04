/** A fetch deadline with explicit cleanup, including Safari versions without AbortSignal.any/timeout. */
export async function fetchWithDeadline(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 3000,
): Promise<Response> {
  const controller = new AbortController(),
    parent = init.signal;
  const cancel = () => controller.abort(parent?.reason);
  if (parent?.aborted) cancel();
  else parent?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", cancel);
  }
}
