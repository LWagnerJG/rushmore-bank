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
  const gestureIds = useRef(new Map<string, string>());
  const phaseRevisionRef = useRef(0);

  const setError = useCallback((msg: string | null) => {
    setErrorRaw(friendlyPlayerError(msg));
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
    // Snappier resume after brief leaves / backgrounding.
    minReconnectionDelay: 400,
    maxReconnectionDelay: 6_000,
    reconnectionDelayGrowFactor: 1.35,
    connectionTimeout: 3_500,
    maxRetries: Infinity,
    onOpen() {
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
      // Partysocket auto-reconnects — show soft status via `connected`, not a hard error.
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
    if (now - lastForceReconnectAt.current < 750) return;
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
    [socket, seatContested],
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
