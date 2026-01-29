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
  const [connectionStatus, setConnectionStatus] = useState("Iniciando...");

  // Inicializar Nexo y establecer conexión
  useEffect(() => {
    console.log("Nexo: isInTiendaNube =", isInTiendaNube);
    console.log("Nexo: CLIENT_ID =", CLIENT_ID ? `${CLIENT_ID.substring(0, 8)}...` : "(vacío)");
    
    if (!isInTiendaNube) {
      // Si no estamos en TiendaNube, mostrar la app directamente
      console.log("Nexo: No estamos en iframe, modo standalone");
      setConnectionStatus("Modo standalone");
      setIsConnected(true);
      return;
    }

    if (!CLIENT_ID) {
      console.warn("VITE_TN_CLIENT_ID no configurado - Nexo no inicializado");
      setConnectionStatus("Error: VITE_TN_CLIENT_ID no configurado");
      setIsConnected(true);
      return;
    }

    setConnectionStatus("Creando instancia Nexo...");
    console.log("Nexo: Creando instancia con clientId:", CLIENT_ID);
    
    const instance = nexo.create({
      clientId: CLIENT_ID,
      log: true, // Habilitar logs para debugging
    });
    setNexoInstance(instance);

    setConnectionStatus("Conectando con Admin...");
    console.log("Nexo: Intentando conectar...");
    
    connect(instance, 5000) // 5 segundos de timeout
      .then(() => {
        console.log("Nexo: Conectado con TiendaNube Admin");
        setConnectionStatus("Conectado, notificando...");
        iAmReady(instance);
        console.log("Nexo: iAmReady enviado");
        setConnectionStatus("Listo");
        setIsConnected(true);
      })
      .catch((error) => {
        console.error("Nexo: Error conectando", error);
        setConnectionStatus(`Error: ${error}`);
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
        <Text fontSize="caption" color="neutral-textDisabled">{connectionStatus}</Text>
      </Box>
    );
  }

  return <>{children}</>;
};

export default NexoSyncRoute;
