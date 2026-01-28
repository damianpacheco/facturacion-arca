/**
 * Servicio para integración con Nexo SDK de TiendaNube.
 * Nexo permite que la aplicación se comunique con el Admin de TiendaNube
 * cuando se ejecuta como aplicación integrada (iframe).
 */

import nexo, {
  connect,
  iAmReady,
  getSessionToken as nexoGetSessionToken,
  goTo,
  copyToClipboard as nexoCopyToClipboard,
} from "@tiendanube/nexo";
import type { NexoClient } from "@tiendanube/nexo";

// Client ID de la aplicación en TiendaNube
const CLIENT_ID = import.meta.env.VITE_TN_CLIENT_ID || "";

// Instancia única de Nexo
let nexoInstance: NexoClient | null = null;

/**
 * Obtiene o crea la instancia de Nexo.
 */
export function getNexoInstance(): NexoClient | null {
  if (!CLIENT_ID) {
    console.warn("VITE_TN_CLIENT_ID no configurado - Nexo no inicializado");
    return null;
  }

  if (!nexoInstance) {
    nexoInstance = nexo.create({ clientId: CLIENT_ID });
  }

  return nexoInstance;
}

/**
 * Detecta si la aplicación está corriendo dentro de TiendaNube (iframe).
 */
export function isRunningInTiendaNube(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Si hay error de seguridad, probablemente estamos en un iframe
    return true;
  }
}

/**
 * Inicializa Nexo y notifica que la aplicación está lista.
 */
export async function initializeNexo(): Promise<boolean> {
  if (!isRunningInTiendaNube()) {
    console.log("Nexo: No estamos en TiendaNube, funcionando en modo standalone");
    return false;
  }

  const instance = getNexoInstance();
  if (!instance) {
    return false;
  }

  try {
    // Conectar con el Admin de TiendaNube
    await connect(instance);
    console.log("Nexo: Conectado con TiendaNube Admin");

    // Notificar que la app está lista
    iAmReady(instance);
    console.log("Nexo: App lista");

    return true;
  } catch (error) {
    console.error("Nexo: Error inicializando", error);
    return false;
  }
}

/**
 * Obtiene el session token para autenticar requests al backend.
 */
export async function getSessionToken(): Promise<string | null> {
  const instance = getNexoInstance();
  if (!instance) {
    return null;
  }

  try {
    const token = await nexoGetSessionToken(instance);
    return token;
  } catch (error) {
    console.error("Nexo: Error obteniendo session token", error);
    return null;
  }
}

/**
 * Navega a una URL dentro del Admin de TiendaNube.
 */
export function navigateToAdmin(path: string): void {
  const instance = getNexoInstance();
  if (!instance) {
    return;
  }

  try {
    goTo(instance, path);
  } catch (error) {
    console.error("Nexo: Error navegando", error);
  }
}

/**
 * Copia texto al portapapeles usando la API de TiendaNube.
 */
export async function copyToClipboard(text: string): Promise<void> {
  const instance = getNexoInstance();
  if (!instance) {
    // Fallback a API nativa
    await navigator.clipboard.writeText(text);
    return;
  }

  try {
    await nexoCopyToClipboard(instance, text);
  } catch {
    // Fallback a API nativa
    await navigator.clipboard.writeText(text);
  }
}

export default {
  getNexoInstance,
  isRunningInTiendaNube,
  initializeNexo,
  getSessionToken,
  navigateToAdmin,
  copyToClipboard,
};
