import { apiClient } from '@/shared/api/client';

/**
 * Download a file through the authenticated API client.
 *
 * - Sends the auth cookie (credentials: 'include').
 * - Propagates real HTTP errors (401, 403, 404, 500) as thrown HttpError
 *   instances instead of silently opening an empty file.
 * - Handles token refresh automatically (same as every other apiClient call).
 *
 * Returns a Promise so callers can await and key toasts off the real outcome.
 *
 * @param path - API path relative to the base URL, e.g. `/tenants/{id}/usage/export.csv`
 * @param filename - Suggested download filename
 */
export async function authenticatedDownload(path: string, filename: string): Promise<void> {
  const blob = await apiClient.downloadBlob(path);
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke after a short delay so the browser has time to initiate the download.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}
