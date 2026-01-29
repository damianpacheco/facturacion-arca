/**
 * Componente que sincroniza las rutas de la aplicación con el Admin de TiendaNube.
 * Esto permite que la URL del navegador refleje la navegación interna de la app.
 */

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import nexo, {
  connect,
  iAmReady,
  syncPathname,
  ACTION_NAVIGATE_SYNC,
} from "@tiendanube/nexo";
import type { NexoClient } from "@tiendanube/nexo";
import { Box, Spinner, Text } from "@nimbus-ds/components";

// Client ID de la aplicación en TiendaNube
const CLIENT_ID = import.meta.env.VITE_TN_CLIENT_ID || "";

interface NexoSyncRouteProps {
  children: React.ReactNode;
}

interface NavigateSyncResponse {
  path: string;
  replace?: boolean;
}

/**
 * Detecta si la aplicación está corriendo dentro de TiendaNube (iframe).
 */
function isRunningInTiendaNube(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const NexoSyncRoute: React.FC<NexoSyncRouteProps> = ({ children }) => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [nexoInstance, setNexoInstance] = useState<NexoClient | null>(null);
  const [isInTiendaNube] = useState(() => isRunningInTiendaNube());

  // Inicializar Nexo y establecer conexión
  useEffect(() => {
    if (!isInTiendaNube) {
      // Si no estamos en TiendaNube, mostrar la app directamente
      setIsConnected(true);
      return;
    }

    if (!CLIENT_ID) {
      console.warn("VITE_TN_CLIENT_ID no configurado - Nexo no inicializado");
      setIsConnected(true);
      return;
    }

    const instance = nexo.create({
      clientId: CLIENT_ID,
      log: import.meta.env.DEV, // Solo log en desarrollo
    });
    setNexoInstance(instance);

    connect(instance)
      .then(() => {
        console.log("Nexo: Conectado con TiendaNube Admin");
        setIsConnected(true);
        iAmReady(instance);
        console.log("Nexo: App lista para mostrar");
      })
      .catch((error) => {
        console.error("Nexo: Error conectando", error);
        // Mostrar la app de todos modos para no bloquear
        setIsConnected(true);
      });
  }, [isInTiendaNube]);

  // Sincronizar pathname con el Admin de TiendaNube
  useEffect(() => {
    if (!isConnected || !nexoInstance || !isInTiendaNube) return;

    const path = search ? `${pathname}${search}` : pathname;
    syncPathname(nexoInstance, path);
  }, [pathname, search, isConnected, nexoInstance, isInTiendaNube]);

  // Escuchar cambios de navegación desde el Admin
  useEffect(() => {
    if (!isConnected || !nexoInstance || !isInTiendaNube) return;

    const unsubscribe = nexoInstance.suscribe(
      ACTION_NAVIGATE_SYNC,
      ({ path, replace }: NavigateSyncResponse) => {
        console.log("Nexo: Navegando a", path, replace ? "(replace)" : "");
        navigate(path, { replace: replace ?? false });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isConnected, nexoInstance, navigate, isInTiendaNube]);

  // Mostrar loading mientras se conecta
  if (!isConnected) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100vh"
        flexDirection="column"
        gap="4"
      >
        <Spinner size="large" />
        <Text>Conectando con TiendaNube...</Text>
      </Box>
    );
  }

  return <>{children}</>;
};

export default NexoSyncRoute;
