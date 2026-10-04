"use client";
import { useEffect, useRef } from "react";
import { useConnect, useConnection, useReconnect } from "wagmi";

type WalletConnectProviderWithSession = {
  session?: unknown;
};

type ConnectorWithType = {
  id: string;
  type?: string;
};

const hasWalletConnectSession = (
  provider: unknown,
): provider is WalletConnectProviderWithSession => {
  return Boolean(
    provider &&
      typeof provider === "object" &&
      "session" in provider &&
      (provider as WalletConnectProviderWithSession).session,
  );
};

const isWalletConnectConnector = (connector: ConnectorWithType) =>
  connector.id === "walletConnect" || connector.type === "walletConnect";

export const WalletReturnReconnect = () => {
  const { address, isConnected, isConnecting, isReconnecting } =
    useConnection();
  const { connectors, mutateAsync: connect } = useConnect();
  const { mutateAsync: reconnect } = useReconnect();
  const lastReconnectAt = useRef(0);
  const reconnectInFlight = useRef(false);

  useEffect(() => {
    let reconnectTimer: number | undefined;
    let cancelled = false;

    const reconnectIfNeeded = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (address || isConnected || isReconnecting || reconnectInFlight.current) {
        return;
      }

      const now = Date.now();
      if (now - lastReconnectAt.current < 1_500) {
        return;
      }

      lastReconnectAt.current = now;
      reconnectInFlight.current = true;

      try {
        const connections = isConnecting ? [] : await reconnect();
        if (cancelled || connections.length > 0) {
          return;
        }

        const walletConnectConnectors = connectors.filter(
          isWalletConnectConnector,
        );
        if (!walletConnectConnectors.length) {
          return;
        }

        for (const walletConnectConnector of walletConnectConnectors) {
          const provider = await walletConnectConnector
            .getProvider()
            .catch(() => undefined);
          if (cancelled) {
            return;
          }

          if (!hasWalletConnectSession(provider)) {
            continue;
          }

          await connect({ connector: walletConnectConnector });
          return;
        }
      } catch {
        // WalletConnect can leave an approved mobile session in storage before
        // Wagmi has accounts. The next focus/pageshow will try again.
      } finally {
        reconnectInFlight.current = false;
      }
    };

    const queueReconnect = () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      reconnectTimer = window.setTimeout(() => {
        void reconnectIfNeeded();
      }, 400);
    };

    window.addEventListener("focus", queueReconnect);
    window.addEventListener("pageshow", queueReconnect);
    document.addEventListener("visibilitychange", queueReconnect);
    queueReconnect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      window.removeEventListener("focus", queueReconnect);
      window.removeEventListener("pageshow", queueReconnect);
      document.removeEventListener("visibilitychange", queueReconnect);
    };
  }, [
    address,
    connect,
    connectors,
    isConnected,
    isConnecting,
    isReconnecting,
    reconnect,
  ]);

  return null;
};

