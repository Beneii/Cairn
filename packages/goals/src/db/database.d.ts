/**
 * SQLite Database Layer
 *
 * Persistent storage for goals.
 */
import Database from "better-sqlite3";
export declare function initDatabase(): Database.Database;
export declare function getDatabase(): Database.Database;
export declare function closeDatabase(): void;
export declare function now(): string;
export declare function parseJSON<T>(str: string | null | undefined, fallback: T): T;
//# sourceMappingURL=database.d.ts.map