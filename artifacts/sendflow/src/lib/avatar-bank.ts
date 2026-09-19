import avatarAmina from '@assets/generated_images/sendflow-avatar-amina.png';
import avatarFatou from '@assets/generated_images/sendflow-avatar-fatou.png';
import avatarIbrahima from '@assets/generated_images/sendflow-avatar-ibrahima.png';
import avatarKofi from '@assets/generated_images/sendflow-avatar-kofi.png';
import avatarNadia from '@assets/generated_images/sendflow-avatar-nadia.png';
import avatarOusmane from '@assets/generated_images/sendflow-avatar-ousmane.png';
import avatarSalma from '@assets/generated_images/sendflow-avatar-salma.png';
import avatarYannick from '@assets/generated_images/sendflow-avatar-yannick.png';

export type AvatarAsset = {
  id: string;
  src: string;
  label: string;
};

export const AVATAR_USER_KEY = 'sendflow.avatar.user-key';
const AVATAR_ASSIGNMENTS_KEY = 'sendflow.avatar.assignments';

export const avatarBank: AvatarAsset[] = [
  { id: 'amina', src: avatarAmina, label: 'Avatar Amina' },
  { id: 'fatou', src: avatarFatou, label: 'Avatar Fatou' },
  { id: 'ibrahima', src: avatarIbrahima, label: 'Avatar Ibrahima' },
  { id: 'kofi', src: avatarKofi, label: 'Avatar Kofi' },
  { id: 'nadia', src: avatarNadia, label: 'Avatar Nadia' },
  { id: 'ousmane', src: avatarOusmane, label: 'Avatar Ousmane' },
  { id: 'salma', src: avatarSalma, label: 'Avatar Salma' },
  { id: 'yannick', src: avatarYannick, label: 'Avatar Yannick' },
];

function normalizeUserKey(userKey: string) {
  return userKey.trim().toLowerCase() || 'anonymous';
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readAssignments(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const stored = window.localStorage.getItem(AVATAR_ASSIGNMENTS_KEY);
  if (!stored) return {};

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => typeof key === 'string' && typeof value === 'string',
      ),
    );
  } catch {
    window.localStorage.removeItem(AVATAR_ASSIGNMENTS_KEY);
    return {};
  }
}

function saveAssignments(assignments: Record<string, string>) {
  try {
    window.localStorage.setItem(AVATAR_ASSIGNMENTS_KEY, JSON.stringify(assignments));
  } catch {
    // A private browsing quota failure should not block the profile page.
  }
}

export function getAvatarForUser(userKey: string): AvatarAsset {
  const normalizedKey = normalizeUserKey(userKey);
  const assignments = readAssignments();
  const assignedId = assignments[normalizedKey];
  const assignedAvatar = avatarBank.find((avatar) => avatar.id === assignedId);

  if (assignedAvatar) return assignedAvatar;

  const usedIds = new Set(Object.values(assignments));
  const availableAvatars = avatarBank.filter((avatar) => !usedIds.has(avatar.id));
  const candidatePool = availableAvatars.length > 0 ? availableAvatars : avatarBank;
  const selectedAvatar = candidatePool[stableHash(normalizedKey) % candidatePool.length];

  assignments[normalizedKey] = selectedAvatar.id;
  saveAssignments(assignments);

  return selectedAvatar;
}

export function getCurrentAvatarUserKey(profile?: {
  firstName: string;
  lastName: string;
}) {
  if (typeof window !== 'undefined') {
    const storedUserKey = window.sessionStorage.getItem(AVATAR_USER_KEY);
    if (storedUserKey) return storedUserKey;
  }

  const profileKey = `${profile?.firstName ?? ''}:${profile?.lastName ?? ''}`;
  return `profile:${normalizeUserKey(profileKey)}`;
}