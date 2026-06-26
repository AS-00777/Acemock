import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react";
import { api, ApiError, setAuthTokenGetter } from "../services/api";
import type { UserProfile } from "../types";

type BackendUser = UserProfile & { createdAt?: string };

type AuthState = {
  ready: boolean;
  token: string | null;
  user: BackendUser | null;
  profile: UserProfile | null;
  logout: () => void;
  updateProfileExtras: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const clerk = useClerk();
  const [profileLoading, setProfileLoading] = useState(false);
  const [user, setUser] = useState<BackendUser | null>(null);

  // Register Clerk's token getter before protected-page passive effects can
  // issue their first API request after a direct navigation or page refresh.
  useLayoutEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null);
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);

  const logout = useCallback(() => {
    setUser(null);
    document.documentElement.classList.remove("dark");
    void clerk.signOut();
  }, [clerk]);

  const refreshProfile = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      return;
    }

    setProfileLoading(true);
    try {
      const resp = await api.get<{ user: BackendUser }>("/user/profile");
      setUser(resp.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      throw err;
    } finally {
      setProfileLoading(false);
    }
  }, [isLoaded, isSignedIn, logout]);

  useEffect(() => {
    refreshProfile().catch(() => {});
  }, [refreshProfile]);

  const updateProfileExtras = useCallback(async (updates: Partial<UserProfile>) => {
    const resp = await api.put<{ user: BackendUser }>("/user/profile", updates);
    setUser(resp.user);
    return resp.user;
  }, []);

  const profile = user;

  useEffect(() => {
    if (profile?.theme === "Dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [profile?.theme]);

  const ready = isLoaded && !profileLoading;
  const token = isSignedIn ? "clerk-session" : null;

  const value: AuthState = useMemo(
    () => ({
      ready,
      token,
      user,
      profile,
      logout,
      updateProfileExtras,
      refreshProfile,
    }),
    [ready, token, user, profile, logout, updateProfileExtras, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
