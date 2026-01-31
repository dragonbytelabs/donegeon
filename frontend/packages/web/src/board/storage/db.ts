import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type DonegeonDB } from "./schema";

export async function initDB(): Promise<IDBPDatabase<DonegeonDB>> {
  return openDB<DonegeonDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("boards", { keyPath: "id" });
        store.createIndex("by-timestamp", "timestamp");
      }
    },
  });
}
