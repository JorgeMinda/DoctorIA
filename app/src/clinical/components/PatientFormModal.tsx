import { useState, useEffect } from "react";
import { useAction } from "wasp/client/operations";
import { manageSyntheticPatients } from "wasp/client/operations";
import { toast } from "../../client/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../../client/components/ui/dialog";
import {
  UserRound,
  HeartPulse,
  Phone,
  ShieldCheck,
} from "lucide-react";

export type PatientLike = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | Date;
  sex: string | null;
  documento?: string | null;
  phone?: string | null;
  address?: string | null;
  insurance?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  nationality?: string | null;
  ethnicity?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  email?: string | null;
};

const empty = {
  firstName: "",
  lastName: "",
  birthDate: "",
  sex: "M",
  documento: "",
  nationality: "Ecuatoriana",
  ethnicity: "Mestizo",
  heightCm: "",
  weightKg: "",
  phone: "",
  address: "",
  insurance: "",
  bloodType: "",
  allergies: "",
  medicalHistory: "",
  emergencyName: "",
  emergencyPhone: "",
};

export function PatientFormModal({
  open,
  onOpenChange,
  initialPatient,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPatient?: PatientLike | null;
  onDone?: () => void;
}) {
  const isEdit = Boolean(initialPatient);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const manageFn = useAction(manageSyntheticPatients);

  useEffect(() => {
    if (initialPatient && open) {
      setForm({
        firstName: initialPatient.firstName ?? "",
        lastName: initialPatient.lastName ?? "",
        birthDate: initialPatient.birthDate
          ? new Date(initialPatient.birthDate).toISOString().slice(0, 10)
          : "",
        sex: initialPatient.sex ?? "M",
        documento: initialPatient.documento ?? "",
        nationality: initialPatient.nationality ?? "Ecuatoriana",
        ethnicity: initialPatient.ethnicity ?? "Mestizo",
        heightCm: initialPatient.heightCm != null ? String(initialPatient.heightCm) : "",
        weightKg: initialPatient.weightKg != null ? String(initialPatient.weightKg) : "",
        phone: initialPatient.phone ?? "",
        address: initialPatient.address ?? "",
        insurance: initialPatient.insurance ?? "",
        bloodType: initialPatient.bloodType ?? "",
        allergies: initialPatient.allergies ?? "",
        medicalHistory: initialPatient.medicalHistory ?? "",
        emergencyName: initialPatient.emergencyName ?? "",
        emergencyPhone: initialPatient.emergencyPhone ?? "",
      });
    } else if (!initialPatient && open) {
      setForm(empty);
    }
  }, [initialPatient, open]);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Nombre y apellido son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    if (!form.birthDate || !form.sex) {
      toast({
        title: "Campos requeridos",
        description: "Fecha de nacimiento y sexo son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await manageFn({
        action: isEdit ? "UPDATE" : "CREATE",
        patientId: initialPatient?.id,
        data: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          birthDate: new Date(`${form.birthDate}T00:00:00`),
          sex: form.sex,
          documento: form.documento?.trim()
            ? form.documento.trim().slice(0, 30)
            : null,
          nationality: form.nationality?.trim() || null,
          ethnicity: form.ethnicity?.trim() || null,
          heightCm: form.heightCm ? parseInt(form.heightCm, 10) : null,
          weightKg: form.weightKg ? parseInt(form.weightKg, 10) : null,
          phone: form.phone?.trim() || null,
          address: form.address?.trim() || null,
          insurance: form.insurance?.trim() || null,
          bloodType: form.bloodType?.trim() || null,
          allergies: form.allergies?.trim() || null,
          medicalHistory: form.medicalHistory?.trim() || null,
          emergencyName: form.emergencyName?.trim() || null,
          emergencyPhone: form.emergencyPhone?.trim() || null,
        },
      });
      toast({
        title: isEdit ? "Paciente actualizado" : "Paciente creado",
        description: "La ficha clínica ha sido guardada con todos sus datos.",
      });
      onOpenChange(false);
      onDone?.();
    } catch (err: any) {
      toast({
        title: isEdit ? "No se pudo actualizar" : "No se pudo crear",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl border-outline-variant bg-surface/95 backdrop-blur-md shadow-2xl p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-outline-variant/40">
          <DialogTitle className="text-xl font-bold tracking-tight">
            {isEdit ? "Editar Ficha de Paciente" : "Nuevo Paciente"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEdit
              ? "Actualiza la información médica, de contacto y de emergencia del paciente."
              : "Registra un nuevo paciente en la base de datos de la clínica."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6 pt-2">
          {/* SECCIÓN 1: IDENTIFICACIÓN Y DATOS PERSONALES */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <UserRound className="size-3.5" />
              1. Identificación y Datos Personales
            </h4>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pf-doc" className="text-xs font-medium">
                  Documento de Identidad (Cédula/Pasaporte)
                </Label>
                <Input
                  id="pf-doc"
                  value={form.documento}
                  onChange={(e) => set("documento", e.target.value)}
                  placeholder="Ej: 1712345678"
                  className="border-outline-variant bg-surface text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-nat" className="text-xs font-medium">
                  Nacionalidad
                </Label>
                <Input
                  id="pf-nat"
                  value={form.nationality}
                  onChange={(e) => set("nationality", e.target.value)}
                  placeholder="Ej: Ecuatoriana"
                  className="border-outline-variant bg-surface text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-firstName" className="text-xs font-medium">
                  Nombres completos <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pf-firstName"
                  required
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  placeholder="Ej: Juan Carlos"
                  className="border-outline-variant bg-surface text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-lastName" className="text-xs font-medium">
                  Apellidos completos <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pf-lastName"
                  required
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  placeholder="Ej: Pérez Gómez"
                  className="border-outline-variant bg-surface text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-birth" className="text-xs font-medium">
                  Fecha de nacimiento <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pf-birth"
                  type="date"
                  required
                  value={form.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                  className="border-outline-variant bg-surface text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-sex" className="text-xs font-medium">
                  Sexo Biológico <span className="text-destructive">*</span>
                </Label>
                <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
                  <SelectTrigger id="pf-sex" className="border-outline-variant bg-surface text-xs">
                    <SelectValue placeholder="Seleccione sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                    <SelectItem value="O">Otro / Intersex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-eth" className="text-xs font-medium">
                  Etnia / Autoidentificación
                </Label>
                <Select value={form.ethnicity} onValueChange={(v) => set("ethnicity", v)}>
                  <SelectTrigger id="pf-eth" className="border-outline-variant bg-surface text-xs">
                    <SelectValue placeholder="Seleccione etnia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mestizo">Mestizo/a</SelectItem>
                    <SelectItem value="Blanco">Blanco/a</SelectItem>
                    <SelectItem value="Afroecuatoriano">Afroecuatoriano/a</SelectItem>
                    <SelectItem value="Indígena">Indígena</SelectItem>
                    <SelectItem value="Montubio">Montubio/a</SelectItem>
                    <SelectItem value="Mulato">Mulato/a</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
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
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pf-phone" className="text-xs font-medium">
                  Teléfono Móvil / Celular
                </Label>
                <Input
                  id="pf-phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="Ej: 0991234567"
                  className="border-outline-variant bg-surface text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-ins" className="text-xs font-medium">
                  Seguro Médico / Cobertura
                </Label>
                <Input
                  id="pf-ins"
                  value={form.insurance}
                  onChange={(e) => set("insurance", e.target.value)}
                  placeholder="Ej: IESS, Particular, Seguro Privado…"
                  className="border-outline-variant bg-surface text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-addr" className="text-xs font-medium">
                  Dirección Domiciliaria
                </Label>
                <Input
                  id="pf-addr"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Ej: Av. Amazonas y República, Quito"
                  className="border-outline-variant bg-surface text-xs"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: SALUD, ANTROPOMETRÍA Y ANTECEDENTES */}
          <div className="space-y-3 pt-2 border-t border-outline-variant/30">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <HeartPulse className="size-3.5" />
              3. Información Médica, Antropometría y Alergias
            </h4>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf-blood" className="text-xs font-medium">
                  Tipo de Sangre
                </Label>
                <Select
                  value={form.bloodType || undefined}
                  onValueChange={(v) => set("bloodType", v)}
                >
                  <SelectTrigger id="pf-blood" className="border-outline-variant bg-surface text-xs font-mono">
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

              <div className="space-y-1.5">
                <Label htmlFor="pf-height" className="text-xs font-medium">
                  Talla / Estatura (cm)
                </Label>
                <Input
                  id="pf-height"
                  type="number"
                  min="1"
                  max="250"
                  value={form.heightCm}
                  onChange={(e) => set("heightCm", e.target.value)}
                  placeholder="Ej: 172"
                  className="border-outline-variant bg-surface text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-weight" className="text-xs font-medium">
                  Peso (kg)
                </Label>
                <Input
                  id="pf-weight"
                  type="number"
                  min="1"
                  max="300"
                  value={form.weightKg}
                  onChange={(e) => set("weightKg", e.target.value)}
                  placeholder="Ej: 68"
                  className="border-outline-variant bg-surface text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="pf-all" className="text-xs font-medium flex items-center justify-between">
                  <span>Alergias Medicamentosas / Ambientales</span>
                  <span className="text-[10px] text-amber-500 font-normal">
                    Importante para prescripción
                  </span>
                </Label>
                <Input
                  id="pf-all"
                  value={form.allergies}
                  onChange={(e) => set("allergies", e.target.value)}
                  placeholder="Ej: Penicilina, AINEs, Polen, Ninguna…"
                  className="border-outline-variant bg-surface text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="pf-hist" className="text-xs font-medium">
                  Antecedentes Médicos / Enfermedades Preexistentes
                </Label>
                <Textarea
                  id="pf-hist"
                  rows={2}
                  value={form.medicalHistory}
                  onChange={(e) => set("medicalHistory", e.target.value)}
                  placeholder="Ej: Hipertensión arterial en tratamiento, diabetes, cirugías previas…"
                  className="border-outline-variant bg-surface text-xs leading-relaxed"
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
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pf-em-name" className="text-xs font-medium">
                  Nombre del Contacto
                </Label>
                <Input
                  id="pf-em-name"
                  value={form.emergencyName}
                  onChange={(e) => set("emergencyName", e.target.value)}
                  placeholder="Ej: María Pérez (Cónyuge / Familiar)"
                  className="border-outline-variant bg-surface text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-em-phone" className="text-xs font-medium">
                  Teléfono de Emergencia
                </Label>
                <Input
                  id="pf-em-phone"
                  value={form.emergencyPhone}
                  onChange={(e) => set("emergencyPhone", e.target.value)}
                  placeholder="Ej: 0987654321"
                  className="border-outline-variant bg-surface text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-outline-variant/30">
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "Crear Paciente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
