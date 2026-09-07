"use client";

import { useEffect, useState } from "react";
import { loadIdeas, saveIdeas } from "@/lib/party";
import { normalizePick } from "@/shared/types";

/** Local only: these notes never enter room state or the judge request. */
export function IdeasPanel({ room, playerId, topicId, taken = [], onUse }: {
  room: string;
  playerId: string;
  topicId: string;
  taken?: string[];
  onUse?: (idea: string) => void;
}) {
  const [ideas, setIdeas] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIdeas(loadIdeas(room, playerId, topicId)), 0);
    return () => clearTimeout(timer);
  }, [room, playerId, topicId]);

  function persist(next: string[]) {
    setIdeas(next);
    try {
      saveIdeas(room, playerId, topicId, next);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }

  function add() {
    const clean = draft.trim().slice(0, 48);
    if (!clean || ideas.length >= 40) return;
    if (!ideas.some((idea) => normalizePick(idea) === normalizePick(clean))) persist([...ideas, clean]);
    setDraft("");
  }

  return <section className="panel space-y-3 text-left">
    <div className="flex items-center justify-between"><h3 className="font-extrabold">My ideas</h3><span className="text-xs text-[var(--muted)]">Only you</span></div>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <input className="field min-w-0 flex-1" aria-label="Private idea" placeholder="Keep a pick in mind" maxLength={48} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button type="submit" className="btn-secondary" disabled={!draft.trim() || ideas.length >= 40}>Save</button>
    </form>
    {ideas.length > 0 && <ul className="space-y-2">{ideas.map((idea) => {
      const unavailable = taken.includes(normalizePick(idea));
      return <li key={idea} className="flex items-center gap-2 text-sm">
        <span className={`min-w-0 flex-1 break-words ${unavailable ? "line-through opacity-50" : ""}`}>{idea}{unavailable ? " · taken" : ""}</span>
        {onUse && <button type="button" className="min-h-11 px-2 font-bold" disabled={unavailable} onClick={() => onUse(idea)}>Use</button>}
        <button type="button" className="min-h-11 px-2 text-[var(--muted)]" aria-label={`Remove idea: ${idea}`} onClick={() => persist(ideas.filter((item) => item !== idea))}>×</button>
      </li>;
    })}</ul>}
    {saveFailed && <p className="text-xs" role="status">These ideas will be lost if you reload.</p>}
  </section>;
}
