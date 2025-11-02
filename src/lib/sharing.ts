/**
 * Sharing service for notes
 * Generates unique shareable links and manages permissions
 */

export type SharePermission = 'read' | 'edit' | 'owner';

export interface ShareSettings {
  noteId: string;
  userId: string;
  shareToken: string;
  permission: SharePermission;
  createdAt: string;
  expiresAt?: string;
}

class SharingService {
  private readonly STORAGE_KEY = 'note_shares';

  /**
   * Generate a unique share token
   */
  generateShareToken(): string {
    return `share_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create a shareable link for a note
   */
  async createShareLink(
    noteId: string,
    userId: string,
    permission: SharePermission = 'read',
    expiresInDays?: number
  ): Promise<string> {
    const shareToken = this.generateShareToken();
    const shareSettings: ShareSettings = {
      noteId,
      userId,
      shareToken,
      permission,
      createdAt: new Date().toISOString(),
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    };

    // Store share settings in localStorage (in production, this would be in a database)
    const shares = this.getAllShares();
    shares[shareToken] = shareSettings;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(shares));

    // Generate shareable URL
    const shareUrl = `${window.location.origin}/shared/${shareToken}`;
    return shareUrl;
  }

  /**
   * Get share settings by token
   */
  getShareByToken(shareToken: string): ShareSettings | null {
    const shares = this.getAllShares();
    const share = shares[shareToken];
    
    if (!share) {
      return null;
    }

    // Check if expired
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      this.revokeShare(shareToken);
      return null;
    }

    return share;
  }

  /**
   * Get all shares for a note
   */
  getSharesForNote(noteId: string): ShareSettings[] {
    const shares = this.getAllShares();
    return Object.values(shares).filter(share => share.noteId === noteId);
  }

  /**
   * Get all shares created by a user
   */
  getSharesByUser(userId: string): ShareSettings[] {
    const shares = this.getAllShares();
    return Object.values(shares).filter(share => share.userId === userId);
  }

  /**
   * Revoke a share link
   */
  revokeShare(shareToken: string): boolean {
    const shares = this.getAllShares();
    if (shares[shareToken]) {
      delete shares[shareToken];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(shares));
      return true;
    }
    return false;
  }

  /**
   * Update share permission
   */
  updateSharePermission(
    shareToken: string,
    permission: SharePermission
  ): boolean {
    const shares = this.getAllShares();
    if (shares[shareToken]) {
      shares[shareToken].permission = permission;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(shares));
      return true;
    }
    return false;
  }

  /**
   * Check if user has permission to access a shared note
   */
  hasPermission(shareToken: string, requiredPermission: SharePermission): boolean {
    const share = this.getShareByToken(shareToken);
    if (!share) {
      return false;
    }

    const permissionLevels: Record<SharePermission, number> = {
      read: 1,
      edit: 2,
      owner: 3,
    };

    return permissionLevels[share.permission] >= permissionLevels[requiredPermission];
  }

  /**
   * Get all shares from storage
   */
  private getAllShares(): Record<string, ShareSettings> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error reading shares from storage:', error);
      return {};
    }
  }
}

export const sharing = new SharingService();

