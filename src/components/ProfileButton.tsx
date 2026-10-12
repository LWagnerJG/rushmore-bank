"use client";

import { memo } from "react";
import { BeanAvatar } from "@/components/BeanAvatar";
import { loadAvatarId } from "@/lib/avatar-prefs";

/**
 * Quiet top-right profile / settings trigger.
 * 44px tap target; mark sized to read next to the player rail.
 */
export const ProfileButton = memo(function ProfileButton({
  name,
  onClick,
  open = false,
  avatarId,
}: {
  name: string;
  onClick: () => void;
  open?: boolean;
  avatarId?: string | null;
}) {
  const id = avatarId ?? loadAvatarId();
  return (
    <button
      type="button"
      className="profile-btn"
      aria-label="Profile"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="profile-btn-mark" aria-hidden="true">
        <BeanAvatar id={id} seed={name || "bean"} size={36} priority />
      </span>
    </button>
  );
});
