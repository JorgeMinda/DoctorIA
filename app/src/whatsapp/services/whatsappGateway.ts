// WhatsApp Gateway Service (Opción 1: QR Bridge / Evolution API / Baileys)
// Envío y recepción de mensajes sin intermediarios de pago ni Meta Cloud API.

import { env } from "wasp/server";

export interface SendMessageOptions {
  to: string; // Número de teléfono en formato E.164 o local con código de país
  text: string;
}

export interface WhatsAppStatus {
  connected: boolean;
  instanceName: string;
  gatewayUrl: string | null;
  state: "open" | "connecting" | "close" | "mock";
  qrCode?: string | null;
}

// Normaliza el número de teléfono removiendo caracteres no numéricos
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^0-9]/g, "");
  // Si comienza con 0 (común en Ecuador/Latinoamérica, ej. 0991234567), anteponer código país (593)
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "593" + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Envía un mensaje de texto por WhatsApp al número indicado.
 * Si el gateway no está configurado, opera en modo mock registrando el mensaje en consola.
 */
export async function sendWhatsAppMessage(options: SendMessageOptions): Promise<{ success: boolean; messageId?: string }> {
  const { to, text } = options;
  const targetNumber = normalizePhoneNumber(to);
  const gatewayUrl = (env as any).WHATSAPP_GATEWAY_URL?.replace(/\/+$/, "");
  const apiKey = (env as any).WHATSAPP_API_KEY;
  const instanceName = (env as any).WHATSAPP_INSTANCE_NAME || "doctoria";

  if (!targetNumber) {
    console.warn("[WhatsAppGateway] Número de destinatario vacío o inválido:", to);
    return { success: false };
  }

  // Modo Mock para desarrollo local / cuando no hay gateway externo levantado aún
  if (!gatewayUrl) {
    console.info(
      `[WhatsApp Gateway MOCK] -> Mensaje para +${targetNumber}:\n${text}\n----------------------------------`,
    );
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  try {
    // Endpoint estándar compatible con Evolution API y Baileys HTTP Bridge
    const endpoint = `${gatewayUrl}/message/sendText/${instanceName}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        number: targetNumber,
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false,
        },
        textMessage: {
          text,
        },
        text, // Compatibilidad con otros bridges
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[WhatsAppGateway] Error ${response.status} enviando a ${targetNumber}:`, errBody);
      return { success: false };
    }

    const data = await response.json().catch(() => ({}));
    return { success: true, messageId: data?.key?.id || data?.id || `msg-${Date.now()}` };
  } catch (error) {
    console.error("[WhatsAppGateway] Excepción de conexión al gateway:", error);
    return { success: false };
  }
}

/**
 * Obtiene el estado actual de la instancia en el Gateway QR.
 */
export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const gatewayUrl = (env as any).WHATSAPP_GATEWAY_URL?.replace(/\/+$/, "");
  const apiKey = (env as any).WHATSAPP_API_KEY;
  const instanceName = (env as any).WHATSAPP_INSTANCE_NAME || "doctoria";

  if (!gatewayUrl) {
    return {
      connected: true, // Simulación activa para permitir pruebas inmediatas
      instanceName,
      gatewayUrl: null,
      state: "mock",
    };
  }

  try {
    const endpoint = `${gatewayUrl}/instance/connectionState/${instanceName}`;
    const response = await fetch(endpoint, {
      headers: {
        ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        connected: false,
        instanceName,
        gatewayUrl,
        state: "close",
      };
    }

    const data = await response.json();
    const state = data?.instance?.state || data?.state || "close";
    return {
      connected: state === "open",
      instanceName,
      gatewayUrl,
      state,
    };
  } catch {
    return {
      connected: false,
      instanceName,
      gatewayUrl,
      state: "close",
    };
  }
}

/**
 * Obtiene el código QR para escanear en WhatsApp si la sesión no está conectada.
 */
export async function getWhatsAppQrCode(): Promise<{ qr: string | null; pairingCode?: string | null }> {
  const gatewayUrl = (env as any).WHATSAPP_GATEWAY_URL?.replace(/\/+$/, "");
  const apiKey = (env as any).WHATSAPP_API_KEY;
  const instanceName = (env as any).WHATSAPP_INSTANCE_NAME || "doctoria";

  if (!gatewayUrl) {
    return { qr: null };
  }

  try {
    const endpoint = `${gatewayUrl}/instance/connect/${instanceName}`;
    const response = await fetch(endpoint, {
      headers: {
        ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return { qr: null };
    const data = await response.json();
    return {
      qr: data?.base64 || data?.qrcode?.base64 || data?.code || null,
      pairingCode: data?.pairingCode || null,
    };
  } catch {
    return { qr: null };
  }
}
