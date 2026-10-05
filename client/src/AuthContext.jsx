import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const data = await api('/auth/me');
      setUser(data.user);
      setProfile(data.profile);
    } catch {
      setToken(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token);
        fetchMe();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setToken(session.access_token);
        (async () => { await fetchMe(); })();
      } else {
        setToken(null);
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchMe]);

  const logout = async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  const refresh = () => fetchMe();

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
