import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  FileHeart,
  Fingerprint,
  Footprints,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Network,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { Company } from "../types";

type LoginScreenProps = {
  company: Company;
  onDemoAccess: () => void;
};

type Feedback = {
  tone: "info" | "danger" | "success";
  message: string;
};

const featureItems = [
  { icon: FileHeart, label: "ProntuarioUnico", detail: "Historico clinico integrado" },
  { icon: Activity, label: "Anamnese modular", detail: "Fluxos clinicos completos" },
  { icon: Network, label: "HCI com LGPD", detail: "Dados seguros e auditaveis" },
  { icon: Sparkles, label: "Relatorios com IA", detail: "Inteligencia para decisoes" }
];

function getLoginErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "E-mail ou senha incorretos. Revise os dados e tente novamente.";
  if (normalized.includes("email not confirmed")) return "Confirme seu e-mail antes de acessar o sistema.";
  if (normalized.includes("failed to fetch") || normalized.includes("network")) return "Nao foi possivel conectar ao servidor. Verifique sua internet e tente novamente.";
  if (normalized.includes("too many requests")) return "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.";

  return "Nao foi possivel entrar agora. Tente novamente ou contate o administrador da sua clinica.";
}

export function LoginScreen({ company, onDemoAccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "info",
    message: isSupabaseConfigured
      ? "Use suas credenciais para acessar o ambiente da clinica."
      : "Ambiente demonstrativo disponivel para avaliacao."
  });

  function validateCredentials() {
    if (!email.trim()) return "Informe seu e-mail profissional.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe um e-mail valido.";
    if (!password) return "Informe sua senha para continuar.";
    return null;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setFeedback({ tone: "success", message: "Ambiente demonstrativo liberado. Preparando seu painel..." });
      window.setTimeout(onDemoAccess, 350);
      return;
    }

    const validationMessage = validateCredentials();

    if (validationMessage) {
      setFeedback({ tone: "danger", message: validationMessage });
      return;
    }

    setLoading(true);
    setFeedback({ tone: "info", message: "Validando suas credenciais em ambiente seguro..." });

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) {
        setFeedback({ tone: "danger", message: getLoginErrorMessage(error.message) });
        return;
      }

      setFeedback({ tone: "success", message: "Acesso autorizado. Carregando seu ambiente clinico..." });
      window.setTimeout(onDemoAccess, 350);
    } catch {
      setFeedback({ tone: "danger", message: "Falha de conexao. Verifique sua internet e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordRecovery() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFeedback({ tone: "danger", message: "Informe um e-mail valido para recuperar sua senha." });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setFeedback({ tone: "info", message: "A recuperacao de senha sera liberada quando o acesso oficial estiver ativo." });
      return;
    }

    setRecovering(true);
    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

      setFeedback(
        error
          ? { tone: "danger", message: "Nao foi possivel enviar a recuperacao agora. Tente novamente em instantes." }
          : { tone: "success", message: "Enviamos as instrucoes de recuperacao para o seu e-mail." }
      );
    } catch {
      setFeedback({ tone: "danger", message: "Falha de conexao ao solicitar a recuperacao de senha." });
    } finally {
      setRecovering(false);
    }
  }

  const displayName = company.displayName || "Podo360";

  return (
    <main className="login-screen">
      <section className="login-showcase" aria-label="Recursos do Podo360">
        <div className="login-showcase__grid" aria-hidden="true" />
        <header className="login-showcase__header">
          <span className="login-logo">
            <span className="login-logo__mark">
              {company.logoUrl ? <img src={company.logoUrl} alt="" /> : <Footprints size={24} />}
            </span>
            <span>
              <strong>Podo360</strong>
              <small>{displayName}</small>
            </span>
          </span>
          <span className="login-security-badge"><ShieldCheck size={15} /> Ambiente protegido</span>
        </header>

        <div className="login-showcase__content">
          <span className="login-kicker"><span /> Tecnologia para a jornada clinica</span>
          <h1>Gestao clinica inteligente para podologia.</h1>
          <p>Controle atendimentos, ProntuarioUnico, BA, anamnese, imagens de evolucao, HCI e relatorios em um ambiente seguro e tecnologico.</p>

          <div className="login-feature-grid">
            {featureItems.map(({ icon: Icon, label, detail }) => (
              <article className="login-feature" key={label}>
                <span><Icon size={18} /></span>
                <div><strong>{label}</strong><small>{detail}</small></div>
              </article>
            ))}
          </div>
        </div>

        <div className="login-clinical-visual" aria-hidden="true">
          <div className="login-clinical-visual__scan"><Footprints /></div>
          <span className="login-data-point login-data-point--one"><i /> Mapa de sensibilidade</span>
          <span className="login-data-point login-data-point--two"><i /> Evolucao documentada</span>
          <span className="login-data-point login-data-point--three"><i /> Dados sincronizados</span>
        </div>

        <footer className="login-showcase__footer">
          <span><Fingerprint size={17} /> Acesso rastreavel</span>
          <span><LockKeyhole size={17} /> LGPD e seguranca</span>
        </footer>
      </section>

      <section className="login-access">
        <form className="login-card" onSubmit={handleLogin} noValidate>
          <div className="login-card__brand">
            <span className="login-card__mark"><Footprints size={22} /></span>
            <div><strong>Podo360</strong><small>Plataforma clinica</small></div>
          </div>

          <div className="login-card__heading">
            <span className="login-card__eyebrow"><ShieldCheck size={15} /> Acesso seguro</span>
            <h2>Entrar no sistema</h2>
            <p>Acesse sua clinica com seguranca.</p>
          </div>

          <div className={`login-feedback login-feedback--${feedback.tone}`} role="status" aria-live="polite">
            {feedback.tone === "danger" ? <CircleAlert size={18} /> : feedback.tone === "success" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
            <span>{feedback.message}</span>
          </div>

          <div className="login-fields">
            <label className="login-field">
              <span>E-mail</span>
              <span className="login-field__control">
                <Mail size={18} />
                <input
                  autoComplete="email"
                  inputMode="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@clinica.com"
                  type="email"
                  value={email}
                />
              </span>
            </label>

            <label className="login-field">
              <span>Senha</span>
              <span className="login-field__control">
                <KeyRound size={18} />
                <input
                  autoComplete="current-password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="login-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
          </div>

          <button className="login-recovery" disabled={loading || recovering} onClick={handlePasswordRecovery} type="button">
            {recovering ? "Enviando instrucoes..." : "Esqueci minha senha"}
          </button>

          <button className="login-submit" disabled={loading || recovering} type="submit">
            {loading ? <><LoaderCircle className="login-spinner" size={19} /> Validando acesso...</> : <>{isSupabaseConfigured ? "Entrar" : "Acessar demonstração"} <ArrowRight size={19} /></>}
          </button>

          <div className="login-card__trust"><LockKeyhole size={15} /><span>Ambiente seguro e protegido</span></div>
        </form>

        <p className="login-access__help">Precisa de ajuda? Entre em contato com o administrador da sua clinica.</p>
      </section>
    </main>
  );
}
