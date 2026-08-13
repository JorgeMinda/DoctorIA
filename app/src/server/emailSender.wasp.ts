import { type EmailSender } from "@wasp.sh/spec";

export const emailSender: EmailSender = {
  // Provider real para producción (Resend, plan gratuito de 3.000 emails/mes).
  // En desarrollo, la verificación de email se puede saltar con SKIP_EMAIL_VERIFICATION_IN_DEV=true.
  provider: "Resend",
  defaultFrom: {
    name: "DoctorIA",
    // PROVISIONAL para staging: onboarding@resend.dev no requiere dominio verificado.
    // Resend solo permite enviar desde dominios verificados o desde onboarding@resend.dev.
    // Cuando verifiques un dominio en Resend, cambia a noreply@tu-dominio.com.
    email: "onboarding@resend.dev",
  },
};
