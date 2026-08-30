// Seed de datos sintéticos DoctorIA (MVP).
// Constitution P5: CERO PII real. Solo pacientes ficticios (PAC-NNN) y perfiles de demostración.
// Usado por `app.db.seeds` en main.wasp.ts -> `wasp db seed`.

import { faker } from "@faker-js/faker";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "@wasp.sh/lib-auth/node";

const DEMO_ADMIN_EMAIL = "admin@doctoria.com";
const DEMO_PASSWORD = "Doctoria2026!";

async function ensureAuthLogin(
  prismaClient: PrismaClient,
  userId: string,
  email: string,
  password: string,
) {
  const hashedPassword = await hashPassword(password);
  const existingAuth = await prismaClient.auth.findUnique({ where: { userId } });
  const authId = existingAuth?.id ?? crypto.randomUUID();
  if (!existingAuth) {
    await prismaClient.auth.create({ data: { id: authId, userId } });
  }
  await prismaClient.authIdentity.upsert({
    where: { providerName_providerUserId: { providerName: "email", providerUserId: email } },
    update: {
      providerData: JSON.stringify({
        hashedPassword,
        isEmailVerified: true,
        emailVerificationSentAt: null,
        passwordResetSentAt: null,
      }),
    },
    create: {
      providerName: "email",
      providerUserId: email,
      providerData: JSON.stringify({
        hashedPassword,
        isEmailVerified: true,
        emailVerificationSentAt: null,
        passwordResetSentAt: null,
      }),
      authId,
    },
  });
}

const DEMO_MEDICOS = [
  { email: "medico1@doctoria.com", fullName: "Dra. Laura Méndez", specialty: "Medicina Interna" },
  { email: "medico2@doctoria.com", fullName: "Dr. Carlos Vega", specialty: "Cardiología" },
];

// Secretaria demo (Semana 6): gestiona pacientes/citas/signos vitales.
const DEMO_SECRETARIA = {
  email: "secretaria@doctoria.com",
  fullName: "Karla Ramírez",
};

// Datos ficticios (sintéticos, P5). Cualquier parecido con la realidad es coincidencia.
const SYNTHETIC_PATIENTS = [
  {
    syntheticId: "PAC-001",
    firstName: "Ana",
    lastName: "Paredes",
    birthDate: new Date("1990-04-12"),
    sex: "F",
    medicalHistory: "Hipertensión arterial controlada. Sin alergias medicamentosas conocidas.",
    allergies: null,
  },
  {
    syntheticId: "PAC-002",
    firstName: "Jorge",
    lastName: "Ramírez",
    birthDate: new Date("1985-11-03"),
    sex: "M",
    medicalHistory: "Diabetes tipo 2 en tratamiento con metformina.",
    allergies: "Penicilina",
  },
  {
    syntheticId: "PAC-003",
    firstName: "María",
    lastName: "Torres",
    birthDate: new Date("1978-07-25"),
    sex: "F",
    medicalHistory: "Asma bronquial. Hipotiroidismo.",
    allergies: null,
  },
  {
    syntheticId: "PAC-004",
    firstName: "Pedro",
    lastName: "Salazar",
    birthDate: new Date("1965-02-18"),
    sex: "M",
    medicalHistory: "Dislipidemia. Cardiopatía isquémica en seguimiento.",
    allergies: "Sulfamidas",
  },
  {
    syntheticId: "PAC-005",
    firstName: "Lucía",
    lastName: "Castillo",
    birthDate: new Date("2001-09-30"),
    sex: "F",
    medicalHistory: "Sin antecedentes de relevancia.",
    allergies: null,
  },
  {
    syntheticId: "PAC-006",
    firstName: "Andrés",
    lastName: "Núñez",
    birthDate: new Date("1995-12-08"),
    sex: "M",
    medicalHistory: "Migraña crónica.",
    allergies: null,
  },
];

