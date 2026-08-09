-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isMedico" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT,
    "specialty" TEXT,
    "paymentProcessorUserId" TEXT,
    "lemonSqueezyCustomerPortalUrl" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionPlan" TEXT,
    "datePaid" TIMESTAMP(3),
    "credits" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyntheticPatient" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syntheticId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "sex" TEXT NOT NULL,
    "medicalHistory" TEXT,
    "allergies" TEXT,

    CONSTRAINT "SyntheticPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicoPatientAccess" (
    "id" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medicoId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,

    CONSTRAINT "MedicoPatientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "originalText" TEXT NOT NULL,
    "motivoConsulta" TEXT,
    "notaClinica" TEXT,
    "examenFisico" TEXT,
    "valoracionClinica" TEXT,
    "planIndicaciones" TEXT,
    "sectionsNotApplicable" JSONB,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "aiRawResponse" TEXT,
    "unclassifiedContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT_MANUAL',
    "noteType" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "parentNoteId" TEXT,
    "addendumReason" TEXT,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Epicrisis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "patientIdentification" TEXT NOT NULL,
    "reasonForAdmission" TEXT,
    "relevantHistory" TEXT,
    "evolutionSummary" TEXT,
    "proceduresResults" TEXT,
    "validatedDiagnoses" TEXT,
    "conditionAtDischarge" TEXT,
    "followUpInstructions" TEXT,
    "responsibleProfessional" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT_AI_ASSISTED',
    "noteType" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "parentEpicrisisId" TEXT,
    "addendumReason" TEXT,

    CONSTRAINT "Epicrisis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "patientId" TEXT,
    "clinicalNoteId" TEXT,
    "epicrisisId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auth" (
    "id" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "providerName" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerData" TEXT NOT NULL DEFAULT '{}',
    "authId" TEXT NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("providerName","providerUserId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_paymentProcessorUserId_key" ON "User"("paymentProcessorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SyntheticPatient_syntheticId_key" ON "SyntheticPatient"("syntheticId");

-- CreateIndex
CREATE INDEX "SyntheticPatient_syntheticId_idx" ON "SyntheticPatient"("syntheticId");

-- CreateIndex
CREATE INDEX "SyntheticPatient_lastName_firstName_idx" ON "SyntheticPatient"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "MedicoPatientAccess_patientId_idx" ON "MedicoPatientAccess"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicoPatientAccess_medicoId_patientId_key" ON "MedicoPatientAccess"("medicoId", "patientId");

-- CreateIndex
CREATE INDEX "ClinicalNote_patientId_createdAt_idx" ON "ClinicalNote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalNote_authorId_idx" ON "ClinicalNote"("authorId");

-- CreateIndex
CREATE INDEX "ClinicalNote_status_idx" ON "ClinicalNote"("status");

-- CreateIndex
CREATE INDEX "ClinicalNote_parentNoteId_idx" ON "ClinicalNote"("parentNoteId");

-- CreateIndex
CREATE INDEX "Epicrisis_patientId_createdAt_idx" ON "Epicrisis"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_userId_key" ON "Auth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "MedicoPatientAccess" ADD CONSTRAINT "MedicoPatientAccess_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicoPatientAccess" ADD CONSTRAINT "MedicoPatientAccess_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "SyntheticPatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicoPatientAccess" ADD CONSTRAINT "MedicoPatientAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "SyntheticPatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_parentNoteId_fkey" FOREIGN KEY ("parentNoteId") REFERENCES "ClinicalNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epicrisis" ADD CONSTRAINT "Epicrisis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "SyntheticPatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epicrisis" ADD CONSTRAINT "Epicrisis_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epicrisis" ADD CONSTRAINT "Epicrisis_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epicrisis" ADD CONSTRAINT "Epicrisis_parentEpicrisisId_fkey" FOREIGN KEY ("parentEpicrisisId") REFERENCES "Epicrisis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "SyntheticPatient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "ClinicalNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_epicrisisId_fkey" FOREIGN KEY ("epicrisisId") REFERENCES "Epicrisis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_authId_fkey" FOREIGN KEY ("authId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
