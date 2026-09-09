import { useState } from "react";
import { useQuery, useAction } from "wasp/client/operations";
import {
  getWhatsAppConnectionInfo,
  sendWhatsAppTestMessage,
  triggerAppointmentRemindersAction,
} from "wasp/client/operations";
import {
  Bot,
  CheckCircle2,
  Clock,
  MessageSquare,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  Users,
  AlertCircle,
  Zap,
} from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";

export function WhatsAppAdminPanel({
  notice,
  reportError,
}: {
  notice: (msg: string) => void;
  reportError: (msg: string) => void;
}) {
  const { data: info, isLoading, refetch } = useQuery(getWhatsAppConnectionInfo);
  const sendTestFn = useAction(sendWhatsAppTestMessage);
  const triggerRemindersFn = useAction(triggerAppointmentRemindersAction);

  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    "👋 Hola, este es un mensaje de prueba del Asistente Virtual DoctorIA 🩺.",
  );
  const [isSending, setIsSending] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      reportError("Ingresa un número de teléfono de destino.");
      return;
    }

    try {
      setIsSending(true);
      await sendTestFn({ phone: testPhone, message: testMessage });
      notice(`✅ Mensaje enviado exitosamente a ${testPhone}`);
      setTestPhone("");
    } catch (err: any) {
      reportError(err?.message || "Error al enviar mensaje de prueba.");
    } finally {
      setIsSending(false);
    }
  };

  const handleTriggerReminders = async () => {
    try {
      setIsTriggering(true);
      const res: any = await triggerRemindersFn({});
      notice(
        `🔔 Recordatorios ejecutados: ${res?.sentCount || 0} enviados, ${
          res?.errors || 0
        } errores.`,
      );
    } catch (err: any) {
      reportError(err?.message || "Error al ejecutar recordatorios.");
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Bot className="size-6 text-primary" />
            Asistente Recepcionista IA por WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            Atención automatizada 24/7, agendamiento de citas, consulta de horarios y confirmaciones.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar Estado
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-outline-variant">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Smartphone className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Estado de Conexión</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={
                    info?.connected
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-600 font-semibold"
                  }
                >
                  {info?.connected ? "En Línea (Conectado)" : "QR Pendiente"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-outline-variant">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="size-11 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pacientes con WhatsApp</p>
              <p className="text-2xl font-bold text-foreground">
                {isLoading ? "..." : info?.totalPatientsWithPhone ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-outline-variant">
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="size-11 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Próximas Citas por Recordar</p>
              <p className="text-2xl font-bold text-foreground">
                {isLoading ? "..." : info?.scheduledCitasUpcoming ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection & QR Setup Card */}
        <Card className="border border-outline-variant">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="size-5 text-primary" />
              Conexión WhatsApp (Opción 1: Escaneo QR Gratuito)
            </CardTitle>
            <CardDescription>
              Vincule el número de WhatsApp del consultorio escaneando el código QR desde la app móvil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {info?.qrCode ? (
              <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-xl bg-muted/20">
                <img
                  src={info.qrCode.startsWith("data:") ? info.qrCode : `data:image/png;base64,${info.qrCode}`}
                  alt="Código QR WhatsApp"
                  className="size-56 rounded-lg shadow-sm"
                />
                <p className="text-xs text-muted-foreground mt-3 text-center max-w-xs">
                  Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular un dispositivo y escanea este código.
                </p>
              </div>
            ) : info?.connected ? (
              <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-emerald-500/5 border-emerald-500/20 text-center space-y-2">
                <CheckCircle2 className="size-12 text-emerald-500" />
                <h4 className="font-semibold text-foreground">WhatsApp Vinculado con Éxito</h4>
                <p className="text-xs text-muted-foreground max-w-md">
                  El Asistente Recepcionista IA está activo y respondiendo consultas de pacientes 24/7 en tiempo real.
                </p>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                  Instancia: {info?.instanceName || "doctoria"}
                </Badge>
              </div>
            ) : (
              <div className="p-4 rounded-xl border bg-muted/30 text-sm space-y-2">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Zap className="size-4 text-primary" />
                  Modo Simulación / Listo para Gateway
                </div>
                <p className="text-xs text-muted-foreground">
                  Para conectar un número real de WhatsApp en producción, despliega una instancia gratuita de Evolution API o Baileys Bridge y configura <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">WHATSAPP_GATEWAY_URL</code>.
                </p>
              </div>
            )}

            {/* Manual Reminders Trigger */}
            <div className="pt-2 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-foreground">Recordatorios 24h</h5>
                <p className="text-xs text-muted-foreground">Disparar manualmente la tanda de recordatorios interactivos.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTriggerReminders}
                disabled={isTriggering}
                className="shrink-0 gap-1.5"
              >
                <Clock className="size-4" />
                {isTriggering ? "Enviando..." : "Ejecutar Ahora"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Message Card */}
        <Card className="border border-outline-variant">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              Probar Envío de Mensaje WhatsApp
            </CardTitle>
            <CardDescription>
              Envía un mensaje directo a cualquier número para verificar la conectividad del Gateway.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendTest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Número de Teléfono (con código de país o local):</label>
                <Input
                  placeholder="Ej: 0991234567 o 593991234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  disabled={isSending}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Mensaje:</label>
                <Textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  disabled={isSending}
                  required
                />
              </div>

              <Button type="submit" disabled={isSending} className="w-full gap-2">
                <Send className="size-4" />
                {isSending ? "Enviando..." : "Enviar Mensaje de Prueba"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
