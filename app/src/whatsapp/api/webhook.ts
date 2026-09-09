// WhatsApp Webhook Ingress Handler
// Procesa eventos entrantes desde Evolution API, Baileys HTTP Bridge o Gateways estándar.

import type { MiddlewareConfigFn } from "wasp/server";
import { processIncomingWhatsAppMessage } from "../services/whatsappAiAgent";

export const handleWhatsAppWebhook = async (req: any, res: any, context: any) => {
  // Responder 200 inmediatamente para evitar reintentos duplicados del gateway
  try {
    const body = req.body || {};

    // 1. Manejo de verificación de webhook (GET o POST challenge de algunos bridges)
    if (req.query?.["hub.challenge"]) {
      return res.status(200).send(req.query["hub.challenge"]);
    }

    // 2. Extraer datos según formato del Gateway
    let from = "";
    let text = "";
    let pushName = "";
    let fromMe = false;

    // Formato 1: Evolution API (messages.upsert)
    if (body.event === "messages.upsert" && body.data) {
      const data = body.data;
      const key = data.key || {};
      fromMe = !!key.fromMe;
      from = key.remoteJid || "";
      pushName = data.pushName || "";

      const msg = data.message || {};
      text =
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.buttonsResponseMessage?.selectedDisplayText ||
        msg.listResponseMessage?.title ||
        "";
    }
    // Formato 2: Baileys directo
    else if (body.key && body.message) {
      fromMe = !!body.key.fromMe;
      from = body.key.remoteJid || "";
      pushName = body.pushName || "";
      text =
        body.message.conversation ||
        body.message.extendedTextMessage?.text ||
        "";
    }
    // Formato 3: Payload genérico / simplificado
    else {
      from = body.from || body.phone || body.number || body.sender || "";
      text = body.text || body.message || body.body || "";
      pushName = body.name || body.pushName || "";
      fromMe = !!body.fromMe;
    }

    // Ignorar mensajes enviados por el propio bot o mensajes de grupos (@g.us)
    if (fromMe || from.endsWith("@g.us") || !from || !text) {
      return res.status(200).json({ status: "ignored", reason: "fromMe or empty or group" });
    }

    // Limpiar remoteJid (ej. "593991234567@s.whatsapp.net" -> "593991234567")
    const cleanedNumber = from.replace(/@.*$/, "");

    // 3. Delegar procesamiento al agente de IA
    const result = await processIncomingWhatsAppMessage(context.entities, {
      from: cleanedNumber,
      text,
      name: pushName,
    });

    return res.status(200).json({
      status: "success",
      handled: result.handled,
      intent: result.intent,
      citaId: result.citaId,
    });
  } catch (error: any) {
    console.error("[WhatsAppWebhook] Error procesando mensaje entrante:", error);
    return res.status(200).json({ status: "error", message: error.message });
  }
};
