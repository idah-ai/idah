import type { HumanizeOption } from "@/utils/types";

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

export function capitalizeText(str: string, capitalizeFirstWord: boolean = true): string {
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
  options: HumanizeOption = { capitalize: true, capitalizeFirstWord: true },
): string {
  const underscorized: string = underscorize(str);
  const sentence: string = underscorized.replace(/_/g, " ");

  if (options.capitalize) return capitalizeText(sentence, options.capitalizeFirstWord);

  return sentence;
}

export function underscorize(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_") // This handles hyphens
    .replace(/__+/g, "_")
    .toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, ""); // Remove all non-word chars except hyphen
}

export async function generateHash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function truncate(str: string, length: number = 20): string {
  return str.length > length ? str.slice(0, length) + "..." : str;
}

export function truncateEmail(email: string): string {
  /** Return truncate name and whole domain */
  const [name, domain] = email.split("@");
  const truncateName = name.length > 20 ? name.slice(0, 20) + "..." : name;
  return `${truncateName}@${domain}`;
}

export function getAvatarFallback(str: string): string {
  function getNameParts(str: string) {
    if (str.includes(".")) {
      const nameParts = str.split(".");
      if (nameParts.length >= 2) {
        return nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0);
      }

      return nameParts[0].charAt(0);
    }

    return str.charAt(0);
  }

  /** In case the string is like email */
  if (str.includes("@")) {
    const nameInEmail = str.split("@")[0];
    return getNameParts(nameInEmail).toUpperCase();
  }

  /** Get the first letter of the string and capitalize it */
  return str.charAt(0).toUpperCase();
}
