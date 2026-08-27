import { useState } from "react";
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
  DialogFooter,
  DialogClose,
} from "../../client/components/ui/dialog";

type PatientLike = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | Date;
  sex: string | null;
  documento?: string | null;
  phone?: string | null;
  medicalHistory?: string | null;
  allergies?: string | null;
  nationality?: string | null;
  email?: string | null;
};

const empty = {
  firstName: "",
  lastName: "",
  birthDate: "",
  sex: "",
  documento: "",
  phone: "",
  medicalHistory: "",
  allergies: "",
  nationality: "",
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
  const [form, setForm] = useState(
    initialPatient
      ? {
        firstName: initialPatient.firstName ?? "",
        lastName: initialPatient.lastName ?? "",
        birthDate: initialPatient.birthDate
          ? new Date(initialPatient.birthDate).toISOString().slice(0, 10)
          : "",
        sex: initialPatient.sex ?? "",
        documento: initialPatient.documento ?? "",
        phone: initialPatient.phone ?? "",
        medicalHistory: initialPatient.medicalHistory ?? "",
        allergies: initialPatient.allergies ?? "",
        nationality: initialPatient.nationality ?? "",
      }
      : empty,
  );
  const [saving, setSaving] = useState(false);

  const manageFn = useAction(manageSyntheticPatients);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
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
          birthDate: new Date(form.birthDate),
          sex: form.sex,
          documento: form.documento || null,
          phone: form.phone || null,
          medicalHistory: form.medicalHistory || null,
          allergies: form.allergies || null,
          nationality: form.nationality || null,
        },
      });
      toast({
        title: isEdit ? "Paciente actualizado" : "Paciente creado",
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar paciente" : "Nuevo paciente"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-firstName">Nombre</Label>
            <Input
              id="pf-firstName"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className="border-outline-variant bg-surface"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-lastName">Apellido</Label>
            <Input
              id="pf-lastName"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className="border-outline-variant bg-surface"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-birth">Fecha de nacimiento</Label>
            <Input
              id="pf-birth"
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
              className="border-outline-variant bg-surface"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sexo</Label>
            <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
              <SelectTrigger className="border-outline-variant bg-surface">
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Femenino</SelectItem>
                <SelectItem value="O">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-doc">Documento de identidad</Label>
            <Input
              id="pf-doc"
              value={form.documento}
              onChange={(e) => set("documento", e.target.value)}
              className="border-outline-variant bg-surface"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-phone">Teléfono</Label>
            <Input
              id="pf-phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="border-outline-variant bg-surface"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-nat">Nacionalidad</Label>
          <Input
            id="pf-nat"
            value={form.nationality}
            onChange={(e) => set("nationality", e.target.value)}
            className="border-outline-variant bg-surface"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-hist">Historia médica</Label>
          <Textarea
            id="pf-hist"
            value={form.medicalHistory}
            onChange={(e) => set("medicalHistory", e.target.value)}
            className="border-outline-variant bg-surface"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-all">Alergias</Label>
          <Textarea
            id="pf-all"
            value={form.allergies}
            onChange={(e) => set("allergies", e.target.value)}
            className="border-outline-variant bg-surface"
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear paciente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
