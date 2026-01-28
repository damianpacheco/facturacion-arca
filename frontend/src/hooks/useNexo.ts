/**
 * Hook para usar Nexo SDK en componentes React.
 */

import { useState, useEffect, useCallback } from "react";
import {
  isRunningInTiendaNube,
  initializeNexo,
  getSessionToken,
  navigateToAdmin,
  copyToClipboard,
} from "../services/nexo";

interface UseNexoReturn {
  /** Si la app está corriendo dentro de TiendaNube */
  isInTiendaNube: boolean;
  /** Si Nexo está inicializado y conectado */
  isConnected: boolean;
  /** Si está cargando la inicialización */
  isLoading: boolean;
  /** Obtener session token para autenticar requests */
  getToken: () => Promise<string | null>;
  /** Navegar a una URL del Admin de TiendaNube */
  goToAdmin: (path: string) => void;
  /** Copiar texto al portapapeles */
  copy: (text: string) => Promise<void>;
}

/**
 * Hook para integración con Nexo SDK de TiendaNube.
 */
export function useNexo(): UseNexoReturn {
  const [isInTiendaNube] = useState(() => isRunningInTiendaNube());
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (isInTiendaNube) {
        const connected = await initializeNexo();
        setIsConnected(connected);
      }
      setIsLoading(false);
    };

    init();
  }, [isInTiendaNube]);

  const getToken = useCallback(async () => {
    if (!isConnected) return null;
    return getSessionToken();
  }, [isConnected]);

  const goToAdmin = useCallback((path: string) => {
    if (isConnected) {
      navigateToAdmin(path);
    }
  }, [isConnected]);

  const copy = useCallback(async (text: string) => {
    await copyToClipboard(text);
  }, []);

  return {
    isInTiendaNube,
    isConnected,
    isLoading,
    getToken,
    goToAdmin,
    copy,
  };
}

export default useNexo;
