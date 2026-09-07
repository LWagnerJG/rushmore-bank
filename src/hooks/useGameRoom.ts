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

export function useGameRoom(roomCode: string) {
  const code = roomCode.toUpperCase();
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [youId, setYouId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const playerId = useMemo(() => getStablePlayerId(code), [code]);
  const pendingJoin = useRef<{ name: string; role: "player" | "spectator" } | null>(
    null,
  );

  const socket = usePartySocket({
    host: getPartyHost(),
    room: code,
    id: playerId,
    onOpen() {
      setConnected(true);
      setError(null);
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
    },
    onError() {
      setError("Connection error — is PartyKit running?");
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
        setError("Could not parse server message");
      }
    },
  });

  const send = useCallback(
    (msg: ClientMessage) => {
      setError(null);
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
        setError("Enter a nickname");
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

  useEffect(() => {
    const name = recallDisplayName();
    if (name && !joined) {
      pendingJoin.current = { name, role: "player" };
    }
  }, [joined]);

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
