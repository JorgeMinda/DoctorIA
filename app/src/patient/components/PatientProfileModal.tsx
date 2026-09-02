import { useState, useEffect } from "react";
import { useAction } from "wasp/client/operations";
import { updateMyPatientProfile } from "wasp/client/operations";
import { toast } from "../../client/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../client/components/ui/dialog";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../client/components/ui/select";
import { Badge } from "../../client/components/ui/badge";
import {
  UserRound,
  HeartPulse,
  Phone,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface PatientProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: any;
  isFirstTimeOnboarding?: boolean;
  onSuccess?: () => void;
}

export function PatientProfileModal({
  open,
  onOpenChange,
  patient,
  isFirstTimeOnboarding = false,
  onSuccess,
}: PatientProfileModalProps) {
  const updateProfileFn = useAction(updateMyPatientProfile);
  const [busy, setBusy] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "O">("M");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [insurance, setInsurance] = useState("");
  const [nationality, setNationality] = useState("Ecuatoriana");

  useEffect(() => {
    if (patient && open) {
      // Limpiar placeholder de correo si existe
      const cleanFirstName =
        patient.firstName?.includes("@") || patient.firstName === "Paciente"
          ? ""
          : patient.firstName ?? "";
      const cleanLastName =
        patient.lastName?.startsWith("PAC-") || patient.lastName === "Paciente"
          ? ""
          : patient.lastName ?? "";

      setFirstName(cleanFirstName);
      setLastName(cleanLastName);

      if (patient.birthDate) {
        try {
          const d = new Date(patient.birthDate);
          setBirthDate(d.toISOString().slice(0, 10));
        } catch {
          setBirthDate("");
        }
      } else {
        setBirthDate("");
      }

      setSex(patient.sex === "F" || patient.sex === "O" ? patient.sex : "M");
      setPhone(patient.phone ?? "");
      setAddress(patient.address ?? "");
      setBloodType(patient.bloodType ?? "");
      setAllergies(patient.allergies ?? "");
      setMedicalHistory(patient.medicalHistory ?? "");
      setEmergencyName(patient.emergencyName ?? "");
      setEmergencyPhone(patient.emergencyPhone ?? "");
      setInsurance(patient.insurance ?? "");
      setNationality(patient.nationality ?? "Ecuatoriana");
    }
  }, [patient, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Campos obligatorios",
        description: "Por favor ingresa tus nombres y apellidos completos.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      await updateProfileFn({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: birthDate ? new Date(birthDate) : undefined,
        sex,
        phone: phone.trim() || null,
        address: address.trim() || null,
        bloodType: bloodType.trim() || null,
        allergies: allergies.trim() || null,
        medicalHistory: medicalHistory.trim() || null,
        emergencyName: emergencyName.trim() || null,
        emergencyPhone: emergencyPhone.trim() || null,
        insurance: insurance.trim() || null,
        nationality: nationality.trim() || null,
      });

      toast({
        title: "✅ Datos guardados con éxito",
        description: "Tu ficha clínica personal ha sido actualizada correctamente.",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error al actualizar datos",
        description: err?.message || "Ocurrió un error al guardar tu información.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl border-outline-variant bg-surface/95 backdrop-blur-md shadow-2xl p-6">
        <DialogHeader className="space-y-2 pb-2 border-b border-outline-variant/40">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="mono-label gap-1.5 border-primary/40 text-primary px-2.5 py-0.5"
            >
              <Sparkles className="size-3.5" />
              {isFirstTimeOnboarding ? "Primer Ingreso" : "Ficha Médica"}
            </Badge>
            {patient?.syntheticId && (
              <Badge variant="secondary" className="font-mono text-xs">
                {patient.syntheticId}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {isFirstTimeOnboarding
              ? "¡Bienvenido a DoctorIA! Completa tu Ficha Clínica"
              : "Actualizar Mis Datos Personales y Clínicos"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isFirstTimeOnboarding
              ? "Tu solicitud ha sido aprobada. Por favor verifica y registra tus datos de contacto y salud para que tu equipo médico cuente con tu información completa."
              : "Mantén tus antecedentes, teléfonos de contacto y datos de emergencia siempre al día."}
          </DialogDescription>
        </DialogHeader>

        {isFirstTimeOnboarding && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-3 backdrop-blur-sm">
            <CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground">
                Cuenta vinculada y autorizada
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Tus consultas, citas y notas médicas se asociarán a este perfil.
                Verifica tus nombres y números de contacto a continuación.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* SECCIÓN 1: IDENTIFICACIÓN */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <UserRound className="size-3.5" />
              1. Identificación y Datos Personales
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="pf-doc" className="text-xs flex items-center justify-between">
                  <span>Documento de Identidad</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Lock className="size-2.5" /> Verificado
                  </span>
                </Label>
                <Input
                  id="pf-doc"
                  value={`${patient?.tipoDocumento ?? "CÉDULA"}: ${patient?.documento ?? "Verificado"} (${patient?.paisEmisor ?? "EC"})`}
                  disabled
                  className="bg-muted/40 font-mono text-xs cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-nat" className="text-xs">
                  Nacionalidad
                </Label>
                <Input
                  id="pf-nat"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="Ej: Ecuatoriana"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-fname" className="text-xs font-medium">
                  Nombres completos <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pf-fname"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej: Carlos Alberto"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-lname" className="text-xs font-medium">
                  Apellidos completos <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pf-lname"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej: Mendoza Páez"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-birth" className="text-xs">
                  Fecha de Nacimiento
                </Label>
                <Input
                  id="pf-birth"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-sex" className="text-xs">
                  Sexo Biológico
                </Label>
                <Select value={sex} onValueChange={(val: any) => setSex(val)}>
                  <SelectTrigger id="pf-sex" className="text-xs">
                    <SelectValue placeholder="Seleccione sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                    <SelectItem value="O">Otro / Intersex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: CONTACTO Y LOCALIZACIÓN */}
          <div className="space-y-3 pt-2 border-t border-outline-variant/30">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <Phone className="size-3.5" />
              2. Datos de Contacto y Residencia
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="pf-phone" className="text-xs">
                  Teléfono Móvil / Celular
                </Label>
                <Input
                  id="pf-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 0991234567"
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-ins" className="text-xs">
                  Seguro Médico / Cobertura
                </Label>
                <Input
                  id="pf-ins"
                  value={insurance}
                  onChange={(e) => setInsurance(e.target.value)}
                  placeholder="Ej: IESS, Seguro Privado, Particular…"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-addr" className="text-xs">
                  Dirección Domiciliaria
                </Label>
                <Input
                  id="pf-addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Av. 10 de Agosto y Colón, Edificio A, Dpto 302"
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: SALUD Y ANTECEDENTES */}
          <div className="space-y-3 pt-2 border-t border-outline-variant/30">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <HeartPulse className="size-3.5" />
              3. Información Médica y Alergias
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="pf-blood" className="text-xs">
                  Tipo de Sangre
                </Label>
                <Select
                  value={bloodType || undefined}
                  onValueChange={setBloodType}
                >
                  <SelectTrigger id="pf-blood" className="text-xs font-mono">
                    <SelectValue placeholder="Seleccione grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(
                      (g) => (
                        <SelectItem key={g} value={g} className="font-mono">
                          {g}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-all" className="text-xs flex items-center justify-between">
                  <span>Alergias Medicamentosas / Ambientales</span>
                  <span className="text-[10px] text-amber-500 font-normal">
                    Importante para prescripción
                  </span>
                </Label>
                <Input
                  id="pf-all"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="Ej: Penicilina, AINEs, Polen, Ninguna conocida…"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="pf-hist" className="text-xs">
                  Antecedentes Médicos / Enfermedades Preexistentes
                </Label>
                <Textarea
                  id="pf-hist"
                  rows={2}
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="Ej: Hipertensión arterial en tratamiento, asma en la infancia, diabetes tipo 2…"
                  className="text-xs leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: CONTACTO DE EMERGENCIA */}
          <div className="space-y-3 pt-2 border-t border-outline-variant/30">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <ShieldCheck className="size-3.5" />
              4. Contacto de Emergencia
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="pf-em-name" className="text-xs">
                  Nombre del Contacto
                </Label>
                <Input
                  id="pf-em-name"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Ej: María Páez (Cónyuge / Madre)"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-em-phone" className="text-xs">
                  Teléfono de Emergencia
                </Label>
                <Input
                  id="pf-em-phone"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="Ej: 0987654321"
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-outline-variant/40">
            {!isFirstTimeOnboarding && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={busy || !firstName.trim() || !lastName.trim()}
              className="w-full sm:w-auto gap-1.5"
            >
              <FileCheck className="size-4" />
              {busy ? "Guardando datos…" : "Guardar y Confirmar Ficha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
