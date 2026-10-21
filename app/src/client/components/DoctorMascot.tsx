import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Sliders,
  Palette,
  Code,
  PlayCircle,
  User,
  Lock,
  ArrowRight,
  Activity,
  HeartPulse,
  Info,
} from "lucide-react";

export type MascotState =
  | "idle"
  | "focus-user"
  | "focus-password"
  | "validating"
  | "success"
  | "error";

// ==========================================
// 1. AURORA BACKGROUND COMPONENT
// ==========================================
export function AuroraBackground() {
  return (
    <div className="aurora-root" aria-hidden="true">
      <span className="aurora-blob b1" />
      <span className="aurora-blob b2" />
      <span className="aurora-blob b3" />
      <span className="login-bg-sphere s1" />
      <span className="login-bg-sphere s2" />
      <span className="login-bg-sphere s3" />
      <span className="login-bg-sphere s4" />
    </div>
  );
}

// ==========================================
// 2. DOCTOR MASCOT COMPONENT
// ==========================================
export interface DoctorMascotProps {
  state: MascotState;
  lookX?: number;
  className?: string;
}

export function DoctorMascot({
  state,
  lookX = 0,
  className = "",
}: DoctorMascotProps) {
  return (
    <div className={`mascot-stage ${className}`} data-state={state}>
      <div className="mascot-ambient-aura" />
      <svg
        className="doctor-mascot"
        data-state={state}
        viewBox="0 0 200 220"
        style={{ ["--look-x" as any]: `${lookX}px` }}
        role="img"
        aria-label="Mascota doctor"
      >
        <g className="dm-body-group">
          {/* Bata */}
          <path
            d="M36 220 C36 172 68 156 100 156 C132 156 164 172 164 220 Z"
            fill="var(--dm-coat)"
          />
          {/* Cuello */}
          <path d="M84 158 L100 186 L116 158 Z" fill="var(--dm-skin)" />
          {/* Estetoscopio */}
          <path
            d="M70 162 C66 192 88 202 100 197 C112 202 134 192 130 162"
            fill="none"
            stroke="var(--dm-steth)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="100" cy="199" r="7" fill="var(--dm-steth)" />
          <circle cx="100" cy="199" r="3" fill="#fff" opacity=".7" />

          {/* Cabeza */}
          <g className="dm-head">
            <circle cx="100" cy="96" r="55" fill="var(--dm-skin)" />
            {/* Gorro quirúrgico */}
            <path
              d="M45 90 C45 38 155 38 155 90 C140 72 60 72 45 90 Z"
              fill="var(--dm-cap)"
            />
            <rect x="94" y="52" width="12" height="3.5" rx="1.5" fill="#fff" />
            <rect
              x="98.25"
              y="47.75"
              width="3.5"
              height="12"
              rx="1.5"
              fill="#fff"
            />

            {/* Mejillas */}
            <circle cx="66" cy="116" r="8" fill="#f28b82" opacity=".35" />
            <circle cx="134" cy="116" r="8" fill="#f28b82" opacity=".35" />

            {/* Ojos */}
            <g className="dm-eye">
              <ellipse cx="80" cy="99" rx="11" ry="12" fill="#fff" />
              <circle
                className="dm-pupil"
                cx="80"
                cy="100"
                r="5.5"
                fill="#1f2937"
              />
            </g>
            <g className="dm-eye">
              <ellipse cx="120" cy="99" rx="11" ry="12" fill="#fff" />
              <circle
                className="dm-pupil"
                cx="120"
                cy="100"
                r="5.5"
                fill="#1f2937"
              />
            </g>

            {/* Bocas */}
            <path
              className="dm-mouth dm-mouth-neutral"
              d="M88 128 Q100 135 112 128"
              fill="none"
              stroke="#7c2d12"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              className="dm-mouth dm-mouth-happy"
              d="M84 124 Q100 148 116 124 Z"
              fill="#7c2d12"
              stroke="#7c2d12"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              className="dm-mouth dm-mouth-sad"
              d="M88 134 Q100 124 112 134"
              fill="none"
              stroke="#7c2d12"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>

          {/* Manos */}
          <g className="dm-hand dm-hand-l">
            <rect
              x="48"
              y="205"
              width="26"
              height="70"
              rx="13"
              fill="var(--dm-coat)"
            />
            <circle cx="61" cy="205" r="15" fill="var(--dm-skin)" />
          </g>
          <g className="dm-hand dm-hand-r">
            <rect
              x="126"
              y="205"
              width="26"
              height="70"
              rx="13"
              fill="var(--dm-coat)"
            />
            <circle cx="139" cy="205" r="15" fill="var(--dm-skin)" />
          </g>
        </g>

        {/* Destellos de éxito */}
        <g className="dm-sparkles">
          <path
            className="dm-spark"
            d="M30 50 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"
            fill="var(--aurora-3)"
          />
          <path
            className="dm-spark"
            d="M170 44 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"
            fill="var(--aurora-1)"
          />
          <path
            className="dm-spark"
            d="M24 120 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"
            fill="var(--aurora-2)"
          />
          <path
            className="dm-spark"
            d="M176 118 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"
            fill="var(--aurora-3)"
          />
        </g>
      </svg>
    </div>
  );
}

