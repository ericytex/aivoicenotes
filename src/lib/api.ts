/**
 * API service for syncing with backend server
 * Configure VITE_API_URL in your .env file
 */

import { Note, NoteInsert, NoteUpdate } from './database';
import { auth } from './auth';

// Use relative path if VITE_API_URL is empty (same domain) or use provided URL
// If VITE_API_URL is set, use it as-is. If empty, use '' so we can prepend /api
const VITE_API_URL = import.meta.env.VITE_API_URL || '';
const API_URL = VITE_API_URL || ''; // Empty string means same domain, we'll prepend /api

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SyncStatus {
  lastSync: string;
  pendingChanges: number;
}

class ApiService {
  private getAuthHeaders(): HeadersInit {
    const user = auth.getCurrentUser();
    const session = auth.getSession();
    
    return {
      'Content-Type': 'application/json',
      'Authorization': session ? `Bearer ${session}` : '',
      'X-User-Id': user?.id || '',
    };
  }

  async healthCheck(): Promise<boolean> {
    
    try {
      const response = await fetch(`${API_URL || ''}/api/health`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Notes API
  async getNotes(): Promise<Note[]> {
    
    const response = await fetch(`${API_URL || ''}/api/notes`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch notes: ${response.statusText}`);
    }

    const result: ApiResponse<Note[]> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch notes');
    }

    return result.data;
  }

  async getNoteById(id: string): Promise<Note> {
    
    const response = await fetch(`${API_URL || ''}/api/notes/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch note: ${response.statusText}`);
    }

    const result: ApiResponse<Note> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch note');
    }

    return result.data;
  }

  async createNote(note: NoteInsert): Promise<Note> {
    
    const response = await fetch(`${API_URL || ''}/api/notes`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(note),
    });

    if (!response.ok) {
      throw new Error(`Failed to create note: ${response.statusText}`);
    }

    const result: ApiResponse<Note> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to create note');
    }

    return result.data;
  }

  async updateNote(id: string, updates: NoteUpdate): Promise<Note> {
    
    const response = await fetch(`${API_URL || ''}/api/notes/${id}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update note: ${response.statusText}`);
    }

    const result: ApiResponse<Note> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to update note');
    }

    return result.data;
  }

  async deleteNote(id: string): Promise<void> {
    
    const response = await fetch(`${API_URL || ''}/api/notes/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }

    const result: ApiResponse<void> = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete note');
    }
  }

  // Sync API
  async syncNotes(localNotes: Note[]): Promise<{ notes: Note[]; conflicts: any[] }> {
    
    const response = await fetch(`${API_URL || ''}/api/sync`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ notes: localNotes }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync: ${response.statusText}`);
    }

    const result: ApiResponse<{ notes: Note[]; conflicts: any[] }> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to sync');
    }

    return result.data;
  }

  async getSyncStatus(): Promise<SyncStatus> {
    
    const response = await fetch(`${API_URL || ''}/api/sync/status`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get sync status: ${response.statusText}`);
    }

    const result: ApiResponse<SyncStatus> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get sync status');
    }

    return result.data;
  }

  // Audio upload
  async uploadAudio(noteId: string, audioBlob: Blob): Promise<string> {
    
    const formData = new FormData();
    formData.append('audio', audioBlob, `${noteId}.webm`);
    formData.append('noteId', noteId);

    const user = auth.getCurrentUser();
    const session = auth.getSession();

    const response = await fetch(`${API_URL || ''}/api/notes/${noteId}/audio`, {
      method: 'POST',
      headers: {
        'Authorization': session ? `Bearer ${session}` : '',
        'X-User-Id': user?.id || '',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload audio: ${response.statusText}`);
    }

    const result: ApiResponse<{ url: string }> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to upload audio');
    }

    return result.data.url;
  }

  isConfigured(): boolean {
    // Always configured - uses relative /api if VITE_API_URL not set
    return true;
  }
}

export const apiService = new ApiService();

