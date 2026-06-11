/** Üretim ilerlemesini bellek içinde tutar (proje bazında). */
const store = new Map();

export function setProgress(projectId, data) {
  store.set(projectId, { ...(store.get(projectId) || {}), ...data, at: Date.now() });
}
export function getProgress(projectId) {
  return store.get(projectId) || null;
}
export function clearProgress(projectId) {
  store.delete(projectId);
}
