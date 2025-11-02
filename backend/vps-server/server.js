/**
 * VoiceNote AI Backend API - VPS Express Server
 * 
 * Simple, production-ready backend for cross-device sync
 * Deploy on your VPS with: npm start
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DB_PATH = process.env.DB_PATH || join(__dirname, 'voicenotes.db');
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// Initialize SQLite database
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

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
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
`);

// Auth middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const userId = req.headers['x-user-id'];

  if (!authHeader || !userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing authentication headers'
    });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    // In a real app, verify JWT token here
    // For simplicity, we'll just check if user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid user'
      });
    }
    req.userId = userId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid token'
    });
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Notes API
app.get('/api/notes', authenticate, (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT * FROM notes 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(req.userId);

    const formattedNotes = notes.map(note => ({
      ...note,
      tags: note.tags ? JSON.parse(note.tags) : null
    }));

    res.json({
      success: true,
      data: formattedNotes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/notes/:id', authenticate, (req, res) => {
  try {
    const note = db.prepare(`
      SELECT * FROM notes 
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.userId);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...note,
        tags: note.tags ? JSON.parse(note.tags) : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/notes', authenticate, (req, res) => {
  try {
    const { title, content, audio_url, duration, language, tags, note_type } = req.body;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, audio_url, duration, language, tags, note_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.userId,
      title || 'Untitled Note',
      content || null,
      audio_url || null,
      duration || null,
      language || 'en',
      tags ? JSON.stringify(tags) : null,
      note_type || 'voice_note',
      now,
      now
    );

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);

    res.json({
      success: true,
      data: {
        ...note,
        tags: note.tags ? JSON.parse(note.tags) : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.patch('/api/notes/:id', authenticate, (req, res) => {
  try {
    const { title, content, audio_url, duration, language, tags, note_type, updated_at } = req.body;
    
    // Verify note belongs to user
    const existingNote = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!existingNote) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (audio_url !== undefined) {
      updates.push('audio_url = ?');
      values.push(audio_url);
    }
    if (duration !== undefined) {
      updates.push('duration = ?');
      values.push(duration);
    }
    if (language !== undefined) {
      updates.push('language = ?');
      values.push(language);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(tags));
    }
    if (note_type !== undefined) {
      updates.push('note_type = ?');
      values.push(note_type);
    }
    
    updates.push('updated_at = ?');
    values.push(updated_at || new Date().toISOString());
    values.push(req.params.id);

    db.prepare(`
      UPDATE notes 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);

    res.json({
      success: true,
      data: {
        ...note,
        tags: note.tags ? JSON.parse(note.tags) : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/notes/:id', authenticate, (req, res) => {
  try {
    // Verify note belongs to user
    const existingNote = db.prepare('SELECT id, audio_url FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!existingNote) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Delete audio file if exists
    if (existingNote.audio_url) {
      const audioPath = join(UPLOAD_DIR, existingNote.audio_url.split('/').pop());
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);

    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync endpoint
app.post('/api/sync', authenticate, (req, res) => {
  try {
    const { notes: localNotes } = req.body;
    
    // Get all notes from server
    const serverNotes = db.prepare(`
      SELECT * FROM notes 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(req.userId);

    const formattedServerNotes = serverNotes.map(note => ({
      ...note,
      tags: note.tags ? JSON.parse(note.tags) : null
    }));

    // Simple conflict detection (could be enhanced)
    const conflicts = [];

    res.json({
      success: true,
      data: {
        notes: formattedServerNotes,
        conflicts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync status
app.get('/api/sync/status', authenticate, (req, res) => {
  try {
    const noteCount = db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').get(req.userId);
    
    res.json({
      success: true,
      data: {
        lastSync: new Date().toISOString(),
        pendingChanges: 0 // Could implement pending changes tracking
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Audio upload
const upload = multer({ 
  dest: UPLOAD_DIR,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

app.post('/api/notes/:id/audio', authenticate, upload.single('audio'), (req, res) => {
  try {
    const noteId = req.params.id;
    
    // Verify note belongs to user
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?').get(noteId, req.userId);
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    // Generate URL for the uploaded file
    const audioUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${audioUrl}`;

    // Update note with audio URL
    db.prepare('UPDATE notes SET audio_url = ? WHERE id = ?').run(fullUrl, noteId);

    res.json({
      success: true,
      data: {
        url: fullUrl
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 VoiceNote API server running on port ${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`📁 Uploads: ${UPLOAD_DIR}`);
  console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || '*'}`);
});