export async function seedSyntheticClinicalData(prismaClient: PrismaClient) {
  // 1. Admin
  const admin = await prismaClient.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: { isAdmin: true, isMedico: false },
    create: {
      email: DEMO_ADMIN_EMAIL,
      username: "admin",
      isAdmin: true,
      isMedico: false,
      fullName: "Administrador DoctorIA",
      specialty: null,
    },
  });
  await ensureAuthLogin(prismaClient, admin.id, DEMO_ADMIN_EMAIL, DEMO_PASSWORD);

  // 2. Médicos habilitados
  const medicos: { id: string }[] = [];
  for (const m of DEMO_MEDICOS) {
    const medico = await prismaClient.user.upsert({
      where: { email: m.email },
      update: { isMedico: true, isAdmin: false, fullName: m.fullName, specialty: m.specialty },
      create: {
        email: m.email,
        username: faker.internet.userName({ firstName: m.fullName.split(" ").pop() ?? "medico" }),
        isMedico: true,
        isAdmin: false,
        fullName: m.fullName,
        specialty: m.specialty,
      },
    });
    medicos.push({ id: medico.id });
    await ensureAuthLogin(prismaClient, medico.id, m.email, DEMO_PASSWORD);
  }

  // 2b. Secretaria demo (rol exclusivo, cuenta activa)
  const secretaria = await prismaClient.user.upsert({
    where: { email: DEMO_SECRETARIA.email },
    update: {
      isSecretaria: true,
      isAdmin: false,
      isMedico: false,
      isActive: true,
      fullName: DEMO_SECRETARIA.fullName,
    },
    create: {
      email: DEMO_SECRETARIA.email,
      username: "secretaria",
      isSecretaria: true,
      isAdmin: false,
      isMedico: false,
      isActive: true,
      fullName: DEMO_SECRETARIA.fullName,
    },
  });
  await ensureAuthLogin(
    prismaClient,
    secretaria.id,
    DEMO_SECRETARIA.email,
    DEMO_PASSWORD,
  );

  // 3. Pacientes sintéticos + accesos (ambos médicos acceden a todos)
  const patients: { id: string }[] = [];
  for (const p of SYNTHETIC_PATIENTS) {
    const patient = await prismaClient.syntheticPatient.upsert({
      where: { syntheticId: p.syntheticId },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        sex: p.sex,
        medicalHistory: p.medicalHistory,
        allergies: p.allergies,
      },
      create: {
        syntheticId: p.syntheticId,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        sex: p.sex,
        medicalHistory: p.medicalHistory,
        allergies: p.allergies,
      },
    });
    patients.push({ id: patient.id });
  }

  // 4. MedicoPatientAccess: ambos médicos -> todos los pacientes
  for (const medico of medicos) {
    for (const patient of patients) {
      await prismaClient.medicoPatientAccess.upsert({
        where: { medicoId_patientId: { medicoId: medico.id, patientId: patient.id } },
        update: {},
        create: { medicoId: medico.id, patientId: patient.id, grantedById: admin.id },
      });
    }
  }

  // 5. Usuarios Pacientes Demo (Fase B.8): paciente1@doctoria.com y paciente2@doctoria.com
  const DEMO_PACIENTES = [
    { email: "paciente1@doctoria.com", syntheticId: "PAC-001", fullName: "Ana Paredes" },
    { email: "paciente2@doctoria.com", syntheticId: "PAC-002", fullName: "Jorge Ramírez" },
  ];

  for (const demoP of DEMO_PACIENTES) {
    try {
      const userPaciente = await prismaClient.user.upsert({
        where: { email: demoP.email },
        update: {
          isPaciente: true,
          isAdmin: false,
          isMedico: false,
          isSecretaria: false,
          fullName: demoP.fullName,
        },
        create: {
          email: demoP.email,
          username: demoP.email.split("@")[0],
          isPaciente: true,
          isAdmin: false,
          isMedico: false,
          isSecretaria: false,
          fullName: demoP.fullName,
        },
      });
      await ensureAuthLogin(prismaClient, userPaciente.id, demoP.email, DEMO_PASSWORD);

      // Vincular al syntheticPatient correspondiente
      await prismaClient.syntheticPatient.updateMany({
        where: { syntheticId: demoP.syntheticId },
        data: { userId: userPaciente.id },
      });
    } catch (err) {
      console.warn(`[seed] Aviso al inicializar paciente demo ${demoP.email}:`, err);
    }
  }

  console.log(
    `[seed] ${medicos.length} médicos, ${patients.length} pacientes sintéticos, ${DEMO_PACIENTES.length} cuentas de paciente vinculadas`,
  );
}
