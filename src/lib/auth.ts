import bcrypt from 'bcryptjs';
import { db } from './database';

export interface User {
  id: string;
  email: string;
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
    // Check if user already exists
    const existingUser = await db.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // Create user
    const userId = await db.createUser(data.email, passwordHash);

    // Create session
    const user = { id: userId, email: data.email };
    this.setSession(userId, user);

    return user;
  }

  async signIn(data: SignInData): Promise<User> {
    const user = await db.getUserByEmail(data.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Create session
    const userData = { id: user.id, email: user.email };
    this.setSession(user.id, userData);

    return userData;
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



