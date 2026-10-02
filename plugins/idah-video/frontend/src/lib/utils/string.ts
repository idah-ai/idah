/**
 * Make the first letter of each word as a capital letter
 */
export function capitalize(str: string, capitalizeFirstWord: boolean = true): string {
  // 1. Split the string by space or underscore
  const words: string[] = str.split(/[\s_]+/);

  // 2. Capitalize each word
  const capitalizedWords: string[] = words.map((word: string) => word.charAt(0).toUpperCase() + word.slice(1));
  const firstWord: string = capitalizedWords[0];
  const lowerFirstWord: string = firstWord.charAt(0).toLowerCase() + firstWord.slice(1);

  // 3. Return the capitalized words
  if (!capitalizeFirstWord) {
    return lowerFirstWord + " " + capitalizedWords.slice(1).join(" ");
  }

  return capitalizedWords.join(" ");
}

export function humanize(
  str: string,
  options: { capitalize: boolean; capitalizeFirstWord: boolean } = { capitalize: true, capitalizeFirstWord: true },
): string {
  const underscorized: string = underscorize(str);
  const sentence: string = underscorized.replace(/_/g, " ");

  if (options.capitalize) return capitalize(sentence, options.capitalizeFirstWord);

  return sentence;
}

export function underscorize(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/__+/g, "_")
    .toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "");
}

export function toCamelCase(str: string) {
  return str.split(/[\s/-]+/).reduce((acc: string, word: string) => {
    return acc + word.charAt(0).toUpperCase() + word.slice(1);
  }, "");
}

export function camelToSnake(str: string) {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

export function getFileName(url: string) {
  return url.split("/").pop();
}

export function getFileExtension(filename: string) {
  return filename.split(".").pop();
}

export function truncate(str: string, length: number = 20): string {
  return str.length > length ? str.slice(0, length) + "..." : str;
}

/**
 * FNV-1a, 32 bits. Used only where Web Crypto is unavailable: it is not a
 * cryptographic hash, and nothing here relies on it being one.
 */
function fallbackHash(message: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < message.length; i++) {
    hash ^= message.charCodeAt(i);
    // hash * 16777619, in 32-bit arithmetic that stays exact.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

/**
 * A stable hash of a string, used to key cached responses.
 *
 * SHA-256 where Web Crypto is available. It is not on a plain-HTTP origin
 * other than localhost, which browsers treat as an insecure context, so an
 * install served without TLS falls back rather than throwing.
 */
export async function generateHash(message: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    return fallbackHash(message);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
