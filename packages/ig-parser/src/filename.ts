/** A filename is only an editable suggestion, never proof of account ownership. */
export function suggestUsernameFromFilename(filename: string): string | null {
  const match = /^instagram-([a-z0-9._]{1,30})-\d{4}-\d{2}-\d{2}-[a-z0-9]+(?: \(\d+\))?\.zip$/i.exec(filename);
  return match?.[1]?.toLowerCase() ?? null;
}
