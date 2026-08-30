import { app, page, route } from "@wasp.sh/spec";

import { App } from "./src/client/App" with { type: "ref" };
import { NotFoundPage } from "./src/client/components/NotFoundPage" with { type: "ref" };
import { serverEnvValidationSchema } from "./src/env" with { type: "ref" };
import { LandingPage } from "./src/landing-page/LandingPage" with { type: "ref" };
import { seedSyntheticClinicalData } from "./src/server/scripts/dbSeeds" with { type: "ref" };

import { authConfig, authSpec } from "./src/auth/auth.wasp";
import { clinicalSpec } from "./src/clinical/clinical.wasp";
import { patientSpec } from "./src/patient/patient.wasp";
import { head } from "./src/client/head.wasp";
import { emailSender } from "./src/server/emailSender.wasp";
import { userSpec } from "./src/user/user.wasp";

export default app({
  name: "DoctorIA",
  wasp: { version: "^0.25.0" },
  title: "DoctorIA",
  head,
  auth: authConfig,
  db: {
    seeds: [
      seedSyntheticClinicalData,
    ],
  },
  client: {
    rootComponent: App,
  },
  server: {
    envValidationSchema: serverEnvValidationSchema,
  },
  emailSender,
  spec: [
    route("LandingPageRoute", "/", page(LandingPage), { prerender: true }),
    route("NotFoundRoute", "*", page(NotFoundPage)),
    authSpec,
    userSpec,
    clinicalSpec,
    patientSpec,
  ],
});
