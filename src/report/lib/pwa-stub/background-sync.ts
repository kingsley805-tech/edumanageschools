export function isNetworkError(_e: Error): boolean {
  return false;
}

export async function requestBackgroundSync(): Promise<void> {
  /* PWA offline sync not enabled in school-hub */
}
