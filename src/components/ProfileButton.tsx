"use client";

import { profileInitials } from "@/lib/profile-initials";

/**
 * Quiet top-right profile / settings trigger.
 * 44px tap target; visual mark stays small.
 */
export function ProfileButton({
  name,
  onClick,
  open = false,
}: {
  name: string;
  onClick: () => void;
  open?: boolean;
}) {
  const initials = profileInitials(name || "?");
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
        {initials}
      </span>
    </button>
  );
}
