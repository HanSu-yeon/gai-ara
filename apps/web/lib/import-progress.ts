/** Keep only the return route and funnel timing; never persist the imported file or account. */
const STORAGE_KEY = "gai-ara:import-progress";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export type ImportSource = "direct" | "referral" | "pair";
export interface ImportProgress {
  path: string;
  updatedAt: number;
  guideOpenedAt?: number;
  exportOpenedAt?: number;
  fileStepOpenedAt?: number;
}
export function isImportPath(path: string): boolean {
  return path === "/upload" || /^\/(r|pair)\/[a-zA-Z0-9_-]+$/.test(path);
}
export function readImportProgress(): ImportProgress | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value.path !== "string" || !isImportPath(value.path) ||
      typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) ||
      Date.now() - value.updatedAt > MAX_AGE_MS || value.updatedAt > Date.now()) return null;
    return { path: value.path, updatedAt: value.updatedAt,
      ...(typeof value.guideOpenedAt === "number" && Number.isFinite(value.guideOpenedAt) && value.guideOpenedAt <= Date.now()
        ? { guideOpenedAt: value.guideOpenedAt } : {}),
      ...(typeof value.exportOpenedAt === "number" && Number.isFinite(value.exportOpenedAt) && value.exportOpenedAt <= Date.now()
        ? { exportOpenedAt: value.exportOpenedAt } : {}),
      ...(typeof value.fileStepOpenedAt === "number" && Number.isFinite(value.fileStepOpenedAt) && value.fileStepOpenedAt <= Date.now()
        ? { fileStepOpenedAt: value.fileStepOpenedAt } : {}) };
  } catch { return null; }
}
export function saveImportProgress(path: string, openedGuide = false): void {
  if (!isImportPath(path)) return;
  const previous = readImportProgress();
  const guideOpenedAt = previous?.path === path ? previous.guideOpenedAt : undefined;
  const exportOpenedAt = previous?.path === path ? previous.exportOpenedAt : undefined;
  const fileStepOpenedAt = previous?.path === path ? previous.fileStepOpenedAt : undefined;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, updatedAt: Date.now(),
      guideOpenedAt: guideOpenedAt ?? (openedGuide ? Date.now() : undefined), exportOpenedAt, fileStepOpenedAt }));
  } catch { /* Importing still works when browser storage is unavailable. */ }
}
export function markExportOpened(path: string, guideOpenedAt?: number): void {
  if (!isImportPath(path)) return;
  const previous = readImportProgress();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      path,
      updatedAt: Date.now(),
      guideOpenedAt: previous?.path === path ? previous.guideOpenedAt ?? guideOpenedAt : guideOpenedAt,
      exportOpenedAt: previous?.path === path ? previous.exportOpenedAt ?? Date.now() : Date.now(),
      fileStepOpenedAt: previous?.path === path ? previous.fileStepOpenedAt ?? Date.now() : Date.now(),
    }));
  } catch { /* Importing still works when browser storage is unavailable. */ }
}
export function markFileStepOpened(path: string, guideOpenedAt?: number): void {
  if (!isImportPath(path)) return;
  const previous = readImportProgress();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      path,
      updatedAt: Date.now(),
      guideOpenedAt: previous?.path === path ? previous.guideOpenedAt ?? guideOpenedAt : guideOpenedAt,
      exportOpenedAt: previous?.path === path ? previous.exportOpenedAt : undefined,
      fileStepOpenedAt: previous?.path === path ? previous.fileStepOpenedAt ?? Date.now() : Date.now(),
    }));
  } catch { /* Importing still works when browser storage is unavailable. */ }
}
export function clearImportProgress(path: string): void {
  try {
    if (readImportProgress()?.path === path) localStorage.removeItem(STORAGE_KEY);
  } catch { /* Storage is optional. */ }
}
export function importSource(path: string): ImportSource {
  return path.startsWith("/r/") ? "referral" : path.startsWith("/pair/") ? "pair" : "direct";
}
