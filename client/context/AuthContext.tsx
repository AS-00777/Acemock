import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../services/api";
import { clearToken, getToken, setToken } from "../services/storage";
import type { UserProfile } from "../types";

type BackendUser = { id: number; name: string; email: string; createdAt: string };

type AuthState = {
  ready: boolean;
  token: string | null;
  user: BackendUser | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfileExtras: (updates: Partial<UserProfile>) => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function toProfile(user: BackendUser, extras: Partial<UserProfile>): UserProfile {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    education: extras.education ?? "Academic Background",
    skills: extras.skills ?? [],
    yearsExperience: extras.yearsExperience ?? 0,
    streakCount: extras.streakCount ?? 1,
    badges: extras.badges ?? ["New Joiner"],
    lastInterviewDate: extras.lastInterviewDate,
    profileImage: extras.profileImage,
    resumeUrl: extras.resumeUrl,
    phoneNumber: extras.phoneNumber,
    countryCode: extras.countryCode,
    country: extras.country,
    city: extras.city,
    location: extras.location,
    bio: extras.bio,
    gender: extras.gender,
    experienceLevel: extras.experienceLevel,
    preferredLanguage: extras.preferredLanguage,
    defaultDifficulty: extras.defaultDifficulty,
    interviewMode: extras.interviewMode,
    theme: extras.theme ?? "Light",
    voicePreference: extras.voicePreference ?? "female",
    userType: extras.userType,
    educationLevel: extras.educationLevel,
    fieldOfStudy: extras.fieldOfStudy,
    industry: extras.industry,
    targetRole: extras.targetRole,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<BackendUser | null>(null);
  const [extras, setExtras] = useState<Partial<UserProfile>>({});

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    setExtras({});
    document.documentElement.classList.remove("dark");
  }, []);

  const refreshProfile = useCallback(async () => {
    const t = getToken();
    setTokenState(t);
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const resp = await api.get<{ user: BackendUser }>("/user/profile");
      setUser(resp.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      throw err;
    }
  }, [logout]);

  useEffect(() => {
    refreshProfile()
      .catch(() => {})
      .finally(() => setReady(true));
  }, [refreshProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      const resp = await api.post<{ token: string; user: BackendUser }>("/auth/login", { email, password });
      setToken(resp.token);
      setTokenState(resp.token);
      setUser(resp.user);
    },
    []
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const resp = await api.post<{ token: string; user: BackendUser }>("/auth/register", { name, email, password });
      setToken(resp.token);
      setTokenState(resp.token);
      setUser(resp.user);
    },
    []
  );

  const updateProfileExtras = useCallback((updates: Partial<UserProfile>) => {
    setExtras((prev) => ({ ...prev, ...updates }));
  }, []);

  const profile = useMemo(() => (user ? toProfile(user, extras) : null), [user, extras]);

  useEffect(() => {
    if (profile?.theme === "Dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [profile?.theme]);

  const value: AuthState = useMemo(
    () => ({
      ready,
      token,
      user,
      profile,
      login,
      register,
      logout,
      updateProfileExtras,
      refreshProfile,
    }),
    [ready, token, user, profile, login, register, logout, updateProfileExtras, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