// ==========================================
// 3. MASCOT STATE HOOK
// ==========================================
export function useMascotState() {
  const [focus, setFocus] = useState<"none" | "user" | "password">("none");
  const [phase, setPhase] = useState<MascotState>("idle");
  const [lookX, setLookX] = useState<number>(0);

  const state: MascotState = useMemo(() => {
    if (phase !== "idle") return phase;
    if (focus === "user") return "focus-user";
    if (focus === "password") return "focus-password";
    return "idle";
  }, [focus, phase]);

  const onUserFocus = useCallback(() => {
    setPhase("idle");
    setFocus("user");
  }, []);

  const onPasswordFocus = useCallback(() => {
    setPhase("idle");
    setFocus("password");
  }, []);

  const onFieldBlur = useCallback(() => {
    setFocus("none");
  }, []);

  const onUserInput = useCallback((value: string) => {
    setLookX((Math.min(value.length, 24) / 24) * 8 - 4);
  }, []);

  const startValidating = useCallback(() => setPhase("validating"), []);
  const setSuccess = useCallback(() => setPhase("success"), []);
  const setError = useCallback(() => {
    setPhase("error");
    setTimeout(() => setPhase("idle"), 1200);
  }, []);

  const forceState = useCallback((forcedState: MascotState) => {
    if (["idle", "validating", "success", "error"].includes(forcedState)) {
      setPhase(forcedState);
      setFocus("none");
    } else if (forcedState === "focus-user") {
      setPhase("idle");
      setFocus("user");
    } else if (forcedState === "focus-password") {
      setPhase("idle");
      setFocus("password");
    }
  }, []);

  return {
    state,
    lookX,
    onUserFocus,
    onPasswordFocus,
    onFieldBlur,
    onUserInput,
    startValidating,
    setSuccess,
    setError,
    forceState,
  };
}

