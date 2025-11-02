/**
 * Server sync service for cross-device synchronization
 * Syncs local database with backend server when online
 */

import { db, Note } from './database';
import { apiService } from './api';
import { auth } from './auth';

interface PendingChange {
  type: 'create' | 'update' | 'delete';
  noteId: string;
  data: any;
  timestamp: string;
}

class ServerSyncService {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInterval: number | null = null;
  private lastSyncTime: string | null = null;
  private pendingChanges: PendingChange[] = [];

  constructor() {
    this.loadPendingChanges();
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.sync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Sync every 30 seconds when online
    this.syncInterval = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.sync();
      }
    }, 30000);

    // Initial sync after 2 seconds
    setTimeout(() => {
      if (this.isOnline) {
        this.sync();
      }
    }, 2000);
  }

  /**
   * Load pending changes from localStorage
   */
  private loadPendingChanges(): void {
    try {
      const stored = localStorage.getItem('pending_sync_changes');
      this.pendingChanges = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading pending changes:', error);
      this.pendingChanges = [];
    }
  }

  /**
   * Save pending changes to localStorage
   */
  private savePendingChanges(): void {
    try {
      localStorage.setItem('pending_sync_changes', JSON.stringify(this.pendingChanges));
    } catch (error) {
      console.error('Error saving pending changes:', error);
    }
  }

  /**
   * Add a change to pending queue
   */
  addPendingChange(change: PendingChange): void {
    // Remove any existing change for the same note
    this.pendingChanges = this.pendingChanges.filter(
      c => !(c.noteId === change.noteId && c.type === change.type)
    );
    
    this.pendingChanges.push(change);
    this.savePendingChanges();
    
    // Try to sync immediately if online
    if (this.isOnline && !this.isSyncing) {
      this.sync();
    }
  }

  /**
   * Sync with server
   */
  async sync(): Promise<void> {
    if (!apiService.isConfigured()) {
      console.log('API not configured, skipping sync');
      return;
    }

    if (this.isSyncing) {
      return;
    }

    if (!this.isOnline) {
      console.log('Offline, skipping sync');
      return;
    }

    const user = auth.getCurrentUser();
    if (!user) {
      return;
    }

    try {
      this.isSyncing = true;
      
      // Check server health
      const isHealthy = await apiService.healthCheck();
      if (!isHealthy) {
        console.warn('Server not available, skipping sync');
        return;
      }

      // Get all local notes
      const localNotes = await db.getNotesByUserId(user.id);

      // Sync with server
      let syncResult;
      try {
        syncResult = await apiService.syncNotes(localNotes);
      } catch (error: any) {
        // Handle 401 - user doesn't exist on server
        if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
          console.warn('⚠️  User not found on server. You may need to sign out and sign back in to sync.');
          // Don't throw - just skip sync for this attempt
          return;
        }
        throw error;
      }

      // Apply server changes to local database using a sync-safe method
      // We'll use a flag to prevent sync loops
      (db as any)._isSyncing = true;
      
      try {
        for (const serverNote of syncResult.notes) {
          const localNote = localNotes.find(n => n.id === serverNote.id);
          
          if (!localNote) {
            // New note from server, insert directly
            await db.ensureInitialized();
            const dbInstance = (db as any).db;
            if (!dbInstance) continue;
            
            const now = new Date().toISOString();
            const tagsJson = serverNote.tags ? JSON.stringify(serverNote.tags) : null;
            
            dbInstance.run(
              `INSERT OR REPLACE INTO notes (id, user_id, title, content, audio_url, duration, language, tags, note_type, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                serverNote.id,
                serverNote.user_id,
                serverNote.title || 'Untitled Note',
                serverNote.content || null,
                serverNote.audio_url || null,
                serverNote.duration || null,
                serverNote.language || 'en',
                tagsJson,
                serverNote.note_type || 'voice_note',
                serverNote.created_at || now,
                serverNote.updated_at || now,
              ]
            );
          } else {
            // Check if server version is newer
            const serverUpdated = new Date(serverNote.updated_at).getTime();
            const localUpdated = new Date(localNote.updated_at).getTime();
            
            if (serverUpdated > localUpdated) {
              // Server version is newer, update local directly
              await db.ensureInitialized();
              const dbInstance = (db as any).db;
              if (!dbInstance) continue;
              
              const tagsJson = serverNote.tags ? JSON.stringify(serverNote.tags) : null;
              const setParts: string[] = [];
              const values: any[] = [];
              
              if (serverNote.title !== undefined) {
                setParts.push('title = ?');
                values.push(serverNote.title);
              }
              if (serverNote.content !== undefined) {
                setParts.push('content = ?');
                values.push(serverNote.content);
              }
              if (serverNote.audio_url !== undefined) {
                setParts.push('audio_url = ?');
                values.push(serverNote.audio_url);
              }
              if (serverNote.duration !== undefined) {
                setParts.push('duration = ?');
                values.push(serverNote.duration);
              }
              if (serverNote.language !== undefined) {
                setParts.push('language = ?');
                values.push(serverNote.language);
              }
              if (serverNote.tags !== undefined) {
                setParts.push('tags = ?');
                values.push(tagsJson);
              }
              if (serverNote.note_type !== undefined) {
                setParts.push('note_type = ?');
                values.push(serverNote.note_type);
              }
              
              setParts.push('updated_at = ?');
              values.push(serverNote.updated_at);
              values.push(serverNote.id);
              
              if (setParts.length > 1) {
                dbInstance.run(
                  `UPDATE notes SET ${setParts.join(', ')} WHERE id = ?`,
                  values
                );
              }
            }
          }
        }
        
        // Save after applying server changes
        await (db as any).saveToIndexedDB();
      } finally {
        (db as any)._isSyncing = false;
      }

      // Process pending changes (push local changes to server)
      const changesToProcess = [...this.pendingChanges];
      this.pendingChanges = [];

      for (const change of changesToProcess) {
        try {
          if (change.type === 'create') {
            await apiService.createNote(change.data);
          } else if (change.type === 'update') {
            await apiService.updateNote(change.noteId, change.data);
          } else if (change.type === 'delete') {
            await apiService.deleteNote(change.noteId);
          }
        } catch (error) {
          console.error(`Error syncing change ${change.type} for ${change.noteId}:`, error);
          // Re-add to pending if it failed
          this.pendingChanges.push(change);
        }
      }

      this.savePendingChanges();
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('last_sync_time', this.lastSyncTime);

      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Force sync now
   */
  async forceSync(): Promise<void> {
    await this.sync();
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isOnline: boolean;
    isSyncing: boolean;
    lastSync: string | null;
    pendingChanges: number;
    apiConfigured: boolean;
  } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSync: this.lastSyncTime || localStorage.getItem('last_sync_time'),
      pendingChanges: this.pendingChanges.length,
      apiConfigured: apiService.isConfigured(),
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
    }
  }
}

export const serverSyncService = new ServerSyncService();

