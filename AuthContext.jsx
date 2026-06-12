import React, { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [clinic, setClinic] = useState(() => {
    try {
      const stored = localStorage.getItem('acgs_clinic');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    const { clinic: c, token } = res.data.data;
    localStorage.setItem('acgs_token',  token);
    localStorage.setItem('acgs_clinic', JSON.stringify(c));
    setClinic(c);
    return c;
  }, []);

  const register = useCallback(async (data) => {
    const res = await authApi.register(data);
    const { clinic: c, token } = res.data.data;
    localStorage.setItem('acgs_token',  token);
    localStorage.setItem('acgs_clinic', JSON.stringify(c));
    setClinic(c);
    return c;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('acgs_token');
    localStorage.removeItem('acgs_clinic');
    setClinic(null);
  }, []);

  // Called after profile update to keep local clinic state in sync
  const refreshClinic = useCallback((updated) => {
    localStorage.setItem('acgs_clinic', JSON.stringify(updated));
    setClinic(updated);
  }, []);

  return (
    <AuthContext.Provider value={{ clinic, login, register, logout, refreshClinic, isLoggedIn: !!clinic }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
