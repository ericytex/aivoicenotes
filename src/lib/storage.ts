// Audio storage using IndexedDB
class StorageService {
  private readonly DB_NAME = 'VoiceNoteStorage';
  private readonly STORE_NAME = 'audioFiles';
  private readonly DB_VERSION = 1;

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    });
  }

  async saveAudio(key: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(blob, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAudio(key: string): Promise<Blob | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async deleteAudio(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  createBlobURL(key: string): string {
    // Return a special URL that we can use to retrieve the blob
    // We'll create actual blob URLs when needed
    return `voicenote://audio/${key}`;
  }

  async getBlobURL(key: string): Promise<string> {
    const blob = await this.getAudio(key);
    if (!blob) {
      throw new Error('Audio file not found');
    }
    return URL.createObjectURL(blob);
  }

  // Clean up blob URL
  revokeBlobURL(url: string): void {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  // Generate a unique key for audio file
  generateAudioKey(userId: string): string {
    return `${userId}/${Date.now()}.webm`;
  }
}

export const storage = new StorageService();



