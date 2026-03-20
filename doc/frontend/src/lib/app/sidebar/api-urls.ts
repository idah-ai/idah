export async function getApiUrls(): Promise<{ url: string; name: string; title?: string; tags?: string[] }[]> {
  // Use environment variable if baseUrl is not provided
  const apiBaseUrl = new URL(import.meta.env.PUBLIC_API_BASE_URL);

  const data = await fetch(new URL("/data/swagger.json", apiBaseUrl));

  if (!data.ok) {
    console.error("Failed to load swagger.json from:", apiBaseUrl.toString());
    return [];
  }

  const result = await data.json();

  return result.urls || [];
}
