import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Footprints } from "lucide-react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error?: Error;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[Podo360] Erro capturado pelo Error Boundary", error, errorInfo);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="login-screen login-screen--state">
        <section className="login-access login-access--center">
          <div className="login-card">
            <div className="login-card__brand">
              <span className="login-card__mark"><Footprints size={22} /></span>
              <div><strong>Podo360</strong><small>Ambiente protegido</small></div>
            </div>
            <div className="login-card__heading">
              <span className="login-card__eyebrow"><AlertTriangle size={15} /> Erro ao carregar</span>
              <h2>Nao foi possivel carregar esta pagina.</h2>
              <p>Atualize a tela ou entre em contato com o suporte Podo360.</p>
            </div>
            {import.meta.env.DEV && (
              <pre className="error-boundary-details">
                {this.state.error.name}: {this.state.error.message}
              </pre>
            )}
          </div>
        </section>
      </main>
    );
  }
}
