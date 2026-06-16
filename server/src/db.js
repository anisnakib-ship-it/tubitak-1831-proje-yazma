import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { DB_PATH, DATA_DIR, UPLOADS_DIR } from './config.js';

// Veri klasörlerini hazırla
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    company_name  TEXT,
    project_type  TEXT NOT NULL DEFAULT 'corporate-carbon',
    analysis      TEXT,            -- JSON: yapılandırılmış analiz formu
    status        TEXT NOT NULL DEFAULT 'draft', -- draft | generating | done | error
    doc_url       TEXT,
    error_message TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id            TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_path   TEXT NOT NULL,
    mime_type     TEXT,
    kind          TEXT NOT NULL DEFAULT 'support', -- support | workpackages
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sections (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    number      INTEGER NOT NULL,
    title       TEXT NOT NULL,
    content     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

// Migration: mevcut veritabanına project_type sütununu ekle
try {
  const cols = db.prepare(`PRAGMA table_info(projects)`).all();
  if (!cols.some((c) => c.name === 'project_type')) {
    db.exec(`ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'tubitak-1831'`);
  }
} catch { /* yok say */ }

// Migration: files tablosuna kind sütununu ekle
try {
  const cols = db.prepare(`PRAGMA table_info(files)`).all();
  if (!cols.some((c) => c.name === 'kind')) {
    db.exec(`ALTER TABLE files ADD COLUMN kind TEXT NOT NULL DEFAULT 'support'`);
  }
} catch { /* yok say */ }

export default db;

// ---------------------------------------------------------
// Project helpers
// ---------------------------------------------------------
export const Projects = {
  create({ id, name, companyName = '', projectType = 'corporate-carbon', analysis = {} }) {
    db.prepare(
      `INSERT INTO projects (id, name, company_name, project_type, analysis) VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, companyName, projectType, JSON.stringify(analysis));
    return this.get(id);
  },

  get(id) {
    const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
    return row ? hydrate(row) : null;
  },

  list() {
    return db
      .prepare(`SELECT * FROM projects ORDER BY datetime(created_at) DESC`)
      .all()
      .map(hydrate);
  },

  update(id, fields) {
    const allowed = ['name', 'company_name', 'project_type', 'analysis', 'status', 'doc_url', 'error_message'];
    const sets = [];
    const values = [];
    for (const [key, value] of Object.entries(fields)) {
      if (!allowed.includes(key)) continue;
      sets.push(`${key} = ?`);
      values.push(key === 'analysis' ? JSON.stringify(value) : value);
    }
    if (sets.length === 0) return this.get(id);
    sets.push(`updated_at = datetime('now')`);
    values.push(id);
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.get(id);
  },

  remove(id) {
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
  }
};

export const Files = {
  add({ id, projectId, originalName, storedPath, mimeType, kind = 'support' }) {
    db.prepare(
      `INSERT INTO files (id, project_id, original_name, stored_path, mime_type, kind) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, projectId, originalName, storedPath, mimeType, kind);
  },
  listByProject(projectId) {
    return db.prepare(`SELECT * FROM files WHERE project_id = ?`).all(projectId);
  }
};

export const Sections = {
  replaceForProject(projectId, sections) {
    const del = db.prepare(`DELETE FROM sections WHERE project_id = ?`);
    const ins = db.prepare(
      `INSERT INTO sections (id, project_id, number, title, content) VALUES (?, ?, ?, ?, ?)`
    );
    db.exec('BEGIN');
    try {
      del.run(projectId);
      for (const s of sections) {
        ins.run(`${projectId}-${s.number}`, projectId, s.number, s.title, s.content);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },
  listByProject(projectId) {
    return db
      .prepare(`SELECT * FROM sections WHERE project_id = ? ORDER BY number ASC`)
      .all(projectId);
  }
};

function hydrate(row) {
  return {
    ...row,
    analysis: safeParse(row.analysis)
  };
}

function safeParse(json) {
  try {
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}
