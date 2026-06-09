import {
  AlertTriangle,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardEdit,
  CreditCard,
  Download,
  FileText,
  Layers3,
  Palette,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundPlus,
  Users
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ChartCard } from "./components/ChartCard";
import { Layout, type ViewKey } from "./components/Layout";
import { MetricCard } from "./components/MetricCard";
import { demoAttendances, demoBodyMaps, demoCompany, demoFinancial, demoPatients, demoProfiles, demoStock } from "./data/demoData";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { generateReferralReport } from "./services/aiReferralReportService";
import type { Attendance, BodyMapEntry, Company, FinancialTransaction, Patient, StockProduct } from "./types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BodyMap3D = lazy(() => import("./components/BodyMap3D").then((module) => ({ default: module.BodyMap3D })));

type DashboardSummary = {
  monthPatients: number;
  weekPatients: number;
  dayPatients: number;
  recurrence: number;
  totalAttendances: number;
  activePatients: number;
  newPatients: number;
  recurringPatients: number;
  revenue: number;
  lowStock: number;
  completed: Attendance[];
};

export function App() {
  const [company, setCompany] = useState<Company>(demoCompany);
  const [signedIn, setSignedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [patients, setPatients] = useState<Patient[]>(demoPatients);
  const [attendances] = useState<Attendance[]>(demoAttendances);
  const [financial] = useState<FinancialTransaction[]>(demoFinancial);
  const [stock] = useState<StockProduct[]>(demoStock);
  const [bodyMaps, setBodyMaps] = useState<BodyMapEntry[]>(demoBodyMaps);
  const [selectedPatientId, setSelectedPatientId] = useState(demoPatients[0].id);
  const [aiReport, setAiReport] = useState("");
  const profile = demoProfiles[0];

  useEffect(() => {
    document.documentElement.style.setProperty("--color-primary", company.primaryColor);
    document.documentElement.style.setProperty("--color-secondary", company.secondaryColor);
    document.documentElement.style.setProperty("--color-accent", company.accentColor);
  }, [company]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const selectedPatientAttendances = attendances.filter((attendance) => attendance.patientId === selectedPatient.id);
  const selectedPatientBodyMaps = bodyMaps.filter((entry) => entry.patientId === selectedPatient.id);

  const dashboard = useMemo(() => {
    const completed = attendances.filter((attendance) => attendance.status === "completed");
    const revenue = financial.filter((item) => item.type === "income" && item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    const recurringPatientIds = new Set(
      patients
        .filter((patient) => attendances.filter((attendance) => attendance.patientId === patient.id).length > 1)
        .map((patient) => patient.id)
    );

    return {
      monthPatients: patients.length,
      weekPatients: 2,
      dayPatients: 1,
      recurrence: recurringPatientIds.size,
      totalAttendances: attendances.length,
      activePatients: patients.length,
      newPatients: patients.filter((patient) => patient.createdAt.startsWith("2026-06")).length,
      recurringPatients: recurringPatientIds.size,
      revenue,
      lowStock: stock.filter((product) => product.currentQuantity <= product.minimumQuantity).length,
      completed
    };
  }, [attendances, financial, patients, stock]);

  async function handleGenerateAiReport(reason = "Persistencia de sintomas e necessidade de avaliacao medica complementar.") {
    const content = await generateReferralReport({
      company,
      patient: selectedPatient,
      attendances: selectedPatientAttendances,
      professionalName: profile.fullName,
      reason
    });
    setAiReport(content);
  }

  function handleSaveBodyMap(entry: Omit<BodyMapEntry, "id" | "createdAt">) {
    setBodyMaps((current) => [
      {
        ...entry,
        id: `body-${current.length + 1}`,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
  }

  function handleAddPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patient: Patient = {
      id: `patient-${patients.length + 1}`,
      companyId: company.id,
      fullName: String(form.get("fullName")),
      cpf: String(form.get("cpf")),
      birthDate: String(form.get("birthDate")),
      phone: String(form.get("whatsapp")),
      whatsapp: String(form.get("whatsapp")),
      address: String(form.get("address")),
      profession: String(form.get("profession") || ""),
      createdAt: new Date().toISOString(),
      clinical: {
        chiefComplaint: String(form.get("chiefComplaint")),
        diseaseHistory: String(form.get("diseaseHistory") || ""),
        diabetes: form.get("diabetes") === "on",
        hypertension: form.get("hypertension") === "on",
        medications: String(form.get("medications") || ""),
        allergies: String(form.get("allergies") || ""),
        previousSurgeries: "",
        vascularProblems: "",
        dermatologicalProblems: "",
        clinicalNotes: String(form.get("clinicalNotes") || "")
      }
    };

    setPatients((current) => [patient, ...current]);
    setSelectedPatientId(patient.id);
    setActiveView("patient-profile");
  }

  if (!signedIn) {
    return <LoginScreen onDemoAccess={() => setSignedIn(true)} />;
  }

  return (
    <Layout company={company} profile={profile} activeView={activeView} onViewChange={setActiveView}>
      {activeView === "dashboard" && <Dashboard dashboard={dashboard} stock={stock} attendances={attendances} patients={patients} />}
      {activeView === "patients" && <Patients patients={patients} onSelect={(id) => { setSelectedPatientId(id); setActiveView("patient-profile"); }} onAddPatient={handleAddPatient} />}
      {activeView === "patient-profile" && (
        <PatientProfile
          patient={selectedPatient}
          attendances={selectedPatientAttendances}
          bodyMaps={selectedPatientBodyMaps}
          onGenerateReport={handleGenerateAiReport}
          onSaveBodyMap={handleSaveBodyMap}
          company={company}
          professionalId={profile.id}
        />
      )}
      {activeView === "attendances" && <Attendances attendances={attendances} patients={patients} />}
      {activeView === "schedule" && <Schedule attendances={attendances} patients={patients} />}
      {activeView === "financial" && <Financial financial={financial} />}
      {activeView === "stock" && <Stock stock={stock} />}
      {activeView === "reports" && <Reports patient={selectedPatient} report={aiReport} onGenerate={handleGenerateAiReport} onChangeReport={setAiReport} />}
      {activeView === "settings" && <SettingsView company={company} onCompanyChange={setCompany} />}
      {activeView === "super-admin" && <SuperAdmin company={company} />}
      {activeView === "plans" && <Plans />}
    </Layout>
  );
}

function LoginScreen({ onDemoAccess }: { onDemoAccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(isSupabaseConfigured ? "Entre com seu usuario da clinica." : "Modo demo ativo: configure o Supabase no .env para login real.");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    if (!isSupabaseConfigured || !supabase) {
      onDemoAccess();
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    onDemoAccess();
  }

  return (
    <main className="login-screen">
      <section className="login-brand">
        <span className="brand__mark"><ShieldCheck /></span>
        <span className="eyebrow">Sistema de gestao para podologia</span>
        <h1>Podo360</h1>
        <p>Prontuario, anamnese, atendimentos, agenda e acompanhamento visual de curativos em um fluxo simples para a clinica.</p>
      </section>

      <form className="login-card" onSubmit={handleLogin}>
        <h2>Acessar sistema</h2>
        <p>{message}</p>
        <label>
          E-mail
          <input name="email" placeholder="admin@clinica.com" type="email" />
        </label>
        <label>
          Senha
          <input name="password" placeholder="********" type="password" />
        </label>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Entrando..." : isSupabaseConfigured ? "Entrar" : "Entrar no demo"}
        </button>
      </form>
    </main>
  );
}

function Dashboard({ dashboard, stock, attendances, patients }: { dashboard: DashboardSummary; stock: StockProduct[]; attendances: Attendance[]; patients: Patient[] }) {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">Sistema de gestao para podologia</span>
          <h1>Podo360</h1>
          <p>Organize pacientes, anamnese, agenda, atendimentos, financeiro, estoque e relatorios em uma experiencia clara para a equipe.</p>
        </div>
        <div className="hero-panel__actions">
          <button className="primary-button" type="button"><Plus size={18} /> Novo atendimento</button>
          <button className="ghost-button" type="button"><FileText size={18} /> Gerar relatorio</button>
        </div>
      </section>

      <div className="filter-row">
        {["Hoje", "Esta semana", "Este mes", "Periodo personalizado"].map((filter, index) => (
          <button className={index === 2 ? "is-active" : ""} key={filter} type="button">{filter}</button>
        ))}
      </div>

      <section className="metrics-grid">
        <MetricCard icon={<Users />} label="Pacientes no mes" value={String(dashboard.monthPatients)} detail={`${dashboard.weekPatients} nesta semana`} tone="primary" />
        <MetricCard icon={<CalendarCheck />} label="Pacientes no dia" value={String(dashboard.dayPatients)} detail="Filtro aplicado: este mes" tone="success" />
        <MetricCard icon={<TrendingUp />} label="Reincidencia" value={String(dashboard.recurrence)} detail="Pacientes com mais de um retorno" tone="warning" />
        <MetricCard icon={<ClipboardEdit />} label="Atendimentos" value={String(dashboard.totalAttendances)} detail={`${dashboard.activePatients} pacientes ativos`} />
        <MetricCard icon={<Receipt />} label="Receita no periodo" value={currency.format(dashboard.revenue)} detail="Somente pagamentos recebidos" tone="success" />
        <MetricCard icon={<AlertTriangle />} label="Estoque baixo" value={String(dashboard.lowStock)} detail="Produtos abaixo do minimo" tone="danger" />
      </section>

      <div className="dashboard-grid">
        <ChartCard title="Atendimentos por dia" subtitle="Volume operacional da semana" data={[{ label: "Seg", value: 4 }, { label: "Ter", value: 7 }, { label: "Qua", value: 5 }, { label: "Qui", value: 8 }, { label: "Sex", value: 6 }]} />
        <ChartCard title="Novos x recorrentes" subtitle="Comparativo de pacientes" data={[{ label: "Novos", value: dashboard.newPatients, secondary: 0 }, { label: "Recorr.", value: dashboard.recurringPatients, secondary: 0 }]} />
        <ChartCard title="Receita mensal" subtitle="Ultimos meses" format="currency" data={[{ label: "Mar", value: 4200 }, { label: "Abr", value: 5100 }, { label: "Mai", value: 6800 }, { label: "Jun", value: dashboard.revenue }]} />
        <ChartCard title="Reincidencia" subtitle="Pacientes que retornaram no periodo" data={[{ label: "Sem 1", value: 1 }, { label: "Sem 2", value: 2 }, { label: "Sem 3", value: dashboard.recurrence }]} />
      </div>

      <section className="split-grid">
        <div className="data-panel">
          <div className="section-heading">
            <div><h2>Proximos atendimentos</h2><p>Agenda conectada ao historico clinico</p></div>
            <CalendarClock size={20} />
          </div>
          <Table
            headers={["Paciente", "Data", "Status"]}
            rows={attendances.map((attendance) => [patientName(patients, attendance.patientId), formatDateTime(attendance.scheduledAt), statusLabel(attendance.status)])}
          />
        </div>
        <div className="data-panel">
          <div className="section-heading">
            <div><h2>Produtos em alerta</h2><p>Baixa automatica preparada por atendimento</p></div>
            <Boxes size={20} />
          </div>
          <Table
            headers={["Produto", "Atual", "Minimo"]}
            rows={stock.filter((product) => product.currentQuantity <= product.minimumQuantity).map((product) => [product.name, `${product.currentQuantity} ${product.unit}`, `${product.minimumQuantity} ${product.unit}`])}
          />
        </div>
      </section>
    </div>
  );
}

function Patients({ patients, onSelect, onAddPatient }: { patients: Patient[]; onSelect: (id: string) => void; onAddPatient: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Gestao de pacientes</span>
          <h1>Pacientes</h1>
          <p>Cadastro, dados clinicos, historico, financeiro relacionado e relatorios.</p>
        </div>
        <div className="search-box"><Search size={17} /><input placeholder="Buscar paciente, CPF ou telefone" /></div>
      </div>

      <section className="split-grid split-grid--wide">
        <div className="data-panel">
          <Table
            headers={["Nome", "WhatsApp", "Queixa principal", "Cadastro"]}
            rows={patients.map((patient) => [
              <button className="link-button" onClick={() => onSelect(patient.id)} type="button">{patient.fullName}</button>,
              patient.whatsapp,
              patient.clinical.chiefComplaint,
              formatDate(patient.createdAt)
            ])}
          />
        </div>

        <form className="panel-form" onSubmit={onAddPatient}>
          <h2>Novo paciente</h2>
          <label>Nome completo<input name="fullName" required /></label>
          <label>CPF<input name="cpf" required /></label>
          <label>Data de nascimento<input name="birthDate" required type="date" /></label>
          <label>WhatsApp<input name="whatsapp" required /></label>
          <label>Endereco<input name="address" required /></label>
          <label>Profissao<input name="profession" /></label>
          <label>Queixa principal<textarea name="chiefComplaint" required /></label>
          <label>Historico de doencas<textarea name="diseaseHistory" /></label>
          <div className="checkbox-row">
            <label><input name="diabetes" type="checkbox" /> Diabetes</label>
            <label><input name="hypertension" type="checkbox" /> Hipertensao</label>
          </div>
          <label>Medicamentos<input name="medications" /></label>
          <label>Alergias<input name="allergies" /></label>
          <label>Observacoes clinicas<textarea name="clinicalNotes" /></label>
          <button className="primary-button" type="submit"><UserRoundPlus size={18} /> Cadastrar paciente</button>
        </form>
      </section>
    </div>
  );
}

function PatientProfile({
  patient,
  attendances,
  bodyMaps,
  onGenerateReport,
  onSaveBodyMap,
  company,
  professionalId
}: {
  patient: Patient;
  attendances: Attendance[];
  bodyMaps: BodyMapEntry[];
  onGenerateReport: () => void;
  onSaveBodyMap: (entry: Omit<BodyMapEntry, "id" | "createdAt">) => void;
  company: Company;
  professionalId: string;
}) {
  return (
    <div className="page-stack">
      <section className="profile-header">
        <div>
          <span className="eyebrow">Ficha do paciente</span>
          <h1>{patient.fullName}</h1>
          <p>{patient.whatsapp} · {patient.profession || "Profissao nao informada"} · CPF {patient.cpf}</p>
        </div>
        <button className="primary-button" onClick={onGenerateReport} type="button"><Sparkles size={18} /> Gerar relatorio com IA</button>
      </section>

      <section className="tabs-bar">
        {["Dados pessoais", "Historico", "Mapa corporal / Curativos", "Financeiro", "Relatorios"].map((tab, index) => (
          <button className={index === 2 ? "is-active" : ""} key={tab} type="button">{tab}</button>
        ))}
      </section>

      <section className="split-grid">
        <div className="data-panel">
          <div className="section-heading">
            <div><h2>Dados clinicos</h2><p>Anamnese principal do paciente</p></div>
            <ClipboardEdit size={20} />
          </div>
          <dl className="definition-grid">
            <div><dt>Queixa principal</dt><dd>{patient.clinical.chiefComplaint}</dd></div>
            <div><dt>Historico</dt><dd>{patient.clinical.diseaseHistory}</dd></div>
            <div><dt>Diabetes</dt><dd>{patient.clinical.diabetes ? "Sim" : "Nao"}</dd></div>
            <div><dt>Hipertensao</dt><dd>{patient.clinical.hypertension ? "Sim" : "Nao"}</dd></div>
            <div><dt>Medicamentos</dt><dd>{patient.clinical.medications || "Nao informado"}</dd></div>
            <div><dt>Alergias</dt><dd>{patient.clinical.allergies || "Nao informado"}</dd></div>
          </dl>
        </div>
        <div className="data-panel">
          <div className="section-heading">
            <div><h2>Historico de atendimentos</h2><p>Evolucoes e retornos</p></div>
            <CheckCircle2 size={20} />
          </div>
          <Table
            headers={["Data", "Procedimento", "Status"]}
            rows={attendances.map((attendance) => [formatDateTime(attendance.scheduledAt), attendance.procedure, statusLabel(attendance.status)])}
          />
        </div>
      </section>

      <Suspense fallback={<div className="data-panel">Carregando corpo humano 3D...</div>}>
        <BodyMap3D entries={bodyMaps} onSave={onSaveBodyMap} patientId={patient.id} companyId={company.id} professionalId={professionalId} attendanceId={attendances[0]?.id} />
      </Suspense>
    </div>
  );
}

function Attendances({ attendances, patients }: { attendances: Attendance[]; patients: Patient[] }) {
  return (
    <ModulePage eyebrow="Atendimentos / Pacientes" title="Atendimentos" description="Registre queixa, avaliacao clinica, conduta, produtos usados, retorno, valor e status.">
      <Table
        headers={["Paciente", "Tipo", "Procedimento", "Data", "Valor", "Status"]}
        rows={attendances.map((attendance) => [
          patientName(patients, attendance.patientId),
          attendance.type,
          attendance.procedure,
          formatDateTime(attendance.scheduledAt),
          currency.format(attendance.value),
          statusLabel(attendance.status)
        ])}
      />
    </ModulePage>
  );
}

function Schedule({ attendances, patients }: { attendances: Attendance[]; patients: Patient[] }) {
  return (
    <ModulePage eyebrow="Agenda" title="Agenda clinica" description="Visualizacao diaria, semanal e mensal preparada para WhatsApp, Google Agenda e lembretes automaticos.">
      <div className="filter-row">
        {["Dia", "Semana", "Mes", "Profissional", "Status"].map((filter, index) => (
          <button className={index === 1 ? "is-active" : ""} key={filter} type="button">{filter}</button>
        ))}
      </div>
      <Table
        headers={["Horario", "Paciente", "Acao esperada", "Status"]}
        rows={attendances.map((attendance) => [
          formatDateTime(attendance.scheduledAt),
          patientName(patients, attendance.patientId),
          attendance.status === "scheduled" ? "Confirmar atendimento" : "Consultar evolucao",
          statusLabel(attendance.status)
        ])}
      />
    </ModulePage>
  );
}

function Financial({ financial }: { financial: FinancialTransaction[] }) {
  const received = financial.filter((item) => item.type === "income" && item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const pending = financial.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
  const expenses = financial.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">Gestao financeiro</span><h1>Financeiro</h1><p>Receitas, despesas, pagamentos por paciente e relatorios financeiros.</p></div>
        <button className="primary-button" type="button"><Plus size={18} /> Lancamento</button>
      </div>
      <section className="metrics-grid">
        <MetricCard icon={<CreditCard />} label="Recebido no mes" value={currency.format(received)} detail="Pagamentos confirmados" tone="success" />
        <MetricCard icon={<Receipt />} label="Pendente" value={currency.format(pending)} detail="A receber" tone="warning" />
        <MetricCard icon={<AlertTriangle />} label="Atrasado" value={currency.format(0)} detail="Sem atraso no demo" />
        <MetricCard icon={<TrendingUp />} label="Lucro estimado" value={currency.format(received - expenses)} detail="Receita - despesas" tone="primary" />
      </section>
      <div className="dashboard-grid">
        <ChartCard title="Receita mensal" subtitle="Entradas confirmadas" format="currency" data={[{ label: "Mar", value: 4200 }, { label: "Abr", value: 5100 }, { label: "Mai", value: 6800 }, { label: "Jun", value: received }]} />
        <ChartCard title="Despesas por categoria" subtitle="Saidas agrupadas" format="currency" data={[{ label: "Estoque", value: expenses }, { label: "Aluguel", value: 1200 }, { label: "Marketing", value: 450 }]} />
      </div>
      <Table headers={["Descricao", "Tipo", "Valor", "Vencimento", "Forma", "Status"]} rows={financial.map((item) => [item.description, item.type === "income" ? "Receita" : "Despesa", currency.format(item.amount), formatDate(item.dueDate), paymentLabel(item.paymentMethod), paymentStatusLabel(item.status)])} />
    </div>
  );
}

function Stock({ stock }: { stock: StockProduct[] }) {
  const totalValue = stock.reduce((sum, product) => sum + product.currentQuantity * product.costValue, 0);
  const low = stock.filter((product) => product.currentQuantity <= product.minimumQuantity);

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">Estoque</span><h1>Dashboard de estoque</h1><p>Produtos, movimentacoes, validade, valor em estoque e alerta de minimo.</p></div>
        <button className="primary-button" type="button"><Plus size={18} /> Novo produto</button>
      </div>
      <section className="metrics-grid">
        <MetricCard icon={<Boxes />} label="Total de produtos" value={String(stock.length)} detail="Produtos cadastrados" />
        <MetricCard icon={<AlertTriangle />} label="Estoque baixo" value={String(low.length)} detail="Abaixo do minimo" tone="danger" />
        <MetricCard icon={<CalendarClock />} label="Prox. validade" value="1" detail="Vence em ate 90 dias" tone="warning" />
        <MetricCard icon={<Receipt />} label="Valor em estoque" value={currency.format(totalValue)} detail="Pelo custo medio" tone="success" />
      </section>
      <Table headers={["Produto", "Categoria", "Codigo", "Atual", "Minimo", "Fornecedor", "Validade"]} rows={stock.map((product) => [product.name, product.category, product.internalCode, `${product.currentQuantity} ${product.unit}`, `${product.minimumQuantity} ${product.unit}`, product.supplier, product.expiresAt ? formatDate(product.expiresAt) : "Sem validade"])} />
    </div>
  );
}

function Reports({ patient, report, onGenerate, onChangeReport }: { patient: Patient; report: string; onGenerate: () => void; onChangeReport: (value: string) => void }) {
  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">Relatorios</span><h1>Relatorios clinicos e financeiros</h1><p>Historico de atendimento, financeiro e encaminhamento medico com IA.</p></div>
        <button className="primary-button" onClick={onGenerate} type="button"><Sparkles size={18} /> Gerar relatorio com IA</button>
      </div>
      <section className="split-grid">
        <div className="data-panel">
          <h2>Filtros</h2>
          <div className="report-list">
            <button className="is-active" type="button"><FileText size={18} /> Encaminhamento medico</button>
            <button type="button"><Receipt size={18} /> Financeiro</button>
            <button type="button"><ClipboardEdit size={18} /> Historico de atendimento</button>
          </div>
          <p className="muted">Paciente atual: {patient.fullName}</p>
        </div>
        <div className="data-panel">
          <div className="section-heading section-heading--compact">
            <div><h2>Relatorio editavel</h2><p>A IA organiza o historico sem emitir diagnostico definitivo.</p></div>
            <div className="icon-group">
              <button className="icon-button" title="Exportar PDF" type="button"><Download size={17} /></button>
              <button className="icon-button" title="Imprimir" type="button"><Printer size={17} /></button>
              <button className="icon-button" title="Enviar futuramente" type="button"><Send size={17} /></button>
            </div>
          </div>
          <textarea className="report-editor" value={report || "Clique em Gerar relatorio com IA para criar o encaminhamento."} onChange={(event) => onChangeReport(event.target.value)} />
        </div>
      </section>
    </div>
  );
}

function SettingsView({ company, onCompanyChange }: { company: Company; onCompanyChange: (company: Company) => void }) {
  function update<K extends keyof Company>(key: K, value: Company[K]) {
    onCompanyChange({ ...company, [key]: value });
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">Identidade da clinica</span><h1>Configuracoes da empresa</h1><p>Logo, cores, nome exibido e dados comerciais por clinica.</p></div>
        <Palette size={24} />
      </div>
      <section className="split-grid">
        <form className="panel-form">
          <label>Nome exibido<input value={company.displayName} onChange={(event) => update("displayName", event.target.value)} /></label>
          <label>E-mail comercial<input value={company.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} /></label>
          <label>Telefone comercial<input value={company.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} /></label>
          <label>Logo URL<input value={company.logoUrl || ""} onChange={(event) => update("logoUrl", event.target.value)} /></label>
          <label>Cor principal<input type="color" value={company.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} /></label>
          <label>Cor secundaria<input type="color" value={company.secondaryColor} onChange={(event) => update("secondaryColor", event.target.value)} /></label>
          <label>Cor de destaque<input type="color" value={company.accentColor} onChange={(event) => update("accentColor", event.target.value)} /></label>
        </form>
        <div className="brand-preview">
          <span className="brand__mark"><Layers3 /></span>
          <h2>{company.displayName}</h2>
          <p>{company.contactPhone} · {company.contactEmail}</p>
          <button className="primary-button" type="button">Botao com cor da clinica</button>
          <small>Supabase: {isSupabaseConfigured ? "configurado" : "aguardando variaveis .env"}</small>
        </div>
      </section>
    </div>
  );
}

function SuperAdmin({ company }: { company: Company }) {
  return (
    <ModulePage eyebrow="Gestao administrativa" title="Super Admin" description="Gerencie empresas, planos, bloqueios, usuarios e saude operacional da plataforma.">
      <section className="metrics-grid">
        <MetricCard icon={<BuildingIcon />} label="Empresas" value="1" detail="Clinicas cadastradas" tone="primary" />
        <MetricCard icon={<Users />} label="Usuarios" value={String(demoProfiles.length)} detail="Todos os perfis" />
        <MetricCard icon={<CreditCard />} label="MRR previsto" value="R$ 349" detail="Plano ativo" tone="success" />
        <MetricCard icon={<AlertTriangle />} label="Bloqueadas" value="0" detail="Sem restricoes" />
      </section>
      <Table headers={["Empresa", "Plano", "Status", "Contato"]} rows={[[company.displayName, company.planName, company.planStatus, company.contactEmail]]} />
    </ModulePage>
  );
}

function Plans() {
  return (
    <ModulePage eyebrow="Planos e assinaturas" title="Planos" description="Estrutura pronta para trials, upgrade, bloqueio, cobranca e limites por plano.">
      <div className="plans-grid">
        {[
          ["Start", "R$ 149", "Agenda, pacientes e atendimentos"],
          ["Professional", "R$ 349", "Financeiro, estoque, relatorios e IA"],
          ["Enterprise", "Sob consulta", "Personalizacao avancada, multiunidade e API"]
        ].map(([name, price, description]) => (
          <article className="plan-card" key={name}>
            <span>{name}</span>
            <strong>{price}</strong>
            <p>{description}</p>
            <button className="ghost-button" type="button">Configurar</button>
          </article>
        ))}
      </div>
    </ModulePage>
  );
}

function ModulePage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      </div>
      <div className="data-panel">{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function patientName(patients: Patient[], patientId: string) {
  return patients.find((patient) => patient.id === patientId)?.fullName ?? "Paciente nao localizado";
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: Attendance["status"]) {
  const labels: Record<Attendance["status"], string> = {
    scheduled: "Agendado",
    in_progress: "Em atendimento",
    completed: "Finalizado",
    cancelled: "Cancelado",
    no_show: "Faltou"
  };
  return labels[status];
}

function paymentLabel(method: FinancialTransaction["paymentMethod"]) {
  const labels: Record<FinancialTransaction["paymentMethod"], string> = {
    pix: "Pix",
    cash: "Dinheiro",
    credit_card: "Cartao de credito",
    debit_card: "Cartao de debito",
    insurance: "Convenio",
    other: "Outro"
  };
  return labels[method];
}

function paymentStatusLabel(status: FinancialTransaction["status"]) {
  const labels: Record<FinancialTransaction["status"], string> = {
    paid: "Pago",
    pending: "Pendente",
    overdue: "Atrasado",
    cancelled: "Cancelado"
  };
  return labels[status];
}

function BuildingIcon() {
  return <span className="text-icon">B</span>;
}
