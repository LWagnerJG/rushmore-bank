"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import type {
  ClientMessage,
  PublicRoomState,
  ServerMessage,
} from "@/shared/types";
import {
  acquireSeatLock,
  allowRoomRejoin,
  getPartyHost,
  getStablePlayerId,
  markRoomRemoved,
  newActionId,
  recallDisplayName,
  recallRoomSession,
  rememberDisplayName,
  rememberRoomSession,
  wasRemovedFromRoom,
} from "@/lib/party";

/** Map infra / transport failures to player-safe copy. Never mention PartyKit. */
function friendlyPlayerError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  if (
    /partykit|websocket|web socket|\bws\b|ECONN|ENOTFOUND|fetch failed|networkerror|socket|stack trace|TypeError|at\s+\S+\s+\(/i.test(
      text,
    )
  ) {
    return "Reconnecting…";
  }
  if (/parse|server message|bad message/i.test(text)) {
    return "Something went wrong — try again";
  }
  if (/server error/i.test(text)) {
    return "Something went wrong — try again";
  }
  return text;
}

/**
 * Errors that are usually leftover from a double-tap / turn race after the
 * room already advanced (server may still reject a second distinct actionId).
 * Suppress briefly after a phaseRevision bump so the toast stays quiet.
 */
export function isBenignRaceError(message: string | null | undefined): boolean {
  if (!message) return false;
  switch (message.trim()) {
    case "Not your turn":
    case "Wrong phase":
    case "Slot already filled":
    case "Not drafting":
    case "Already started":
    case "Game over — play again":
    case "Roster full":
      return true;
    default:
      return false;
  }
}

/** How long after a revision bump we swallow race leftovers. */
export const RACE_ERROR_SUPPRESS_MS = 1000;

/** Stable key so double-taps reuse one actionId until the phase advances. */
export function gestureKeyFor(
  msg: ClientMessage,
  phaseRevision: number,
): string {
  const rev = phaseRevision;
  switch (msg.type) {
    case "start":
    case "spin_topics":
    case "majority_reroll":
    case "skip_review":
    case "bank_the_beans":
    case "next_topic":
    case "play_again":
    case "end_game":
    case "advance":
    case "host_pause":
    case "host_resume":
    case "host_extend":
    case "roll":
    case "pull_out":
    case "bank_confirm_open":
    case "bank_confirm_cancel":
      return `${msg.type}:${rev}`;
    case "vote_topic":
      return `vote_topic:${rev}:${msg.topicId}`;
    case "lock_in":
      return `lock_in:${rev}:${msg.text}`;
    case "submit_vote":
      return `submit_vote:${rev}:${msg.targetPlayerId}`;
    case "submit_wager":
      return `submit_wager:${rev}:${msg.amount}`;
    case "party_resolve":
      return `party_resolve:${rev}:${msg.choice}`;
    case "join":
      return `join:${msg.name}:${msg.role ?? "player"}`;
    case "admin_spawn_bots":
      return `admin_spawn_bots:${rev}:${msg.count}`;
    case "admin_jump_phase":
      return `admin_jump_phase:${rev}:${msg.phase}`;
    default:
      return `${msg.type}:${rev}`;
  }
}

