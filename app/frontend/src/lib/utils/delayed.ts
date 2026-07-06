function timeout(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function sleep(milliseconds: number) {
  await timeout(milliseconds);

  return Promise.resolve();
}

/**
 * Per-instance debounce. Unlike `delayedInput`/`delayInput` (which share a single module-level timer
 * and so collide when two callers run concurrently), each `debounce(...)` call gets its own timer.
 * The returned function has a `.cancel()` to drop any pending call.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, delay: number = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Object.assign(
    (...args: A): void => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    },
    { cancel: (): void => clearTimeout(timer) },
  );
}

let currentTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function delayedInput<T>(input: T, delay: number = 300): Promise<T> {
  // Clear the previous timeout if it exists
  if (currentTimeoutId !== null) {
    clearTimeout(currentTimeoutId);
  }

  return new Promise((resolve) => {
    currentTimeoutId = setTimeout(() => {
      resolve(input);
      currentTimeoutId = null; // Clear the timeout ID after resolving
    }, delay);
  });
}
