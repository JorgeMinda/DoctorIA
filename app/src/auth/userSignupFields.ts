import { defineUserSignupFields } from "wasp/auth/providers/types";
import { env } from "wasp/server";
import { z } from "zod";

function isAdminEmail(email: string): boolean {
  return env.ADMIN_EMAILS.includes(email);
}

const emailDataSchema = z.object({
  email: z.string(),
});

export const getEmailUserFields = defineUserSignupFields({
  email: (data) => {
    const emailData = emailDataSchema.parse(data);
    return emailData.email;
  },
  username: (data) => {
    const emailData = emailDataSchema.parse(data);
    return emailData.email;
  },
  isAdmin: (data) => {
    const emailData = emailDataSchema.parse(data);
    return isAdminEmail(emailData.email);
  },
});
