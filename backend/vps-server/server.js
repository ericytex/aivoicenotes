/**
 * VoiceNote AI Backend API - VPS Express Server
 * 
 * Production-ready backend for cross-device sync
 * Uses SQLite database (can be upgraded to PostgreSQL later)
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3333;
const DB_PATH = process.env.DB_PATH || join(__dirname, 'voicenotes.db');
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, 'uploads');

// Ensure data directory exists (for database)
const dataDir = process.env.DB_PATH ? dirname(process.env.DB_PATH) : __dirname;
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Created data directory:', dataDir);
}

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('✅ Created upload directory:', UPLOAD_DIR);
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id']
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Initialize SQLite database
let db;
try {
  // Ensure parent directory exists before creating database
  const dbDir = dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = new Database(DB_PATH);
  console.log('✅ Database connected:', DB_PATH);
} catch (error) {
  console.error('❌ Database connection failed:', error);
  console.error('   DB_PATH:', DB_PATH);
  console.error('   Data directory:', dirname(DB_PATH));
  console.error('   Data directory exists:', fs.existsSync(dirname(DB_PATH)));
  try {
    fs.accessSync(dirname(DB_PATH), fs.constants.W_OK);
    console.error('   Data directory writable: yes');
  } catch (permError) {
    console.error('   Data directory writable: no -', permError.message);
  }
  process.exit(1);
}

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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

  CREATE TABLE IF NOT EXISTS sync_metadata (
    user_id TEXT PRIMARY KEY,
    last_sync TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Auth middleware - simplified for local-first architecture
// In production, you'd want proper JWT validation
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing user ID'
    });
  }

  // Verify user exists
  try {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not found'
      });
    }
    req.userId = userId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid user'
    });
  }
};

// Helper function to format note with parsed tags
const formatNote = (note) => {
  return {
    ...note,
    tags: note.tags ? JSON.parse(note.tags) : null
  };
};

// Auth endpoints
app.post('/api/auth/signup', express.json(), (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Create user
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, is_admin, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, email, passwordHash, 0, now);

    res.json({
      success: true,
      data: {
        id,
        email,
        is_admin: false
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

app.post('/api/auth/signin', express.json(), (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin === 1
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sign in'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  try {
    // Test database connection
    db.prepare('SELECT 1').get();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Database connection failed'
    });
  }
});

// Notes API
app.get('/api/notes', authenticate, (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT * FROM notes 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(req.userId);

    res.json({
      success: true,
      data: notes.map(formatNote)
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notes'
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
      data: formatNote(note)
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch note'
    });
  }
});

app.post('/api/notes', authenticate, (req, res) => {
  try {
    const { title, content, audio_url, duration, language, tags, note_type } = req.body;
    
    // Generate ID if not provided (client usually provides it)
    const id = req.body.id || crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO notes (id, user_id, title, content, audio_url, duration, language, tags, note_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM notes WHERE id = ?), ?),
        ?)
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
      id, // for COALESCE check
      now, // fallback created_at
      now  // updated_at
    );

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);

    res.json({
      success: true,
      data: formatNote(note)
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create note'
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
      values.push(tags ? JSON.stringify(tags) : null);
    }
    if (note_type !== undefined) {
      updates.push('note_type = ?');
      values.push(note_type);
    }
    
    updates.push('updated_at = ?');
    values.push(updated_at || new Date().toISOString());
    values.push(req.params.id);

    if (updates.length > 1) {
      db.prepare(`
        UPDATE notes 
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);
    }

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);

    res.json({
      success: true,
      data: formatNote(note)
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update note'
    });
  }
});

app.delete('/api/notes/:id', authenticate, (req, res) => {
  try {
    // Verify note belongs to user and get audio URL
    const existingNote = db.prepare('SELECT id, audio_url FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!existingNote) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Delete audio file if exists
    if (existingNote.audio_url && existingNote.audio_url.includes('/uploads/')) {
      try {
        const filename = existingNote.audio_url.split('/').pop();
        const audioPath = join(UPLOAD_DIR, filename);
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
          console.log('Deleted audio file:', audioPath);
        }
      } catch (fileError) {
        console.warn('Could not delete audio file:', fileError);
        // Continue even if file deletion fails
      }
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete note'
    });
  }
});

// Sync endpoint - handles bidirectional sync
app.post('/api/sync', authenticate, (req, res) => {
  try {
    const { notes: localNotes = [] } = req.body;
    
    // Get all notes from server for this user
    const serverNotes = db.prepare(`
      SELECT * FROM notes 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(req.userId);

    // Update sync metadata
    db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (user_id, last_sync)
      VALUES (?, ?)
    `).run(req.userId, new Date().toISOString());

    // Format server notes
    const formattedServerNotes = serverNotes.map(formatNote);

    // Simple conflict detection based on timestamps
    const conflicts = [];
    
    for (const localNote of localNotes) {
      const serverNote = formattedServerNotes.find(n => n.id === localNote.id);
      if (serverNote) {
        const localTime = new Date(localNote.updated_at).getTime();
        const serverTime = new Date(serverNote.updated_at).getTime();
        
        // If both have been modified (within 5 seconds considered same edit)
        if (Math.abs(localTime - serverTime) > 5000 && 
            localTime > serverTime) {
          // Local is newer but server also has changes - potential conflict
          conflicts.push({
            noteId: localNote.id,
            local: localNote,
            server: serverNote
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        notes: formattedServerNotes,
        conflicts
      }
    });
  } catch (error) {
    console.error('Error syncing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync'
    });
  }
});

// Sync status endpoint
app.get('/api/sync/status', authenticate, (req, res) => {
  try {
    const syncMeta = db.prepare('SELECT last_sync FROM sync_metadata WHERE user_id = ?').get(req.userId);
    const noteCount = db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').get(req.userId);
    
    res.json({
      success: true,
      data: {
        lastSync: syncMeta?.last_sync || null,
        pendingChanges: 0, // Could implement pending changes tracking
        totalNotes: noteCount?.count || 0
      }
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sync status'
    });
  }
});

// Audio upload endpoint
const upload = multer({ 
  dest: UPLOAD_DIR,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || 
        file.mimetype.startsWith('video/') ||
        ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

app.post('/api/notes/:id/audio', authenticate, upload.single('audio'), (req, res) => {
  try {
    const noteId = req.params.id;
    
    // Verify note belongs to user
    const note = db.prepare('SELECT id, audio_url FROM notes WHERE id = ? AND user_id = ?').get(noteId, req.userId);
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

    // Delete old audio file if exists
    if (note.audio_url && note.audio_url.includes('/uploads/')) {
      try {
        const oldFilename = note.audio_url.split('/').pop();
        const oldPath = join(UPLOAD_DIR, oldFilename);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (fileError) {
        console.warn('Could not delete old audio file:', fileError);
      }
    }

    // Generate URL for the uploaded file
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    const audioUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${protocol}://${host}${audioUrl}`;

    // Update note with audio URL
    db.prepare('UPDATE notes SET audio_url = ?, updated_at = ? WHERE id = ?').run(
      fullUrl,
      new Date().toISOString(),
      noteId
    );

    console.log(`✅ Audio uploaded for note ${noteId}: ${req.file.filename}`);

    res.json({
      success: true,
      data: {
        url: fullUrl
      }
    });
  } catch (error) {
    console.error('Error uploading audio:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload audio'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (db) {
    db.close();
    console.log('✅ Database closed');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (db) {
    db.close();
    console.log('✅ Database closed');
  }
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 VoiceNote API Server');
  console.log('═══════════════════════════════════════');
  console.log(`📍 Port: ${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`📁 Uploads: ${UPLOAD_DIR}`);
  console.log(`🌐 CORS: ${process.env.CORS_ORIGIN || '*'}`);
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
  console.log('═══════════════════════════════════════\n');
});
