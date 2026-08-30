import {
  type GetPasswordResetEmailContentFn,
  type GetVerificationEmailContentFn,
} from "wasp/server/auth";

export const getVerificationEmailContent: GetVerificationEmailContentFn = ({
  verificationLink,
}) => ({
  subject: "Verify your email",
  text: `Click the link below to verify your email: ${verificationLink}`,
  html: `
        <p>Click the link below to verify your email</p>
        <a href="${verificationLink}">Verify email</a>
    `,
});

export const getPasswordResetEmailContent: GetPasswordResetEmailContentFn = ({
  passwordResetLink,
}) => ({
  subject: "Password reset",
  text: `Click the link below to reset your password: ${passwordResetLink}`,
  html: `
        <p>Click the link below to reset your password</p>
        <a href="${passwordResetLink}">Reset password</a>
    `,
});

export const getPatientLinkEmailContent = ({
  patientName,
  syntheticId,
}: {
  patientName: string;
  syntheticId: string;
}) => ({
  subject: "Cuenta de paciente vinculada - DoctorIA",
  text: `Tu cuenta ha sido vinculada exitosamente al paciente ${patientName} (${syntheticId}). Ya puedes acceder a DoctorIA para consultar tu historial clínico confirmado y próximas citas.`,
  html: `
    <h2>¡Cuenta de Paciente Vinculada!</h2>
    <p>Tu cuenta ha sido vinculada exitosamente al paciente <strong>${patientName}</strong> (<code>${syntheticId}</code>).</p>
    <p>Ya puedes acceder a DoctorIA para consultar tu historial clínico confirmado y tus próximas citas médicas.</p>
  `,
});
