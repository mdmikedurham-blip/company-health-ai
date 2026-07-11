/**
 * Promise timeout helpers for manual-upload extraction stages.
 */

export class TimeoutError extends Error {
  readonly code = "TIMEOUT" as const;
  readonly stage: string;
  readonly timeoutMs: number;

  constructor(stage: string, timeoutMs: number) {
    super(
      `${stage} timed out after ${Math.round(timeoutMs / 1000)}s — extraction abandoned`,
    );
    this.name = "TimeoutError";
    this.stage = stage;
    this.timeoutMs = timeoutMs;
  }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError ||
    (error instanceof Error &&
      (error.name === "TimeoutError" ||
        /timed out after \d+s/i.test(error.message)));
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new TimeoutError(stage, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
