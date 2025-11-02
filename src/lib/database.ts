import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { syncService } from './sync';
import { serverSyncService } from './sync-server';
import { generateUUID } from './uuid';

// Types matching the Supabase schema
export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  audio_url: string | null;
  duration: number | null;
  language: string | null;
  tags: string[] | null;
  note_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteInsert {
  user_id: string;
  title?: string;
  content?: string | null;
  audio_url?: string | null;
  duration?: number | null;
  language?: string | null;
  tags?: string[] | null;
  note_type?: string | null;
}

export interface NoteUpdate {
  title?: string;
  content?: string | null;
  audio_url?: string | null;
  duration?: number | null;
  language?: string | null;
  tags?: string[] | null;
  note_type?: string | null;
  updated_at?: string;
}

class DatabaseService {
  private db: SqlJsDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });

        // Load existing database from IndexedDB or create new one
        const savedDb = await this.loadFromIndexedDB();
        
        if (savedDb) {
          this.db = new SQL.Database(savedDb);
          // Run migrations for existing databases
          this.runMigrations();
        } else {
          this.db = new SQL.Database();
          this.createTables();
          await this.saveToIndexedDB();
        }
      } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Create notes table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'Untitled Note',
        content TEXT,
        audio_url TEXT,
        duration INTEGER,
        language TEXT DEFAULT 'en',
        tags TEXT,
        note_type TEXT DEFAULT 'voice_note',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create users table for authentication
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);

    // Create indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC)`);
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Migration: Add is_admin column if it doesn't exist
      const result = this.db.exec('PRAGMA table_info(users)');
      if (result.length > 0) {
        const columns = result[0].values.map((row: any[]) => row[1]);
        if (!columns.includes('is_admin')) {
          console.log('Running migration: Adding is_admin column to users table');
          this.db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
          this.saveToIndexedDB().catch(err => console.error('Error saving migration:', err));
        }
      }
    } catch (error) {
      console.error('Migration error:', error);
      // If migration fails, continue anyway
    }
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('VoiceNoteDB', 1);
      
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['database'], 'readonly');
        const store = transaction.objectStore('database');
        const getRequest = store.get('data');
        
        getRequest.onerror = () => resolve(null);
        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('database')) {
          db.createObjectStore('database');
        }
      };
    });
  }

  private async saveToIndexedDB(): Promise<void> {
    if (!this.db) return;

    const data = this.db.export();
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VoiceNoteDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['database'], 'readwrite');
        const store = transaction.objectStore('database');
        const putRequest = store.put(data, 'data');
        
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('database')) {
          db.createObjectStore('database');
        }
      };
    });
  }

  async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  // Notes CRUD operations
  async createNote(note: NoteInsert): Promise<Note> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const id = generateUUID();
    const now = new Date().toISOString();
    const tagsJson = note.tags ? JSON.stringify(note.tags) : null;

    this.db.run(
      `INSERT INTO notes (id, user_id, title, content, audio_url, duration, language, tags, note_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        note.user_id,
        note.title || 'Voice Note',
        note.content || null,
        note.audio_url || null,
        note.duration || null,
        note.language || 'en',
        tagsJson,
        note.note_type || 'voice_note',
        now,
        now,
      ]
    );

    await this.saveToIndexedDB();

    const createdNote = await this.getNoteById(id);

    // Broadcast to other tabs
    syncService.broadcastEvent({
      type: 'note_created',
      noteId: id,
      userId: note.user_id,
      timestamp: now,
    });

    // Queue for server sync (skip if this is a server sync operation)
    if (!(this as any)._isSyncing) {
      serverSyncService.addPendingChange({
        type: 'create',
        noteId: id,
        data: {
          user_id: note.user_id,
          title: createdNote.title,
          content: createdNote.content,
          audio_url: createdNote.audio_url,
          duration: createdNote.duration,
          language: createdNote.language,
          tags: createdNote.tags,
          note_type: createdNote.note_type,
        },
        timestamp: now,
      });
    }

    return createdNote;
  }

  async getNoteById(id: string): Promise<Note> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM notes WHERE id = ?');
    stmt.bind([id]);
    
    if (!stmt.step()) {
      stmt.free();
      throw new Error('Note not found');
    }

    const row = stmt.getAsObject();
    stmt.free();

    return this.rowToNote(row);
  }

  async getNotesByUserId(userId: string): Promise<Note[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC');
    stmt.bind([userId]);
    
    const notes: Note[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      notes.push(this.rowToNote(row));
    }
    stmt.free();

    return notes;
  }

  async updateNote(id: string, updates: NoteUpdate): Promise<Note> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      setParts.push('title = ?');
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      setParts.push('content = ?');
      values.push(updates.content);
    }
    if (updates.audio_url !== undefined) {
      setParts.push('audio_url = ?');
      values.push(updates.audio_url);
    }
    if (updates.duration !== undefined) {
      setParts.push('duration = ?');
      values.push(updates.duration);
    }
    if (updates.language !== undefined) {
      setParts.push('language = ?');
      values.push(updates.language);
    }
    if (updates.tags !== undefined) {
      setParts.push('tags = ?');
      values.push(updates.tags ? JSON.stringify(updates.tags) : null);
    }
    if (updates.note_type !== undefined) {
      setParts.push('note_type = ?');
      values.push(updates.note_type);
    }

    setParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.run(
      `UPDATE notes SET ${setParts.join(', ')} WHERE id = ?`,
      values
    );

    await this.saveToIndexedDB();

    const updatedNote = await this.getNoteById(id);
    const now = new Date().toISOString();

    // Broadcast to other tabs
    syncService.broadcastEvent({
      type: 'note_updated',
      noteId: id,
      userId: updatedNote.user_id,
      timestamp: now,
    });

    // Queue for server sync (skip if this is a server sync operation)
    if (!(this as any)._isSyncing) {
      serverSyncService.addPendingChange({
        type: 'update',
        noteId: id,
        data: updates,
        timestamp: now,
      });
    }

    return updatedNote;
  }

  async deleteNote(id: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    // Get note before deleting for sync event
    let userId = '';
    try {
      const noteToDelete = await this.getNoteById(id);
      userId = noteToDelete.user_id;
    } catch (error) {
      // Note doesn't exist, proceed with deletion anyway
    }

    this.db.run(`DELETE FROM notes WHERE id = ?`, [id]);
    await this.saveToIndexedDB();

    const now = new Date().toISOString();

    // Broadcast to other tabs
    if (userId) {
      syncService.broadcastEvent({
        type: 'note_deleted',
        noteId: id,
        userId: userId,
        timestamp: now,
      });

      // Queue for server sync (skip if this is a server sync operation)
      if (!(this as any)._isSyncing) {
        serverSyncService.addPendingChange({
          type: 'delete',
          noteId: id,
          data: {},
          timestamp: now,
        });
      }
    }
  }

  private rowToNote(row: { [key: string]: any }): Note {
    const note: any = { ...row };

    // Parse tags JSON string
    if (note.tags && typeof note.tags === 'string') {
      try {
        note.tags = JSON.parse(note.tags);
      } catch {
        note.tags = null;
      }
    }

    return note as Note;
  }

  // User operations for authentication
  async createUser(email: string, passwordHash: string, isAdmin: boolean = false): Promise<string> {
    return this.createUserWithId(generateUUID(), email, passwordHash, isAdmin);
  }

  async createUserWithId(id: string, email: string, passwordHash: string, isAdmin: boolean = false): Promise<string> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO users (id, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, email, passwordHash, isAdmin ? 1 : 0, now]
    );
    await this.saveToIndexedDB();
    return id;
  }

  async getUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string; is_admin: boolean } | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare('SELECT id, email, password_hash, is_admin FROM users WHERE email = ?');
      stmt.bind([email]);
      
      if (!stmt.step()) {
        stmt.free();
        console.log('No user found with email:', email);
        return null;
      }

      const row = stmt.getAsObject();
      stmt.free();

      console.log('User found:', { id: row.id, email: row.email, hasPassword: !!row.password_hash, isAdmin: !!row.is_admin });
      return {
        id: row.id as string,
        email: row.email as string,
        password_hash: row.password_hash as string,
        is_admin: Boolean(row.is_admin),
      };
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<{ id: string; email: string; is_admin: boolean } | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT id, email, is_admin FROM users WHERE id = ?');
    stmt.bind([id]);
    
    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject();
    stmt.free();

    return {
      id: row.id as string,
      email: row.email as string,
      is_admin: Boolean(row.is_admin),
    };
  }

  async getAllUsers(): Promise<Array<{ id: string; email: string; is_admin: boolean; created_at: string }>> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT id, email, is_admin, created_at FROM users ORDER BY created_at DESC');
    
    const users: Array<{ id: string; email: string; is_admin: boolean; created_at: string }> = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      users.push({
        id: row.id as string,
        email: row.email as string,
        is_admin: Boolean(row.is_admin),
        created_at: row.created_at as string,
      });
    }
    stmt.free();

    return users;
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('UPDATE users SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, userId]);
    await this.saveToIndexedDB();
  }

  async deleteUser(userId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    // Also delete user's notes
    this.db.run('DELETE FROM notes WHERE user_id = ?', [userId]);
    this.db.run('DELETE FROM users WHERE id = ?', [userId]);
    await this.saveToIndexedDB();
  }
}

export const db = new DatabaseService();