// ==========================================
// 4. INTERACTIVE MASCOT STUDIO & DEMO
// ==========================================
export function DoctorMascotDemoStudio() {
  const mascot = useMascotState();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "controls" | "code">(
    "preview"
  );
  const [simulationResult, setSimulationResult] = useState<"success" | "error">(
    "success"
  );

  const [colors, setColors] = useState({
    base: "#0b1220",
    aurora1: "#0ea5a4",
    aurora2: "#6366f1",
    aurora3: "#10b981",
  });

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--aurora-base", colors.base);
    root.style.setProperty("--aurora-1", colors.aurora1);
    root.style.setProperty("--aurora-2", colors.aurora2);
    root.style.setProperty("--aurora-3", colors.aurora3);
  }, [colors]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mascot.startValidating();

    setTimeout(() => {
      if (simulationResult === "success") {
        mascot.setSuccess();
      } else {
        mascot.setError();
      }
    }, 1500);
  };

  return (
    <div className="relative min-h-[700px] w-full overflow-hidden rounded-3xl border border-slate-700/60 font-sans text-slate-100 shadow-2xl">
      <AuroraBackground />

      <header className="relative z-20 backdrop-blur-md bg-slate-900/60 border-b border-slate-700/50 px-4 py-3 sm:px-6">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-400">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                Mascota Médica DoctorIA{" "}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Aurora UI
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Estudio Interactivo & Control de Auras
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === "preview"
                  ? "bg-teal-500 text-slate-950 font-semibold shadow-md shadow-teal-500/20"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <PlayCircle className="w-3.5 h-3.5" /> Demo
            </button>
            <button
              onClick={() => setActiveTab("controls")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === "controls"
                  ? "bg-teal-500 text-slate-950 font-semibold shadow-md shadow-teal-500/20"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Estados
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === "code"
                  ? "bg-teal-500 text-slate-950 font-semibold shadow-md shadow-teal-500/20"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Code className="w-3.5 h-3.5" /> Props
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 grid place-items-center p-6 my-auto min-h-[550px]">
        {activeTab === "preview" && (
          <div className="w-full max-w-sm flex flex-col items-center">
            <div className="mb-[-20px] z-20 transition-transform duration-300 hover:scale-105">
              <DoctorMascot state={mascot.state} lookX={mascot.lookX} />
            </div>

            <div className="w-full clinical-glass-card rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-indigo-500 to-emerald-500" />

              <div className="text-center mb-5">
                <h4 className="text-lg font-bold text-white tracking-wide">
                  Portal Médico
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Ingresa tus credenciales para acceder al sistema
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Usuario / Email
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="dr.garcia@hospital.org"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        mascot.onUserInput(e.target.value);
                      }}
                      onFocus={mascot.onUserFocus}
                      onBlur={mascot.onFieldBlur}
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={mascot.onPasswordFocus}
                      onBlur={mascot.onFieldBlur}
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Activity className="w-3 h-3 text-teal-400" /> Simular:
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSimulationResult("success")}
                      className={`px-2 py-0.5 rounded text-[10px] border transition ${
                        simulationResult === "success"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold"
                          : "border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      Éxito
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulationResult("error")}
                      className={`px-2 py-0.5 rounded text-[10px] border transition ${
                        simulationResult === "error"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold"
                          : "border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      Error
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={mascot.state === "validating"}
                  className="w-full mt-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-semibold py-2 px-4 rounded-xl shadow-lg shadow-teal-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                >
                  {mascot.state === "validating" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                      Validando acceso...
                    </>
                  ) : (
                    <>
                      Iniciar Sesión <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Estado Mascot:</span>
                <span className="font-mono font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                  {mascot.state}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "controls" && (
          <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="clinical-glass-card rounded-2xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-teal-400" /> Pruebas de Estado
              </h4>
              <p className="text-[11px] text-slate-400 mb-3">
                Fuerza la animación de la mascota a un estado específico.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: "idle",
                    label: "Idle / Reposo",
                    icon: Sparkles,
                    color: "hover:border-slate-500",
                  },
                  {
                    id: "focus-user",
                    label: "Focus Usuario",
                    icon: User,
                    color: "hover:border-teal-500",
                  },
                  {
                    id: "focus-password",
                    label: "Focus Contraseña",
                    icon: Lock,
                    color: "hover:border-indigo-500",
                  },
                  {
                    id: "validating",
                    label: "Validando",
                    icon: RefreshCw,
                    color: "hover:border-amber-500",
                  },
                  {
                    id: "success",
                    label: "Éxito (Hop)",
                    icon: CheckCircle2,
                    color: "hover:border-emerald-500",
                  },
                  {
                    id: "error",
                    label: "Error (Shake)",
                    icon: XCircle,
                    color: "hover:border-rose-500",
                  },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => mascot.forceState(st.id as MascotState)}
                    className={`flex items-center gap-1.5 p-2 rounded-xl border border-slate-700 bg-slate-800/60 text-xs font-semibold transition ${
                      st.color
                    } ${
                      mascot.state === st.id
                        ? "ring-2 ring-teal-400 bg-slate-800 text-white"
                        : "text-slate-300"
                    }`}
                  >
                    <st.icon className="w-3.5 h-3.5 text-teal-400" />
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Seguimiento Pupilar (lookX: {mascot.lookX.toFixed(1)}px)
                </label>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.5"
                  value={mascot.lookX}
                  onChange={() => mascot.forceState("focus-user")}
                  onInput={(e: React.FormEvent<HTMLInputElement>) => {
                    const val = parseFloat(e.currentTarget.value);
                    mascot.onUserInput(
                      "a".repeat(Math.round(((val + 4) / 8) * 24))
                    );
                  }}
                  className="w-full accent-teal-400 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="clinical-glass-card rounded-2xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" /> Paleta CSS
              </h4>
              <p className="text-[11px] text-slate-400 mb-3">
                Ajusta las variables de color del fondo y del aura en vivo.
              </p>

              <div className="space-y-2.5">
                {[
                  {
                    key: "aurora1",
                    label: "--aurora-1 (Primario / Cyan)",
                    desc: "Cyan Teal",
                  },
                  {
                    key: "aurora2",
                    label: "--aurora-2 (Secundario / Violet)",
                    desc: "Indigo Violet",
                  },
                  {
                    key: "aurora3",
                    label: "--aurora-3 (Acento / Éxito)",
                    desc: "Emerald Green",
                  },
                  {
                    key: "base",
                    label: "--aurora-base (Fondo Obscuro)",
                    desc: "Dark Blue Slate",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800"
                  >
                    <div>
                      <span className="block text-xs font-semibold text-slate-200">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {item.desc}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={(colors as any)[item.key]}
                        onChange={(e) =>
                          setColors({ ...colors, [item.key]: e.target.value })
                        }
                        className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                      />
                      <span className="font-mono text-[11px] text-slate-300 w-14">
                        {(colors as any)[item.key]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  setColors({
                    base: "#0b1220",
                    aurora1: "#0ea5a4",
                    aurora2: "#6366f1",
                    aurora3: "#10b981",
                  })
                }
                className="mt-3 w-full py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition"
              >
                Restablecer Colores
              </button>
            </div>
          </div>
        )}

        {activeTab === "code" && (
          <div className="w-full max-w-xl clinical-glass-card rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-teal-400" /> Integración del Hook
              </h4>
              <span className="text-[11px] text-slate-400">
                DoctorMascot Props
              </span>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 text-xs font-mono">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-teal-400 font-bold block mb-1">
                  // 1. Hook de estado
                </span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  const mascot = useMascotState();
                  <br />
                  // mascot.state: "idle" | "focus-user" | "focus-password" |
                  "validating" | "success" | "error"
                  <br />
                  // mascot.lookX: number (-4px a +4px)
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-indigo-400 font-bold block mb-1">
                  // 2. Control de Inputs
                </span>
                <pre className="text-slate-300 whitespace-pre-wrap text-[11px]">
{`<input
  onFocus={mascot.onUserFocus}
  onBlur={mascot.onFieldBlur}
  onInput={(e) => mascot.onUserInput(e.currentTarget.value)}
/>

<input
  type="password"
  onFocus={mascot.onPasswordFocus}
  onBlur={mascot.onFieldBlur}
/>`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-20 backdrop-blur-md bg-slate-900/60 border-t border-slate-800/80 px-4 py-2 text-center text-[11px] text-slate-500 flex items-center justify-between w-full">
        <span>Mascota Médica SVG & Background Aurora</span>
        <span className="flex items-center gap-1 text-slate-400">
          <Info className="w-3 h-3" /> Transiciones CSS nativas
        </span>
      </footer>
    </div>
  );
}
