import type { BoardStateDto } from "@donegeon/app/api";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type PlayerId = string;

function emptyBoard(): BoardStateDto {
  return { grid_size: 100, entities: [], stacks: [] };
}

const SCHEMA_VERSION = 1;

export class BoardRepo {
  private byPlayer = new Map<PlayerId, BoardStateDto>();
  private db: Database;

  constructor() {
    const dbPath = Bun.env.DONEGEON_DB_PATH ?? "./.data/donegeon.sqlite";
    try {
      mkdirSync(dirname(dbPath), { recursive: true });
    } catch (e) {
      throw new Error(`[@donegeon/backend]: Failed to create database directory: ${(e as Error).message}`);
    }
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    // Create metadata table to track schema version
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Get current schema version
    const row = this.db.query("SELECT value FROM _schema_meta WHERE key = 'version'").get() as any;
    const currentVersion = row?.value ? Number.parseInt(String(row.value), 10) : 0;

    // Run migrations
    if (currentVersion < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS board_state (
          player_id TEXT PRIMARY KEY,
          json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      this.db.exec("INSERT OR REPLACE INTO _schema_meta(key, value) VALUES ('version', '1')");
    }

    // Future migrations would go here:
    // if (currentVersion < 2) { ... }
  }

  get(playerId: PlayerId): BoardStateDto {
    const existing = this.byPlayer.get(playerId);
    if (existing) return existing;

    const row = this.db.query("SELECT json FROM board_state WHERE player_id = ?").get(playerId) as any;
    if (row?.json) {
      try {
        const parsed = JSON.parse(String(row.json)) as BoardStateDto;
        this.byPlayer.set(playerId, parsed);
        return parsed;
      } catch {
        // fall through to create empty
      }
    }

    const created = emptyBoard();
    this.byPlayer.set(playerId, created);
    // persist initial
    this.set(playerId, created);
    return created;
  }

  set(playerId: PlayerId, state: BoardStateDto) {
    this.byPlayer.set(playerId, state);
    const json = JSON.stringify(state);
    this.db
      .query("INSERT INTO board_state(player_id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at")
      .run(playerId, json, Date.now());
  }
}

