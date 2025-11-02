import bcrypt from 'bcryptjs';
import { db } from './database';

export interface User {
  id: string;
  email: string;
  is_admin?: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

class AuthService {
  private readonly SESSION_KEY = 'voicenote_session';
  private readonly SESSION_USER_KEY = 'voicenote_user';

  async signUp(data: SignUpData): Promise<User> {
    // Server-first: Create user on server first
    const apiService = (await import('./api')).apiService;
    
    if (!apiService.isConfigured()) {
      throw new Error('Server is not configured. Please configure the API URL.');
    }

    // Check server health
    const isHealthy = await apiService.healthCheck();
    if (!isHealthy) {
      throw new Error('Server is not available. Please try again later.');
    }

    // Create user on server first
    let serverUser: User | null = null;
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          serverUser = result.data;
        }
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to create user' }));
        throw new Error(error.error || 'Failed to create user on server');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to connect to server');
    }

    if (!serverUser) {
      throw new Error('Failed to create user on server');
    }

    // Now sync to local database (for offline access)
    try {
      // Check if user already exists locally
      const existingUser = await db.getUserByEmail(data.email);
      if (existingUser && existingUser.id !== serverUser.id) {
        // Delete old local user with different ID
        await db.deleteUser(existingUser.id);
      }

      // Create or update local user with server's ID
      if (!existingUser || existingUser.id !== serverUser.id) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);
        await db.createUserWithId(serverUser.id, data.email, passwordHash, serverUser.is_admin || false);
      }

      console.log('✅ User created on server and synced to local');
    } catch (error) {
      console.warn('⚠️  User created on server but local sync failed:', error);
      // Continue anyway - server has the user
    }

    // Create session with server's user data
    this.setSession(serverUser.id, serverUser);
    return serverUser;
  }

  async signIn(data: SignInData): Promise<User> {
    // Server-first: Always authenticate with server first
    const apiService = (await import('./api')).apiService;
    
    if (!apiService.isConfigured()) {
      throw new Error('Server is not configured. Please configure the API URL.');
    }

    // Check server health
    const isHealthy = await apiService.healthCheck();
    if (!isHealthy) {
      throw new Error('Server is not available. Please check your connection and try again.');
    }

    // Authenticate with server first
    let serverUser: User | null = null;
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          serverUser = result.data;
        }
      } else {
        const error = await response.json().catch(() => ({ error: 'Invalid email or password' }));
        throw new Error(error.error || 'Invalid email or password');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to connect to server');
    }

    if (!serverUser) {
      throw new Error('Invalid email or password');
    }

    // Sync user to local database (for offline caching)
    try {
      await db.ensureInitialized();
      
      // Check if user exists locally
      let localUser = await db.getUserByEmail(data.email);
      
      if (!localUser || localUser.id !== serverUser.id) {
        // Delete old local user if ID doesn't match
        if (localUser && localUser.id !== serverUser.id) {
          await db.deleteUser(localUser.id);
        }

        // Create local user with server's ID and password (for offline access)
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);
        await db.createUserWithId(serverUser.id, data.email, passwordHash, serverUser.is_admin || false);
        
        console.log('✅ User synced from server to local cache');
      }

      // Create session with server's user data
      this.setSession(serverUser.id, serverUser);
      console.log('✅ Sign in successful (server-first):', serverUser.email);
      return serverUser;
    } catch (error) {
      console.warn('⚠️  Server authentication succeeded but local sync failed:', error);
      // Continue anyway - server has authenticated the user
      this.setSession(serverUser.id, serverUser);
      return serverUser;
    }
  }

  signOut(): void {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.SESSION_USER_KEY);
  }

  getCurrentUser(): User | null {
    const userJson = localStorage.getItem(this.SESSION_USER_KEY);
    if (!userJson) return null;

    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }

  getSession(): string | null {
    return localStorage.getItem(this.SESSION_KEY);
  }

  async getCurrentUserId(): Promise<string | null> {
    const session = this.getSession();
    if (!session) return null;

    // Verify session is still valid (user exists)
    try {
      const user = await db.getUserById(session);
      return user ? user.id : null;
    } catch {
      return null;
    }
  }

  private setSession(userId: string, user: User): void {
    localStorage.setItem(this.SESSION_KEY, userId);
    localStorage.setItem(this.SESSION_USER_KEY, JSON.stringify(user));
  }

  isAuthenticated(): boolean {
    return this.getSession() !== null && this.getCurrentUser() !== null;
  }
}

export const auth = new AuthService();



