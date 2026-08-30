import {
  page,
  route,
  type Auth,
  type AuthMethods,
  type Spec,
} from "@wasp.sh/spec";

import { LoginPage } from "./LoginPage" with { type: "ref" };
import { SignupPage } from "./SignupPage" with { type: "ref" };
import { EmailVerificationPage } from "./email-and-pass/EmailVerificationPage" with { type: "ref" };
import { PasswordResetPage } from "./email-and-pass/PasswordResetPage" with { type: "ref" };
import { RequestPasswordResetPage } from "./email-and-pass/RequestPasswordResetPage" with { type: "ref" };
import {
  getPasswordResetEmailContent,
  getVerificationEmailContent,
} from "./email-and-pass/emails" with { type: "ref" };
import { getEmailUserFields } from "./userSignupFields" with { type: "ref" };

const emailAuthMethod: NonNullable<AuthMethods["email"]> = {
  fromField: {
    name: "DoctorIA",
    email: "onboarding@resend.dev",
  },
  emailVerification: {
    clientRoute: "EmailVerificationRoute",
    getEmailContentFn: getVerificationEmailContent,
  },
  passwordReset: {
    clientRoute: "PasswordResetRoute",
    getEmailContentFn: getPasswordResetEmailContent,
  },
  userSignupFields: getEmailUserFields,
};

// 🔐 Auth out of the box! https://wasp.sh/docs/auth/overview
export const authConfig: Auth = {
  userEntity: "User",
  methods: {
    email: emailAuthMethod,
  },
  onAuthFailedRedirectTo: "/login",
  onAuthSucceededRedirectTo: "/patient/link",
};

export const authSpec: Spec = [
  route("LoginRoute", "/login", page(LoginPage)),
  route("SignupRoute", "/signup", page(SignupPage)),
  route(
    "RequestPasswordResetRoute",
    "/request-password-reset",
    page(RequestPasswordResetPage),
  ),
  route("PasswordResetRoute", "/password-reset", page(PasswordResetPage)),
  route(
    "EmailVerificationRoute",
    "/email-verification",
    page(EmailVerificationPage),
  ),
];
