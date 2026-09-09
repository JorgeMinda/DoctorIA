// Tests unitarios para el servicio de notas de voz de WhatsApp (DoctorIA)

import { describe, expect, it } from "vitest";
import { transcribeWhatsAppAudio } from "../../src/whatsapp/services/whatsappAudioService";

describe("WhatsApp Audio Service - transcribeWhatsAppAudio", () => {
  it("retorna texto por defecto cuando se envía buffer o base64", async () => {
    const mockAudioBase64 = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JAe5CQEZZT3Ui...";
    const result = await transcribeWhatsAppAudio(mockAudioBase64, "audio/ogg");

    expect(result.success).toBe(true);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("retorna failure cuando el input de audio está vacío", async () => {
    const result = await transcribeWhatsAppAudio("");
    expect(result.success).toBe(false);
    expect(result.text).toBe("");
  });
});
