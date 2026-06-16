/**
 * Debounced input helper for auto-complete / search-as-you-type.
 * Each call resets the timer; only the last call within `delay` ms fires.
 */
export function debouncedInput<T>(
  input: T,
  delay: number = 300,
): Promise<T> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        resolve(input);
      }, delay);
    };

    check();
  });
}

/**
 * Sleep for `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` after a minimum delay of `ms` milliseconds.
 * Useful for ensuring a loading spinner shows for at least `ms`.
 */
export async function delayed<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const [result] = await Promise.all([fn(), sleep(ms)]);
  return result;
}
