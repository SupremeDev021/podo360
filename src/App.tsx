import {
  AlertTriangle,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardEdit,
  ClipboardPlus,
  CreditCard,
  Download,
  FileText,
  HeartPulse,
  Layers3,
  Palette,
  Plus,
  PlayCircle,
  Printer,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnamnesisWizard } from "./components/AnamnesisWizard";
import { ChartCard } from "./components/ChartCard";
import { FootSensitivityMap3D } from "./components/FootSensitivityMap3D";
import { ImageEvolutionComparison } from "./components/ImageEvolutionComparison";
import { Layout, type ViewKey } from "./components/Layout";
import { MetricCard } from "./components/MetricCard";
import { UniqueMedicalRecordView } from "./components/UniqueMedicalRecord";
import { WoundImageModule } from "./components/WoundImageModule";
import {
  demoAnamneses,
  demoAttendanceImages,
  demoAttendances,
  demoCompany,
  demoFinancial,
  demoFootSensitivityMaps,
  demoHciConsents,
  demoHciMatches,
  demoIntegratedHistories,
  demoPatients,
  demoProfiles,
  demoStock,
  demoUniqueMedicalRecords
} from "./data/demoData";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { generateReferralReport } from "./services/aiReferralReportService";
import type {
  AnamnesisRecord,
  Attendance,
  AttendanceImage,
  Company,
  FinancialTransaction,
  FootSensitivityMap,
  HciPatientMatch,
  Patient,
  StockProduct,
  UniqueMedicalRecord
} from "./types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

type AppNotice = {
  id: number;
  title: string;
  message: string;
  tone?: "success" | "info" | "warning" | "danger";
};

type PatientTabKey = "patient-data" | "unique-record" | "anamnesis" | "wound-images" | "image-evolution" | "reports";

const patientTabs: Array<{ key: PatientTabKey; label: string }> = [
  { key: "patient-data", label: "Dados do paciente" },
  { key: "unique-record", label: "ProntuárioÚnico" },
  { key: "anamnesis", label: "Anamnese modular" },
  { key: "wound-images", label: "Imagens da ferida" },
  { key: "image-evolution", label: "Comparativo de evolução" },
  { key: "reports", label: "Relatórios" }
];

