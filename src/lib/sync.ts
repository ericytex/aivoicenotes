/**
 * Sync service for cross-device and cross-tab synchronization
 * Uses localStorage events for cross-tab sync and IndexedDB for persistence
 */

import { db } from './database';

interface SyncEvent {
  type: 'note_created' | 'note_updated' | 'note_deleted';
  noteId: string;
  userId: string;
  timestamp: string;
  data?: any;
}

class SyncService {
  private listeners: Set<(event: SyncEvent) => void> = new Set();
  private isOnline: boolean = navigator.onLine;
  private syncInterval: number | null = null;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners({
        type: 'note_updated',
        noteId: 'sync',
        userId: 'system',
        timestamp: new Date().toISOString(),
        data: { status: 'online' },
      });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners({
        type: 'note_updated',
        noteId: 'sync',
        userId: 'system',
        timestamp: new Date().toISOString(),
        data: { status: 'offline' },
      });
    });

    // Listen for storage events (cross-tab sync)
    window.addEventListener('storage', (e) => {
      if (e.key === 'note_sync_events') {
        try {
          const events: SyncEvent[] = JSON.parse(e.newValue || '[]');
          events.forEach(event => {
            // Only process events from other tabs
            if (event.userId !== 'system' || event.noteId !== 'sync') {
              this.notifyListeners(event);
            }
          });
        } catch (error) {
          console.error('Error parsing sync events:', error);
        }
      }
    });

    // Start periodic sync check (every 30 seconds)
    this.syncInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, 30000);
  }

  /**
   * Broadcast a sync event to other tabs
   */
  broadcastEvent(event: SyncEvent): void {
    try {
      const events = this.getStoredEvents();
      events.push(event);
      // Keep only last 100 events
      const recentEvents = events.slice(-100);
      localStorage.setItem('note_sync_events', JSON.stringify(recentEvents));
      
      // Trigger storage event manually for same-tab listeners
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'note_sync_events',
        newValue: JSON.stringify(recentEvents),
        oldValue: JSON.stringify(events),
      }));
    } catch (error) {
      console.error('Error broadcasting sync event:', error);
    }
  }

  /**
   * Register a listener for sync events
   */
  onSync(callback: (event: SyncEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Check for updates (placeholder for future server sync)
   */
  private async checkForUpdates(): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    // Future: Check for server-side updates
    // For now, just sync across tabs via localStorage
  }

  /**
   * Get stored sync events
   */
  private getStoredEvents(): SyncEvent[] {
    try {
      const stored = localStorage.getItem('note_sync_events');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading sync events:', error);
      return [];
    }
  }

  /**
   * Notify all listeners of a sync event
   */
  private notifyListeners(event: SyncEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isOnline: boolean;
    lastSync: string | null;
  } {
    const events = this.getStoredEvents();
    const lastEvent = events[events.length - 1];
    
    return {
      isOnline: this.isOnline,
      lastSync: lastEvent?.timestamp || null,
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
    }
    this.listeners.clear();
  }
}

export const syncService = new SyncService();

