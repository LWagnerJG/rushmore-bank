/**
 * Local avatar preference (no accounts). Default is hashed from device id.
 */

import { getStableClientId } from "@/lib/client-id";
import {
  avatarIdFromSeed,
  isBeanAvatarId,
  type BeanAvatarId,
} from "@/shared/bean-avatars";

const KEY = "quarry:avatar-id";

export function loadAvatarId(deviceId = getStableClientId()): BeanAvatarId {
  if (typeof window === "undefined") return avatarIdFromSeed(deviceId);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (isBeanAvatarId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return avatarIdFromSeed(deviceId);
}

export function saveAvatarId(id: BeanAvatarId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