export function useGameRoom(
  roomCode: string,
  options?: { preferredName?: string; preferSpectate?: boolean },
) {
  const code = roomCode.toUpperCase();
  const preferredName = options?.preferredName?.trim() ?? "";
  const preferSpectate = options?.preferSpectate ?? false;
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [youId, setYouId] = useState<string>("");
  const [error, setErrorRaw] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [seatContested, setSeatContested] = useState(false);
  const seatContestedRef = useRef(false);
  const removedRef = useRef(wasRemovedFromRoom(code));
  const playerId = useMemo(() => getStablePlayerId(code), [code]);
  const pendingJoin = useRef<{
    name: string;
    role: "player" | "spectator";
  } | null>(null);
  const membershipRef = useRef<{
    name: string;
    role: "player" | "spectator";
  } | null>(null);
  const lastForceReconnectAt = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureIds = useRef(new Map<string, string>());
  const phaseRevisionRef = useRef(0);
  const suppressRaceUntilRef = useRef(0);

  const setError = useCallback((msg: string | null) => {
    const next = friendlyPlayerError(msg);
    if (
      next &&
      isBenignRaceError(next) &&
      Date.now() < suppressRaceUntilRef.current
    ) {
      return;
    }
    setErrorRaw((prev) => {
      // Dedupe identical copy while the toast is still up.
      if (next && prev === next) return prev;
      return next;
    });
  }, []);

  // Prefer URL/preset nickname for onOpen join — never auto-queue from shared
  // localStorage alone (that made tab B join as Luke when ?name=Brynna).
  // If no preset, restore a fresh room session so app-switch returns auto-rejoin.
  useEffect(() => {
    if (removedRef.current || wasRemovedFromRoom(code)) {
      removedRef.current = true;
      setRemoved(true);
      return;
    }
    if (preferredName) {
      pendingJoin.current = {
        name: preferredName,
        role: preferSpectate ? "spectator" : "player",
      };
      return;
    }
    const session = recallRoomSession(code);
    if (!session) return;
    pendingJoin.current = {
      name: session.name,
      role: preferSpectate ? "spectator" : session.role,
    };
    membershipRef.current = pendingJoin.current;
  }, [preferredName, preferSpectate, code]);

  // Multi-tab seat lock — another tab with the same playerId wins the war.
  useEffect(() => {
    if (removedRef.current) return;
    const lock = acquireSeatLock(code, playerId, () => {
      seatContestedRef.current = true;
      setSeatContested(true);
      setErrorRaw("This seat is open in another tab — use that tab or Rejoin.");
    });
    return () => lock.release();
  }, [code, playerId]);

  const socket = usePartySocket({
    host: getPartyHost(),
    room: code,
    id: playerId,
    // Fast retry with capped backoff — target recover within ~2s on brief flaps.
    minReconnectionDelay: 150,
    maxReconnectionDelay: 2_000,
    reconnectionDelayGrowFactor: 1.45,
    connectionTimeout: 2_500,
    maxRetries: Infinity,
    onOpen() {
      reconnectAttemptRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setConnected(true);
      setErrorRaw(null);
      if (removedRef.current || seatContestedRef.current) return;
      const resume = pendingJoin.current ?? membershipRef.current;
      if (resume) {
        pendingJoin.current = resume;
        socket.send(
          JSON.stringify({
            type: "join",
            name: resume.name,
            role: resume.role,
            actionId: newActionId(),
          } satisfies ClientMessage),
        );
      }
    },
    onClose() {
      setConnected(false);
      setErrorRaw("Reconnecting…");
      // Kick an explicit reconnect in parallel with PartySocket's auto-retry.
      const attempt = reconnectAttemptRef.current;
      reconnectAttemptRef.current = attempt + 1;
      const delay = Math.min(1_500, Math.round(120 * Math.pow(1.6, attempt)));
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        const now = Date.now();
        if (now - lastForceReconnectAt.current < 180) return;
        lastForceReconnectAt.current = now;
        try {
          socket.reconnect();
        } catch {
          /* ignore */
        }
      }, delay);
    },
    onError() {
      setErrorRaw("Reconnecting…");
    },
    onMessage(event) {
      try {
        const msg = JSON.parse(String(event.data)) as ServerMessage;
        if (msg.type === "state" || msg.type === "joined") {
          setState(msg.state);
          setYouId(msg.youId);
          if (msg.state.phaseRevision !== phaseRevisionRef.current) {
            phaseRevisionRef.current = msg.state.phaseRevision;
            gestureIds.current.clear();
            // Swallow double-tap race rejects that land right after a success.
            suppressRaceUntilRef.current = Date.now() + RACE_ERROR_SUPPRESS_MS;
          }
          if (removedRef.current) return;
          const me = msg.state.players.find((p) => p.id === msg.youId);
          if (me) {
            setJoined(true);
            const role = me.role === "spectator" ? "spectator" : "player";
            membershipRef.current = { name: me.name, role };
            pendingJoin.current = { name: me.name, role };
            rememberRoomSession({
              code,
              name: me.name,
              role,
              playerId: msg.youId,
              at: Date.now(),
            });
          }
        } else if (msg.type === "error") {
          // The text check also works with servers deployed before the code field.
          if (
            msg.code === "REMOVED_FROM_LOBBY" ||
            /^You were removed from the lobby\b/.test(msg.message)
          ) {
            removedRef.current = true;
            pendingJoin.current = null;
            membershipRef.current = null;
            setRemoved(true);
            setJoined(false);
            setState(null);
            markRoomRemoved(code, playerId);
          }
          setError(msg.message);
        }
      } catch {
        setErrorRaw("Something went wrong — try again");
      }
    },
  });

  const forceReconnect = useCallback(() => {
    const now = Date.now();
    if (now - lastForceReconnectAt.current < 180) return;
    lastForceReconnectAt.current = now;
    try {
      socket.reconnect();
    } catch {
      /* ignore */
    }
  }, [socket]);

  // Always force-reconnect on resume — iOS can leave readyState OPEN on a dead socket.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      forceReconnect();
    };
    const onOnline = () => {
      forceReconnect();
    };
    const onPageShow = () => {
      forceReconnect();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [forceReconnect]);

  const send = useCallback(
    (msg: ClientMessage) => {
      if (seatContested) {
        setErrorRaw("This seat is open in another tab — use that tab or Rejoin.");
        return;
      }
      if (socket.readyState !== WebSocket.OPEN) {
        setErrorRaw("Reconnecting…");
        forceReconnect();
        return;
      }
      setErrorRaw(null);
      const key = gestureKeyFor(msg, phaseRevisionRef.current);
      let actionId = msg.actionId;
      if (!actionId) {
        actionId = gestureIds.current.get(key) ?? newActionId();
        gestureIds.current.set(key, actionId);
      }
      const withId = { ...msg, actionId };
      socket.send(JSON.stringify(withId));
    },
    [socket, seatContested, forceReconnect],
  );

  const join = useCallback(
    (name: string, role: "player" | "spectator" = "player") => {
      const clean = name.trim();
      if (!clean) {
        setErrorRaw("Enter a nickname");
        return;
      }
      if (seatContested) {
        setErrorRaw("This seat is open in another tab — use that tab or Rejoin.");
        return;
      }
      allowRoomRejoin(code);
      removedRef.current = false;
      setRemoved(false);
      rememberDisplayName(clean);
      pendingJoin.current = { name: clean, role };
      membershipRef.current = { name: clean, role };
      rememberRoomSession({
        code,
        name: clean,
        role,
        playerId,
        at: Date.now(),
      });
      if (socket.readyState === WebSocket.OPEN) {
        send({ type: "join", name: clean, role });
      } else {
        forceReconnect();
      }
    },
    [send, socket, code, playerId, forceReconnect, seatContested],
  );

  // Host heartbeat for failover
  useEffect(() => {
    const you = state?.players.find((p) => p.id === youId);
    if (!you?.isHost || !connected || removed) return;
    const t = setInterval(() => {
      send({ type: "host_heartbeat" });
    }, 8000);
    return () => clearInterval(t);
  }, [state?.players, youId, connected, removed, send]);

  const you = state?.players.find((p) => p.id === youId) ?? null;

  return {
    state,
    youId,
    you,
    error,
    setError,
    connected,
    joined,
    removed,
    seatContested,
    join,
    send,
    defaultName: recallDisplayName(),
    forceReconnect,
  };
}
