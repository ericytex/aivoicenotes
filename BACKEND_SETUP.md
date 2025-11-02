# Backend Setup for Cross-Device Sync

The app now supports syncing across devices via a backend API. The local database still works offline, but syncs with a server when online.

## Architecture

- **Local Database**: SQLite in browser (IndexedDB) for offline support
- **Server Database**: Shared database (PostgreSQL/MySQL) for cross-device sync
- **Sync Strategy**: Local-first with server sync when online

## Backend Requirements

Your backend API should provide these endpoints:

### Base URL
Configure in `.env`: `VITE_API_URL=https://your-api.com`

### Authentication
All requests require:
- `Authorization: Bearer {session_token}` header
- `X-User-Id: {user_id}` header

### Endpoints

#### Health Check
```
GET /health
Returns: 200 OK if server is healthy
```

#### Get All Notes
```
GET /api/notes
Headers: Authorization, X-User-Id
Returns: {
  success: true,
  data: Note[]
}
```

#### Get Note by ID
```
GET /api/notes/:id
Headers: Authorization, X-User-Id
Returns: {
  success: true,
  data: Note
}
```

#### Create Note
```
POST /api/notes
Headers: Authorization, X-User-Id
Body: {
  user_id: string,
  title?: string,
  content?: string,
  audio_url?: string,
  duration?: number,
  language?: string,
  tags?: string[],
  note_type?: string
}
Returns: {
  success: true,
  data: Note
}
```

#### Update Note
```
PATCH /api/notes/:id
Headers: Authorization, X-User-Id
Body: {
  title?: string,
  content?: string,
  audio_url?: string,
  duration?: number,
  language?: string,
  tags?: string[],
  note_type?: string,
  updated_at?: string
}
Returns: {
  success: true,
  data: Note
}
```

#### Delete Note
```
DELETE /api/notes/:id
Headers: Authorization, X-User-Id
Returns: {
  success: true
}
```

#### Sync Notes
```
POST /api/sync
Headers: Authorization, X-User-Id
Body: {
  notes: Note[]
}
Returns: {
  success: true,
  data: {
    notes: Note[],  // All notes from server
    conflicts: any[]  // Any conflicts detected
  }
}
```

#### Get Sync Status
```
GET /api/sync/status
Headers: Authorization, X-User-Id
Returns: {
  success: true,
  data: {
    lastSync: string,
    pendingChanges: number
  }
}
```

#### Upload Audio
```
POST /api/notes/:id/audio
Headers: Authorization, X-User-Id
Body: FormData {
  audio: Blob,
  noteId: string
}
Returns: {
  success: true,
  data: {
    url: string  // URL to access the audio file
  }
}
```

## Database Schema

### Notes Table
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content TEXT,
  audio_url TEXT,
  duration INTEGER,
  language TEXT DEFAULT 'en',
  tags TEXT,  -- JSON array
  note_type TEXT DEFAULT 'voice_note',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
```

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
```

## Sync Behavior

1. **Local-First**: All operations work offline
2. **Auto-Sync**: Syncs every 30 seconds when online
3. **Manual Sync**: Users can force sync via UI
4. **Conflict Resolution**: Server timestamp wins (last write wins)
5. **Pending Changes**: Changes are queued when offline, synced when online

## Example Backend Implementation

See `/backend-example` directory for a simple Node.js/Express + PostgreSQL implementation.

## Testing Without Backend

If `VITE_API_URL` is not set, the app works fully offline with local database only. Sync will be skipped gracefully.

