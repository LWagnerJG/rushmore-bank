"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import type {
  ClientMessage,
  RoomState,
  ServerMessage,
} from "@/shared/types";
import {
  getPartyHost,
  getStablePlayerId,
  recallDisplayName,
  rememberDisplayName,
} from "@/lib/party";

export function useGameRoom(roomCode: string) {
  const code = roomCode.toUpperCase();
  const [state, setState] = useState<RoomState | null>(null);
  const [youId, setYouId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const playerId = useMemo(() => getStablePlayerId(code), [code]);
  const pendingJoin = useRef<string | null>(null);

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
            name: pendingJoin.current,
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
      socket.send(JSON.stringify(msg));
    },
    [socket],
  );

  const join = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean) {
        setError("Enter a display name");
        return;
      }
      rememberDisplayName(clean);
      pendingJoin.current = clean;
      if (socket.readyState === WebSocket.OPEN) {
        send({ type: "join", name: clean });
      }
    },
    [send, socket],
  );

  useEffect(() => {
    // Auto-rejoin with saved name if we already have a seat after refresh
    const name = recallDisplayName();
    if (name && !joined) {
      pendingJoin.current = name;
    }
  }, [joined]);

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
