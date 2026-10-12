/**
 * IndexNow API Integration Architecture for Bing, Yandex, Naver, and Seznam.
 * Allows submitting updated or newly created URLs directly to search engines.
 */

import { SITE_URL } from "./urls";

export const INDEXNOW_KEY = "dealxstocks_indexnow_2026_key";

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
}

/** Submit a batch of updated public URLs to the IndexNow protocol. */
export async function submitIndexNowUrls(urls: string[]): Promise<{ success: boolean; status?: number; error?: string }> {
  if (!urls || urls.length === 0) {
    return { success: false, error: "No URLs provided" };
  }

  const absoluteUrls = urls.map(u => (u.startsWith("http") ? u : `${SITE_URL}${u.startsWith("/") ? u : `/${u}`}`));
  const host = new URL(SITE_URL).hostname;

  const payload: IndexNowPayload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: absoluteUrls,
  };

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (response.status === 200 || response.status === 202) {
      return { success: true, status: response.status };
    }
    return { success: false, status: response.status, error: `IndexNow responded with status ${response.status}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