export function App() {
  const [company, setCompany] = useState<Company>(demoCompany);
  const [signedIn, setSignedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [patients, setPatients] = useState<Patient[]>(demoPatients);
  const [uniqueMedicalRecords, setUniqueMedicalRecords] = useState<UniqueMedicalRecord[]>(demoUniqueMedicalRecords);
  const [attendances, setAttendances] = useState<Attendance[]>(demoAttendances);
  const [anamneses, setAnamneses] = useState<AnamnesisRecord[]>(demoAnamneses);
  const [financial] = useState<FinancialTransaction[]>(demoFinancial);
  const [stock] = useState<StockProduct[]>(demoStock);
  const [footSensitivityMaps, setFootSensitivityMaps] = useState<FootSensitivityMap[]>(demoFootSensitivityMaps);
  const [attendanceImages, setAttendanceImages] = useState<AttendanceImage[]>(demoAttendanceImages);
  const [includeHciInReport, setIncludeHciInReport] = useState(false);
  const [hciQuery, setHciQuery] = useState("");
  const [hciSelectedMatch, setHciSelectedMatch] = useState<HciPatientMatch | null>(demoHciMatches[0]);
  const [selectedPatientId, setSelectedPatientId] = useState(demoPatients[0].id);
  const [activeAttendanceId, setActiveAttendanceId] = useState<string | null>(demoAttendances[2]?.id ?? null);
  const [aiReport, setAiReport] = useState("");
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const profile = demoProfiles[0];

  useEffect(() => {
    document.documentElement.style.setProperty("--color-primary", company.primaryColor);
    document.documentElement.style.setProperty("--color-secondary", company.secondaryColor);
    document.documentElement.style.setProperty("--color-accent", company.accentColor);
  }, [company]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const selectedUniqueMedicalRecord = uniqueMedicalRecords.find((record) => record.id === selectedPatient.uniqueMedicalRecordId);
  const selectedPatientAttendances = attendances.filter((attendance) => attendance.patientId === selectedPatient.id);
  const selectedPatientAnamneses = anamneses.filter((record) => record.patientId === selectedPatient.id);
  const selectedPatientFootMaps = footSensitivityMaps.filter((entry) => entry.patientId === selectedPatient.id);
  const selectedPatientImages = attendanceImages.filter((image) => image.patientId === selectedPatient.id);
  const authorizedHciHistories = includeHciInReport
    ? demoIntegratedHistories.filter((history) =>
        demoHciConsents.some((consent) =>
          consent.uniqueMedicalRecordId === selectedPatient.uniqueMedicalRecordId &&
          consent.sourceCompanyId === history.sourceCompany.id &&
          consent.consentStatus === "authorized"
        )
      )
    : [];

  function notify(title: string, message: string, tone: AppNotice["tone"] = "success") {
    setNotice({ id: Date.now(), title, message, tone });
  }

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
      anamneses: selectedPatientAnamneses,
      footSensitivityMaps: selectedPatientFootMaps,
      attendanceImages: selectedPatientImages,
      integratedHistories: authorizedHciHistories,
      includeHci: includeHciInReport,
      professionalName: profile.fullName,
      reason
    });
    setAiReport(content);
  }

  function handleSaveFootSensitivity(entry: Omit<FootSensitivityMap, "id" | "createdAt">) {
    setFootSensitivityMaps((current) => [
      {
        ...entry,
        id: `foot-map-${current.length + 1}`,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    notify("Ponto salvo", "Sensibilidade do pe 3D registrada neste BA.", "success");
  }

  function handleSaveAnamnesis(record: AnamnesisRecord) {
    setAnamneses((current) => {
      const index = current.findIndex((item) => item.id === record.id);
      if (index < 0) return [record, ...current];
      return current.map((item) => (item.id === record.id ? record : item));
    });
    notify(record.isCompleted ? "Ficha finalizada" : "Ficha salva como rascunho", "Progresso da anamnese modular vinculado ao BA.", "success");
  }

  function handleSaveAttendanceImage(image: Omit<AttendanceImage, "id" | "createdAt">) {
    setAttendanceImages((current) => [
      {
        ...image,
        id: `attendance-image-${current.length + 1}`,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    notify("Imagem da ferida salva", "Registro visual vinculado ao BA e ao ProntuárioÚnico.", "success");
  }

  function handleSaveComparativeNote(imageIds: string[], note: string) {
    setAttendanceImages((current) =>
      current.map((image) =>
        imageIds.includes(image.id)
          ? { ...image, comparativeNotes: note, updatedAt: new Date().toISOString() }
          : image
      )
    );
    notify("Comparativo salvo", "Observacao comparativa aplicada as imagens selecionadas.", "success");
  }

  function handleCreateAttendance(patient: Patient, options?: Partial<Attendance>) {
    const nextBaNumber = generateBaNumber(company.id, attendances);
    const openedAt = new Date().toISOString();
    const attendance: Attendance = {
      id: `attendance-${attendances.length + 1}`,
      companyId: company.id,
      patientId: patient.id,
      uniqueMedicalRecordId: patient.uniqueMedicalRecordId,
      uniqueRecordNumber: patient.uniqueRecordNumber,
      baNumber: nextBaNumber,
      professionalId: options?.professionalId,
      openedAt,
      openedBy: profile.id,
      scheduledAt: openedAt,
      attendanceDate: openedAt,
      type: options?.type ?? "Atendimento podologico",
      visitKind: options?.visitKind ?? "first_evaluation",
      initialNotes: options?.initialNotes ?? "",
      priority: options?.priority ?? "normal",
      procedure: "BA aberto",
      complaint: options?.complaint ?? patient.clinical.chiefComplaint,
      clinicalEvaluation: "",
      conduct: "",
      productsUsed: [],
      notes: options?.notes ?? "BA aberto pela recepcao.",
      status: "waiting",
      value: 0
    };

    setAttendances((current) => [attendance, ...current]);
    setSelectedPatientId(patient.id);
    setActiveAttendanceId(attendance.id);
    notify("BA aberto com sucesso", `${attendance.baNumber} entrou como Aguardando atendimento.`, "success");
    setActiveView("patients");
  }

  function handleOpenBa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName"));
    const cpf = String(form.get("cpf"));
    const birthDate = String(form.get("birthDate"));
    const phone = String(form.get("phone"));
    const whatsapp = String(form.get("whatsapp") || phone);
    const uniqueRecordNumber = String(form.get("uniqueRecordNumber") || "");
    const existingUniqueRecord = findExistingUniqueRecordForPatient({ fullName, cpf, birthDate, phone: whatsapp }, patients, demoHciMatches);
    const existingPatient = patients.find((patient) =>
      normalizeText(patient.uniqueRecordNumber) === normalizeText(uniqueRecordNumber) ||
      normalizeDigits(patient.cpf) === normalizeDigits(cpf) ||
      (normalizeText(patient.fullName) === normalizeText(fullName) && patient.birthDate === birthDate)
    );

    if (existingUniqueRecord) {
      notify("Paciente ja possui ProntuárioÚnico", `Sera usado o numero ${existingUniqueRecord.uniqueRecordNumber}.`, "info");
    }

    const patient: Patient = existingPatient ?? {
      id: `patient-${patients.length + 1}`,
      companyId: company.id,
      uniqueMedicalRecordId: existingUniqueRecord?.uniqueMedicalRecordId ?? `unique-record-${patients.length + 1}`,
      uniqueRecordNumber: existingUniqueRecord?.uniqueRecordNumber ?? generateUniqueRecordNumber(patients),
      fullName,
      cpf,
      birthDate,
      phone,
      whatsapp,
      email: String(form.get("email") || ""),
      address: String(form.get("address")),
      profession: String(form.get("profession") || ""),
      createdAt: new Date().toISOString(),
      clinical: {
        chiefComplaint: String(form.get("chiefComplaint")),
        diseaseHistory: "",
        diabetes: false,
        hypertension: false,
        medications: "",
        allergies: "",
        previousSurgeries: "",
        vascularProblems: "",
        dermatologicalProblems: "",
        clinicalNotes: String(form.get("initialNotes") || "")
      }
    };

    if (!existingPatient) {
      setPatients((current) => [patient, ...current]);
    }
    if (!existingUniqueRecord && !existingPatient) {
      setUniqueMedicalRecords((current) => [
        {
          id: patient.uniqueMedicalRecordId,
          uniqueRecordNumber: patient.uniqueRecordNumber,
          patientUniqueId: `patient-identity-${patient.id}`,
          cpfHash: `hash:${patient.cpf}`,
          normalizedPatientName: normalizeText(patient.fullName),
          birthDate: patient.birthDate,
          phoneHash: `hash:${patient.whatsapp}`,
          emailHash: patient.email ? `hash:${patient.email}` : undefined,
          createdAt: patient.createdAt,
          updatedAt: patient.createdAt
        },
        ...current
      ]);
    }
    handleCreateAttendance(patient, {
      professionalId: String(form.get("professionalId") || "") || undefined,
      type: String(form.get("attendanceType") || "Atendimento podologico"),
      visitKind: String(form.get("visitKind")) === "return" ? "return" : "first_evaluation",
      complaint: String(form.get("chiefComplaint") || ""),
      initialNotes: String(form.get("initialNotes") || ""),
      priority: String(form.get("priority") || "normal") as Attendance["priority"],
      notes: [
        `Clinica vinculada: ${company.displayName}.`,
        String(form.get("attendanceOrigin") || "") ? `Origem: ${String(form.get("attendanceOrigin"))}.` : "",
        String(form.get("payerType") || "") ? `Pagamento: ${String(form.get("payerType"))}.` : "",
        String(form.get("openingReason") || "") ? `Motivo: ${String(form.get("openingReason"))}.` : "",
        String(form.get("initialNotes") || "")
      ].filter(Boolean).join(" ")
    });
    event.currentTarget.reset();
  }

  function handleStartAttendance(attendanceId: string) {
    const now = new Date().toISOString();
    let targetPatientId = selectedPatientId;
    setAttendances((current) =>
      current.map((attendance) => {
        if (attendance.id !== attendanceId) return attendance;
        targetPatientId = attendance.patientId;
        return {
          ...attendance,
          status: "in_progress",
          startedAt: attendance.startedAt ?? now,
          startedBy: attendance.startedBy ?? profile.id,
          professionalId: attendance.professionalId || profile.id,
          updatedAt: now
        };
      })
    );
    setSelectedPatientId(targetPatientId);
    setActiveAttendanceId(attendanceId);
    notify("Atendimento iniciado", "Status alterado para Em atendimento e ficha modular carregada.", "success");
    setActiveView("patient-profile");
  }

  function handleFinishAttendance(attendanceId: string) {
    const now = new Date().toISOString();
    setAttendances((current) =>
      current.map((attendance) =>
        attendance.id === attendanceId
          ? { ...attendance, status: "completed", finishedAt: attendance.finishedAt ?? now, finishedBy: profile.id, updatedAt: now }
          : attendance
      )
    );
    notify("Atendimento finalizado", "Data e hora de finalizacao foram registradas no BA.", "success");
  }

  if (!signedIn) {
    return <LoginScreen onDemoAccess={() => setSignedIn(true)} />;
  }

  return (
    <Layout company={company} profile={profile} activeView={activeView} onViewChange={setActiveView}>
      {notice && <Toast notice={notice} onClose={() => setNotice(null)} />}
      {activeView === "dashboard" && <Dashboard dashboard={dashboard} stock={stock} attendances={attendances} patients={patients} />}
      {activeView === "ba-opening" && (
        <BaOpening
          company={company}
          profiles={demoProfiles}
          patients={patients}
          attendances={attendances}
          onOpenBa={handleOpenBa}
          onNotify={notify}
        />
      )}
      {activeView === "patients" && (
        <Patients
          patients={patients}
          attendances={attendances}
          profiles={demoProfiles}
          onSelect={(id) => { setSelectedPatientId(id); setActiveView("patient-profile"); }}
          onStartAttendance={handleStartAttendance}
          onContinueAttendance={handleStartAttendance}
          onExportBa={(attendance) => {
            const patient = patients.find((item) => item.id === attendance.patientId);
            if (patient) exportAttendanceBa(patient, company, attendance, anamneses, footSensitivityMaps, attendanceImages);
          }}
        />
      )}
      {activeView === "patient-profile" && (
        <PatientProfile
          patient={selectedPatient}
          attendances={selectedPatientAttendances}
          activeAttendanceId={activeAttendanceId}
          uniqueMedicalRecord={selectedUniqueMedicalRecord}
          anamneses={selectedPatientAnamneses}
          footSensitivityMaps={selectedPatientFootMaps}
          attendanceImages={selectedPatientImages}
          onGenerateReport={handleGenerateAiReport}
          onCreateAttendance={handleCreateAttendance}
          onFinishAttendance={handleFinishAttendance}
          onSaveAnamnesis={handleSaveAnamnesis}
          onSaveFootSensitivity={handleSaveFootSensitivity}
          onSaveAttendanceImage={handleSaveAttendanceImage}
          onSaveComparativeNote={handleSaveComparativeNote}
          company={company}
          professionalId={profile.id}
        />
      )}
      {activeView === "attendances" && <Attendances attendances={attendances} patients={patients} />}
      {activeView === "schedule" && <Schedule attendances={attendances} patients={patients} />}
      {activeView === "financial" && <Financial financial={financial} />}
      {activeView === "stock" && <Stock stock={stock} />}
      {activeView === "reports" && (
        <Reports
          patient={selectedPatient}
          report={aiReport}
          includeHci={includeHciInReport}
          hciAvailable={demoHciMatches.some((match) => match.consentStatus === "authorized")}
          onIncludeHciChange={setIncludeHciInReport}
          onGenerate={handleGenerateAiReport}
          onChangeReport={setAiReport}
        />
      )}
      {activeView === "hci" && (
        <HciView
          query={hciQuery}
          onQueryChange={setHciQuery}
          matches={filterHciMatches(hciQuery, demoHciMatches)}
          selectedMatch={hciSelectedMatch}
          onSelectMatch={setHciSelectedMatch}
        />
      )}
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

function Toast({ notice, onClose }: { notice: AppNotice; onClose: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timeout);
  }, [notice.id, onClose]);

  return (
    <aside className={`toast toast--${notice.tone ?? "info"}`} role="status">
      <CheckCircle2 size={19} />
      <div>
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </div>
      <button onClick={onClose} type="button" aria-label="Fechar aviso">×</button>
    </aside>
  );
}

type PatientSearchResult = {
  patient: Patient;
  lastBa?: Attendance;
};

function BaOpening({
  company,
  profiles,
  patients,
  attendances,
  onOpenBa,
  onNotify
}: {
  company: Company;
  profiles: typeof demoProfiles;
  patients: Patient[];
  attendances: Attendance[];
  onOpenBa: (event: FormEvent<HTMLFormElement>) => void;
  onNotify: (title: string, message: string, tone?: AppNotice["tone"]) => void;
}) {
  const [patientData, setPatientData] = useState({
    fullName: "",
    cpf: "",
    birthDate: "",
    age: "",
    profession: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    uniqueRecordNumber: ""
  });
  const [birthDateMessage, setBirthDateMessage] = useState("");
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  function updatePatientField(key: keyof typeof patientData, value: string) {
    if (key === "birthDate") {
      const result = calculateAgeValue(value);
      setBirthDateMessage(result.message);
      setPatientData((current) => ({ ...current, birthDate: value, age: result.ageText }));
      if (result.message) onNotify("Data de nascimento invalida", result.message, "warning");
      return;
    }
    setPatientData((current) => ({ ...current, [key]: value }));
  }

  function searchPatients() {
    const query = normalizeText(patientData.fullName);
    const cpf = normalizeDigits(patientData.cpf);
    const phone = normalizeDigits(patientData.whatsapp || patientData.phone);
    const record = normalizeText(patientData.uniqueRecordNumber);

    if (!query && !cpf && !phone && !record) {
      onNotify("Informe um dado para busca", "Digite nome, CPF, telefone, WhatsApp ou ProntuárioÚnico.", "warning");
      return;
    }

    const results = patients
      .filter((patient) => {
        const matchesName = query && normalizeText(patient.fullName).includes(query);
        const matchesCpf = cpf && normalizeDigits(patient.cpf).includes(cpf);
        const matchesPhone = phone && normalizeDigits(patient.whatsapp || patient.phone).includes(phone);
        const matchesRecord = record && normalizeText(patient.uniqueRecordNumber).includes(record);
        return matchesName || matchesCpf || matchesPhone || matchesRecord;
      })
      .map((patient) => ({
        patient,
        lastBa: attendances
          .filter((attendance) => attendance.patientId === patient.id)
          .sort((a, b) => new Date(b.openedAt ?? b.scheduledAt).getTime() - new Date(a.openedAt ?? a.scheduledAt).getTime())[0]
      }));

    setSearchResults(results);
    setSearchOpen(true);
    if (!results.length) {
      onNotify("Nenhum paciente encontrado", "Continue o cadastro para criar um novo ProntuárioÚnico.", "info");
    }
  }

  function selectPatient(patient: Patient) {
    setPatientData({
      fullName: patient.fullName,
      cpf: patient.cpf,
      birthDate: patient.birthDate,
      age: calculateAge(patient.birthDate),
      profession: patient.profession || "",
      phone: patient.phone,
      whatsapp: patient.whatsapp,
      email: patient.email || "",
      address: patient.address,
      uniqueRecordNumber: patient.uniqueRecordNumber
    });
    setBirthDateMessage("");
    setSearchOpen(false);
    onNotify("Paciente encontrado", "Dados do paciente preenchidos automaticamente. Preencha os Dados do BA manualmente.", "success");
  }

  function handleBaSubmit(event: FormEvent<HTMLFormElement>) {
    onOpenBa(event);
    setPatientData({
      fullName: "",
      cpf: "",
      birthDate: "",
      age: "",
      profession: "",
      phone: "",
      whatsapp: "",
      email: "",
      address: "",
      uniqueRecordNumber: ""
    });
    setBirthDateMessage("");
    setSearchOpen(false);
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Recepcao · ponto inicial do atendimento</span>
          <h1>Abertura de BA</h1>
          <p>Identifique ou crie o ProntuárioÚnico, gere o BA e coloque o paciente em Aguardando atendimento.</p>
        </div>
        <ClipboardPlus size={28} />
      </div>

      <form className="panel-form ba-form" onSubmit={handleBaSubmit}>
        <section>
          <h2>Dados do Paciente</h2>
          <div className="form-grid">
            <label className="field-with-action">Nome completo
              <span>
                <input name="fullName" required value={patientData.fullName} onChange={(event) => updatePatientField("fullName", event.target.value)} />
                <button className="icon-button" onClick={searchPatients} type="button" title="Pesquisar paciente existente"><Search size={18} /></button>
              </span>
            </label>
            <label>CPF<input name="cpf" value={patientData.cpf} onChange={(event) => updatePatientField("cpf", event.target.value)} /></label>
            <label>Data de nascimento<input name="birthDate" type="date" value={patientData.birthDate} onChange={(event) => updatePatientField("birthDate", event.target.value)} /></label>
            <label>Idade<input name="age" min="0" readOnly value={patientData.age} /></label>
            <label>Profissao<input name="profession" value={patientData.profession} onChange={(event) => updatePatientField("profession", event.target.value)} /></label>
            <label>Telefone<input name="phone" value={patientData.phone} onChange={(event) => updatePatientField("phone", event.target.value)} /></label>
            <label>WhatsApp<input name="whatsapp" value={patientData.whatsapp} onChange={(event) => updatePatientField("whatsapp", event.target.value)} /></label>
            <label>E-mail<input name="email" type="email" value={patientData.email} onChange={(event) => updatePatientField("email", event.target.value)} /></label>
            <label>ProntuárioÚnico<input name="uniqueRecordNumber" value={patientData.uniqueRecordNumber} onChange={(event) => updatePatientField("uniqueRecordNumber", event.target.value)} placeholder="Preenchido ao selecionar paciente existente" /></label>
          </div>
          <label>Endereco<input name="address" value={patientData.address} onChange={(event) => updatePatientField("address", event.target.value)} /></label>
          {birthDateMessage && <p className="inline-warning">{birthDateMessage}</p>}

          {searchOpen && (
            <div className="search-results-panel">
              <div className="section-heading section-heading--compact">
                <div>
                  <h3>Resultados da busca</h3>
                  <p>{searchResults.length ? "Selecione um paciente para preencher somente os Dados do Paciente." : "Nenhum paciente encontrado. Continue o cadastro para criar um novo ProntuárioÚnico."}</p>
                </div>
                <button className="ghost-action" onClick={() => setSearchOpen(false)} type="button">Fechar</button>
              </div>
              <div className="search-result-list">
                {searchResults.map(({ patient, lastBa }) => (
                  <button key={patient.id} onClick={() => selectPatient(patient)} type="button">
                    <strong>{patient.fullName}</strong>
                    <span>CPF {maskCpf(patient.cpf)} · {formatDate(patient.birthDate)} · {calculateAge(patient.birthDate)}</span>
                    <small>{patient.whatsapp || patient.phone} · ProntuárioÚnico {patient.uniqueRecordNumber} · Ultimo BA {lastBa?.baNumber ?? "sem BA"}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2>Dados do BA</h2>
          <div className="form-grid">
            <label>Tipo de atendimento<input name="attendanceType" placeholder="Ex.: avaliacao podologica" /></label>
            <label>
              Primeira avaliacao ou retorno
              <select name="visitKind" defaultValue="">
                <option value="">Selecione</option>
                <option value="first_evaluation">Primeira avaliacao</option>
                <option value="return">Retorno</option>
              </select>
            </label>
            <label>
              Clinica/empresa vinculada
              <input value={company.displayName} readOnly />
            </label>
            <label>
              Profissional responsavel
              <select name="professionalId" defaultValue="">
                <option value="">Definir depois</option>
                {profiles.filter((item) => item.role === "professional" || item.role === "company_admin").map((item) => (
                  <option key={item.id} value={item.id}>{item.fullName}</option>
                ))}
              </select>
            </label>
            <label>
              Prioridade
              <select name="priority" defaultValue="">
                <option value="">Selecione</option>
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
            <label>Origem do atendimento<input name="attendanceOrigin" placeholder="Ex.: recepcao, WhatsApp, encaminhamento" /></label>
            <label>Convenio ou particular<input name="payerType" placeholder="Ex.: particular" /></label>
            <label>Data/hora de abertura<input value={new Date().toLocaleString("pt-BR")} readOnly /></label>
          </div>
          <label>Queixa principal inicial<textarea name="chiefComplaint" /></label>
          <label>Observacoes iniciais<textarea name="initialNotes" /></label>
          <label>Motivo da abertura do BA<textarea name="openingReason" /></label>
        </section>

        <button className="primary-button" type="submit"><ClipboardPlus size={18} /> Abrir BA</button>
      </form>
    </div>
  );
}

function Patients({
  patients,
  attendances,
  profiles,
  onSelect,
  onStartAttendance,
  onContinueAttendance,
  onExportBa
}: {
  patients: Patient[];
  attendances: Attendance[];
  profiles: typeof demoProfiles;
  onSelect: (id: string) => void;
  onStartAttendance: (attendanceId: string) => void;
  onContinueAttendance: (attendanceId: string) => void;
  onExportBa: (attendance: Attendance) => void;
}) {
  const queue = patients.map((patient) => {
    const patientAttendances = attendances
      .filter((attendance) => attendance.patientId === patient.id)
      .sort((a, b) => new Date(b.openedAt ?? b.scheduledAt).getTime() - new Date(a.openedAt ?? a.scheduledAt).getTime());
    const lastBa = patientAttendances[0];
    return { patient, lastBa, lastAttendance: patientAttendances.find((attendance) => attendance.status === "completed") };
  });

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Fila hospitalar adaptada para podologia</span>
          <h1>Pacientes</h1>
          <p>Tela operacional com status de BA e acoes de atendimento. Historico completo fica no ProntuárioÚnico, historico do paciente ou HCI autorizado.</p>
        </div>
        <div className="search-box"><Search size={17} /><input placeholder="Buscar paciente, CPF ou telefone" /></div>
      </div>

      <section className="data-panel">
        <Table
          headers={["Paciente", "ProntuárioÚnico", "Contato", "Idade", "Status", "Ultimo BA", "Abertura", "Ultimo atendimento", "Profissional", "Acoes"]}
          rows={queue.map(({ patient, lastBa, lastAttendance }) => [
            <button className="link-button" onClick={() => onSelect(patient.id)} type="button">{patient.fullName}</button>,
            patient.uniqueRecordNumber,
            <span>{patient.cpf ? `CPF ${patient.cpf}` : "CPF oculto"}<br />{patient.whatsapp || patient.phone}</span>,
            calculateAge(patient.birthDate),
            <span className={`status-badge status-badge--${lastBa?.status ?? "ba_open"}`}>{statusLabel(lastBa?.status ?? "ba_open")}</span>,
            lastBa?.baNumber ?? "Sem BA aberto",
            lastBa ? formatDateTime(lastBa.openedAt ?? lastBa.scheduledAt) : "-",
            lastAttendance ? formatDateTime(lastAttendance.finishedAt ?? lastAttendance.scheduledAt) : "-",
            lastBa?.professionalId ? profiles.find((profile) => profile.id === lastBa.professionalId)?.fullName ?? "Profissional vinculado" : "A definir",
            <div className="table-actions">
              {lastBa?.status === "waiting" && (
                <button className="primary-button" onClick={() => onStartAttendance(lastBa.id)} type="button"><PlayCircle size={17} /> Iniciar atendimento</button>
              )}
              {lastBa?.status === "in_progress" && (
                <button className="primary-button" onClick={() => onContinueAttendance(lastBa.id)} type="button"><ClipboardEdit size={17} /> Continuar atendimento</button>
              )}
              {lastBa?.status === "completed" && (
                <>
                  <button className="ghost-action" onClick={() => onSelect(patient.id)} type="button"><FileText size={17} /> Ver resumo do BA</button>
                  <button className="ghost-action" onClick={() => onExportBa(lastBa)} type="button"><Download size={17} /> Exportar BA</button>
                </>
              )}
            </div>
          ])}
        />
      </section>
    </div>
  );
}

function PatientProfile({
  patient,
  attendances,
  activeAttendanceId,
  uniqueMedicalRecord,
  anamneses,
  footSensitivityMaps,
  attendanceImages,
  onGenerateReport,
  onCreateAttendance,
  onFinishAttendance,
  onSaveAnamnesis,
  onSaveFootSensitivity,
  onSaveAttendanceImage,
  onSaveComparativeNote,
  company,
  professionalId
}: {
  patient: Patient;
  attendances: Attendance[];
  activeAttendanceId: string | null;
  uniqueMedicalRecord?: UniqueMedicalRecord;
  anamneses: AnamnesisRecord[];
  footSensitivityMaps: FootSensitivityMap[];
  attendanceImages: AttendanceImage[];
  onGenerateReport: () => void;
  onCreateAttendance: (patient: Patient) => void;
  onFinishAttendance: (attendanceId: string) => void;
  onSaveAnamnesis: (record: AnamnesisRecord) => void;
  onSaveFootSensitivity: (entry: Omit<FootSensitivityMap, "id" | "createdAt">) => void;
  onSaveAttendanceImage: (image: Omit<AttendanceImage, "id" | "createdAt">) => void;
  onSaveComparativeNote: (imageIds: string[], note: string) => void;
  company: Company;
  professionalId: string;
}) {
  const [activePatientTab, setActivePatientTab] = useState<PatientTabKey>("patient-data");
  const currentAttendance =
    attendances.find((attendance) => attendance.id === activeAttendanceId) ??
    attendances.find((attendance) => attendance.status === "in_progress") ??
    attendances[0];
  const currentAnamnesis = currentAttendance ? anamneses.find((record) => record.attendanceId === currentAttendance.id) : undefined;
  const anamnesisNode = currentAttendance ? (
    <AnamnesisWizard
      patient={patient}
      record={currentAnamnesis}
      onSave={onSaveAnamnesis}
      companyId={company.id}
      attendanceId={currentAttendance.id}
      uniqueMedicalRecordId={currentAttendance.uniqueMedicalRecordId}
      uniqueRecordNumber={patient.uniqueRecordNumber}
      baNumber={currentAttendance.baNumber}
      createdBy={professionalId}
      footSensitivitySlot={
        <FootSensitivityMap3D
          entries={footSensitivityMaps}
          onSave={onSaveFootSensitivity}
          patientId={patient.id}
          companyId={company.id}
          professionalId={professionalId}
          attendanceId={currentAttendance.id}
          uniqueMedicalRecordId={currentAttendance.uniqueMedicalRecordId}
          uniqueRecordNumber={patient.uniqueRecordNumber}
          baNumber={currentAttendance.baNumber}
        />
      }
      woundImagesSlot={
        <WoundImageModule
          images={attendanceImages}
          onSave={onSaveAttendanceImage}
          patientId={patient.id}
          companyId={company.id}
          createdBy={professionalId}
          attendanceId={currentAttendance.id}
          uniqueMedicalRecordId={currentAttendance.uniqueMedicalRecordId}
          uniqueRecordNumber={patient.uniqueRecordNumber}
          baNumber={currentAttendance.baNumber}
        />
      }
      imageEvolutionSlot={
        <ImageEvolutionComparison
          images={attendanceImages}
          attendances={attendances}
          patientId={patient.id}
          uniqueMedicalRecordId={patient.uniqueMedicalRecordId}
          onComparativeNote={onSaveComparativeNote}
        />
      }
    />
  ) : <EmptyState title="Nenhum BA registrado" message="Abra um BA para iniciar a ficha modular de anamnese." />;

  return (
    <div className="page-stack">
      <section className="profile-header">
        <div>
          <span className="eyebrow">ProntuárioÚnico: {patient.uniqueRecordNumber}</span>
          <h1>{patient.fullName}</h1>
          <p>{patient.whatsapp} · {patient.profession || "Profissao nao informada"} · CPF {patient.cpf}</p>
        </div>
        <div className="hero-panel__actions">
          <button className="ghost-action" onClick={() => onCreateAttendance(patient)} type="button"><Plus size={18} /> Novo BA</button>
          <button className="ghost-action" onClick={() => exportMedicalRecord(patient, company, attendances, anamneses, footSensitivityMaps, attendanceImages)} type="button"><Download size={18} /> Exportar ProntuárioÚnico</button>
          <button className="primary-button" onClick={onGenerateReport} type="button"><Sparkles size={18} /> Gerar relatorio com IA</button>
        </div>
      </section>

      <section className="tabs-bar">
        {patientTabs.map((tab) => (
          <button className={activePatientTab === tab.key ? "is-active" : ""} key={tab.key} onClick={() => setActivePatientTab(tab.key)} type="button">{tab.label}</button>
        ))}
      </section>

      {currentAttendance && (
        <section className="attendance-topline">
          <div><span>Paciente</span><strong>{patient.fullName}</strong></div>
          <div><span>ProntuárioÚnico</span><strong>{patient.uniqueRecordNumber}</strong></div>
          <div><span>BA atual</span><strong>{currentAttendance.baNumber}</strong></div>
          <div><span>Status</span><strong>{statusLabel(currentAttendance.status)}</strong></div>
          <div><span>Abertura</span><strong>{formatDateTime(currentAttendance.openedAt ?? currentAttendance.scheduledAt)}</strong></div>
          <div><span>Inicio</span><strong>{currentAttendance.startedAt ? formatDateTime(currentAttendance.startedAt) : "Nao iniciado"}</strong></div>
          <div><span>Profissional</span><strong>{currentAttendance.professionalId ? "Dra. Marina Costa" : "A definir"}</strong></div>
          <div><span>Clinica</span><strong>{company.displayName}</strong></div>
          {currentAttendance.status === "in_progress" && (
            <button className="primary-button" onClick={() => onFinishAttendance(currentAttendance.id)} type="button">
              <CheckCircle2 size={17} /> Finalizar atendimento
            </button>
          )}
        </section>
      )}

      {activePatientTab === "patient-data" && <PatientDataSection patient={patient} />}
      {activePatientTab === "unique-record" && <UniqueMedicalRecordView patient={patient} uniqueMedicalRecord={uniqueMedicalRecord} attendances={attendances} attendanceImages={attendanceImages} />}
      {activePatientTab === "anamnesis" && anamnesisNode}
      {activePatientTab === "wound-images" && (currentAttendance ? (
        <WoundImageModule
          images={attendanceImages}
          onSave={onSaveAttendanceImage}
          patientId={patient.id}
          companyId={company.id}
          createdBy={professionalId}
          attendanceId={currentAttendance.id}
          uniqueMedicalRecordId={currentAttendance.uniqueMedicalRecordId}
          uniqueRecordNumber={patient.uniqueRecordNumber}
          baNumber={currentAttendance.baNumber}
        />
      ) : <EmptyState title="Nenhuma imagem cadastrada" message="Abra um BA para anexar imagens da ferida, lesao, unha ou curativo." />)}
      {activePatientTab === "image-evolution" && (
        <div className="data-panel">
          <ImageEvolutionComparison
            images={attendanceImages}
            attendances={attendances}
            patientId={patient.id}
            uniqueMedicalRecordId={patient.uniqueMedicalRecordId}
            onComparativeNote={onSaveComparativeNote}
          />
        </div>
      )}
      {activePatientTab === "reports" && (
        <ReportsSection
          patient={patient}
          currentAttendance={currentAttendance}
          company={company}
          attendances={attendances}
          anamneses={anamneses}
          footSensitivityMaps={footSensitivityMaps}
          attendanceImages={attendanceImages}
          onGenerateReport={onGenerateReport}
        />
      )}
    </div>
  );
}

function PatientDataSection({ patient }: { patient: Patient }) {
  return (
    <section className="data-panel">
      <div className="section-heading section-heading--compact">
        <div>
          <h2>Dados do paciente</h2>
          <p>Dados cadastrais operacionais. Historico clinico completo permanece no ProntuárioÚnico.</p>
        </div>
        <Users size={20} />
      </div>
      <dl className="definition-grid definition-grid--three">
        <div><dt>Nome completo</dt><dd>{patient.fullName}</dd></div>
        <div><dt>CPF</dt><dd>{patient.cpf || "Nao informado"}</dd></div>
        <div><dt>Data de nascimento</dt><dd>{patient.birthDate ? formatDate(patient.birthDate) : "Nao informada"}</dd></div>
        <div><dt>Idade</dt><dd>{calculateAge(patient.birthDate)}</dd></div>
        <div><dt>Profissao</dt><dd>{patient.profession || "Nao informada"}</dd></div>
        <div><dt>Telefone</dt><dd>{patient.phone || "Nao informado"}</dd></div>
        <div><dt>WhatsApp</dt><dd>{patient.whatsapp || "Nao informado"}</dd></div>
        <div><dt>E-mail</dt><dd>{patient.email || "Nao informado"}</dd></div>
        <div><dt>Endereco</dt><dd>{patient.address || "Nao informado"}</dd></div>
        <div><dt>ProntuárioÚnico</dt><dd>{patient.uniqueRecordNumber}</dd></div>
      </dl>
    </section>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <section className="empty-state">
      <FileText size={28} />
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

function ReportsSection({
  patient,
  currentAttendance,
  company,
  attendances,
  anamneses,
  footSensitivityMaps,
  attendanceImages,
  onGenerateReport
}: {
  patient: Patient;
  currentAttendance?: Attendance;
  company: Company;
  attendances: Attendance[];
  anamneses: AnamnesisRecord[];
  footSensitivityMaps: FootSensitivityMap[];
  attendanceImages: AttendanceImage[];
  onGenerateReport: () => void;
}) {
  return (
    <section className="split-grid">
      <div className="data-panel">
        <div className="section-heading section-heading--compact">
          <div>
            <h2>Relatórios</h2>
            <p>Exportacoes e relatorio medico com IA respeitando ProntuárioÚnico, BA e HCI autorizado.</p>
          </div>
          <FileText size={20} />
        </div>
        <div className="report-list">
          <button disabled={!currentAttendance} onClick={() => currentAttendance && exportAttendanceBa(patient, company, currentAttendance, anamneses, footSensitivityMaps, attendanceImages)} type="button"><FileText size={18} /> Exportar BA atual</button>
          <button onClick={() => exportMedicalRecord(patient, company, attendances, anamneses, footSensitivityMaps, attendanceImages)} type="button"><Download size={18} /> Exportar ProntuárioÚnico completo</button>
          <button className="primary-button" onClick={onGenerateReport} type="button"><Sparkles size={18} /> Gerar relatório médico com IA</button>
        </div>
      </div>
      <div className="data-panel">
        {attendances.length ? (
          <Table
            headers={["BA", "Data", "Status"]}
            rows={attendances.map((attendance) => [attendance.baNumber, formatDateTime(attendance.openedAt ?? attendance.scheduledAt), statusLabel(attendance.status)])}
          />
        ) : <EmptyState title="Nenhum relatório gerado" message="Este paciente ainda não possui atendimentos para exportacao." />}
      </div>
    </section>
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
          attendance.status === "waiting" ? "Iniciar atendimento" : "Consultar evolucao",
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

function Reports({
  patient,
  report,
  includeHci,
  hciAvailable,
  onIncludeHciChange,
  onGenerate,
  onChangeReport
}: {
  patient: Patient;
  report: string;
  includeHci: boolean;
  hciAvailable: boolean;
  onIncludeHciChange: (value: boolean) => void;
  onGenerate: () => void;
  onChangeReport: (value: string) => void;
}) {
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
          {hciAvailable && (
            <label className="toggle-row">
              <input checked={includeHci} onChange={(event) => onIncludeHciChange(event.target.checked)} type="checkbox" />
              Incluir HCI autorizado no relatorio
            </label>
          )}
          {!hciAvailable && <p className="muted">HCI so aparece quando houver consentimento autorizado e permissao de acesso.</p>}
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

function HciView({
  query,
  onQueryChange,
  matches,
  selectedMatch,
  onSelectMatch
}: {
  query: string;
  onQueryChange: (value: string) => void;
  matches: HciPatientMatch[];
  selectedMatch: HciPatientMatch | null;
  onSelectMatch: (match: HciPatientMatch) => void;
}) {
  const integratedHistory = selectedMatch?.consentStatus === "authorized"
    ? demoIntegratedHistories.find((history) => history.patient.id === selectedMatch.patientId)
    : undefined;

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LGPD · consentimento · auditoria</span>
          <h1>HCI — Historico Clinico Integrado</h1>
          <p>Consulta segura pelo ProntuárioÚnico do paciente, sem quebrar isolamento por empresa.</p>
        </div>
        <HeartPulse size={26} />
      </div>

      <section className="data-panel">
        <div className="hci-search">
          <label>
            Buscar por nome, CPF, ProntuárioÚnico, telefone ou data de nascimento
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Ex.: Ana Paula, 123.456.789-00, PU-2026-000001" />
          </label>
          <button className="primary-button" type="button"><Search size={18} /> Buscar paciente</button>
        </div>
      </section>

      <section className="split-grid">
        <div className="data-panel">
          <div className="section-heading section-heading--compact">
            <div><h2>Possiveis pacientes encontrados</h2><p>Priorizacao: CPF, CPF + nascimento, nome + nascimento, nome + telefone</p></div>
          </div>
          <div className="hci-results">
            {matches.map((match) => (
              <button className={selectedMatch?.id === match.id ? "is-active" : ""} key={match.id} onClick={() => onSelectMatch(match)} type="button">
                <strong>{match.companyName}</strong>
                <span>{match.patientName} · ProntuárioÚnico {match.uniqueRecordNumber}</span>
                <small>{match.matchPriority} · {consentLabel(match.consentStatus)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="data-panel">
          {selectedMatch?.consentStatus === "authorized" && integratedHistory ? (
            <>
              <div className="section-heading section-heading--compact">
                <div><h2>Historico autorizado</h2><p>Origem: {integratedHistory.sourceCompany.displayName}</p></div>
                <ShieldCheck size={20} />
              </div>
              <dl className="definition-grid">
                <div><dt>Paciente</dt><dd>{integratedHistory.patient.fullName}</dd></div>
                <div><dt>ProntuárioÚnico</dt><dd>{integratedHistory.patient.uniqueRecordNumber}</dd></div>
                <div><dt>Escopo</dt><dd>{selectedMatch.accessScope}</dd></div>
              </dl>
              <Table
                headers={["BA", "Data", "Queixa", "Procedimento"]}
                rows={integratedHistory.attendances.map((attendance) => [
                  attendance.baNumber,
                  formatDateTime(attendance.scheduledAt),
                  attendance.complaint,
                  attendance.procedure
                ])}
              />
              <p className="muted">Acesso deve registrar log em hci_access_logs com usuario, empresa solicitante, empresa origem, motivo e secoes acessadas.</p>
            </>
          ) : (
            <div className="consent-empty">
              <ShieldCheck size={30} />
              <h2>Consentimento necessario</h2>
              <p>Dados clinicos de outra empresa nao podem ser exibidos sem consentimento explicito do paciente.</p>
              <button className="primary-button" type="button">Solicitar autorizacao do paciente</button>
            </div>
          )}
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
          <fieldset className="option-fieldset">
            <legend>HCI — Historico Clinico Integrado</legend>
            <label className="toggle-row">
              <input checked={Boolean(company.hciEnabled)} onChange={(event) => update("hciEnabled", event.target.checked)} type="checkbox" />
              Habilitar HCI
            </label>
            <label>Validade padrao do consentimento em dias<input type="number" value={company.hciConsentValidityDays ?? 180} onChange={(event) => update("hciConsentValidityDays", Number(event.target.value))} /></label>
            <label className="toggle-row">
              <input checked={Boolean(company.hciAllowImages)} onChange={(event) => update("hciAllowImages", event.target.checked)} type="checkbox" />
              Permitir acesso com imagens quando autorizado
            </label>
            <label>
              Escopo padrao
              <select value={company.hciDefaultScope ?? "history_without_images"} onChange={(event) => update("hciDefaultScope", event.target.value as Company["hciDefaultScope"])}>
                <option value="clinical_summary">Apenas resumo clinico</option>
                <option value="full_history">Historico completo</option>
                <option value="history_with_images">Historico com imagens</option>
                <option value="history_without_images">Historico sem imagens</option>
                <option value="medical_reports_only">Apenas relatorios medicos</option>
                <option value="recent_attendances">Apenas atendimentos recentes</option>
              </select>
            </label>
          </fieldset>
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
    ba_open: "BA aberto",
    waiting: "Aguardando atendimento",
    in_progress: "Em atendimento",
    paused: "Atendimento pausado",
    completed: "Finalizado",
    cancelled: "Cancelado",
    no_show: "Faltou"
  };
  return labels[status];
}

function calculateAge(birthDate?: string) {
  const result = calculateAgeValue(birthDate);
  return result.ageText || "-";
}

function calculateAgeValue(birthDate?: string) {
  if (!birthDate) return { ageText: "", message: "" };
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return { ageText: "", message: "Data de nascimento invalida." };
  const today = new Date();
  if (birth > today) return { ageText: "", message: "A data de nascimento nao pode ser futura." };
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return { ageText: `${age} anos`, message: "" };
}

function maskCpf(cpf: string) {
  const digits = normalizeDigits(cpf);
  if (digits.length !== 11) return cpf || "Nao informado";
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
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

function generateUniqueRecordNumber(patients: Patient[]) {
  const year = new Date().getFullYear();
  const current = patients.filter((patient) => patient.uniqueRecordNumber.includes(`PU-${year}`)).length + 1;
  return `PU-${year}-${String(current).padStart(6, "0")}`;
}

function generateBaNumber(companyId: string, attendances: Attendance[]) {
  const year = new Date().getFullYear();
  const current = attendances.filter((attendance) => attendance.companyId === companyId && attendance.baNumber.includes(`BA-${year}`)).length + 1;
  return `BA-${year}-${String(current).padStart(6, "0")}`;
}

function findExistingUniqueRecordForPatient(
  input: { fullName: string; cpf: string; birthDate: string; phone: string },
  patients: Patient[],
  hciMatches: HciPatientMatch[]
) {
  const byCpf = patients.find((patient) => normalizeDigits(patient.cpf) === normalizeDigits(input.cpf));
  if (byCpf) return { uniqueMedicalRecordId: byCpf.uniqueMedicalRecordId, uniqueRecordNumber: byCpf.uniqueRecordNumber };

  const byCpfAndBirth = patients.find((patient) => normalizeDigits(patient.cpf) === normalizeDigits(input.cpf) && patient.birthDate === input.birthDate);
  if (byCpfAndBirth) return { uniqueMedicalRecordId: byCpfAndBirth.uniqueMedicalRecordId, uniqueRecordNumber: byCpfAndBirth.uniqueRecordNumber };

  const byNameAndBirth = patients.find((patient) => normalizeText(patient.fullName) === normalizeText(input.fullName) && patient.birthDate === input.birthDate);
  if (byNameAndBirth) return { uniqueMedicalRecordId: byNameAndBirth.uniqueMedicalRecordId, uniqueRecordNumber: byNameAndBirth.uniqueRecordNumber };

  const byNameAndPhone = patients.find((patient) => normalizeText(patient.fullName) === normalizeText(input.fullName) && normalizeDigits(patient.whatsapp || patient.phone) === normalizeDigits(input.phone));
  if (byNameAndPhone) return { uniqueMedicalRecordId: byNameAndPhone.uniqueMedicalRecordId, uniqueRecordNumber: byNameAndPhone.uniqueRecordNumber };

  const hciByNameAndBirth = hciMatches.find((match) => normalizeText(match.patientName) === normalizeText(input.fullName) && match.birthDate === input.birthDate);
  if (hciByNameAndBirth) return { uniqueMedicalRecordId: hciByNameAndBirth.uniqueMedicalRecordId, uniqueRecordNumber: hciByNameAndBirth.uniqueRecordNumber };

  return null;
}

function filterHciMatches(query: string, matches: HciPatientMatch[]) {
  const normalized = normalizeText(query);
  if (!normalized) return matches;
  return matches.filter((match) =>
    [match.patientName, match.uniqueRecordNumber, match.companyName, match.birthDate]
      .filter(Boolean)
      .some((value) => normalizeText(String(value)).includes(normalized))
  );
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function imageTypeLabel(type: AttendanceImage["imageType"]) {
  const labels: Record<AttendanceImage["imageType"], string> = {
    before: "Antes",
    during: "Durante",
    after: "Depois",
    current_state: "Estado atual",
    return: "Retorno",
    evolution: "Evolucao"
  };
  return labels[type];
}

function consentLabel(status: HciPatientMatch["consentStatus"]) {
  const labels: Record<HciPatientMatch["consentStatus"], string> = {
    authorized: "Consentimento autorizado",
    pending: "Consentimento pendente",
    unauthorized: "Consentimento nao autorizado",
    revoked: "Consentimento revogado"
  };
  return labels[status];
}

function exportAttendanceBa(patient: Patient, company: Company, attendance: Attendance, anamneses: AnamnesisRecord[], footMaps: FootSensitivityMap[], images: AttendanceImage[]) {
  const relatedAnamnesis = anamneses.find((record) => record.attendanceId === attendance.id);
  const relatedFootMaps = footMaps.filter((entry) => entry.attendanceId === attendance.id);
  const relatedImages = images.filter((image) => image.attendanceId === attendance.id);
  openPrintDocument(
    `BA ${attendance.baNumber}`,
    [
      documentHeader(company, `Boletim de Atendimento ${attendance.baNumber}`),
      `<h2>Paciente</h2><p>${patient.fullName}<br>ProntuárioÚnico: ${patient.uniqueRecordNumber}<br>CPF: ${patient.cpf}</p>`,
      `<h2>Atendimento</h2><p>Data: ${formatDateTime(attendance.scheduledAt)}<br>Queixa: ${attendance.complaint}<br>Procedimento: ${attendance.procedure}<br>Conduta: ${attendance.conduct || "Nao informada"}</p>`,
      `<h2>Anamnese</h2><pre>${JSON.stringify(relatedAnamnesis?.formData ?? {}, null, 2)}</pre>`,
      `<h2>Sensibilidade / Pe 3D</h2><ul>${relatedFootMaps.map((entry) => `<li>${entry.footSide} · ${entry.regionKey}: ${entry.sensitivityStatus} · ${entry.notes}</li>`).join("") || "<li>Sem marcacoes</li>"}</ul>`,
      `<h2>Imagens da ferida</h2>${renderImagesForPrint(relatedImages)}`
    ].join(""),
    company.primaryColor
  );
}

function exportMedicalRecord(
  patient: Patient,
  company: Company,
  attendances: Attendance[],
  anamneses: AnamnesisRecord[],
  footMaps: FootSensitivityMap[],
  images: AttendanceImage[]
) {
  openPrintDocument(
    `ProntuárioÚnico ${patient.uniqueRecordNumber}`,
    [
      documentHeader(company, `ProntuárioÚnico ${patient.uniqueRecordNumber}`),
      `<h2>Dados do paciente</h2><p>${patient.fullName}<br>CPF: ${patient.cpf}<br>Nascimento: ${formatDate(patient.birthDate)}<br>Telefone/WhatsApp: ${patient.whatsapp}</p>`,
      `<h2>Dados clinicos</h2><p>Queixa principal: ${patient.clinical.chiefComplaint}<br>Historico: ${patient.clinical.diseaseHistory}<br>Medicamentos: ${patient.clinical.medications || "Nao informado"}</p>`,
      `<h2>BAs</h2><ul>${attendances.map((attendance) => `<li>${attendance.baNumber} — ${formatDateTime(attendance.scheduledAt)} — ${attendance.procedure}</li>`).join("")}</ul>`,
      `<h2>Anamneses</h2>${anamneses.map((record) => `<h3>${record.baNumber}</h3><pre>${JSON.stringify(record.formData, null, 2)}</pre>`).join("") || "<p>Sem anamneses registradas.</p>"}`,
      `<h2>Sensibilidade / Pe 3D</h2><ul>${footMaps.map((entry) => `<li>${entry.baNumber} · ${entry.footSide} · ${entry.regionKey}: ${entry.sensitivityStatus}</li>`).join("") || "<li>Sem marcacoes</li>"}</ul>`,
      `<h2>Evolucao por imagens</h2>${renderImagesForPrint(images)}`,
      `<p><strong>Data da emissao:</strong> ${new Date().toLocaleString("pt-BR")}</p>`
    ].join(""),
    company.primaryColor
  );
}

function documentHeader(company: Company, title: string) {
  return `
    <header>
      ${company.logoUrl ? `<img src="${company.logoUrl}" alt="" />` : ""}
      <h1>${title}</h1>
      <p>${company.displayName}<br>${company.contactPhone} · ${company.contactEmail}<br>${company.document}</p>
    </header>
  `;
}

function renderImagesForPrint(images: AttendanceImage[]) {
  if (!images.length) return "<p>Sem imagens de ferida registradas.</p>";

  return `
    <div class="image-print-grid">
      ${images
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((image) => `
          <article>
            ${image.fileUrl.startsWith("http") || image.fileUrl.startsWith("data:") || image.fileUrl.startsWith("blob:")
              ? `<img src="${image.fileUrl}" alt="${image.description || imageTypeLabel(image.imageType)}" />`
              : `<div class="image-placeholder">Arquivo: ${image.fileUrl}</div>`}
            <h3>${image.baNumber} — ${imageTypeLabel(image.imageType)}</h3>
            <p><strong>Regiao:</strong> ${image.footRegion || "Nao informada"}<br>
            <strong>Data/hora:</strong> ${formatDateTime(image.createdAt)}<br>
            <strong>Profissional:</strong> ${image.createdBy}</p>
            <p>${image.description || ""}</p>
            ${image.clinicalNotes ? `<p><strong>Observacao clinica:</strong> ${image.clinicalNotes}</p>` : ""}
            ${image.comparativeNotes ? `<p><strong>Comparativo:</strong> ${image.comparativeNotes}</p>` : ""}
          </article>
        `).join("")}
    </div>
  `;
}

function openPrintDocument(title: string, body: string, primaryColor: string) {
  const printWindow = window.open("", "_blank", "width=980,height=720");
  if (!printWindow) return;
  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #172033; margin: 32px; line-height: 1.45; }
          header { border-bottom: 3px solid ${primaryColor}; margin-bottom: 24px; padding-bottom: 16px; }
          header img { max-height: 64px; display: block; margin-bottom: 12px; }
          h1, h2, h3 { margin-bottom: 8px; }
          h2 { border-bottom: 1px solid #dce5ea; padding-bottom: 4px; }
          pre { white-space: pre-wrap; background: #f8fafc; padding: 12px; border: 1px solid #dce5ea; }
          .image-print-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
          .image-print-grid article { border: 1px solid #dce5ea; padding: 12px; break-inside: avoid; }
          .image-print-grid img, .image-placeholder { width: 100%; min-height: 160px; object-fit: cover; background: #f8fafc; display: grid; place-items: center; color: #667085; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir / salvar PDF</button>
        ${body}
      </body>
    </html>
  `);
  printWindow.document.close();
}

function BuildingIcon() {
  return <span className="text-icon">B</span>;
}
