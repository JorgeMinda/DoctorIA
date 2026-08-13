import { type EmailSender } from "@wasp.sh/spec";

export const emailSender: EmailSender = {
  // Provider real para producción (Resend, plan gratuito de 3.000 emails/mes).
  // En desarrollo, la verificación de email se puede saltar con SKIP_EMAIL_VERIFICATION_IN_DEV=true.
  provider: "Resend",
  defaultFrom: {
    name: "DoctorIA",
    // Debe coincidir con el dominio/email verificado en Resend para que los correos se envíen.
    email: "jls.minda@yavirac.edu.ec",
  },
};
