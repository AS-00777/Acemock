import { clerkClient } from "@clerk/express";
import type { RowDataPacket } from "mysql2/promise";
import { exec, query } from "../config/db";

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  clerk_id: string | null;
  auth_provider: string | null;
  created_at: Date;
  deleted_at: Date | null;
};

type UserProfileRow = RowDataPacket & {
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  country_code: string | null;
  gender: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  user_type: string | null;
  education_level: string | null;
  field_of_study: string | null;
  industry: string | null;
  years_experience: number | null;
  target_role: string | null;
  experience_level: string | null;
  preferred_language: string | null;
  default_difficulty: string | null;
  skills: string | null;
  voice_preference: string | null;
  theme: string | null;
  profile_image: string | null;
};

export type UserProfilePayload = {
  name?: string;
  phoneNumber?: string;
  countryCode?: string;
  gender?: string;
  country?: string;
  city?: string;
  bio?: string;
  userType?: string;
  educationLevel?: string;
  fieldOfStudy?: string;
  industry?: string;
  yearsExperience?: number;
  targetRole?: string;
  experienceLevel?: string;
  preferredLanguage?: string;
  defaultDifficulty?: string;
  skills?: string[];
  voicePreference?: string;
  theme?: string;
  profileImage?: string;
};

const emptyProfile = {
  phoneNumber: "",
  countryCode: "",
  gender: "",
  country: "",
  city: "",
  bio: "",
  userType: undefined,
  educationLevel: "",
  fieldOfStudy: "",
  industry: "",
  yearsExperience: 0,
  targetRole: "",
  experienceLevel: "",
  preferredLanguage: "",
  defaultDifficulty: "",
  skills: [] as string[],
  voicePreference: undefined,
  theme: "Light",
  profileImage: "",
};

function buildName(clerkUser: any, fallbackEmail: string, clerkUserId: string) {
  const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (clerkUser?.username) return String(clerkUser.username);
  if (fallbackEmail) return fallbackEmail.split("@")[0];
  return clerkUserId;
}

function buildEmail(clerkUser: any, clerkUserId: string) {
  const primaryEmailId = clerkUser?.primaryEmailAddressId;
  const primaryEmail =
    clerkUser?.emailAddresses?.find((email: any) => email.id === primaryEmailId)?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress;
  return String(primaryEmail || `${clerkUserId}@clerk.local`).toLowerCase();
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
  };
}

