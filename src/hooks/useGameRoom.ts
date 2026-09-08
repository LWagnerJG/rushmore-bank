"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import type {
  ClientMessage,
  PublicRoomState,
  ServerMessage,
} from "@/shared/types";
import {
  getPartyHost,
  getStablePlayerId,
  newActionId,
  recallDisplayName,
  rememberDisplayName,
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
    return "Connection lost — retrying";
  }
  if (/parse|server message|bad message/i.test(text)) {
    return "Something went wrong — try again";
  }
  if (/server error/i.test(text)) {
    return "Something went wrong — try again";
  }
  return text;
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
  const playerId = useMemo(() => getStablePlayerId(code), [code]);
  const pendingJoin = useRef<{
    name: string;
    role: "player" | "spectator";
  } | null>(null);

  const setError = useCallback((msg: string | null) => {
    setErrorRaw(friendlyPlayerError(msg));
  }, []);

  // Prefer URL/preset nickname for onOpen join — never auto-queue from shared
  // localStorage alone (that made tab B join as Luke when ?name=Brynna).
  useEffect(() => {
    if (preferredName) {
      pendingJoin.current = {
        name: preferredName,
        role: preferSpectate ? "spectator" : "player",
      };
    }
  }, [preferredName, preferSpectate]);

  const socket = usePartySocket({
    host: getPartyHost(),
    room: code,
    id: playerId,
    onOpen() {
      setConnected(true);
      setErrorRaw(null);
      if (pendingJoin.current) {
        socket.send(
          JSON.stringify({
            type: "join",
            name: pendingJoin.current.name,
            role: pendingJoin.current.role,
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
      setErrorRaw("Connection lost — retrying");
    },
    onMessage(event) {
      try {
        const msg = JSON.parse(String(event.data)) as ServerMessage;
        if (msg.type === "state" || msg.type === "joined") {
          setState(msg.state);
          setYouId(msg.youId);
          const me = msg.state.players.find((p) => p.id === msg.youId);
          if (me) setJoined(true);
        } else if (msg.type === "error") {
          setError(msg.message);
        }
      } catch {
        setErrorRaw("Something went wrong — try again");
      }
    },
  });

  const send = useCallback(
    (msg: ClientMessage) => {
      setErrorRaw(null);
      const withId = {
        ...msg,
        actionId: msg.actionId ?? newActionId(),
      };
      socket.send(JSON.stringify(withId));
    },
    [socket],
  );

  const join = useCallback(
    (name: string, role: "player" | "spectator" = "player") => {
      const clean = name.trim();
      if (!clean) {
        setErrorRaw("Enter a nickname");
        return;
      }
      rememberDisplayName(clean);
      pendingJoin.current = { name: clean, role };
      if (socket.readyState === WebSocket.OPEN) {
        send({ type: "join", name: clean, role });
      }
    },
    [send, socket],
  );

  // Host heartbeat for failover
  useEffect(() => {
    const you = state?.players.find((p) => p.id === youId);
    if (!you?.isHost || !connected) return;
    const t = setInterval(() => {
      send({ type: "host_heartbeat" });
    }, 8000);
    return () => clearInterval(t);
  }, [state?.players, youId, connected, send]);

  const you = state?.players.find((p) => p.id === youId) ?? null;

  return {
    state,
    youId,
    you,
    error,
    setError,
    connected,
    joined,
    join,
    send,
    defaultName: recallDisplayName(),
  };
}
