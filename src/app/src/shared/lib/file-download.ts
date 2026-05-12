/**
 * Triggers a browser file download by creating a temporary anchor element.
 * Works for same-origin URLs that return file content (CSV, PDF, etc).
 *
 * @param url - Full URL to download from
 * @param filename - Suggested filename for the download
 */
export function triggerFileDownload(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