function parseSkills(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((skill) => typeof skill === "string") : [];
  } catch {
    return [];
  }
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeSkills(skills: unknown) {
  if (!Array.isArray(skills)) return [];
  const seen = new Set<string>();
  return skills
    .filter((skill): skill is string => typeof skill === "string")
    .map((skill) => skill.trim())
    .filter(Boolean)
    .filter((skill) => {
      const key = skill.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mapFullProfile(user: UserRow, profile?: UserProfileRow) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
    education: "Academic Background",
    streakCount: 1,
    badges: ["New Joiner"],
    ...emptyProfile,
    phoneNumber: profile?.phone_number ?? emptyProfile.phoneNumber,
    countryCode: profile?.country_code ?? emptyProfile.countryCode,
    gender: profile?.gender ?? emptyProfile.gender,
    country: profile?.country ?? emptyProfile.country,
    city: profile?.city ?? emptyProfile.city,
    location: [profile?.city, profile?.country].filter(Boolean).join(", "),
    bio: profile?.bio ?? emptyProfile.bio,
    userType: profile?.user_type ?? emptyProfile.userType,
    educationLevel: profile?.education_level ?? emptyProfile.educationLevel,
    fieldOfStudy: profile?.field_of_study ?? emptyProfile.fieldOfStudy,
    industry: profile?.industry ?? emptyProfile.industry,
    yearsExperience: Number(profile?.years_experience ?? emptyProfile.yearsExperience),
    targetRole: profile?.target_role ?? emptyProfile.targetRole,
    experienceLevel: profile?.experience_level ?? emptyProfile.experienceLevel,
    preferredLanguage: profile?.preferred_language ?? emptyProfile.preferredLanguage,
    defaultDifficulty: profile?.default_difficulty ?? emptyProfile.defaultDifficulty,
    skills: parseSkills(profile?.skills ?? null),
    voicePreference: profile?.voice_preference ?? emptyProfile.voicePreference,
    theme: profile?.theme ?? emptyProfile.theme,
    profileImage: profile?.profile_image ?? emptyProfile.profileImage,
  };
}

export async function findOrCreateUserFromClerk(clerkUserId: string) {
  const byClerkId = await query<UserRow[]>(
    "SELECT id, name, email, clerk_id, auth_provider, created_at, deleted_at FROM users WHERE clerk_id = ? AND deleted_at IS NULL LIMIT 1",
    [clerkUserId]
  );

  if (byClerkId[0]) return mapUser(byClerkId[0]);

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email = buildEmail(clerkUser, clerkUserId);
  const name = buildName(clerkUser, email, clerkUserId);

  const byEmail = await query<UserRow[]>(
    "SELECT id, name, email, clerk_id, auth_provider, created_at, deleted_at FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1",
    [email]
  );

  if (byEmail[0]) {
    await exec(
      "UPDATE users SET clerk_id = ?, auth_provider = 'clerk', name = ?, email = ? WHERE id = ?",
      [clerkUserId, name, email, byEmail[0].id]
    );
    return {
      id: byEmail[0].id,
      email,
      name,
    };
  }

  const insert = await exec(
    "INSERT INTO users (name, email, password, clerk_id, auth_provider, created_at) VALUES (?, ?, NULL, ?, 'clerk', NOW())",
    [name, email, clerkUserId]
  );

  return {
    id: insert.insertId,
    email,
    name,
  };
}

export async function getUserProfile(userId: number) {
  const users = await query<UserRow[]>(
    "SELECT id, name, email, clerk_id, auth_provider, created_at, deleted_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );

  const user = users[0];
  if (!user || user.deleted_at) return null;

  const profiles = await query<UserProfileRow[]>(
    `SELECT full_name, email, phone_number, country_code, gender, country, city, bio, user_type,
      education_level, field_of_study, industry, years_experience, target_role,
      experience_level, preferred_language, default_difficulty, skills,
      voice_preference, theme, profile_image
     FROM user_profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  return mapFullProfile(user, profiles[0]);
}

export async function updateUserProfile(userId: number, payload: UserProfilePayload) {
  const name = cleanString(payload.name);
  if (name) {
    await exec("UPDATE users SET name = ? WHERE id = ?", [name, userId]);
  }

  const users = await query<UserRow[]>(
    "SELECT id, name, email, clerk_id, auth_provider, created_at, deleted_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const user = users[0];
  if (!user || user.deleted_at) return null;

  const skills = normalizeSkills(payload.skills);

  await exec(
    `INSERT INTO user_profiles (
      user_id, full_name, email, phone_number, country_code, gender, country, city, bio, user_type,
      education_level, field_of_study, industry, years_experience, target_role,
      experience_level, preferred_language, default_difficulty, skills,
      voice_preference, theme, profile_image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      email = VALUES(email),
      phone_number = VALUES(phone_number),
      country_code = VALUES(country_code),
      gender = VALUES(gender),
      country = VALUES(country),
      city = VALUES(city),
      bio = VALUES(bio),
      user_type = VALUES(user_type),
      education_level = VALUES(education_level),
      field_of_study = VALUES(field_of_study),
      industry = VALUES(industry),
      years_experience = VALUES(years_experience),
      target_role = VALUES(target_role),
      experience_level = VALUES(experience_level),
      preferred_language = VALUES(preferred_language),
      default_difficulty = VALUES(default_difficulty),
      skills = VALUES(skills),
      voice_preference = VALUES(voice_preference),
      theme = VALUES(theme),
      profile_image = VALUES(profile_image)`,
    [
      userId,
      user.name,
      user.email,
      cleanString(payload.phoneNumber),
      cleanString(payload.countryCode),
      cleanString(payload.gender),
      cleanString(payload.country),
      cleanString(payload.city),
      cleanString(payload.bio),
      cleanString(payload.userType),
      cleanString(payload.educationLevel),
      cleanString(payload.fieldOfStudy),
      cleanString(payload.industry),
      Number(payload.yearsExperience ?? 0),
      cleanString(payload.targetRole),
      cleanString(payload.experienceLevel),
      cleanString(payload.preferredLanguage),
      cleanString(payload.defaultDifficulty),
      JSON.stringify(skills),
      cleanString(payload.voicePreference),
      cleanString(payload.theme) || "Light",
      cleanString(payload.profileImage),
    ]
  );

  return getUserProfile(userId);
}
