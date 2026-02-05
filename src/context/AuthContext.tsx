import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types';
import { apiService } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('builderspace_token');
    if (token) {
      getCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const getCurrentUser = async () => {
    try {
      const response = await apiService.getCurrentUser();
      setUser(response.user);
    } catch (error) {
      console.error('Failed to get current user:', error);
      // Clear invalid token
      localStorage.removeItem('builderspace_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      const response = await apiService.login({ email, password });
      
      // Store token
      localStorage.setItem('builderspace_token', response.accessToken);
      setUser(response.user);
    } catch (error: any) {
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      const response = await apiService.signup({ name, email, password });
      
      // Store token
      localStorage.setItem('builderspace_token', response.accessToken);
      setUser(response.user);
    } catch (error: any) {
      setError(error.message || 'Signup failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (token: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      const response = await apiService.googleAuth(token);
      
      // Store token
      localStorage.setItem('builderspace_token', response.accessToken);
      setUser(response.user);
    } catch (error: any) {
      setError(error.message || 'Google login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('builderspace_token');
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      setError(null);
      const response = await apiService.updateProfile(userData);
      setUser(response.user);
    } catch (error: any) {
      setError(error.message || 'Profile update failed');
      throw error;
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        googleLogin,
        logout,
        updateUser,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
