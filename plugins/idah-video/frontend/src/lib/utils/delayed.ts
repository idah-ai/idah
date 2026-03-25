export const delayed = async <T>(milliseconds: number, realPromise: () => Promise<T>) => {
  await setTimeout(() => {}, milliseconds);
  return realPromise();
};

function timeout(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function sleep(milliseconds: number) {
  await timeout(milliseconds);

  return Promise.resolve();
}

export const delayInput = (() => {
  let timer: number | NodeJS.Timeout = 0;
  return (callback: () => void, ms: number) => {
    clearTimeout(timer);
    return (timer = setTimeout(callback, ms));
  };
})();

let currentTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function delayedInput<T>(input: T, delay: number = 300): Promise<T> {
  // Clear the previous timeout if it exists
  if (currentTimeoutId !== null) {
    clearTimeout(currentTimeoutId);
  }

  return new Promise(resolve => {
    currentTimeoutId = setTimeout(() => {
      resolve(input);
      currentTimeoutId = null; // Clear the timeout ID after resolving
    }, delay);
  });
}
