import { initialState, validateState, type LabState } from "./model";
const DB = "android-interview-lab";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("数据库升级被其他窗口阻止，请关闭其他标签后重试。"));
  });
}
export async function loadState(): Promise<LabState> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readonly");
    const req = tx.objectStore("workspace").get("personal");
    req.onsuccess = () => {
      try {
        resolve(
          req.result === undefined ? initialState() : validateState(req.result),
        );
      } catch {
        reject(
          new Error(
            "保存的数据格式不兼容，已停止自动写入。请先导出或恢复备份。",
          ),
        );
      }
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
export async function persistState(state: LabState): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(state, "personal");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
