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
    // Check if user already exists locally
    const existingUser = await db.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // Create user locally first
    let userId = await db.createUser(data.email, passwordHash);

    // Try to create user on server if API is configured
    const apiService = (await import('./api')).apiService;
    if (apiService.isConfigured()) {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password }),
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Use server's user ID to keep them in sync
            const serverUserId = result.data.id;
            if (serverUserId !== userId) {
              // Update local user to use server ID
              // Delete old user and create with server ID
              await db.deleteUser(userId);
              userId = await db.createUserWithId(serverUserId, data.email, passwordHash, false);
            }
            console.log('User created on server with ID:', serverUserId);
          }
        } else {
          console.warn('Failed to create user on server, but user created locally');
        }
      } catch (error) {
        console.warn('Could not create user on server:', error);
        // Continue anyway - user is created locally
      }
    }

    // Create session
    const user = { id: userId, email: data.email, is_admin: false };
    this.setSession(userId, user);

    return user;
  }

  async signIn(data: SignInData): Promise<User> {
    try {
      // Ensure database is initialized
      await db.ensureInitialized();
      
      // Try server first if API is configured
      const apiService = (await import('./api')).apiService;
      if (apiService.isConfigured()) {
        try {
          const response = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.email, password: data.password }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const serverUser = result.data;
              
              // Check if user exists locally, if not create them
              let localUser = await db.getUserByEmail(data.email);
              if (!localUser) {
                // User exists on server but not locally - create local user
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(data.password, salt);
                // Use server's user ID
                await db.createUserWithId(serverUser.id, data.email, passwordHash, serverUser.is_admin);
                localUser = await db.getUserByEmail(data.email);
              }

              // Verify password matches locally for offline access
              const isValid = await bcrypt.compare(data.password, localUser!.password_hash);
              if (!isValid) {
                // Update local password hash to match server
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(data.password, salt);
                // Update would require a method in database.ts - for now, just use server auth
              }

              const userData = { id: serverUser.id, email: serverUser.email, is_admin: serverUser.is_admin };
              this.setSession(serverUser.id, userData);
              console.log('Sign in successful (server) for user:', serverUser.email);
              return userData;
            }
          }
        } catch (error) {
          console.warn('Server signin failed, trying local:', error);
          // Fall through to local auth
        }
      }
      
      // Fallback to local authentication
      const user = await db.getUserByEmail(data.email);
      if (!user) {
        console.error('Sign in failed: User not found for email:', data.email);
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isValid = await bcrypt.compare(data.password, user.password_hash);
      if (!isValid) {
        console.error('Sign in failed: Password mismatch for email:', data.email);
        throw new Error('Invalid email or password');
      }

      // If server is available but user doesn't exist there, try to sync them
      if (apiService.isConfigured()) {
        try {
          const isHealthy = await apiService.healthCheck();
          if (isHealthy) {
            // Try to create user on server with same credentials
            const signupResponse = await fetch('/api/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: data.email, password: data.password }),
            });
            
            if (signupResponse.ok) {
              const signupResult = await signupResponse.json();
              if (signupResult.success && signupResult.data) {
                // Update local user to use server's ID
                const serverUserId = signupResult.data.id;
                if (serverUserId !== user.id) {
                  await db.deleteUser(user.id);
                  const salt = await bcrypt.genSalt(10);
                  const passwordHash = await bcrypt.hash(data.password, salt);
                  await db.createUserWithId(serverUserId, data.email, passwordHash, false);
                  console.log('✅ User created on server and synced');
                  const userData = { id: serverUserId, email: user.email, is_admin: false };
                  this.setSession(serverUserId, userData);
                  return userData;
                }
              }
            } else if (signupResponse.status === 400) {
              // User might already exist on server - try signin instead
              const signinResponse = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: data.email, password: data.password }),
              });
              
              if (signinResponse.ok) {
                const signinResult = await signinResponse.json();
                if (signinResult.success && signinResult.data) {
                  // Server user exists - sync IDs
                  const serverUserId = signinResult.data.id;
                  if (serverUserId !== user.id) {
                    await db.deleteUser(user.id);
                    const salt = await bcrypt.genSalt(10);
                    const passwordHash = await bcrypt.hash(data.password, salt);
                    await db.createUserWithId(serverUserId, data.email, passwordHash, signinResult.data.is_admin || false);
                    console.log('✅ User synced with server');
                    const userData = { id: serverUserId, email: user.email, is_admin: signinResult.data.is_admin || false };
                    this.setSession(serverUserId, userData);
                    return userData;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn('Could not sync user with server, using local only:', error);
          // Continue with local auth anyway
        }
      }

      // Create session
      const userData = { id: user.id, email: user.email, is_admin: user.is_admin };
      this.setSession(user.id, userData);

      console.log('Sign in successful (local) for user:', user.email);
      return userData;
    } catch (error) {
      console.error('Sign in error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An error occurred during sign in');
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



