import {
  AlertTriangle,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardEdit,
  ClipboardPlus,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  Image as ImageIcon,
  KeyRound,
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
  Trash2,
  TrendingUp,
  UploadCloud,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnamnesisWizard } from "./components/AnamnesisWizard";
import { ChartCard } from "./components/ChartCard";
import { FootSensitivityMap3D } from "./components/FootSensitivityMap3D";
import { ImageEvolutionComparison } from "./components/ImageEvolutionComparison";
import { Layout, type ViewKey } from "./components/Layout";
import { LoginScreen } from "./components/LoginScreen";
import { MetricCard } from "./components/MetricCard";
import { UniqueMedicalRecordView } from "./components/UniqueMedicalRecord";
import { WoundImageModule } from "./components/WoundImageModule";
import {
  demoAnamneses,
  demoAutoclaveRecords,
  demoAttendanceImages,
  demoAttendances,
  demoClinicalAppointments,
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
import { podologyProductCatalog, podologyProductCategories } from "./data/productCatalog";
import { supabase } from "./lib/supabase";
import { generateReferralReport } from "./services/aiReferralReportService";
import { roleLabel } from "./services/rbac";
import { ATTENDANCE_FINALIZED_ERROR, OPEN_ATTENDANCE_EXISTS_ERROR, createAttendanceBa, createAutoclaveRecord, createClinicalAppointment, createCompanyUser, createFinancialTransaction, createStockProduct, deleteFootSensitivityMap, finishAttendanceBa, manageCompanyUser, reopenAttendanceBa, saveAnamnesisRecord, saveAttendanceImage, saveAttendanceUsedProducts, saveCompanySettings, saveFootSensitivityMap, startAttendanceBa, updateAttendanceImageComparativeNotes, updateAutoclaveRecord, updateClinicalAppointment, updateFootSensitivityMap, updateOwnPassword, updateStockProduct, uploadCompanyLogo } from "./services/podo360Repository";
import { formatCnpj, formatCpf, formatPhone, formatCurrencyInput, parseCurrency } from "./utils/masks";
import type {
  AnamnesisRecord,
  Attendance,
  AttendanceAuditLog,
  AttendanceImage,
  AutoclaveRecord,
  AutoclaveRecordItem,
  ClinicalAppointment,
  Company,
  FinancialTransaction,
  FootSensitivityMap,
  HciPatientMatch,
  IntegratedClinicalHistory,
  Patient,
  Profile,
  StockProduct,
  UsedProduct,
  UniqueMedicalRecord
} from "./types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FINALIZED_ATTENDANCE_MESSAGE = "Este atendimento já foi finalizado. Para editar, cancele a finalização na aba Gerenciamento de Atendimento.";
const OPEN_BA_EXISTS_MESSAGE = "Este paciente já possui um BA aberto. Finalize o atendimento atual antes de abrir um novo BA.";
const OPEN_ATTENDANCE_STATUSES: Attendance["status"][] = ["ba_open", "waiting", "in_progress", "reopened", "paused"];

function isAttendanceFinalized(attendance?: Pick<Attendance, "status" | "finishedAt">) {
  return Boolean(attendance && (attendance.status === "completed" || attendance.finishedAt));
}

function findOpenAttendanceForPatient(attendances: Attendance[], patientId: string, companyId: string) {
  return attendances.find((attendance) =>
    attendance.companyId === companyId &&
    attendance.patientId === patientId &&
    OPEN_ATTENDANCE_STATUSES.includes(attendance.status) &&
    !attendance.finishedAt
  );
}

function canManageAttendanceReopen(profile: Profile, allowedViews: ViewKey[]) {
  return profile.role === "super_admin" || profile.role === "company_admin" || allowedViews.includes("attendance-management");
}

function catalogStock(companyId: string, existing: StockProduct[]) {
  const names = new Set(existing.map((item) => normalizeText(item.name)));
  const catalog = podologyProductCatalog
    .filter(([, name]) => !names.has(normalizeText(name)))
    .map(([category, name], index): StockProduct => ({
      id: `catalog-${index + 1}`,
      companyId,
      name,
      category,
      internalCode: `CAT-${String(index + 1).padStart(3, "0")}`,
      currentQuantity: 0,
      minimumQuantity: 0,
      unit: "un",
      costValue: 0,
      saleValue: 0,
      supplier: "",
      active: true
    }));
  return [...existing, ...catalog];
}

type AppNotice = {
  id: number;
  title: string;
  message: string;
  tone?: "success" | "info" | "warning" | "danger";
};

type PatientTabKey = "patient-data" | "unique-record" | "history" | "bas" | "anamnesis" | "wound-images" | "image-evolution" | "reports" | "hci";

type BaOpeningPrefill = {
  appointmentId: string;
  patientId?: string;
  fullName: string;
  cpf?: string;
  birthDate?: string;
  profession?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  uniqueRecordNumber?: string;
  visitKind?: Attendance["visitKind"];
  chiefComplaint?: string;
  initialNotes?: string;
  payerType?: ClinicalAppointment["payerType"];
  insuranceName?: string;
};

const patientTabs: Array<{ key: PatientTabKey; label: string }> = [
  { key: "patient-data", label: "Dados do paciente" },
  { key: "unique-record", label: "Prontuário de Evolução" },
  { key: "history", label: "Histórico de atendimentos" },
  { key: "bas", label: "BAs" },
  { key: "anamnesis", label: "Anamnese" },
  { key: "wound-images", label: "Evolução por Imagem" },
  { key: "image-evolution", label: "Comparativo de evolução" },
  { key: "reports", label: "Relatórios" },
  { key: "hci", label: "HCI" }
];

const modulePermissionOptions: Array<[ViewKey, string]> = [
  ["dashboard", "Dashboard"], ["ba-opening", "Abertura de atendimento"], ["attendances", "Atendimento"], ["attendance-management", "Gerenciamento de Atendimento"], ["patients", "Pacientes"],
  ["schedule", "Agenda Clínica"], ["patient-profile", "Prontuário de Evolução / Anamnese / Evolução por Imagem"], ["reports", "Relatórios"],
  ["financial", "Financeiro / Produtos"], ["stock", "Estoque"], ["autoclave", "Registro de Autoclave / Esterilizacao"], ["hci", "HCI"], ["settings", "Configuracoes"], ["super-admin", "Administracao da Clinica"]
];

function allowedViewsForProfile(profile: Profile): ViewKey[] {
  if (profile.role === "super_admin") return modulePermissionOptions.map(([key]) => key);
  if (profile.modulePermissions?.length) return profile.modulePermissions.filter((key): key is ViewKey => modulePermissionOptions.some(([view]) => view === key));
  const defaults: Record<Profile["role"], ViewKey[]> = {
    super_admin: modulePermissionOptions.map(([key]) => key),
    company_admin: modulePermissionOptions.map(([key]) => key).filter((key) => key !== "super-admin"),
    professional: ["dashboard", "patients", "patient-profile", "attendances", "schedule", "reports", "autoclave", "hci"],
    reception: ["dashboard", "ba-opening", "patients", "patient-profile", "attendances", "schedule"],
    financial: ["dashboard", "financial", "reports"],
    stock: ["dashboard", "stock", "autoclave", "financial"],
    schedule: ["dashboard", "patients", "schedule"],
    reports: ["dashboard", "reports"],
    custom: ["dashboard"]
  };
  return defaults[profile.role];
}

export function App() {
  const [company, setCompany] = useState<Company>(demoCompany);
  const [signedIn, setSignedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [patients, setPatients] = useState<Patient[]>(demoPatients);
  const [uniqueMedicalRecords, setUniqueMedicalRecords] = useState<UniqueMedicalRecord[]>(demoUniqueMedicalRecords);
  const [appointments, setAppointments] = useState<ClinicalAppointment[]>(demoClinicalAppointments);
  const [attendances, setAttendances] = useState<Attendance[]>(demoAttendances);
  const [anamneses, setAnamneses] = useState<AnamnesisRecord[]>(demoAnamneses);
  const [financial, setFinancial] = useState<FinancialTransaction[]>(demoFinancial);
  const [stock, setStock] = useState<StockProduct[]>(() => catalogStock(demoCompany.id, demoStock));
  const [autoclaveRecords, setAutoclaveRecords] = useState<AutoclaveRecord[]>(demoAutoclaveRecords);
  const [footSensitivityMaps, setFootSensitivityMaps] = useState<FootSensitivityMap[]>(demoFootSensitivityMaps);
  const [attendanceImages, setAttendanceImages] = useState<AttendanceImage[]>(demoAttendanceImages);
  const [attendanceAuditLogs, setAttendanceAuditLogs] = useState<AttendanceAuditLog[]>([]);
  const [includeHciInReport, setIncludeHciInReport] = useState(false);
  const [hciQuery, setHciQuery] = useState("");
  const [hciSelectedMatch, setHciSelectedMatch] = useState<HciPatientMatch | null>(demoHciMatches[0]);
  const [selectedPatientId, setSelectedPatientId] = useState(demoPatients[0].id);
  const [activeAttendanceId, setActiveAttendanceId] = useState<string | null>(demoAttendances[2]?.id ?? null);
  const [baOpeningPrefill, setBaOpeningPrefill] = useState<BaOpeningPrefill | null>(null);
  const [aiReport, setAiReport] = useState("");
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const [billingAttendance, setBillingAttendance] = useState<Attendance | null>(null);
  const [baSubmitting, setBaSubmitting] = useState(false);
  const profile = demoProfiles[0];
  const allowedViews = allowedViewsForProfile(profile);
  const hasAttendanceManagementAccess = canManageAttendanceReopen(profile, allowedViews);

  function handleMaskedInput(event: FormEvent<HTMLDivElement>) {
    const input = event.target as HTMLInputElement;
    if (!input?.name) return;
    if (["phone", "whatsapp", "temporaryPatientPhone", "temporaryPatientWhatsapp"].includes(input.name)) input.value = formatPhone(input.value);
    if (input.name === "cpf") input.value = formatCpf(input.value);
    if (input.name === "document") input.value = formatCnpj(input.value);
    if (["amount", "costValue", "saleValue", "reportMinValue", "reportMaxValue"].includes(input.name)) {
      input.type = "text";
      input.inputMode = "numeric";
      input.value = formatCurrencyInput(input.value);
    }
  }

  useEffect(() => {
    document.documentElement.style.setProperty("--color-primary", company.primaryColor);
    document.documentElement.style.setProperty("--color-secondary", company.secondaryColor);
    document.documentElement.style.setProperty("--color-accent", company.accentColor);
    document.documentElement.style.setProperty("--color-bg", company.backgroundColor || "#f3f7fb");
    document.documentElement.style.setProperty("--sidebar-bg", company.sidebarColor || "#071923");
    document.documentElement.style.setProperty("--sidebar-text", company.sidebarTextColor || "#f8fbfc");
    document.documentElement.style.setProperty("--sidebar-muted", colorWithAlpha(company.sidebarTextColor || "#f8fbfc", 0.68));
    document.documentElement.style.setProperty("--sidebar-hover", company.sidebarHoverColor || company.primaryColor);
    document.title = `${company.displayName} | Podo360`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", company.primaryColor);
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (company.logoUrl) {
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = company.logoUrl;
    }
  }, [company]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const selectedUniqueMedicalRecord = uniqueMedicalRecords.find((record) => record.id === selectedPatient.uniqueMedicalRecordId);
  const selectedPatientAttendances = attendances.filter((attendance) => attendance.patientId === selectedPatient.id);
  const selectedPatientAnamneses = anamneses.filter((record) => record.patientId === selectedPatient.id);
  const selectedPatientFootMaps = footSensitivityMaps.filter((entry) => entry.patientId === selectedPatient.id);
  const selectedPatientImages = attendanceImages.filter((image) => image.patientId === selectedPatient.id);
  const authorizedHciHistories = demoIntegratedHistories.filter((history) =>
    demoHciConsents.some((consent) =>
      consent.uniqueMedicalRecordId === selectedPatient.uniqueMedicalRecordId &&
      consent.sourceCompanyId === history.sourceCompany.id &&
      consent.consentStatus === "authorized"
      )
  );

  function notify(title: string, message: string, tone: AppNotice["tone"] = "success") {
    setNotice({ id: Date.now(), title, message, tone });
  }

  function guardEditableAttendance(attendanceId: string, title = "Atendimento finalizado") {
    const attendance = attendances.find((item) => item.id === attendanceId && item.companyId === company.id);
    if (isAttendanceFinalized(attendance)) {
      notify(title, FINALIZED_ATTENDANCE_MESSAGE, "warning");
      return false;
    }
    return true;
  }

  function handleFinalizedWriteError(error: unknown) {
    if (error instanceof Error && error.message === ATTENDANCE_FINALIZED_ERROR) {
      notify("Atendimento finalizado", FINALIZED_ATTENDANCE_MESSAGE, "warning");
      return true;
    }
    return false;
  }

  async function handleGenerateAiReport(patientId = selectedPatient.id, reason = "Persistencia de sintomas e necessidade de avaliacao medica complementar.", attendanceId?: string) {
    const reportPatient = patients.find((item) => item.id === patientId && item.companyId === company.id) ?? selectedPatient;
    const patientAttendances = attendances.filter((attendance) => attendance.patientId === reportPatient.id && attendance.companyId === company.id);
    const reportAttendances = attendanceId ? patientAttendances.filter((attendance) => attendance.id === attendanceId) : patientAttendances;
    if (attendanceId && !reportAttendances.length) {
      notify("Não foi possível gerar o relatório com IA no momento.", "O atendimento selecionado não foi encontrado para esta clínica.", "danger");
      return;
    }
    const relatedAttendanceIds = new Set(reportAttendances.map((attendance) => attendance.id));
    const reportAnamneses = anamneses.filter((record) => record.patientId === reportPatient.id && record.companyId === company.id && (!attendanceId || relatedAttendanceIds.has(record.attendanceId)));
    const reportFootMaps = footSensitivityMaps.filter((entry) => entry.patientId === reportPatient.id && entry.companyId === company.id && (!attendanceId || relatedAttendanceIds.has(entry.attendanceId)));
    const reportImages = attendanceImages.filter((image) => image.patientId === reportPatient.id && image.companyId === company.id && (!attendanceId || relatedAttendanceIds.has(image.attendanceId)));
    const reportHciHistories = demoIntegratedHistories.filter((history) =>
      demoHciConsents.some((consent) =>
        consent.uniqueMedicalRecordId === reportPatient.uniqueMedicalRecordId &&
        consent.sourceCompanyId === history.sourceCompany.id &&
        consent.consentStatus === "authorized"
      )
    );
    try {
      const content = await generateReferralReport({
        company,
        patient: reportPatient,
        attendances: reportAttendances,
        anamneses: reportAnamneses,
        footSensitivityMaps: reportFootMaps,
        attendanceImages: reportImages,
        integratedHistories: includeHciInReport ? reportHciHistories : [],
        includeHci: includeHciInReport,
        professionalName: profile.fullName,
        reason
      });
      setAiReport(content);
      notify("Relatório com IA gerado", "Revise o texto antes de exportar ou compartilhar.", "success");
    } catch {
      notify("Não foi possível gerar o relatório com IA no momento.", "Verifique a configuração do serviço de IA.", "danger");
    }
  }

  async function handleSaveFootSensitivity(entry: Omit<FootSensitivityMap, "id" | "createdAt"> & { id?: string }) {
    if (!guardEditableAttendance(entry.attendanceId)) throw new Error(ATTENDANCE_FINALIZED_ERROR);
    const now = new Date().toISOString();
    if (entry.id) {
      const existing = footSensitivityMaps.find((item) => item.id === entry.id);
      const updated: FootSensitivityMap = { ...entry, id: entry.id, createdAt: existing?.createdAt ?? now, updatedAt: now };
      try {
        await updateFootSensitivityMap(updated);
      } catch (error) {
        if (handleFinalizedWriteError(error)) throw error;
        throw error;
      }
      setFootSensitivityMaps((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify("Marcação atualizada", "Sensibilidade do pé 3D atualizada neste BA.", "success");
      return;
    }

    const created: FootSensitivityMap = {
      ...entry,
      id: `foot-map-${Date.now()}`,
      createdAt: now,
      updatedAt: now
    };
    try {
      await saveFootSensitivityMap(created);
    } catch (error) {
      if (handleFinalizedWriteError(error)) throw error;
      throw error;
    }
    setFootSensitivityMaps((current) => [created, ...current]);
    notify("Marcação salva", "Sensibilidade do pé 3D registrada neste BA.", "success");
  }

  async function handleRemoveFootSensitivity(entryId: string) {
    const entry = footSensitivityMaps.find((item) => item.id === entryId);
    if (!entry) return;
    if (!guardEditableAttendance(entry.attendanceId)) throw new Error(ATTENDANCE_FINALIZED_ERROR);
    try {
      await deleteFootSensitivityMap(entryId, entry.companyId);
    } catch (error) {
      if (handleFinalizedWriteError(error)) throw error;
      throw error;
    }
    setFootSensitivityMaps((current) => current.filter((item) => item.id !== entryId));
    notify("Marcação removida", "A marcação foi removida da visualização deste atendimento.", "success");
  }

  async function handleSaveAnamnesis(record: AnamnesisRecord) {
    if (!guardEditableAttendance(record.attendanceId)) return;
    setAnamneses((current) => {
      const index = current.findIndex((item) => item.id === record.id);
      if (index < 0) return [record, ...current];
      return current.map((item) => (item.id === record.id ? record : item));
    });
    const usedProducts = (Array.isArray(record.formData.used_products) ? record.formData.used_products : []) as UsedProduct[];
    const names = usedProducts.map((item) => item.name.trim()).filter(Boolean);
    setAttendances((current) => current.map((item) => item.id === record.attendanceId ? { ...item, productsUsed: Array.from(new Set([...item.productsUsed, ...names])) } : item));
    if (usedProducts.some((entry) => entry.name.trim() && !entry.productId && stock.some((product) => normalizeText(product.name) === normalizeText(entry.name)))) {
      notify("Este item já está cadastrado na lista.", "Use o produto existente no select para evitar duplicidade.", "warning");
    }
    for (const item of usedProducts.filter((entry) => entry.name.trim() && !stock.some((product) => normalizeText(product.name) === normalizeText(entry.name)))) {
      await handleCreateProduct({ id: `stock-${Date.now()}-${item.name}`, companyId: record.companyId, name: item.name.trim(), category: item.category || "Outros", internalCode: `OUT-${Date.now()}`, currentQuantity: 0, minimumQuantity: 0, unit: item.unit || "un", costValue: 0, saleValue: item.unitPrice || 0, supplier: "", active: true });
    }
    try {
      await Promise.all([saveAnamnesisRecord(record), saveAttendanceUsedProducts(record, usedProducts)]);
    } catch (error) {
      if (handleFinalizedWriteError(error)) return;
      throw error;
    }
    notify(record.isCompleted ? "Ficha finalizada" : "Ficha salva como rascunho", "Progresso da anamnese modular vinculado ao BA.", "success");
  }

  async function handleSaveAttendanceImage(image: Omit<AttendanceImage, "id" | "createdAt">) {
    if (!guardEditableAttendance(image.attendanceId)) return;
    try {
      await saveAttendanceImage(image);
    } catch (error) {
      if (handleFinalizedWriteError(error)) return;
      throw error;
    }
    setAttendanceImages((current) => [
      {
        ...image,
        id: `attendance-image-${current.length + 1}`,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
      notify("Evolução por imagem salva", "Registro visual vinculado ao BA e ao Prontuário de Evolução.", "success");
  }

  async function handleSaveComparativeNote(imageIds: string[], note: string) {
    const selectedImages = attendanceImages.filter((image) => imageIds.includes(image.id));
    if (!selectedImages.length) {
      notify("Selecione uma imagem", "A observacao comparativa precisa estar vinculada a pelo menos uma imagem.", "warning");
      throw new Error("comparison_images_missing");
    }
    if (selectedImages.some((image) => image.companyId !== company.id)) {
      notify("Você não tem permissão para realizar esta ação.", "As imagens selecionadas não pertencem à clínica atual.", "danger");
      throw new Error("comparison_company_mismatch");
    }

    if (selectedImages.some((image) => !guardEditableAttendance(image.attendanceId))) {
      throw new Error(ATTENDANCE_FINALIZED_ERROR);
    }

    const updatedAt = new Date().toISOString();
    try {
      await updateAttendanceImageComparativeNotes(company.id, imageIds, note);
      setAttendanceImages((current) =>
        current.map((image) =>
          imageIds.includes(image.id)
            ? { ...image, comparativeNotes: note, updatedAt }
            : image
        )
      );
      notify("Observação comparativa salva com sucesso.", "O comparativo ficou vinculado ao atendimento, BA e Prontuário de Evolução.", "success");
    } catch (error) {
      notify("Não foi possível salvar agora. Tente novamente.", "A sessão foi preservada; revise permissões ou conexão.", "danger");
      throw error;
    }
  }

  async function handleCreateAttendance(patient: Patient, options?: Partial<Attendance>) {
    if (baSubmitting) return false;
    const openAttendance = findOpenAttendanceForPatient(attendances, patient.id, company.id);
    if (openAttendance) {
      setSelectedPatientId(patient.id);
      setActiveAttendanceId(openAttendance.id);
      notify("BA já aberto", OPEN_BA_EXISTS_MESSAGE, "warning");
      return false;
    }

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
      appointmentId: options?.appointmentId,
      convertedFromAppointment: Boolean(options?.appointmentId),
      openedAt,
      openedBy: profile.id,
      scheduledAt: openedAt,
      attendanceDate: openedAt,
      type: options?.type ?? "Atendimento podologico",
      visitKind: options?.visitKind ?? "first_evaluation",
      initialNotes: options?.initialNotes ?? "",
      priority: options?.priority ?? "normal",
      payerType: options?.payerType ?? "private",
      insuranceName: options?.insuranceName,
      procedure: "BA aberto",
      complaint: options?.complaint ?? patient.clinical.chiefComplaint,
      clinicalEvaluation: "",
      conduct: "",
      productsUsed: [],
      notes: options?.notes ?? "BA aberto pela recepcao.",
      status: "waiting",
      value: 0
    };

    setBaSubmitting(true);
    try {
      await createAttendanceBa(attendance);
    } catch (error) {
      if (error instanceof Error && error.message === OPEN_ATTENDANCE_EXISTS_ERROR) {
        notify("BA já aberto", OPEN_BA_EXISTS_MESSAGE, "warning");
        setBaSubmitting(false);
        return false;
      }
      notify("BA salvo apenas localmente", "Nao foi possivel sincronizar o novo BA com o ambiente online.", "warning");
    } finally {
      setBaSubmitting(false);
    }

    setAttendances((current) => [attendance, ...current]);
    if (attendance.appointmentId) {
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === attendance.appointmentId
            ? {
                ...appointment,
                status: "converted_to_ba",
                convertedAttendanceId: attendance.id,
                convertedAt: openedAt,
                convertedBy: profile.id,
                updatedAt: openedAt
              }
            : appointment
        )
      );
      notify("Agendamento convertido em BA", `${attendance.baNumber} foi gerado pela abertura de atendimento.`, "success");
    }
    setSelectedPatientId(patient.id);
    setActiveAttendanceId(attendance.id);
    notify("BA aberto com sucesso", `${attendance.baNumber} entrou como Aguardando atendimento.`, "success");
    setActiveView("patients");
    return true;
  }

  async function handleOpenBa(event: FormEvent<HTMLFormElement>) {
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
      notify("Paciente ja possui Prontuário de Evolução", `Sera usado o numero ${existingUniqueRecord.uniqueRecordNumber}.`, "info");
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

    if (existingPatient) {
      const openAttendance = findOpenAttendanceForPatient(attendances, existingPatient.id, company.id);
      if (openAttendance) {
        setSelectedPatientId(existingPatient.id);
        setActiveAttendanceId(openAttendance.id);
        notify("BA já aberto", OPEN_BA_EXISTS_MESSAGE, "warning");
        return false;
      }
    }

    const created = await handleCreateAttendance(patient, {
      professionalId: String(form.get("professionalId") || "") || undefined,
      type: "Atendimento podologico",
      visitKind: String(form.get("visitKind")) === "return" ? "return" : "first_evaluation",
      complaint: "",
      initialNotes: String(form.get("initialNotes") || ""),
      priority: "normal",
      payerType: String(form.get("payerType") || "private") as Attendance["payerType"],
      insuranceName: String(form.get("insuranceName") || "") || undefined,
      appointmentId: String(form.get("sourceAppointmentId") || "") || undefined,
      notes: [
        `Clinica vinculada: ${company.displayName}.`,
        String(form.get("payerType") || "") ? `Pagamento: ${String(form.get("payerType"))}.` : "",
        String(form.get("initialNotes") || "")
      ].filter(Boolean).join(" ")
    });

    if (!created) return false;

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
    setActiveView("ba-opening");
    setBaOpeningPrefill(null);
    return true;
  }

  function handleSaveAppointment(appointment: Omit<ClinicalAppointment, "id" | "createdAt" | "updatedAt" | "createdBy" | "status">) {
    const now = new Date().toISOString();
    const created: ClinicalAppointment = {
        ...appointment,
        id: `clinical-appointment-${appointments.length + 1}`,
        status: "scheduled",
        createdBy: profile.id,
        createdAt: now,
        updatedAt: now
      };
    setAppointments((current) => [created, ...current]);
    void createClinicalAppointment(created).catch(() => notify("Agendamento salvo apenas localmente", "Nao foi possivel sincronizar com o ambiente online.", "warning"));
    notify("Agendamento criado com sucesso", "Agenda reservada sem criar BA ou Prontuário de Evolução.", "success");
  }

  function handleUpdateAppointmentStatus(appointmentId: string, status: ClinicalAppointment["status"]) {
    const labels: Record<ClinicalAppointment["status"], string> = {
      scheduled: "Agendamento criado com sucesso",
      confirmed: "Agendamento confirmado",
      waiting_arrival: "Aguardando chegada",
      arrived: "Paciente marcado como chegou",
      converted_to_ba: "Agendamento convertido em BA",
      cancelled: "Agendamento cancelado",
      no_show: "Paciente marcado como faltou",
      rescheduled: "Agendamento reagendado"
    };
    setAppointments((current) => current.map((appointment) => appointment.id === appointmentId ? { ...appointment, status, updatedAt: new Date().toISOString() } : appointment));
    notify(labels[status], status === "arrived" ? "Continue pela Abertura de atendimento para gerar BA e Prontuário de Evolução se necessário." : "Status atualizado na Agenda Clínica.", "success");
  }

  function handleUpdateAppointment(appointment: ClinicalAppointment) {
    setAppointments((current) => current.map((item) => item.id === appointment.id ? appointment : item));
    void updateClinicalAppointment(appointment).catch(() => {
      notify("Alteracao salva apenas localmente", "Nao foi possivel sincronizar o agendamento com o ambiente online.", "warning");
    });
    notify(
      appointment.status === "no_show" ? "Paciente marcado como falta." : "Agendamento atualizado com sucesso.",
      appointment.status === "no_show" ? "A falta foi registrada sem criar BA ou Prontuário de Evolução." : "Data, horario e dados da agenda foram atualizados.",
      "success"
    );
  }

  function handleOpenBaFromAppointment(appointment: ClinicalAppointment) {
    const patient = appointment.patientId ? patients.find((item) => item.id === appointment.patientId) : undefined;
    setBaOpeningPrefill({
      appointmentId: appointment.id,
      patientId: patient?.id,
      fullName: patient?.fullName ?? appointment.temporaryPatientName ?? "",
      cpf: patient?.cpf ?? "",
      birthDate: patient?.birthDate ?? appointment.temporaryPatientBirthDate ?? "",
      profession: patient?.profession ?? "",
      phone: patient?.phone ?? appointment.temporaryPatientPhone ?? "",
      whatsapp: patient?.whatsapp ?? appointment.temporaryPatientWhatsapp ?? "",
      email: patient?.email ?? appointment.temporaryPatientEmail ?? "",
      address: patient?.address ?? "",
      uniqueRecordNumber: patient?.uniqueRecordNumber ?? "",
      visitKind: appointment.appointmentType === "return" ? "return" : "first_evaluation",
      chiefComplaint: appointment.initialComplaint,
      initialNotes: appointment.notes ?? ""
      , payerType: appointment.payerType
      , insuranceName: appointment.insuranceName
    });
    setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, status: item.status === "converted_to_ba" ? item.status : "arrived", updatedAt: new Date().toISOString() } : item));
      notify("Não é possível gerar BA diretamente pela Agenda", "Dados enviados para Abertura de atendimento. Confirme a entrada para criar BA.", "info");
    setActiveView("ba-opening");
  }

  async function handleStartAttendance(attendanceId: string) {
    const now = new Date().toISOString();
    const targetAttendance = attendances.find((attendance) => attendance.id === attendanceId);
    const targetPatientId = targetAttendance?.patientId ?? selectedPatientId;
    try {
      await startAttendanceBa(attendanceId);
    } catch {
      notify("Erro ao iniciar atendimento", "Nao foi possivel atualizar o BA no ambiente online. Tente novamente.", "danger");
      return;
    }
    setAttendances((current) =>
      current.map((attendance) => {
        if (attendance.id !== attendanceId) return attendance;
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

  async function handleFinishAttendance(attendanceId: string) {
    const now = new Date().toISOString();
    const currentAttendance = attendances.find((item) => item.id === attendanceId && item.companyId === company.id);
    if (isAttendanceFinalized(currentAttendance)) {
      notify("Este atendimento já está finalizado.", "Cancele a finalização na aba Gerenciamento de Atendimento antes de finalizar novamente.", "warning");
      return;
    }
    try {
      await finishAttendanceBa(attendanceId);
    } catch {
      notify("Erro ao finalizar atendimento", "Nao foi possivel finalizar o BA no ambiente online. Tente novamente.", "danger");
      return;
    }
    setAttendances((current) =>
      current.map((attendance) =>
        attendance.id === attendanceId
          ? { ...attendance, status: "completed", finishedAt: attendance.finishedAt ?? now, finishedBy: profile.id, updatedAt: now }
          : attendance
      )
    );
    notify("Atendimento finalizado", "Data e hora de finalizacao foram registradas no BA.", "success");
    const finished = attendances.find((item) => item.id === attendanceId);
    if (finished) setBillingAttendance({ ...finished, status: "completed", finishedAt: now });
  }

  async function handleReopenAttendance(attendanceId: string, reason: string) {
    const attendance = attendances.find((item) => item.id === attendanceId && item.companyId === company.id);
    const cleanReason = reason.trim();
    if (!attendance) {
      notify("Atendimento não encontrado", "Não foi possível localizar este BA na clínica atual.", "danger");
      throw new Error("attendance_not_found");
    }
    if (!hasAttendanceManagementAccess) {
      notify("Acesso negado", "Seu perfil não possui permissão para reabrir atendimentos finalizados.", "danger");
      throw new Error("attendance_reopen_forbidden");
    }
    if (!cleanReason) {
      notify("Informe o motivo", "O motivo da reabertura é obrigatório para auditoria.", "warning");
      throw new Error("reopen_reason_required");
    }
    if (!isAttendanceFinalized(attendance)) {
      notify("Atendimento já editável", "Este atendimento não está finalizado.", "info");
      return;
    }

    try {
      await reopenAttendanceBa(attendanceId, cleanReason);
    } catch {
      notify("Reabertura mantida localmente", "Não foi possível sincronizar a reabertura agora. A migration precisa estar aplicada no Supabase.", "warning");
    }

    const now = new Date().toISOString();
    const auditLog: AttendanceAuditLog = {
      id: `audit-${Date.now()}`,
      companyId: attendance.companyId,
      attendanceId: attendance.id,
      baNumber: attendance.baNumber,
      patientId: attendance.patientId,
      uniqueMedicalRecordId: attendance.uniqueMedicalRecordId,
      action: "finalization_cancelled",
      previousStatus: attendance.status,
      newStatus: "in_progress",
      reason: cleanReason,
      createdBy: profile.id,
      createdAt: now,
      metadata: {
        previousFinishedAt: attendance.finishedAt,
        previousFinishedBy: attendance.finishedBy
      }
    };
    setAttendanceAuditLogs((current) => [auditLog, ...current]);
    setAttendances((current) =>
      current.map((item) =>
        item.id === attendanceId
          ? {
              ...item,
              status: "in_progress",
              previousFinishedAt: item.finishedAt,
              finalizationCancelledAt: now,
              finalizationCancelledBy: profile.id,
              finalizationCancelledReason: cleanReason,
              reopenedAt: now,
              reopenedBy: profile.id,
              reopenReason: cleanReason,
              finishedAt: undefined,
              finishedBy: undefined,
              updatedAt: now
            }
          : item
      )
    );
    notify("Atendimento reaberto", "A finalização foi cancelada e o atendimento voltou a permitir edição.", "success");
  }

  async function handleCreateProduct(product: StockProduct) {
    if (stock.some((item) => item.companyId === product.companyId && normalizeText(item.name) === normalizeText(product.name))) {
      notify("Produto ja cadastrado", `${product.name} nao foi duplicado.`, "info");
      return;
    }
    try {
      await createStockProduct(product);
      setStock((current) => [product, ...current]);
      notify("Produto cadastrado com sucesso", `${product.name} ja aparece no estoque.`, "success");
    } catch {
      notify("Erro ao cadastrar produto", "Confira os dados e sua permissao de estoque.", "danger");
      throw new Error("stock_create_failed");
    }
  }

  async function handleUpdateProduct(product: StockProduct) {
    try {
      await updateStockProduct(product);
      setStock((current) => current.map((item) => item.id === product.id ? product : item));
      notify(product.active === false ? "Item removido do estoque com sucesso." : "Produto atualizado com sucesso.", product.active === false ? `${product.name} foi inativado e o histórico foi preservado.` : `${product.name} foi atualizado.`, "success");
    } catch {
      notify("Erro ao atualizar produto", "Confira os dados e sua permissao de estoque.", "danger");
    }
  }

  async function handleCreateFinancial(transaction: FinancialTransaction) {
    try {
      await createFinancialTransaction(transaction, profile.id);
      setFinancial((current) => [transaction, ...current]);
      notify("Lancamento cadastrado com sucesso", `${transaction.description} foi incluido no financeiro.`, "success");
    } catch {
      notify("Erro ao cadastrar lancamento", "Confira os dados e sua permissao financeira.", "danger");
      throw new Error("financial_create_failed");
    }
  }

  async function handleSaveAutoclaveRecord(record: AutoclaveRecord) {
    const existing = autoclaveRecords.some((item) => item.id === record.id);
    try {
      if (existing) await updateAutoclaveRecord(record);
      else await createAutoclaveRecord(record);
      setAutoclaveRecords((current) => existing ? current.map((item) => item.id === record.id ? record : item) : [record, ...current]);
      notify(existing ? "Registro de autoclave atualizado" : "Registro de autoclave criado", `Ciclo ${record.cycleNumber} salvo para ${company.displayName}.`, "success");
    } catch {
      notify("Nao foi possivel salvar o registro", "Confira os dados e sua permissao de esterilizacao.", "danger");
    }
  }

  async function handleLogout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setSignedIn(false);
    setActiveView("dashboard");
  }

  if (!signedIn) {
    return <LoginScreen company={company} onDemoAccess={() => setSignedIn(true)} />;
  }

  return (
    <Layout allowedViews={allowedViews} company={company} profile={profile} activeView={activeView} onViewChange={setActiveView} onLogout={handleLogout}>
      <div className="app-input-mask-scope" onInputCapture={handleMaskedInput}>
      {notice && <Toast notice={notice} onClose={() => setNotice(null)} />}
      {billingAttendance && <FinancialReviewDialog attendance={billingAttendance} patient={patients.find((item) => item.id === billingAttendance.patientId)} products={stock} onCancel={() => setBillingAttendance(null)} onConfirm={async (transaction) => { await handleCreateFinancial(transaction); setBillingAttendance(null); notify("Lançamento financeiro gerado com sucesso.", `Lancamento vinculado ao BA ${billingAttendance.baNumber}.`, "success"); }} />}
      {activeView === "dashboard" && <Dashboard appointments={appointments} company={company} financial={financial} stock={stock} attendances={attendances} patients={patients} />}
      {activeView === "ba-opening" && (
        <BaOpening
          company={company}
          profiles={demoProfiles}
          patients={patients}
          attendances={attendances}
          prefill={baOpeningPrefill}
          onOpenBa={handleOpenBa}
          opening={baSubmitting}
          onNotify={notify}
        />
      )}
      {activeView === "patients" && (
        <Patients
          companyId={company.id}
          patients={patients}
          attendances={attendances}
          onSelect={(id) => { setSelectedPatientId(id); setActiveView("patient-profile"); }}
          onOpenNewPatient={() => setActiveView("ba-opening")}
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
          products={stock.filter((item) => item.companyId === company.id)}
          onGenerateReport={(attendanceId) => handleGenerateAiReport(selectedPatient.id, "Persistencia de sintomas e necessidade de avaliacao medica complementar.", attendanceId)}
          aiReport={aiReport}
          onChangeAiReport={setAiReport}
          onCreateAttendance={handleCreateAttendance}
          onFinishAttendance={handleFinishAttendance}
          onSaveAnamnesis={handleSaveAnamnesis}
          onSaveFootSensitivity={handleSaveFootSensitivity}
          onRemoveFootSensitivity={handleRemoveFootSensitivity}
          onSaveAttendanceImage={handleSaveAttendanceImage}
          onSaveComparativeNote={handleSaveComparativeNote}
          company={company}
          professionalId={profile.id}
          profiles={demoProfiles}
          hciHistories={authorizedHciHistories}
          onSchedule={() => setActiveView("schedule")}
          onSelectAttendance={setActiveAttendanceId}
        />
      )}
      {activeView === "attendances" && (
        <Attendances
          attendances={attendances}
          attendanceImages={attendanceImages}
          patients={patients}
          profiles={demoProfiles}
          onContinue={handleStartAttendance}
          onExport={(attendance) => {
            const patient = patients.find((item) => item.id === attendance.patientId);
            if (patient) exportAttendanceBa(patient, company, attendance, anamneses, footSensitivityMaps, attendanceImages);
          }}
          onOpenPatient={(patientId, attendanceId) => {
            setSelectedPatientId(patientId);
            setActiveAttendanceId(attendanceId);
            setActiveView("patient-profile");
          }}
          onStart={handleStartAttendance}
        />
      )}
      {activeView === "attendance-management" && (
        hasAttendanceManagementAccess ? (
          <AttendanceManagement
            attendances={attendances}
            auditLogs={attendanceAuditLogs}
            patients={patients}
            profiles={demoProfiles}
            onOpenAttendance={(patientId, attendanceId) => {
              setSelectedPatientId(patientId);
              setActiveAttendanceId(attendanceId);
              setActiveView("patient-profile");
            }}
            onReopen={handleReopenAttendance}
          />
        ) : (
          <EmptyState title="Acesso restrito" message="Seu perfil não possui permissão para gerenciar reabertura de atendimentos." />
        )
      )}
      {activeView === "schedule" && (
        <ClinicalAgendaPage
          company={company}
          appointments={appointments}
          patients={patients}
          profiles={demoProfiles}
          onSaveAppointment={handleSaveAppointment}
          onUpdateStatus={handleUpdateAppointmentStatus}
          onUpdateAppointment={handleUpdateAppointment}
          onOpenBa={handleOpenBaFromAppointment}
          onNotify={notify}
        />
      )}
      {activeView === "financial" && <Financial attendances={attendances} financial={financial} onCreate={handleCreateFinancial} patients={patients} profiles={demoProfiles} companyId={company.id} stock={stock} onCreateProduct={handleCreateProduct} onUpdateProduct={handleUpdateProduct} />}
      {activeView === "stock" && <Stock companyId={company.id} onCreate={handleCreateProduct} onUpdate={handleUpdateProduct} stock={stock} />}
      {activeView === "autoclave" && <AutoclaveRecords company={company} profile={profile} records={autoclaveRecords} stock={stock} onSave={handleSaveAutoclaveRecord} />}
      {activeView === "reports" && (
        <Reports
          anamneses={anamneses}
          attendanceImages={attendanceImages}
          attendances={attendances}
          company={company}
          companyId={company.id}
          financial={financial}
          patient={selectedPatient}
          patients={patients}
          profiles={demoProfiles}
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
      {activeView === "settings" && <SettingsView company={company} profile={profile} onCompanyChange={setCompany} onNotify={notify} />}
      {activeView === "super-admin" && <SuperAdmin company={company} onNotify={notify} />}
      </div>
    </Layout>
  );
}

type DashboardPeriod = "today" | "week" | "month" | "custom";

function Dashboard({ company, appointments, financial, stock, attendances, patients }: { company: Company; appointments: ClinicalAppointment[]; financial: FinancialTransaction[]; stock: StockProduct[]; attendances: Attendance[]; patients: Patient[] }) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const companyId = company.id;
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const range = useMemo(() => dashboardDateRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const localPatients = patients.filter((item) => item.companyId === companyId);
  const localAttendances = attendances.filter((item) => item.companyId === companyId && isDateInRange(item.openedAt ?? item.scheduledAt, range));
  const localAppointments = appointments.filter((item) => item.companyId === companyId && isDateInRange(item.appointmentDate, range));
  const localFinancial = financial.filter((item) => item.companyId === companyId && isDateInRange(item.paidAt ?? item.dueDate, range));
  const periodPatients = localPatients.filter((item) => isDateInRange(item.createdAt, range));
  const recurringPatientIds = new Set(localAttendances.filter((item) => localAttendances.filter((other) => other.patientId === item.patientId).length > 1).map((item) => item.patientId));
  const revenue = localFinancial.filter((item) => item.type === "income" && item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const expenses = localFinancial.filter((item) => item.type === "expense" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount, 0);
  const chartDays = Array.from({ length: Math.min(7, Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000) + 1)) }, (_, index) => {
    const date = new Date(range.start);
    date.setDate(date.getDate() + index);
    return {
      label: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      value: localAttendances.filter((item) => sameLocalDay(new Date(item.openedAt ?? item.scheduledAt), date)).length
    };
  });
  const periodLabel = period === "today" ? "Hoje" : period === "week" ? "Esta semana" : period === "month" ? "Este mes" : "Periodo personalizado";

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">Sistema de gestao para podologia</span>
          <h1>Podo360</h1>
          <p>Organize pacientes, anamnese, agenda, atendimentos, financeiro, estoque e relatorios em uma experiencia clara para a equipe.</p>
        </div>
        <div className="hero-panel__actions">
          <button className="ghost-button" onClick={() => exportDashboardReport(company, periodLabel, range, { localPatients, periodPatients, localAttendances, localAppointments, localFinancial, stock, revenue, expenses, recurringPatientIds })} type="button"><FileText size={18} /> Gerar relatorio</button>
        </div>
      </section>

      <div className="filter-row">
        {([["today", "Hoje"], ["week", "Esta semana"], ["month", "Este mes"], ["custom", "Periodo personalizado"]] as const).map(([key, label]) => (
          <button className={period === key ? "is-active" : ""} key={key} onClick={() => setPeriod(key)} type="button">{label}</button>
        ))}
        {period === "custom" && <><input aria-label="Inicio do periodo" onChange={(event) => setCustomStart(event.target.value)} type="date" value={customStart} /><input aria-label="Fim do periodo" onChange={(event) => setCustomEnd(event.target.value)} type="date" value={customEnd} /></>}
      </div>

      <section className="metrics-grid">
        <MetricCard icon={<Users />} label="Novos pacientes" value={String(periodPatients.length)} detail={periodLabel} tone="primary" />
        <MetricCard icon={<CalendarCheck />} label="Agendamentos" value={String(localAppointments.length)} detail={periodLabel} tone="success" />
        <MetricCard icon={<TrendingUp />} label="Reincidencia" value={String(recurringPatientIds.size)} detail="Pacientes com mais de um atendimento" tone="warning" />
        <MetricCard icon={<ClipboardEdit />} label="Atendimentos" value={String(localAttendances.length)} detail={`${localAttendances.filter((item) => item.status === "completed").length} finalizados`} />
        <MetricCard icon={<Receipt />} label="Receita no periodo" value={currency.format(revenue)} detail={`${currency.format(expenses)} em despesas`} tone="success" />
        <MetricCard icon={<AlertTriangle />} label="Estoque baixo" value={String(stock.filter((product) => product.companyId === companyId && product.minimumQuantity > 0 && product.currentQuantity <= product.minimumQuantity).length)} detail="Produtos abaixo do minimo" tone="danger" />
      </section>

      <div className="dashboard-grid">
        <ChartCard title="Atendimentos por dia" subtitle={periodLabel} data={chartDays} />
        <ChartCard title="Novos x recorrentes" subtitle={periodLabel} data={[{ label: "Novos", value: periodPatients.length, secondary: 0 }, { label: "Recorr.", value: recurringPatientIds.size, secondary: 0 }]} />
        <ChartCard title="Receitas x despesas" subtitle={periodLabel} format="currency" data={[{ label: "Receitas", value: revenue }, { label: "Despesas", value: expenses }]} />
        <ChartCard title="Status da agenda" subtitle={periodLabel} data={[{ label: "Agend.", value: localAppointments.length }, { label: "Faltou", value: localAppointments.filter((item) => item.status === "no_show").length }, { label: "Chegou", value: localAppointments.filter((item) => item.status === "arrived").length }]} />
      </div>

      <section className="split-grid">
        <div className="data-panel">
          <div className="section-heading">
            <div><h2>Proximos atendimentos</h2><p>Agenda conectada ao historico clinico</p></div>
            <CalendarClock size={20} />
          </div>
          <Table
            headers={["Paciente", "Data", "Status"]}
            rows={localAttendances.map((attendance) => [patientName(patients, attendance.patientId), formatDateTime(attendance.scheduledAt), statusLabel(attendance.status)])}
          />
        </div>
        <div className="data-panel">
          <div className="section-heading">
            <div><h2>Produtos em alerta</h2><p>Baixa automatica preparada por atendimento</p></div>
            <Boxes size={20} />
          </div>
          <Table
            headers={["Produto", "Atual", "Minimo"]}
            rows={stock.filter((product) => product.companyId === companyId && product.minimumQuantity > 0 && product.currentQuantity <= product.minimumQuantity).map((product) => [product.name, `${product.currentQuantity} ${product.unit}`, `${product.minimumQuantity} ${product.unit}`])}
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
  prefill,
  onOpenBa,
  opening,
  onNotify
}: {
  company: Company;
  profiles: typeof demoProfiles;
  patients: Patient[];
  attendances: Attendance[];
  prefill: BaOpeningPrefill | null;
  onOpenBa: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  opening: boolean;
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
  const [baPrefill, setBaPrefill] = useState({
    sourceAppointmentId: "",
    visitKind: "",
    chiefComplaint: "",
    initialNotes: ""
  });
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [payerType, setPayerType] = useState<"private" | "insurance">("private");
  const showInsuranceType = Boolean(company.enableInsuranceType);

  useEffect(() => {
    if (!prefill) return;
    const result = calculateAgeValue(prefill.birthDate);
    setPatientData({
      fullName: prefill.fullName,
      cpf: prefill.cpf || "",
      birthDate: prefill.birthDate || "",
      age: result.ageText,
      profession: prefill.profession || "",
      phone: prefill.phone || "",
      whatsapp: prefill.whatsapp || prefill.phone || "",
      email: prefill.email || "",
      address: prefill.address || "",
      uniqueRecordNumber: prefill.uniqueRecordNumber || ""
    });
    setBaPrefill({
      sourceAppointmentId: prefill.appointmentId,
      visitKind: prefill.visitKind || "",
      chiefComplaint: prefill.chiefComplaint || "",
      initialNotes: prefill.initialNotes || ""
    });
    setBirthDateMessage(result.message);
    setPayerType(prefill.payerType ?? "private");
  }, [prefill]);

  function updatePatientField(key: keyof typeof patientData, value: string) {
    if (key === "cpf") value = formatCpf(value);
    if (key === "phone" || key === "whatsapp") value = formatPhone(value);
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
      onNotify("Informe um dado para busca", "Digite nome, CPF, telefone, WhatsApp ou Prontuário de Evolução.", "warning");
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
      onNotify("Nenhum paciente encontrado", "Continue o cadastro para criar um novo Prontuário de Evolução.", "info");
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

  async function handleBaSubmit(event: FormEvent<HTMLFormElement>) {
    const opened = await onOpenBa(event);
    if (!opened) return;
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
    setBaPrefill({ sourceAppointmentId: "", visitKind: "", chiefComplaint: "", initialNotes: "" });
    setSearchOpen(false);
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Recepção · ponto inicial do atendimento</span>
          <h1>Abertura de atendimento</h1>
          <p>Identifique ou crie o Prontuário de Evolução, gere o BA e coloque o paciente em Aguardando atendimento.</p>
        </div>
        <ClipboardPlus size={28} />
      </div>

      <form className="panel-form ba-form" key={baPrefill.sourceAppointmentId || "manual-ba"} onSubmit={handleBaSubmit}>
        <section>
          <h2>Dados do Paciente</h2>
          {prefill && !prefill.uniqueRecordNumber && (
            <p className="inline-info">Este paciente veio da Agenda Clínica e ainda não possui Prontuário de Evolução. Ele será criado somente ao confirmar a abertura de atendimento.</p>
          )}
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
            <label>Telefone / WhatsApp<input name="phone" value={patientData.phone} onChange={(event) => { updatePatientField("phone", event.target.value); updatePatientField("whatsapp", event.target.value); }} /></label>
            <input name="whatsapp" type="hidden" value={patientData.whatsapp || patientData.phone} />
            <label>E-mail<input name="email" type="email" value={patientData.email} onChange={(event) => updatePatientField("email", event.target.value)} /></label>
            <label>Prontuário de Evolução<input name="uniqueRecordNumber" readOnly value={patientData.uniqueRecordNumber} placeholder="Gerado automaticamente na primeira entrada" /><small className="field-help">{patientData.uniqueRecordNumber ? "Número vinculado ao paciente selecionado." : "Será gerado automaticamente ao abrir o BA."}</small></label>
          </div>
          <label>Endereco<input name="address" value={patientData.address} onChange={(event) => updatePatientField("address", event.target.value)} /></label>
          {birthDateMessage && <p className="inline-warning">{birthDateMessage}</p>}

          {searchOpen && (
            <div className="search-results-panel">
              <div className="section-heading section-heading--compact">
                <div>
                  <h3>Resultados da busca</h3>
                  <p>{searchResults.length ? "Selecione um paciente para preencher somente os Dados do Paciente." : "Nenhum paciente encontrado. Continue o cadastro para criar um novo Prontuário de Evolução."}</p>
                </div>
                <button className="ghost-action" onClick={() => setSearchOpen(false)} type="button">Fechar</button>
              </div>
              <div className="search-result-list">
                {searchResults.map(({ patient, lastBa }) => (
                  <button key={patient.id} onClick={() => selectPatient(patient)} type="button">
                    <strong>{patient.fullName}</strong>
                    <span>CPF {maskCpf(patient.cpf)} · {formatDate(patient.birthDate)} · {calculateAge(patient.birthDate)}</span>
                    <small>{patient.whatsapp || patient.phone} · Prontuário de Evolução {patient.uniqueRecordNumber} · Último BA {lastBa?.baNumber ?? "sem BA"}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2>Dados do BA</h2>
          <input name="sourceAppointmentId" type="hidden" value={baPrefill.sourceAppointmentId} />
          <div className="form-grid">
            <label>
              Primeira avaliacao ou retorno
              <select name="visitKind" defaultValue={baPrefill.visitKind}>
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
            {showInsuranceType && <label>Convênio ou particular<select name="payerType" onChange={(event) => setPayerType(event.target.value as "private" | "insurance")} value={payerType}><option value="private">Particular</option><option value="insurance">Convênio</option></select></label>}
            {showInsuranceType && payerType === "insurance" && <label>Nome do convênio<input defaultValue={prefill?.insuranceName} name="insuranceName" required placeholder="Informe o convênio" /></label>}
            <label>Data/hora de abertura<input value={new Date().toLocaleString("pt-BR")} readOnly /></label>
          </div>
          <label>Observacoes iniciais<textarea name="initialNotes" defaultValue={baPrefill.initialNotes} /></label>
        </section>

        <button className="primary-button" disabled={opening} type="submit"><ClipboardPlus size={18} /> {opening ? "Abrindo BA..." : "Abrir BA"}</button>
      </form>
    </div>
  );
}

function Patients({
  companyId,
  patients,
  attendances,
  onSelect,
  onOpenNewPatient
}: {
  companyId: string;
  patients: Patient[];
  attendances: Attendance[];
  onSelect: (id: string) => void;
  onOpenNewPatient: () => void;
}) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [withOpenBa, setWithOpenBa] = useState(false);
  const [withClinicalHistory, setWithClinicalHistory] = useState(false);
  const [lastAttendancePeriod, setLastAttendancePeriod] = useState("all");

  const results = patients
    .filter((patient) => patient.companyId === companyId)
    .map((patient) => {
      const patientAttendances = attendances
        .filter((attendance) => attendance.companyId === companyId && attendance.patientId === patient.id)
        .sort((a, b) => new Date(b.openedAt ?? b.scheduledAt).getTime() - new Date(a.openedAt ?? a.scheduledAt).getTime());
      return { patient, patientAttendances, lastBa: patientAttendances[0], lastCompleted: patientAttendances.find((attendance) => attendance.status === "completed") };
    })
    .filter(({ patient, patientAttendances, lastBa }) => {
      const baNumbers = patientAttendances.map((attendance) => attendance.baNumber).join(" ");
      const searchable = normalizeText(`${patient.fullName} ${patient.cpf} ${patient.phone} ${patient.whatsapp} ${patient.uniqueRecordNumber} ${baNumbers}`);
      return searchable.includes(normalizeText(submittedQuery)) &&
        (!withOpenBa || patientAttendances.some((attendance) => ["ba_open", "waiting", "in_progress", "paused"].includes(attendance.status))) &&
        (!withClinicalHistory || patientAttendances.length > 0 || Boolean(patient.clinical.diseaseHistory)) &&
        (lastAttendancePeriod === "all" || Boolean(lastBa && matchesPeriod(lastBa.openedAt ?? lastBa.scheduledAt, lastAttendancePeriod)));
    });

  function searchPatients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      setSubmittedQuery(query.trim());
      setSearched(true);
      setLoading(false);
    }, 250);
  }

  function clearSearch() {
    setQuery("");
    setSubmittedQuery("");
    setSearched(false);
    setWithOpenBa(false);
    setWithClinicalHistory(false);
    setLastAttendancePeriod("all");
  }

  return (
    <div className="patient-search-page">
      <section className="patient-search-hero">
        <div className="patient-search-hero__icon"><Search size={28} /></div>
        <div>
          <span className="eyebrow">Consulta histórica da clínica</span>
          <h1>Pesquisar paciente</h1>
          <p>Busque pelo nome, CPF, telefone, Prontuário de Evolução ou BA para acessar o histórico completo do paciente.</p>
        </div>
        <form className="patient-search-form" onSubmit={searchPatients}>
          <label className="patient-search-form__field">
            <Search size={20} />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, CPF, telefone, Prontuário de Evolução ou BA" />
          </label>
          <button className="primary-button" disabled={loading} type="submit">{loading ? "Pesquisando..." : "Pesquisar"}</button>
        </form>
        <div className="patient-quick-filters">
          <label><input checked={withOpenBa} onChange={(event) => setWithOpenBa(event.target.checked)} type="checkbox" /> Com BA aberto</label>
          <label><input checked={withClinicalHistory} onChange={(event) => setWithClinicalHistory(event.target.checked)} type="checkbox" /> Com histórico clínico</label>
          <select aria-label="Período do último atendimento" value={lastAttendancePeriod} onChange={(event) => setLastAttendancePeriod(event.target.value)}>
            <option value="all">Qualquer último atendimento</option><option value="today">Atendido hoje</option><option value="week">Atendido esta semana</option><option value="month">Atendido este mês</option>
          </select>
          {searched && <button className="ghost-action" onClick={clearSearch} type="button">Limpar pesquisa</button>}
        </div>
      </section>

      {!searched && !loading && (
        <section className="patient-search-initial">
          <Users size={30} />
          <h2>Pesquise um paciente para visualizar os dados e histórico clínico.</h2>
          <p>A consulta mostra somente pacientes e BAs vinculados à clínica atual. Histórico externo permanece protegido pelo HCI.</p>
        </section>
      )}

      {loading && <section className="patient-search-loading"><span /><span /><span /></section>}

      {searched && !loading && (
        <section className="patient-results">
          <div className="section-heading section-heading--compact"><div><h2>Pacientes encontrados</h2><p>{results.length} resultado(s) para a pesquisa realizada.</p></div></div>
          {results.length ? results.map(({ patient, lastBa, lastCompleted }) => (
            <button className="patient-result-card" key={patient.id} onClick={() => onSelect(patient.id)} type="button">
              <span className="patient-result-card__avatar">{patient.fullName.slice(0, 2).toUpperCase()}</span>
              <span className="patient-result-card__identity"><strong>{patient.fullName}</strong><small>CPF {maskCpf(patient.cpf)} · {patient.whatsapp || patient.phone}</small><small>Prontuário de Evolução {patient.uniqueRecordNumber}</small></span>
              <span className="patient-result-card__meta"><small>Idade</small><strong>{calculateAge(patient.birthDate)}</strong></span>
              <span className="patient-result-card__meta"><small>Último BA</small><strong>{lastBa?.baNumber ?? "Sem BA"}</strong></span>
              <span className="patient-result-card__meta"><small>Último atendimento</small><strong>{lastCompleted ? formatDateTime(lastCompleted.finishedAt ?? lastCompleted.scheduledAt) : "-"}</strong></span>
              <span className={`status-badge status-badge--${lastBa?.status ?? "ba_open"}`}>{lastBa ? statusLabel(lastBa.status) : "Sem BA aberto"}</span>
              <span className="ghost-action">Ver paciente</span>
            </button>
          )) : (
            <div className="patient-no-results"><EmptyState title="Nenhum paciente encontrado" message="Revise os dados pesquisados ou abra um BA para um novo paciente." /><button className="primary-button" onClick={onOpenNewPatient} type="button"><ClipboardPlus size={17} /> Abrir BA para novo paciente</button></div>
          )}
        </section>
      )}
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
  products,
  onGenerateReport,
  aiReport,
  onChangeAiReport,
  onCreateAttendance,
  onFinishAttendance,
  onSaveAnamnesis,
  onSaveFootSensitivity,
  onRemoveFootSensitivity,
  onSaveAttendanceImage,
  onSaveComparativeNote,
  company,
  professionalId,
  profiles,
  hciHistories,
  onSchedule,
  onSelectAttendance
}: {
  patient: Patient;
  attendances: Attendance[];
  activeAttendanceId: string | null;
  uniqueMedicalRecord?: UniqueMedicalRecord;
  anamneses: AnamnesisRecord[];
  footSensitivityMaps: FootSensitivityMap[];
  attendanceImages: AttendanceImage[];
  products: StockProduct[];
  onGenerateReport: (attendanceId?: string) => Promise<void> | void;
  aiReport: string;
  onChangeAiReport: (value: string) => void;
  onCreateAttendance: (patient: Patient) => void;
  onFinishAttendance: (attendanceId: string) => void;
  onSaveAnamnesis: (record: AnamnesisRecord) => void;
  onSaveFootSensitivity: (entry: Omit<FootSensitivityMap, "id" | "createdAt"> & { id?: string }) => Promise<void> | void;
  onRemoveFootSensitivity: (entryId: string) => Promise<void> | void;
  onSaveAttendanceImage: (image: Omit<AttendanceImage, "id" | "createdAt">) => Promise<void> | void;
  onSaveComparativeNote: (imageIds: string[], note: string) => Promise<void> | void;
  company: Company;
  professionalId: string;
  profiles: typeof demoProfiles;
  hciHistories: IntegratedClinicalHistory[];
  onSchedule: () => void;
  onSelectAttendance: (attendanceId: string) => void;
}) {
  const [activePatientTab, setActivePatientTab] = useState<PatientTabKey>(() => {
    const selected = attendances.find((attendance) => attendance.id === activeAttendanceId);
    return selected && ["waiting", "in_progress", "paused"].includes(selected.status) ? "anamnesis" : "patient-data";
  });
  const currentAttendance =
    attendances.find((attendance) => attendance.id === activeAttendanceId) ??
    attendances.find((attendance) => attendance.status === "in_progress") ??
    attendances[0];
  const currentAnamnesis = currentAttendance ? anamneses.find((record) => record.attendanceId === currentAttendance.id) : undefined;
  const attendanceLocked = isAttendanceFinalized(currentAttendance);
  const [generatingAiReport, setGeneratingAiReport] = useState(false);
  const [finishAttendanceCandidateId, setFinishAttendanceCandidateId] = useState<string | null>(null);

  function handleOpenFinishModal(attendanceId: string) {
    setFinishAttendanceCandidateId(attendanceId);
  }

  function handleCancelFinish(event?: { preventDefault?: () => void; stopPropagation?: () => void }) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setFinishAttendanceCandidateId(null);
  }

  function handleConfirmFinish(event?: { preventDefault?: () => void; stopPropagation?: () => void }) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const attendanceId = finishAttendanceCandidateId;
    if (!attendanceId) return;
    setFinishAttendanceCandidateId(null);
    onFinishAttendance(attendanceId);
  }

  useEffect(() => {
    if (!finishAttendanceCandidateId) return;
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setFinishAttendanceCandidateId(null);
    }
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [finishAttendanceCandidateId]);

  async function generateCurrentAttendanceReport() {
    if (!currentAttendance) return;
    setGeneratingAiReport(true);
    setActivePatientTab("reports");
    try {
      await onGenerateReport(currentAttendance.id);
    } finally {
      setGeneratingAiReport(false);
    }
  }

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
      products={products}
      readOnly={attendanceLocked}
      readOnlyMessage={FINALIZED_ATTENDANCE_MESSAGE}
      onFinishAttendanceRequest={() => {
        if (currentAttendance.status === "in_progress") handleOpenFinishModal(currentAttendance.id);
      }}
      footSensitivitySlot={
        <FootSensitivityMap3D
          entries={footSensitivityMaps}
          onSave={onSaveFootSensitivity}
          onRemove={onRemoveFootSensitivity}
          patientId={patient.id}
          companyId={company.id}
          professionalId={professionalId}
          attendanceId={currentAttendance.id}
          uniqueMedicalRecordId={currentAttendance.uniqueMedicalRecordId}
          uniqueRecordNumber={patient.uniqueRecordNumber}
          baNumber={currentAttendance.baNumber}
          readOnly={attendanceLocked}
          readOnlyMessage={FINALIZED_ATTENDANCE_MESSAGE}
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
          readOnly={attendanceLocked}
          readOnlyMessage={FINALIZED_ATTENDANCE_MESSAGE}
        />
      }
      imageEvolutionSlot={
        <ImageEvolutionComparison
          images={attendanceImages}
          attendances={attendances}
          patientId={patient.id}
          uniqueMedicalRecordId={patient.uniqueMedicalRecordId}
          onComparativeNote={onSaveComparativeNote}
          readOnly={attendanceLocked}
          readOnlyMessage={FINALIZED_ATTENDANCE_MESSAGE}
        />
      }
    />
  ) : <EmptyState title="Nenhum BA registrado" message="Abra um BA para iniciar a ficha modular de anamnese." />;

  return (
    <div className="page-stack">
      <section className="profile-header">
        <div>
          <span className="eyebrow">Prontuário de Evolução: {patient.uniqueRecordNumber}</span>
          <h1>{patient.fullName}</h1>
          <p>{patient.whatsapp} · {patient.profession || "Profissao nao informada"} · CPF {patient.cpf}</p>
        </div>
        <div className="hero-panel__actions">
          <button className="ghost-action" onClick={() => onCreateAttendance(patient)} type="button"><Plus size={18} /> Novo BA</button>
          <button className="ghost-action" onClick={onSchedule} type="button"><CalendarPlus size={18} /> Agendar atendimento</button>
          <button className="ghost-action export-action export-action--pdf" onClick={() => exportMedicalRecord(patient, company, attendances, anamneses, footSensitivityMaps, attendanceImages)} type="button"><Download size={18} /> Exportar Prontuário de Evolução</button>
          <button className="primary-button" disabled={generatingAiReport || !currentAttendance} onClick={generateCurrentAttendanceReport} type="button"><Sparkles size={18} /> {generatingAiReport ? "Gerando relatório com IA..." : "Gerar relatorio com IA"}</button>
        </div>
      </section>

      <section className="tabs-bar">
        {patientTabs.filter((tab) => tab.key !== "hci" || company.hciEnabled).map((tab) => (
          <button className={activePatientTab === tab.key ? "is-active" : ""} key={tab.key} onClick={() => setActivePatientTab(tab.key)} type="button">{tab.label}</button>
        ))}
      </section>

      {currentAttendance && (
        <section className="attendance-topline">
          <div><span>Paciente</span><strong>{patient.fullName}</strong></div>
          <div><span>Nascimento</span><strong>{patient.birthDate ? formatDate(patient.birthDate) : "Nao informado"}</strong></div>
          <div><span>Idade</span><strong>{calculateAge(patient.birthDate)}</strong></div>
          <div><span>Prontuário de Evolução</span><strong>{patient.uniqueRecordNumber}</strong></div>
          <div><span>BA atual</span><strong>{currentAttendance.baNumber}</strong></div>
          <div><span>Status</span><strong>{statusLabel(currentAttendance.status)}</strong></div>
          <div><span>Abertura</span><strong>{formatDateTime(currentAttendance.openedAt ?? currentAttendance.scheduledAt)}</strong></div>
          <div><span>Inicio</span><strong>{currentAttendance.startedAt ? formatDateTime(currentAttendance.startedAt) : "Nao iniciado"}</strong></div>
          <div><span>Profissional</span><strong>{currentAttendance.professionalId ? "Dra. Marina Costa" : "A definir"}</strong></div>
          <div><span>Clinica</span><strong>{company.displayName}</strong></div>
          {attendanceLocked && <div><span>Bloqueio</span><strong><span className="status-badge status-badge--completed">Atendimento finalizado</span></strong></div>}
          {currentAttendance.status === "in_progress" && (
            <button className="primary-button" onClick={() => handleOpenFinishModal(currentAttendance.id)} type="button">
              <CheckCircle2 size={17} /> Finalizar atendimento
            </button>
          )}
        </section>
      )}

      {attendanceLocked && (
        <div className="locked-attendance-banner">
          <strong>Atendimento finalizado</strong>
          <span>Este atendimento está finalizado e está disponível apenas para consulta.</span>
        </div>
      )}

      {finishAttendanceCandidateId && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={handleCancelFinish}>
          <section
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-attendance-title"
            onKeyDown={(event) => { if (event.key === "Escape") handleCancelFinish(event); }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-card__icon"><CheckCircle2 size={22} /></div>
            <div>
              <h2 id="finish-attendance-title">Deseja finalizar este atendimento?</h2>
              <p>Ao confirmar, o BA sera fechado e a data/hora de finalizacao sera registrada. Agora nao apenas fecha esta confirmacao.</p>
            </div>
            <div className="dialog-card__actions">
              <button className="ghost-action" onClick={handleCancelFinish} type="button">Agora nao</button>
              <button
                className="primary-button"
                onClick={handleConfirmFinish}
                type="button"
              >
                Sim, finalizar
              </button>
            </div>
          </section>
        </div>
      )}

      {activePatientTab === "patient-data" && <PatientDataSection patient={patient} />}
      {activePatientTab === "unique-record" && <UniqueMedicalRecordView patient={patient} uniqueMedicalRecord={uniqueMedicalRecord} attendances={attendances} attendanceImages={attendanceImages} />}
      {activePatientTab === "history" && <PatientAttendanceHistory attendances={attendances} patient={patient} profiles={profiles} company={company} anamneses={anamneses} footSensitivityMaps={footSensitivityMaps} attendanceImages={attendanceImages} />}
      {activePatientTab === "bas" && <PatientBas attendances={attendances} patient={patient} company={company} anamneses={anamneses} footSensitivityMaps={footSensitivityMaps} attendanceImages={attendanceImages} onCreateAttendance={onCreateAttendance} onContinue={(attendanceId) => { onSelectAttendance(attendanceId); setActivePatientTab("anamnesis"); }} />}
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
          readOnly={attendanceLocked}
          readOnlyMessage={FINALIZED_ATTENDANCE_MESSAGE}
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
            readOnly={attendanceLocked}
            readOnlyMessage={FINALIZED_ATTENDANCE_MESSAGE}
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
          generatingAiReport={generatingAiReport}
          report={aiReport}
          onChangeReport={onChangeAiReport}
        />
      )}
      {activePatientTab === "hci" && <PatientHci patient={patient} histories={hciHistories} />}
    </div>
  );
}

function PatientDataSection({ patient }: { patient: Patient }) {
  return (
    <section className="data-panel">
      <div className="section-heading section-heading--compact">
        <div>
          <h2>Dados do paciente</h2>
          <p>Dados cadastrais operacionais. Historico clinico completo permanece no Prontuário de Evolução.</p>
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
        <div><dt>Prontuário de Evolução</dt><dd>{patient.uniqueRecordNumber}</dd></div>
        <div><dt>Data de cadastro</dt><dd>{formatDate(patient.createdAt)}</dd></div>
        <div><dt>Status do paciente</dt><dd><span className="status-badge status-badge--completed">Ativo</span></dd></div>
      </dl>
    </section>
  );
}

function PatientAttendanceHistory({ attendances, patient, profiles, company, anamneses, footSensitivityMaps, attendanceImages }: { attendances: Attendance[]; patient: Patient; profiles: typeof demoProfiles; company: Company; anamneses: AnamnesisRecord[]; footSensitivityMaps: FootSensitivityMap[]; attendanceImages: AttendanceImage[] }) {
  const [selected, setSelected] = useState<Attendance | null>(null);
  return (
    <section className="page-stack">
      <div className="section-heading section-heading--compact"><div><h2>Histórico de atendimentos</h2><p>Atendimentos locais vinculados ao Prontuário de Evolução nesta clínica.</p></div></div>
      {attendances.length ? <div className="patient-history-list">{attendances.map((attendance) => (
        <article className="patient-history-card" key={attendance.id}>
          <div><span className={`status-badge status-badge--${attendance.status}`}>{statusLabel(attendance.status)}</span><h3>{attendance.baNumber}</h3><p>{formatDateTime(attendance.openedAt)} · {profiles.find((item) => item.id === attendance.professionalId)?.fullName ?? "Profissional a definir"}</p></div>
          <dl><div><dt>Tipo</dt><dd>{attendance.type}</dd></div><div><dt>Queixa principal</dt><dd>{attendance.complaint || "Nao informada"}</dd></div><div><dt>Resumo</dt><dd>{attendance.procedure || attendance.notes || "Sem resumo registrado"}</dd></div></dl>
          <div className="table-actions"><button className="ghost-action" onClick={() => setSelected(attendance)} type="button">Ver detalhes</button><button className="ghost-action export-action export-action--pdf" onClick={() => exportAttendanceBa(patient, company, attendance, anamneses, footSensitivityMaps, attendanceImages)} type="button"><Download size={17} /> Exportar BA</button></div>
        </article>
      ))}</div> : <EmptyState title="Nenhum atendimento encontrado" message="Este paciente ainda nao possui atendimentos nesta clinica." />}
      {selected && <div className="dialog-backdrop" onMouseDown={() => setSelected(null)}><section className="dialog-card dialog-card--wide" onMouseDown={(event) => event.stopPropagation()}><div><h2>Detalhe do BA {selected.baNumber}</h2><p>{formatDateTime(selected.openedAt)} · {statusLabel(selected.status)}</p></div><dl className="definition-grid"><div><dt>Queixa</dt><dd>{selected.complaint || "-"}</dd></div><div><dt>Procedimento</dt><dd>{selected.procedure || "-"}</dd></div><div><dt>Avaliacao clinica</dt><dd>{selected.clinicalEvaluation || "-"}</dd></div><div><dt>Conduta</dt><dd>{selected.conduct || "-"}</dd></div><div><dt>Produtos utilizados</dt><dd>{selected.productsUsed.join(", ") || "-"}</dd></div><div><dt>Imagens vinculadas</dt><dd>{attendanceImages.filter((image) => image.attendanceId === selected.id).length}</dd></div></dl><div className="dialog-card__actions"><button className="ghost-action" onClick={() => setSelected(null)} type="button">Fechar</button><button className="primary-button export-action export-action--pdf" onClick={() => exportAttendanceBa(patient, company, selected, anamneses, footSensitivityMaps, attendanceImages)} type="button"><Download size={17} /> Salvar PDF</button></div></section></div>}
    </section>
  );
}

function PatientBas({ attendances, patient, company, anamneses, footSensitivityMaps, attendanceImages, onCreateAttendance, onContinue }: { attendances: Attendance[]; patient: Patient; company: Company; anamneses: AnamnesisRecord[]; footSensitivityMaps: FootSensitivityMap[]; attendanceImages: AttendanceImage[]; onCreateAttendance: (patient: Patient) => void; onContinue: (attendanceId: string) => void }) {
  return (
    <section className="page-stack">
      <div className="section-heading section-heading--compact"><div><h2>Boletins de Atendimento</h2><p>BAs separados por status e vinculados somente a esta clínica.</p></div><button className="primary-button" onClick={() => onCreateAttendance(patient)} type="button"><Plus size={17} /> Abrir novo BA</button></div>
      <div className="ba-status-groups">
        {(["waiting", "in_progress", "completed", "cancelled", "no_show"] as const).map((status) => {
          const items = attendances.filter((attendance) => attendance.status === status);
          return <section className="ba-status-group" key={status}><header><span className={`status-badge status-badge--${status}`}>{statusLabel(status)}</span><strong>{items.length}</strong></header>{items.length ? items.map((attendance) => <article key={attendance.id}><div><strong>{attendance.baNumber}</strong><small>{formatDateTime(attendance.openedAt)} · {attendance.type}</small></div><div className="table-actions">{attendance.status === "in_progress" && <button className="primary-button" onClick={() => onContinue(attendance.id)} type="button">Continuar atendimento</button>}<button className="ghost-action export-action export-action--pdf" onClick={() => exportAttendanceBa(patient, company, attendance, anamneses, footSensitivityMaps, attendanceImages)} type="button"><Download size={17} /> Exportar BA</button></div></article>) : <p>Nenhum BA neste status.</p>}</section>;
        })}
      </div>
    </section>
  );
}
function PatientHci({ patient, histories }: { patient: Patient; histories: IntegratedClinicalHistory[] }) {
  const [requested, setRequested] = useState(false);
  return (
    <section className="data-panel">
      <div className="section-heading section-heading--compact"><div><h2>Histórico Clínico Integrado</h2><p>Dados externos aparecem somente quando existe consentimento HCI autorizado.</p></div><ShieldCheck size={22} /></div>
      {histories.length ? histories.map((history) => <article className="hci-authorized-card" key={history.sourceCompany.id}><span className="status-badge status-badge--completed">Consentimento autorizado</span><h3>{history.sourceCompany.displayName}</h3><p>{history.attendances.length} atendimento(s) externo(s) autorizado(s) para consulta.</p><Table headers={["BA", "Data", "Procedimento"]} rows={history.attendances.map((attendance) => [attendance.baNumber, formatDateTime(attendance.openedAt ?? attendance.scheduledAt), attendance.procedure])} /></article>) : <div className="consent-empty"><ShieldCheck size={30} /><h2>{requested ? "Solicitação de consentimento registrada" : "Consentimento HCI necessário"}</h2><p>{requested ? "Aguarde a autorização do paciente antes de consultar histórico externo." : `Nenhum histórico externo de ${patient.fullName} pode ser exibido sem autorização explícita.`}</p><button className="primary-button" disabled={requested} onClick={() => setRequested(true)} type="button">{requested ? "Consentimento pendente" : "Solicitar consentimento HCI"}</button></div>}
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
  onGenerateReport,
  generatingAiReport,
  report,
  onChangeReport
}: {
  patient: Patient;
  currentAttendance?: Attendance;
  company: Company;
  attendances: Attendance[];
  anamneses: AnamnesisRecord[];
  footSensitivityMaps: FootSensitivityMap[];
  attendanceImages: AttendanceImage[];
  onGenerateReport: (attendanceId?: string) => Promise<void> | void;
  generatingAiReport?: boolean;
  report: string;
  onChangeReport: (value: string) => void;
}) {
  return (
    <section className="split-grid">
      <div className="data-panel">
        <div className="section-heading section-heading--compact">
          <div>
            <h2>Relatórios</h2>
            <p>Exportacoes e relatorio medico com IA respeitando Prontuário de Evolução, BA e HCI autorizado.</p>
          </div>
          <FileText size={20} />
        </div>
        <div className="report-list">
          <button className="export-action export-action--pdf" disabled={!currentAttendance} onClick={() => currentAttendance && exportAttendanceBa(patient, company, currentAttendance, anamneses, footSensitivityMaps, attendanceImages)} type="button"><FileText size={18} /> Exportar BA atual</button>
          <button className="export-action export-action--pdf" onClick={() => exportMedicalRecord(patient, company, attendances, anamneses, footSensitivityMaps, attendanceImages)} type="button"><Download size={18} /> Exportar Prontuário de Evolução completo</button>
          <button className="primary-button" disabled={generatingAiReport || !currentAttendance} onClick={() => currentAttendance && onGenerateReport(currentAttendance.id)} type="button"><Sparkles size={18} /> {generatingAiReport ? "Gerando relatório com IA..." : "Gerar relatório médico com IA"}</button>
        </div>
      </div>
      <div className="data-panel">
        {generatingAiReport ? <EmptyState title="Gerando relatório com IA..." message="Buscando BA, anamnese, imagens, evolução e dados da clínica para montar a pré-visualização." /> : report ? (
          <>
            <div className="section-heading section-heading--compact"><div><h2>Pré-visualização do relatório</h2><p>Revise o texto antes de exportar.</p></div><Printer size={20} /></div>
            <textarea className="report-editor" value={report} onChange={(event) => onChangeReport(event.target.value)} />
            <div className="dialog-card__actions"><button className="ghost-action" onClick={() => navigator.clipboard?.writeText(report)} type="button">Copiar</button><button className="primary-button export-action export-action--pdf" onClick={() => openPrintDocument(`Relatório clínico ${patient.fullName}`, [documentHeader(company, "Relatório Clínico Podológico"), `<pre class="report-text">${report}</pre>`].join(""), company)} type="button"><Download size={17} /> Salvar PDF</button></div>
          </>
        ) : attendances.length ? (
          <Table headers={["BA", "Data", "Status"]} rows={attendances.map((attendance) => [attendance.baNumber, formatDateTime(attendance.openedAt ?? attendance.scheduledAt), statusLabel(attendance.status)])} />
        ) : <EmptyState title="Nenhum relatório gerado" message="Este paciente ainda não possui atendimentos para exportacao." />}
      </div>
    </section>
  );
}

function AttendanceManagement({
  attendances,
  auditLogs,
  patients,
  profiles,
  onOpenAttendance,
  onReopen
}: {
  attendances: Attendance[];
  auditLogs: AttendanceAuditLog[];
  patients: Patient[];
  profiles: typeof demoProfiles;
  onOpenAttendance: (patientId: string, attendanceId: string) => void;
  onReopen: (attendanceId: string, reason: string) => Promise<void> | void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("completed");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selected, setSelected] = useState<Attendance | null>(null);
  const [reopening, setReopening] = useState<Attendance | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = attendances
    .filter((attendance) => {
      const patient = patients.find((item) => item.id === attendance.patientId);
      const professional = profiles.find((item) => item.id === attendance.professionalId);
      const text = normalizeText(`${patient?.fullName || ""} ${patient?.cpf || ""} ${patient?.phone || ""} ${patient?.whatsapp || ""} ${patient?.uniqueRecordNumber || ""} ${attendance.uniqueRecordNumber} ${attendance.baNumber} ${professional?.fullName || ""}`);
      return (!query || text.includes(normalizeText(query))) &&
        (status === "all" || attendance.status === status) &&
        (!periodStart || new Date(attendance.openedAt ?? attendance.scheduledAt) >= new Date(`${periodStart}T00:00:00`)) &&
        (!periodEnd || new Date(attendance.openedAt ?? attendance.scheduledAt) <= new Date(`${periodEnd}T23:59:59`));
    })
    .sort((a, b) => new Date(b.openedAt ?? b.scheduledAt).getTime() - new Date(a.openedAt ?? a.scheduledAt).getTime());

  async function confirmReopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reopening) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("Informe o motivo do cancelamento para auditoria.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onReopen(reopening.id, cleanReason);
      setReopening(null);
      setReason("");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "reopen_reason_required") setError("Informe o motivo do cancelamento para auditoria.");
      else setError("Não foi possível reabrir este atendimento agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-stack attendance-management">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">Auditoria clínica</span>
          <h1>Gerenciamento de Atendimento</h1>
          <p>Pesquise atendimentos finalizados e reabra para edição somente quando houver justificativa registrada.</p>
        </div>
        <ShieldCheck size={34} />
      </div>

      <div className="data-panel operational-filters">
        <div className="filter-grid">
          <label>Pesquisar paciente, CPF, telefone, BA ou Prontuário de Evolução<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite nome, CPF, telefone, BA ou PU" /></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="completed">Finalizados</option><option value="in_progress">Em atendimento</option><option value="waiting">Aguardando</option><option value="all">Todos</option></select></label>
          <label>Data inicial<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Data final<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <button className="ghost-action" onClick={() => { setQuery(""); setStatus("completed"); setPeriodStart(""); setPeriodEnd(""); }} type="button">Limpar filtros</button>
      </div>

      <div className="attendance-management-list">
        {filtered.length ? filtered.map((attendance) => {
          const patient = patients.find((item) => item.id === attendance.patientId);
          const professional = profiles.find((item) => item.id === attendance.professionalId);
          const logs = auditLogs.filter((log) => log.attendanceId === attendance.id);
          return (
            <article className="attendance-management-card" key={attendance.id}>
              <div>
                <span className={`status-badge status-badge--${attendance.status}`}>{statusLabel(attendance.status)}</span>
                <h3>{patient?.fullName ?? "Paciente não encontrado"}</h3>
                <p>BA {attendance.baNumber} · PU {attendance.uniqueRecordNumber}</p>
              </div>
              <dl className="definition-grid definition-grid--three">
                <div><dt>Data</dt><dd>{formatDateTime(attendance.openedAt ?? attendance.scheduledAt)}</dd></div>
                <div><dt>Profissional</dt><dd>{professional?.fullName ?? "A definir"}</dd></div>
                <div><dt>Finalizado em</dt><dd>{attendance.finishedAt ? formatDateTime(attendance.finishedAt) : "-"}</dd></div>
                <div><dt>Quem finalizou</dt><dd>{profiles.find((item) => item.id === attendance.finishedBy)?.fullName ?? "-"}</dd></div>
                <div><dt>Última reabertura</dt><dd>{attendance.reopenedAt ? formatDateTime(attendance.reopenedAt) : "-"}</dd></div>
                <div><dt>Auditoria</dt><dd>{logs.length} registro(s)</dd></div>
              </dl>
              <div className="table-actions">
                <button className="ghost-action" onClick={() => setSelected(attendance)} type="button"><Eye size={16} /> Ver detalhes</button>
                {patient && <button className="ghost-action" onClick={() => onOpenAttendance(patient.id, attendance.id)} type="button">Abrir atendimento</button>}
                {isAttendanceFinalized(attendance) && <button className="primary-button" onClick={() => { setReopening(attendance); setReason(""); setError(""); }} type="button">Cancelar finalização</button>}
              </div>
            </article>
          );
        }) : <EmptyState title="Nenhum atendimento encontrado" message="Ajuste os filtros ou pesquise por nome, CPF, telefone, BA ou Prontuário de Evolução." />}
      </div>

      {selected && (
        <div className="dialog-backdrop" onMouseDown={() => setSelected(null)}>
          <section className="dialog-card dialog-card--wide" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div><h2>Detalhes do BA {selected.baNumber}</h2><p>{statusLabel(selected.status)} · {formatDateTime(selected.openedAt ?? selected.scheduledAt)}</p></div>
            <dl className="definition-grid">
              <div><dt>Paciente</dt><dd>{patients.find((item) => item.id === selected.patientId)?.fullName ?? "-"}</dd></div>
              <div><dt>Prontuário de Evolução</dt><dd>{selected.uniqueRecordNumber}</dd></div>
              <div><dt>Finalizado em</dt><dd>{selected.finishedAt ? formatDateTime(selected.finishedAt) : "-"}</dd></div>
              <div><dt>Motivo da reabertura</dt><dd>{selected.reopenReason || "-"}</dd></div>
            </dl>
            <div className="audit-log-list">
              <h3>Auditoria</h3>
              {auditLogs.filter((log) => log.attendanceId === selected.id).length ? auditLogs.filter((log) => log.attendanceId === selected.id).map((log) => (
                <p key={log.id}><strong>{auditActionLabel(log.action)}</strong> · {formatDateTime(log.createdAt)} · {log.reason}</p>
              )) : <p className="muted">Nenhum registro local de auditoria nesta sessão.</p>}
            </div>
            <div className="dialog-card__actions"><button className="ghost-action" onClick={() => setSelected(null)} type="button">Fechar</button></div>
          </section>
        </div>
      )}

      {reopening && (
        <div className="dialog-backdrop" onMouseDown={() => !saving && setReopening(null)}>
          <form className="dialog-card dialog-card--wide" noValidate onSubmit={confirmReopen} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reopen-attendance-title">
            <div className="dialog-card__icon"><AlertTriangle size={22} /></div>
            <div>
              <h2 id="reopen-attendance-title">Cancelar finalização do atendimento</h2>
              <p>Essa ação permitirá novas edições neste atendimento. Informe o motivo para auditoria.</p>
            </div>
            <label>Motivo do cancelamento<textarea value={reason} onChange={(event) => setReason(event.target.value)} required placeholder="Descreva por que este atendimento precisa ser reaberto" /></label>
            {error && <div className="inline-error">{error}</div>}
            <div className="dialog-card__actions">
              <button className="ghost-action" disabled={saving} onClick={() => setReopening(null)} type="button">Cancelar</button>
              <button className="primary-button" disabled={saving} type="submit">{saving ? "Reabrindo..." : "Confirmar reabertura"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function auditActionLabel(action: AttendanceAuditLog["action"]) {
  const labels: Record<AttendanceAuditLog["action"], string> = {
    finalized: "Finalizado",
    finalization_cancelled: "Finalização cancelada",
    reopened_for_editing: "Reaberto para edição",
    edited_after_reopen: "Editado após reabertura"
  };
  return labels[action];
}

function Attendances({
  attendances,
  attendanceImages,
  patients,
  profiles,
  onStart,
  onContinue,
  onOpenPatient,
  onExport
}: {
  attendances: Attendance[];
  attendanceImages: AttendanceImage[];
  patients: Patient[];
  profiles: typeof demoProfiles;
  onStart: (attendanceId: string) => void;
  onContinue: (attendanceId: string) => void;
  onOpenPatient: (patientId: string, attendanceId: string) => void;
  onExport: (attendance: Attendance) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [professional, setProfessional] = useState("all");
  const [period, setPeriod] = useState("all");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [type, setType] = useState("all");
  const [returnOnly, setReturnOnly] = useState(false);
  const [imagesOnly, setImagesOnly] = useState(false);
  const [dressingOnly, setDressingOnly] = useState(false);

  const filtered = attendances
    .filter((attendance) => attendance.companyId === demoCompany.id)
    .filter((attendance) => {
      const patient = patients.find((item) => item.id === attendance.patientId);
      const text = normalizeText(`${patient?.fullName || ""} ${patient?.uniqueRecordNumber || ""} ${attendance.baNumber} ${attendance.complaint} ${attendance.procedure}`);
      return (!query || text.includes(normalizeText(query))) &&
        (status === "all" || attendance.status === status) &&
        (professional === "all" || attendance.professionalId === professional) &&
        (type === "all" || attendance.type === type) &&
        matchesPeriod(attendance.openedAt || attendance.scheduledAt, period, periodStart, periodEnd) &&
        (!returnOnly || attendance.visitKind === "return" || Boolean(attendance.recommendedReturn)) &&
        (!imagesOnly || attendanceImages.some((image) => image.attendanceId === attendance.id)) &&
        (!dressingOnly || normalizeText(`${attendance.procedure} ${attendance.conduct}`).includes("curativo"));
    })
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  function clearFilters() {
    setQuery(""); setStatus("all"); setProfessional("all"); setPeriod("all"); setPeriodStart(""); setPeriodEnd(""); setType("all");
    setReturnOnly(false); setImagesOnly(false); setDressingOnly(false);
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">Atendimentos</span><h1>Fila operacional</h1><p>Acompanhe BAs da clinica, inicie atendimentos e retome fichas modulares.</p></div>
      </div>
      <section className="queue-summary">
        {(["waiting", "in_progress", "completed", "cancelled", "no_show"] as const).map((item) => (
          <button className={status === item ? "is-active" : ""} key={item} onClick={() => setStatus(status === item ? "all" : item)} type="button">
            <strong>{attendances.filter((attendance) => attendance.status === item).length}</strong><span>{statusLabel(item)}</span>
          </button>
        ))}
      </section>
      <section className="data-panel operational-filters">
        <div className="filter-grid">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Paciente, Prontuário de Evolução, BA, queixa ou procedimento" />
          <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option>{(["waiting", "in_progress", "completed", "cancelled", "no_show", "paused", "ba_open"] as const).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select>
          <select value={professional} onChange={(event) => setProfessional(event.target.value)}><option value="all">Todos os profissionais</option>{profiles.filter((item) => item.role !== "financial").map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select>
          <select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">Todo o periodo</option><option value="today">Hoje</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="custom">Personalizado</option></select>
          {period === "custom" && <><input aria-label="Periodo inicial" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} type="date" /><input aria-label="Periodo final" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} type="date" /></>}
          <select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Todos os tipos</option>{Array.from(new Set(attendances.map((item) => item.type))).map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="filter-checks">
          <label><input checked={returnOnly} onChange={(event) => setReturnOnly(event.target.checked)} type="checkbox" /> Retorno</label>
          <label><input checked={imagesOnly} onChange={(event) => setImagesOnly(event.target.checked)} type="checkbox" /> Com imagens</label>
          <label><input checked={dressingOnly} onChange={(event) => setDressingOnly(event.target.checked)} type="checkbox" /> Com curativo</label>
          <button className="ghost-action" onClick={clearFilters} type="button">Limpar filtros</button>
        </div>
      </section>
      <section className="attendance-queue">
        {filtered.length ? filtered.map((attendance) => {
          const patient = patients.find((item) => item.id === attendance.patientId);
          const professionalName = profiles.find((item) => item.id === attendance.professionalId)?.fullName ?? "A definir";
          return (
            <article className="attendance-queue__item" key={attendance.id}>
              <div><span className={`status-badge status-badge--${attendance.status}`}>{statusLabel(attendance.status)}</span><h3>{patient?.fullName ?? "Paciente nao localizado"}</h3><p>{patient?.uniqueRecordNumber} · {attendance.baNumber}</p></div>
              <dl><div><dt>Nascimento</dt><dd>{patient?.birthDate ? formatDate(patient.birthDate) : "Nao informado"}</dd></div><div><dt>Idade</dt><dd>{calculateAge(patient?.birthDate)}</dd></div><div><dt>Abertura</dt><dd>{formatDateTime(attendance.openedAt)}</dd></div><div><dt>Inicio</dt><dd>{attendance.startedAt ? formatDateTime(attendance.startedAt) : "-"}</dd></div><div><dt>Profissional</dt><dd>{professionalName}</dd></div><div><dt>Tipo</dt><dd>{attendance.type}</dd></div></dl>
              <div className="table-actions">
                {attendance.status === "waiting" && <button className="primary-button" onClick={() => onStart(attendance.id)} type="button"><PlayCircle size={17} /> Iniciar atendimento</button>}
                {["in_progress", "paused"].includes(attendance.status) && <button className="primary-button" onClick={() => onContinue(attendance.id)} type="button"><ClipboardEdit size={17} /> Continuar atendimento</button>}
                {attendance.status === "completed" && <><button className="ghost-action" onClick={() => onOpenPatient(attendance.patientId, attendance.id)} type="button">Ver no Prontuário de Evolução</button><button className="ghost-action export-action export-action--pdf" onClick={() => onExport(attendance)} type="button"><Download size={17} /> Exportar BA</button></>}
                {["cancelled", "no_show"].includes(attendance.status) && <button className="ghost-action" onClick={() => onOpenPatient(attendance.patientId, attendance.id)} type="button">Ver detalhes</button>}
              </div>
            </article>
          );
        }) : <EmptyState title="Nenhum atendimento encontrado para os filtros selecionados" message="Limpe ou ajuste os filtros para visualizar outros BAs." />}
      </section>
    </div>
  );
}

function ClinicalAgendaPage({
  company,
  appointments,
  patients,
  profiles,
  onSaveAppointment,
  onUpdateStatus,
  onUpdateAppointment,
  onOpenBa,
  onNotify
}: {
  company: Company;
  appointments: ClinicalAppointment[];
  patients: Patient[];
  profiles: typeof demoProfiles;
  onSaveAppointment: (appointment: Omit<ClinicalAppointment, "id" | "createdAt" | "updatedAt" | "createdBy" | "status">) => void;
  onUpdateStatus: (appointmentId: string, status: ClinicalAppointment["status"]) => void;
  onUpdateAppointment: (appointment: ClinicalAppointment) => void;
  onOpenBa: (appointment: ClinicalAppointment) => void;
  onNotify: (title: string, message: string, tone?: AppNotice["tone"]) => void;
}) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "list" | "queue">("day");
  const [patientMode, setPatientMode] = useState<"existing" | "temporary">("existing");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [professionalFilter, setProfessionalFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ClinicalAppointment | null>(null);
  const [markingAbsent, setMarkingAbsent] = useState<ClinicalAppointment | null>(null);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [appointmentPayerType, setAppointmentPayerType] = useState<"private" | "insurance">("private");
  const showInsuranceType = Boolean(company.enableInsuranceType);

  const filteredPatients = patients.filter((patient) =>
    [patient.fullName, patient.cpf, patient.phone, patient.whatsapp, patient.uniqueRecordNumber]
      .some((value) => normalizeText(value || "").includes(normalizeText(patientSearch)))
  );

  const filteredAppointments = appointments.filter((appointment) => {
    const displayName = appointment.patientId
      ? patients.find((patient) => patient.id === appointment.patientId)?.fullName ?? ""
      : appointment.temporaryPatientName ?? "";
    const phone = appointment.patientId
      ? patients.find((patient) => patient.id === appointment.patientId)?.whatsapp ?? ""
      : appointment.temporaryPatientWhatsapp ?? appointment.temporaryPatientPhone ?? "";
    const matchesQuery = !query || normalizeText(`${displayName} ${phone}`).includes(normalizeText(query));
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    const matchesProfessional = professionalFilter === "all" || appointment.professionalId === professionalFilter;
    const matchesQueue = viewMode !== "queue" || ["confirmed", "waiting_arrival", "arrived"].includes(appointment.status);
    return matchesQuery && matchesStatus && matchesProfessional && matchesQueue;
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patient = selectedPatientId ? patients.find((item) => item.id === selectedPatientId) : undefined;

    if (patientMode === "existing" && !patient) {
      onNotify("Selecione um paciente", "Busque e selecione um paciente existente para vincular o agendamento.", "warning");
      return;
    }

    if (patientMode === "temporary") {
      onNotify("Este paciente ainda não possui Prontuário de Evolução", "Ele será criado somente na Abertura de atendimento.", "info");
    } else {
      onNotify("Paciente existente vinculado ao agendamento", "Nenhum BA foi criado pela Agenda.", "success");
    }

    onSaveAppointment({
      companyId: demoCompany.id,
      patientId: patient?.id,
      uniqueMedicalRecordId: patient?.uniqueMedicalRecordId,
      temporaryPatientName: patientMode === "temporary" ? String(form.get("temporaryPatientName") || "") : undefined,
      temporaryPatientPhone: patientMode === "temporary" ? String(form.get("temporaryPatientPhone") || "") : undefined,
      temporaryPatientWhatsapp: patientMode === "temporary" ? String(form.get("temporaryPatientWhatsapp") || form.get("temporaryPatientPhone") || "") : undefined,
      temporaryPatientEmail: patientMode === "temporary" ? String(form.get("temporaryPatientEmail") || "") : undefined,
      temporaryPatientBirthDate: patientMode === "temporary" ? String(form.get("temporaryPatientBirthDate") || "") : undefined,
      appointmentDate: String(form.get("appointmentDate") || new Date().toISOString().slice(0, 10)),
      startTime: String(form.get("startTime") || "09:00"),
      endTime: String(form.get("endTime") || "09:50"),
      professionalId: String(form.get("professionalId") || ""),
      procedureType: String(form.get("procedureType") || "Atendimento podologico"),
      appointmentType: String(form.get("appointmentType") || "first_evaluation") as ClinicalAppointment["appointmentType"],
      initialComplaint: String(form.get("initialComplaint") || ""),
      notes: String(form.get("notes") || ""),
      payerType: String(form.get("payerType") || "private") as ClinicalAppointment["payerType"]
      , insuranceName: String(form.get("insuranceName") || "") || undefined
    });
    event.currentTarget.reset();
    setSelectedPatientId("");
    setPatientSearch("");
    setNewAppointmentOpen(false);
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const appointmentDate = String(form.get("appointmentDate") || "");
    const startTime = String(form.get("startTime") || "");
    const endTime = String(form.get("endTime") || "");
    if (!appointmentDate || !startTime || !endTime || endTime <= startTime) {
      onNotify("Horario invalido", "O horario final deve ser maior que o horario inicial.", "warning");
      return;
    }
    onUpdateAppointment({
      ...editing,
      appointmentDate,
      startTime,
      endTime,
      professionalId: String(form.get("professionalId") || "") || undefined,
      notes: String(form.get("notes") || ""),
      status: String(form.get("status")) as ClinicalAppointment["status"],
      updatedAt: new Date().toISOString()
    });
    setEditing(null);
  }

  function handleAbsentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!markingAbsent) return;
    const notes = String(new FormData(event.currentTarget).get("absenceNotes") || "");
    const now = new Date().toISOString();
    onUpdateAppointment({ ...markingAbsent, status: "no_show", markedAbsentAt: now, markedAbsentBy: profiles[0]?.id, absenceNotes: notes, updatedAt: now });
    setMarkingAbsent(null);
  }

  return (
    <div className="page-stack">
      <section className="hero-panel hero-panel--tech">
        <div>
          <span className="eyebrow">Agenda Clínica</span>
          <h1>Agenda inteligente da clínica</h1>
          <p>Reserve horários, acompanhe chegadas e envie dados para a Abertura de atendimento sem gerar BA ou Prontuário de Evolução antes da entrada clínica.</p>
        </div>
        <button className="primary-button" onClick={() => setNewAppointmentOpen(true)} type="button"><CalendarPlus size={18} /> Novo agendamento</button>
      </section>

      <section>
        <section className="data-panel">
          <div className="section-heading section-heading--compact">
            <div><h2>Agenda Clínica</h2><p>Visualizacoes e filtros operacionais.</p></div>
          </div>
          <div className="filter-row">
            {(["day", "week", "month", "list", "queue"] as const).map((mode) => (
              <button className={viewMode === mode ? "is-active" : ""} key={mode} onClick={() => setViewMode(mode)} type="button">{agendaViewLabel(mode)}</button>
            ))}
          </div>
          <div className="filter-row filter-row--dense agenda-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou telefone" />
            <select value={professionalFilter} onChange={(event) => setProfessionalFilter(event.target.value)}>
              <option value="all">Todos os profissionais</option>
              {profiles.filter((profile) => profile.role !== "financial").map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos os status</option>
              {(["scheduled", "confirmed", "waiting_arrival", "arrived", "converted_to_ba", "cancelled", "no_show", "rescheduled"] as const).map((status) => <option key={status} value={status}>{appointmentStatusLabel(status)}</option>)}
            </select>
          </div>
          <div className="appointment-list">
            {filteredAppointments.length ? filteredAppointments.map((appointment) => (
              <AppointmentCard appointment={appointment} key={appointment.id} patient={appointment.patientId ? patients.find((patient) => patient.id === appointment.patientId) : undefined} professionalName={profiles.find((item) => item.id === appointment.professionalId)?.fullName ?? "A definir"} onStatus={onUpdateStatus} onOpenBa={onOpenBa} onEdit={setEditing} onMarkAbsent={setMarkingAbsent} />
            )) : <EmptyState title="Nenhum agendamento encontrado" message="Ajuste os filtros ou crie um novo agendamento." />}
          </div>
        </section>
      </section>
      {newAppointmentOpen && <div className="dialog-backdrop"><form className="dialog-card dialog-card--large agenda-form" onSubmit={handleSubmit}>
          <div className="section-heading section-heading--compact">
            <div><h2>Novo agendamento</h2><p>Escolha paciente existente ou pré-cadastre um paciente novo.</p></div>
            <CalendarPlus size={20} />
          </div>

          <div className="segmented segmented--light">
            <button className={patientMode === "existing" ? "is-active" : ""} onClick={() => setPatientMode("existing")} type="button">Paciente existente</button>
            <button className={patientMode === "temporary" ? "is-active" : ""} onClick={() => setPatientMode("temporary")} type="button">Novo paciente</button>
          </div>

          {patientMode === "existing" ? (
            <div className="search-results-panel">
              <label>Buscar paciente<input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Nome, CPF, telefone ou Prontuário de Evolução" /></label>
              <div className="search-result-list search-result-list--compact">
                {filteredPatients.slice(0, 4).map((patient) => (
                  <button className={selectedPatientId === patient.id ? "is-selected" : ""} key={patient.id} onClick={() => setSelectedPatientId(patient.id)} type="button">
                    <strong>{patient.fullName}</strong>
                    <small>{patient.uniqueRecordNumber} · {patient.whatsapp}</small>
                  </button>
                ))}
                {!filteredPatients.length && <p className="muted">Nenhum paciente encontrado.</p>}
              </div>
            </div>
          ) : (
            <div className="temporary-banner">
              Este agendamento ainda não cria Prontuário de Evolução. O Prontuário de Evolução será criado somente na Abertura de atendimento.
            </div>
          )}

          {patientMode === "temporary" && (
            <div className="form-grid form-grid--two">
              <label>Nome completo<input name="temporaryPatientName" /></label>
              <label>Telefone<input inputMode="tel" name="temporaryPatientPhone" onInput={(event) => { event.currentTarget.value = formatPhone(event.currentTarget.value); }} /></label>
              <label>E-mail<input name="temporaryPatientEmail" type="email" /></label>
            </div>
          )}

          <div className="form-grid form-grid--two">
            <label>Data<input name="appointmentDate" defaultValue={new Date().toISOString().slice(0, 10)} type="date" /></label>
            <label>Inicio<input name="startTime" defaultValue="09:00" type="time" /></label>
            <label>Fim<input name="endTime" defaultValue="09:50" type="time" /></label>
            <label>Profissional<select name="professionalId">{profiles.filter((profile) => profile.role !== "financial").map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
            <label>Agenda<select name="appointmentType" defaultValue="first_evaluation"><option value="first_evaluation">Primeira avaliacao</option><option value="return">Retorno</option><option value="procedure">Procedimento</option><option value="follow_up">Acompanhamento</option></select></label>
            {showInsuranceType && <label>Convênio ou particular<select name="payerType" onChange={(event) => setAppointmentPayerType(event.target.value as "private" | "insurance")} value={appointmentPayerType}><option value="private">Particular</option><option value="insurance">Convênio</option></select></label>}
            {showInsuranceType && appointmentPayerType === "insurance" && <label>Nome do convênio<input name="insuranceName" required /></label>}
          </div>
          <label>Observacoes<textarea name="notes" /></label>
          <div className="dialog-card__actions"><button className="ghost-action" onClick={() => setNewAppointmentOpen(false)} type="button">Cancelar</button><button className="primary-button" type="submit"><CalendarPlus size={18} /> Criar agendamento</button></div>
        </form></div>}
      {editing && <div className="dialog-backdrop"><form className="dialog-card dialog-card--wide" onSubmit={handleEditSubmit}><div><h2>Editar agendamento</h2><p>Altere data, horarios, profissional, observacoes e status.</p></div><div className="form-grid form-grid--two"><label>Data<input defaultValue={editing.appointmentDate} name="appointmentDate" required type="date" /></label><label>Inicio<input defaultValue={editing.startTime} name="startTime" required type="time" /></label><label>Fim<input defaultValue={editing.endTime} name="endTime" required type="time" /></label><label>Profissional<select defaultValue={editing.professionalId} name="professionalId">{profiles.filter((item) => item.role !== "financial").map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label><label>Status<select defaultValue={editing.status} name="status">{(["scheduled", "confirmed", "waiting_arrival", "arrived", "cancelled", "no_show", "rescheduled"] as const).map((item) => <option key={item} value={item}>{appointmentStatusLabel(item)}</option>)}</select></label></div><label>Observacoes<textarea defaultValue={editing.notes} name="notes" /></label><div className="dialog-card__actions"><button className="ghost-action" onClick={() => setEditing(null)} type="button">Cancelar</button><button className="primary-button" type="submit">Salvar alteracoes</button></div></form></div>}
      {markingAbsent && <div className="dialog-backdrop"><form className="dialog-card" onSubmit={handleAbsentSubmit}><div><h2>Deseja marcar este paciente como falta?</h2><p>Esta ação apenas atualiza o agendamento. Nenhum BA ou Prontuário de Evolução será criado.</p></div><label>Observação da falta<textarea name="absenceNotes" placeholder="Opcional" /></label><div className="dialog-card__actions"><button className="ghost-action" onClick={() => setMarkingAbsent(null)} type="button">Cancelar</button><button className="danger-button" type="submit">Marcar falta</button></div></form></div>}
    </div>
  );
}

function AppointmentCard({
  appointment,
  patient,
  professionalName,
  onStatus,
  onOpenBa,
  onEdit,
  onMarkAbsent
}: {
  appointment: ClinicalAppointment;
  patient?: Patient;
  professionalName: string;
  onStatus: (appointmentId: string, status: ClinicalAppointment["status"]) => void;
  onOpenBa: (appointment: ClinicalAppointment) => void;
  onEdit: (appointment: ClinicalAppointment) => void;
  onMarkAbsent: (appointment: ClinicalAppointment) => void;
}) {
  const displayName = patient?.fullName ?? appointment.temporaryPatientName ?? "Paciente sem nome";
  const phone = patient?.whatsapp ?? appointment.temporaryPatientWhatsapp ?? appointment.temporaryPatientPhone ?? "Sem telefone";

  return (
    <article className="appointment-card">
      <div className="appointment-card__time">
        <strong>{appointment.startTime}</strong>
        <span>{appointment.endTime}</span>
      </div>
      <div>
        <div className="appointment-card__title">
          <h3>{displayName}</h3>
          <span className={`status-badge status-badge--appointment-${appointment.status}`}>{appointmentStatusLabel(appointment.status)}</span>
        </div>
        <p>{appointment.procedureType} · {professionalName}</p>
        <small>{appointment.appointmentDate} · {phone} · {patient?.uniqueRecordNumber ?? "Sem Prontuário de Evolução até Abertura de atendimento"}</small>
      </div>
      <div className="table-actions">
        {appointment.status === "scheduled" && <button className="ghost-action" onClick={() => onStatus(appointment.id, "confirmed")} type="button">Confirmar</button>}
        {["scheduled", "confirmed", "waiting_arrival"].includes(appointment.status) && <button className="ghost-action" onClick={() => onStatus(appointment.id, "arrived")} type="button">Paciente chegou</button>}
        <button className="ghost-action" onClick={() => onEdit(appointment)} type="button">Editar</button>
        {!["converted_to_ba", "no_show", "cancelled"].includes(appointment.status) && <button className="ghost-action" onClick={() => onMarkAbsent(appointment)} type="button">Marcar falta</button>}
        <button className="primary-button" disabled={appointment.status === "converted_to_ba"} onClick={() => onOpenBa(appointment)} type="button"><ClipboardPlus size={17} /> Abrir BA</button>
        {appointment.status !== "converted_to_ba" && <button className="ghost-action" onClick={() => onStatus(appointment.id, "cancelled")} type="button">Cancelar</button>}
      </div>
    </article>
  );
}

function agendaViewLabel(view: "day" | "week" | "month" | "list" | "queue") {
  const labels = {
    day: "Dia",
    week: "Semana",
    month: "Mes",
    list: "Lista",
    queue: "Fila do dia"
  };
  return labels[view];
}

function appointmentStatusLabel(status: ClinicalAppointment["status"]) {
  const labels: Record<ClinicalAppointment["status"], string> = {
    scheduled: "Agendado",
    confirmed: "Confirmado",
    waiting_arrival: "Aguardando chegada",
    arrived: "Paciente chegou",
    converted_to_ba: "Convertido em BA",
    cancelled: "Cancelado",
    no_show: "Faltou",
    rescheduled: "Reagendado"
  };
  return labels[status];
}

function FinancialReviewDialog({ attendance, patient, products, onCancel, onConfirm }: { attendance: Attendance; patient?: Patient; products: StockProduct[]; onCancel: () => void; onConfirm: (transaction: FinancialTransaction) => Promise<void> }) {
  const initialItems = [
    ...(attendance.procedure ? [{ id: "procedure", label: attendance.procedure, value: attendance.value || 0 }] : []),
    ...attendance.productsUsed.map((name, index) => ({ id: `product-${index}`, label: name, value: products.find((item) => normalizeText(item.name) === normalizeText(name))?.saleValue ?? 0 }))
  ];
  const [items, setItems] = useState(initialItems);
  const [manualLabel, setManualLabel] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<FinancialTransaction["paymentMethod"]>("pix");
  const [status, setStatus] = useState<FinancialTransaction["status"]>("pending");
  const [saving, setSaving] = useState(false);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return <div className="dialog-backdrop"><section className="dialog-card dialog-card--large"><div><h2>Gerar lançamento financeiro deste atendimento</h2><p>Revise os itens antes de confirmar. O lançamento manual continua disponível no Financeiro.</p></div><div className="financial-review-summary"><strong>{patient?.fullName ?? "Paciente"}</strong><span>BA {attendance.baNumber} · Prontuário de Evolução {attendance.uniqueRecordNumber}</span></div><div className="financial-items">{items.map((item) => <div className="financial-item" key={item.id}><input aria-label="Descricao do item" onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, label: event.target.value } : entry))} value={item.label} /><input aria-label="Valor do item" min="0" onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, value: Number(event.target.value) } : entry))} step="0.01" type="number" value={item.value} /><button className="ghost-action" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} type="button">Remover</button></div>)}</div><div className="financial-item"><input onChange={(event) => setManualLabel(event.target.value)} placeholder="Adicionar item manual" value={manualLabel} /><input min="0" onChange={(event) => setManualValue(event.target.value)} placeholder="Valor" step="0.01" type="number" value={manualValue} /><button className="ghost-action" onClick={() => { if (!manualLabel) return; setItems((current) => [...current, { id: `manual-${Date.now()}`, label: manualLabel, value: Number(manualValue || 0) }]); setManualLabel(""); setManualValue(""); }} type="button">Adicionar</button></div><div className="form-grid form-grid--two"><label>Forma de pagamento<select onChange={(event) => setPaymentMethod(event.target.value as FinancialTransaction["paymentMethod"])} value={paymentMethod}>{(["pix", "cash", "credit_card", "debit_card", "insurance", "other"] as const).map((item) => <option key={item} value={item}>{paymentLabel(item)}</option>)}</select></label><label>Status<select onChange={(event) => setStatus(event.target.value as FinancialTransaction["status"])} value={status}><option value="pending">Pendente</option><option value="paid">Pago</option></select></label></div><div className="financial-review-total"><span>Total</span><strong>{currency.format(total)}</strong></div><div className="dialog-card__actions"><button className="ghost-action" disabled={saving} onClick={onCancel} type="button">Nao gerar lancamento agora</button><button className="primary-button" disabled={saving || !items.length} onClick={async () => { setSaving(true); await onConfirm({ id: `fin-${Date.now()}`, companyId: attendance.companyId, patientId: attendance.patientId, attendanceId: attendance.id, baNumber: attendance.baNumber, uniqueMedicalRecordId: attendance.uniqueMedicalRecordId, description: `Atendimento ${attendance.baNumber}: ${items.map((item) => item.label).join(", ")}`, type: "income", amount: total, dueDate: new Date().toISOString().slice(0, 10), paidAt: status === "paid" ? new Date().toISOString().slice(0, 10) : undefined, paymentMethod, category: "Atendimento", status, payerType: attendance.payerType, insuranceName: attendance.insuranceName, notes: "Gerado após revisão do atendimento." }); setSaving(false); }} type="button">{saving ? "Gerando..." : "Confirmar lançamento"}</button></div></section></div>;
}

function Financial({ financial, patients, attendances, profiles, companyId, onCreate, stock, onCreateProduct, onUpdateProduct }: { financial: FinancialTransaction[]; patients: Patient[]; attendances: Attendance[]; profiles: typeof demoProfiles; companyId: string; onCreate: (transaction: FinancialTransaction) => Promise<void>; stock: StockProduct[]; onCreateProduct: (product: StockProduct) => Promise<void>; onUpdateProduct: (product: StockProduct) => Promise<void> }) {
  const [section, setSection] = useState<"transactions" | "products">("transactions");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [financialPayerType, setFinancialPayerType] = useState<"private" | "insurance">("private");
  const [period, setPeriod] = useState("all");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [category, setCategory] = useState("all");
  const [patientId, setPatientId] = useState("all");
  const [ba, setBa] = useState("");
  const [professional, setProfessional] = useState("all");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const filtered = financial.filter((item) => {
    const attendance = attendances.find((entry) => entry.id === item.attendanceId);
    return item.companyId === companyId &&
      matchesPeriod(item.dueDate, period, periodStart, periodEnd) &&
      (type === "all" || item.type === type) &&
      (status === "all" || item.status === status) &&
      (method === "all" || item.paymentMethod === method) &&
      (category === "all" || item.category === category) &&
      (patientId === "all" || item.patientId === patientId) &&
      (!ba || normalizeText(attendance?.baNumber || "").includes(normalizeText(ba))) &&
      (professional === "all" || attendance?.professionalId === professional) &&
      (!min || item.amount >= Number(min)) && (!max || item.amount <= Number(max));
  });
  const received = filtered.filter((item) => item.type === "income" && item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const pending = filtered.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
  const overdue = filtered.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.amount, 0);
  const expenses = filtered.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      const attendance = attendances.find((item) => item.id === String(form.get("attendanceId") || ""));
      await onCreate({ id: `fin-${Date.now()}`, companyId, patientId: String(form.get("patientId") || "") || attendance?.patientId || undefined, attendanceId: attendance?.id, baNumber: attendance?.baNumber, uniqueMedicalRecordId: attendance?.uniqueMedicalRecordId, description: String(form.get("description")), type: String(form.get("type")) as FinancialTransaction["type"], amount: parseCurrency(String(form.get("amount"))), dueDate: String(form.get("dueDate")), paidAt: String(form.get("paidAt") || "") || undefined, paymentMethod: String(form.get("paymentMethod")) as FinancialTransaction["paymentMethod"], category: String(form.get("category")), status: String(form.get("status")) as FinancialTransaction["status"], payerType: financialPayerType, insuranceName: financialPayerType === "insurance" ? String(form.get("insuranceName") || "") : undefined, notes: String(form.get("notes") || "") || undefined });
      setOpen(false);
    } finally { setSaving(false); }
  }

  function clear() { setPeriod("all"); setPeriodStart(""); setPeriodEnd(""); setType("all"); setStatus("all"); setMethod("all"); setCategory("all"); setPatientId("all"); setBa(""); setProfessional("all"); setMin(""); setMax(""); }

  if (section === "products") {
    return <div className="page-stack"><div className="filter-row"><button onClick={() => setSection("transactions")} type="button">Lancamentos</button><button className="is-active" type="button">Produtos</button></div><Stock companyId={companyId} onCreate={onCreateProduct} onUpdate={onUpdateProduct} stock={stock} /></div>;
  }

  return (
    <div className="page-stack">
      <div className="filter-row"><button className="is-active" type="button">Lancamentos</button><button onClick={() => setSection("products")} type="button">Produtos</button></div>
      <div className="section-heading">
        <div><span className="eyebrow">Gestao financeiro</span><h1>Financeiro</h1><p>Receitas, despesas, pagamentos por paciente e relatorios financeiros.</p></div>
        <button className="primary-button" onClick={() => setOpen(true)} type="button"><Plus size={18} /> Lancamento</button>
      </div>
      <section className="metrics-grid">
        <MetricCard icon={<CreditCard />} label="Recebido no mes" value={currency.format(received)} detail="Pagamentos confirmados" tone="success" />
        <MetricCard icon={<Receipt />} label="Pendente" value={currency.format(pending)} detail="A receber" tone="warning" />
        <MetricCard icon={<AlertTriangle />} label="Atrasado" value={currency.format(overdue)} detail="Conforme filtros" />
        <MetricCard icon={<TrendingUp />} label="Lucro estimado" value={currency.format(received - expenses)} detail="Receita - despesas" tone="primary" />
      </section>
      <div className="dashboard-grid">
        <ChartCard title="Receita mensal" subtitle="Entradas confirmadas" format="currency" data={[{ label: "Mar", value: 4200 }, { label: "Abr", value: 5100 }, { label: "Mai", value: 6800 }, { label: "Jun", value: received }]} />
        <ChartCard title="Despesas por categoria" subtitle="Saidas agrupadas" format="currency" data={[{ label: "Estoque", value: expenses }, { label: "Aluguel", value: 1200 }, { label: "Marketing", value: 450 }]} />
      </div>
      <section className="data-panel operational-filters">
        <div className="filter-grid"><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">Todo periodo</option><option value="today">Hoje</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="custom">Personalizado</option></select>{period === "custom" && <><input aria-label="Periodo inicial" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} type="date" /><input aria-label="Periodo final" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} type="date" /></>}<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">Receitas e despesas</option><option value="income">Receita</option><option value="expense">Despesa</option></select><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos os status</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="overdue">Atrasado</option><option value="cancelled">Cancelado</option></select><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="all">Todas as formas</option>{(["pix", "cash", "credit_card", "debit_card", "insurance", "other"] as const).map((item) => <option key={item} value={item}>{paymentLabel(item)}</option>)}</select><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Todas as categorias</option>{Array.from(new Set(financial.map((item) => item.category))).map((item) => <option key={item}>{item}</option>)}</select><select value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="all">Todos os pacientes</option>{patients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select><input value={ba} onChange={(e) => setBa(e.target.value)} placeholder="Numero do BA" /><select value={professional} onChange={(e) => setProfessional(e.target.value)}><option value="all">Todos os profissionais</option>{profiles.filter((item) => item.role !== "financial").map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select><input value={min} onChange={(e) => setMin(e.target.value)} type="number" placeholder="Valor minimo" /><input value={max} onChange={(e) => setMax(e.target.value)} type="number" placeholder="Valor maximo" /></div>
        <button className="ghost-action" onClick={clear} type="button">Limpar filtros</button>
      </section>
      {filtered.length ? <Table headers={["Descricao", "Tipo", "Valor", "Vencimento", "Forma", "Status"]} rows={filtered.map((item) => [item.description, item.type === "income" ? "Receita" : "Despesa", currency.format(item.amount), formatDate(item.dueDate), paymentLabel(item.paymentMethod), paymentStatusLabel(item.status)])} /> : <EmptyState title="Nenhum lancamento encontrado para os filtros selecionados" message="Limpe ou ajuste os filtros financeiros." />}
      {open && <div className="dialog-backdrop"><form className="dialog-card dialog-card--large" onSubmit={submit}><div><h2>Novo lancamento</h2><p>Cadastre uma receita ou despesa vinculada a clinica.</p></div><div className="form-grid form-grid--two"><label>Tipo<select name="type"><option value="income">Receita</option><option value="expense">Despesa</option></select></label><label>Descricao<input name="description" required /></label><label>Valor<input min="0.01" name="amount" required step="0.01" type="number" /></label><label>Categoria<input name="category" required /></label><label>Vencimento<input name="dueDate" required type="date" /></label><label>Data de pagamento<input name="paidAt" type="date" /></label><label>Forma de pagamento<select name="paymentMethod">{(["pix", "cash", "credit_card", "debit_card", "insurance", "other"] as const).map((item) => <option key={item} value={item}>{paymentLabel(item)}</option>)}</select></label><label>Status<select name="status"><option value="paid">Pago</option><option value="pending">Pendente</option><option value="overdue">Atrasado</option><option value="cancelled">Cancelado</option></select></label><label>Convênio ou particular<select onChange={(event) => setFinancialPayerType(event.target.value as "private" | "insurance")} value={financialPayerType}><option value="private">Particular</option><option value="insurance">Convênio</option></select></label>{financialPayerType === "insurance" && <label>Nome do convênio<input name="insuranceName" required /></label>}<label>Paciente<select name="patientId"><option value="">Sem paciente</option>{patients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label><label>BA / Atendimento<select name="attendanceId"><option value="">Sem BA</option>{attendances.map((item) => <option key={item.id} value={item.id}>{item.baNumber} · {patientName(patients, item.patientId)}</option>)}</select></label></div><label>Observacoes<textarea name="notes" /></label><div className="dialog-card__actions"><button className="ghost-action" disabled={saving} onClick={() => setOpen(false)} type="button">Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar lancamento"}</button></div></form></div>}
    </div>
  );
}

function Stock({ stock, companyId, onCreate, onUpdate }: { stock: StockProduct[]; companyId: string; onCreate: (product: StockProduct) => Promise<void>; onUpdate: (product: StockProduct) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [otherFields, setOtherFields] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState("");
  const [deleting, setDeleting] = useState<StockProduct | null>(null);
  const visibleStock = stock.filter((item) => item.active !== false);
  const totalValue = stock.reduce((sum, product) => sum + product.currentQuantity * product.costValue, 0);
  const low = stock.filter((product) => product.minimumQuantity > 0 && product.currentQuantity <= product.minimumQuantity);
  const categories = Array.from(new Set([...podologyProductCategories, ...stock.map((item) => item.category).filter(Boolean)]));
  const suppliers = Array.from(new Set(stock.map((item) => item.supplier).filter(Boolean)));
  const units = [["un", "Unidade"], ["cx", "Caixa"], ["pct", "Pacote"], ["frasco", "Frasco"], ["tubo", "Tubo"], ["par", "Par"], ["kit", "Kit"], ["ml", "ml"], ["g", "g"]];
  const productOptions = selectedCategory && selectedCategory !== "__other__" ? stock.filter((item) => item.category === selectedCategory) : stock;
  const productsByCategory = Array.from(new Set(productOptions.map((item) => item.category || "Sem categoria"))).map((category) => [category, productOptions.filter((item) => (item.category || "Sem categoria") === category)] as const);

  function fieldValue(form: FormData, key: string) {
    return String(form.get(`${key}Other`) || form.get(key) || "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget);
    const base: StockProduct = editing ?? { id: `stock-${Date.now()}`, companyId, name: "", category: "", internalCode: "", currentQuantity: 0, minimumQuantity: 0, unit: "un", costValue: 0, saleValue: 0, supplier: "", expiresAt: undefined, active: true };
    const product: StockProduct = { ...base, companyId, name: fieldValue(form, "name"), category: fieldValue(form, "category"), internalCode: String(form.get("internalCode") || base.internalCode || `PROD-${Date.now()}`), currentQuantity: Number(form.get("currentQuantity") ?? base.currentQuantity), minimumQuantity: Number(form.get("minimumQuantity") ?? base.minimumQuantity), unit: fieldValue(form, "unit"), costValue: parseCurrency(String(form.get("costValue") || 0)), saleValue: parseCurrency(String(form.get("saleValue") || 0)), supplier: fieldValue(form, "supplier"), expiresAt: String(form.get("expiresAt") || "") || undefined, notes: String(form.get("notes") || "") || undefined, active: form.get("active") === "on" };
    try { if (editing) await onUpdate(product); else await onCreate(product); setOpen(false); setEditing(null); setOtherFields({}); setSelectedCategory(""); } finally { setSaving(false); }
  }

  function choiceField(name: string, label: string, options: Array<[string, string]>, current?: string) {
    const other = otherFields[name] || (Boolean(current) && !options.some(([value]) => value === current));
    return <label>{label}<select defaultValue={other ? "__other__" : current || ""} name={name} onChange={(event) => setOtherFields((state) => ({ ...state, [name]: event.target.value === "__other__" }))}><option value="">Selecione</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}<option value="__other__">Outro</option></select>{other && <input defaultValue={current} name={`${name}Other`} placeholder={`Informe ${label.toLowerCase()}`} required />}</label>;
  }

  return <div className="page-stack">
    <div className="section-heading"><div><span className="eyebrow">Estoque</span><h1>Produtos</h1><p>Cadastro, valores, fornecedores e disponibilidade dos produtos.</p></div><button className="primary-button" onClick={() => { setEditing(null); setOtherFields({}); setSelectedCategory(""); setOpen(true); }} type="button"><Plus size={18} /> Novo produto</button></div>
    <section className="metrics-grid"><MetricCard icon={<Boxes />} label="Total de produtos" value={String(stock.length)} detail="Produtos cadastrados" /><MetricCard icon={<AlertTriangle />} label="Estoque baixo" value={String(low.length)} detail="Abaixo do minimo" tone="danger" /><MetricCard icon={<CalendarClock />} label="Ativos" value={String(stock.filter((item) => item.active !== false).length)} detail="Disponiveis para uso" tone="warning" /><MetricCard icon={<Receipt />} label="Valor em estoque" value={currency.format(totalValue)} detail="Pelo custo medio" tone="success" /></section>
    {visibleStock.length ? <Table headers={["Produto", "Categoria", "Unidade", "Fornecedor", "Venda", "Status", "Acoes"]} rows={visibleStock.map((product) => [product.name, product.category, product.unit, product.supplier || "-", currency.format(product.saleValue), "Ativo", <div className="table-actions"><button className="ghost-action" onClick={() => { setEditing(product); setOtherFields({}); setSelectedCategory(product.category); setOpen(true); }} type="button">Editar</button><button className="danger-link" onClick={() => setDeleting(product)} type="button">Excluir</button></div>])} /> : <EmptyState title="Nenhum produto cadastrado" message="Use Novo produto para iniciar o cadastro." />}
    {open && <div className="dialog-backdrop"><form className="dialog-card dialog-card--large" onSubmit={submit}><div><h2>{editing ? "Editar produto" : "Novo produto"}</h2><p>Escolha uma categoria para filtrar o catálogo ou informe um item personalizado.</p></div><div className="form-grid form-grid--two"><label>Categoria<select defaultValue={editing?.category || ""} name="category" onChange={(event) => { setSelectedCategory(event.target.value); setOtherFields((state) => ({ ...state, category: event.target.value === "__other__" })); }}><option value="">Todas as categorias</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}<option value="__other__">Outra categoria</option></select>{otherFields.category && <input name="categoryOther" placeholder="Informe a nova categoria" required />}</label><label>Produto<select defaultValue={editing?.name || ""} name="name" onChange={(event) => setOtherFields((state) => ({ ...state, name: event.target.value === "__other__" }))}><option value="">Selecione um produto</option>{productsByCategory.map(([category, items]) => <optgroup key={category} label={category}>{items.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</optgroup>)}<option value="__other__">Outro produto</option></select>{otherFields.name && <input name="nameOther" placeholder="Informe o novo produto" required />}</label>{choiceField("unit", "Unidade de medida", units as Array<[string, string]>, editing?.unit)}{choiceField("supplier", "Fornecedor", suppliers.map((item): [string, string] => [item, item]), editing?.supplier)}<label>Codigo interno<input defaultValue={editing?.internalCode} name="internalCode" /></label><label>Quantidade atual<input defaultValue={editing?.currentQuantity ?? 0} min="0" name="currentQuantity" step="0.001" type="number" /></label><label>Quantidade minima<input defaultValue={editing?.minimumQuantity ?? 0} min="0" name="minimumQuantity" step="0.001" type="number" /></label><label>Valor de custo<input defaultValue={editing?.costValue ?? 0} min="0" name="costValue" step="0.01" type="number" /></label><label>Valor de venda<input defaultValue={editing?.saleValue ?? 0} min="0" name="saleValue" step="0.01" type="number" /></label><label className="toggle-row"><input defaultChecked={editing?.active !== false} name="active" type="checkbox" /> Produto ativo</label></div><label>Observacoes<textarea defaultValue={editing?.notes} name="notes" /></label><div className="dialog-card__actions"><button className="ghost-action" disabled={saving} onClick={() => { setOpen(false); setEditing(null); setSelectedCategory(""); }} type="button">Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Salvando..." : editing ? "Salvar alteracoes" : "Salvar produto"}</button></div></form></div>}
    {deleting && <div className="dialog-backdrop"><section className="dialog-card"><div className="dialog-card__icon"><Trash2 size={22} /></div><div><h2>Deseja realmente excluir este item do estoque?</h2><p>Este item será inativado para preservar movimentações, atendimentos e relatórios vinculados.</p></div><div className="dialog-card__actions"><button className="ghost-action" onClick={() => setDeleting(null)} type="button">Cancelar</button><button className="danger-button" onClick={async () => { await onUpdate({ ...deleting, active: false, deletedAt: new Date().toISOString(), deletedBy: demoProfiles[0].id }); setDeleting(null); }} type="button">Excluir item</button></div></section></div>}
  </div>;
}

function AutoclaveRecords({ company, profile, records, stock, onSave }: { company: Company; profile: Profile; records: AutoclaveRecord[]; stock: StockProduct[]; onSave: (record: AutoclaveRecord) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoclaveRecord | null>(null);
  const [viewing, setViewing] = useState<AutoclaveRecord | null>(null);
  const [deleting, setDeleting] = useState<AutoclaveRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [cycleType, setCycleType] = useState("all");
  const [items, setItems] = useState<AutoclaveRecordItem[]>([emptyAutoclaveItem(company.id, "draft")]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [equipmentCode, setEquipmentCode] = useState("");
  const companyRecords = records.filter((record) => record.companyId === company.id && !record.deletedAt);
  const companyStock = stock.filter((item) => item.companyId === company.id && item.active !== false && !item.deletedAt);
  const autoclaveEquipments = companyStock.filter((item) => {
    const haystack = normalizeText(`${item.name} ${item.category} ${item.notes || ""}`);
    return haystack.includes("autoclave") || haystack.includes("equipamento") || haystack.includes("biosseguranca") || haystack.includes("seladora") || haystack.includes("incubadora");
  });
  const materialOptions = companyStock.filter((item) => !autoclaveEquipments.some((equipment) => equipment.id === item.id));
  const filtered = companyRecords.filter((record) =>
    (status === "all" || record.status === status) &&
    (cycleType === "all" || record.cycleType === cycleType) &&
    (!query || normalizeText(`${record.cycleDate} ${record.cycleNumber} ${record.sterilizationLot} ${record.responsibleName} ${record.autoclaveName} ${record.autoclaveCode}`).includes(normalizeText(query)))
  );
  const approved = companyRecords.filter((record) => record.finalResult === "approved").length;
  const failed = companyRecords.filter((record) => record.finalResult !== "approved").length;

  function openNew() {
    setEditing(null);
    setItems([emptyAutoclaveItem(company.id, "draft")]);
    setSelectedEquipmentId("");
    setEquipmentCode("");
    setOpen(true);
  }

  function openEdit(record: AutoclaveRecord) {
    setEditing(record);
    setItems(record.items.length ? record.items : [emptyAutoclaveItem(company.id, record.id)]);
    setSelectedEquipmentId(record.autoclaveProductId || "");
    setEquipmentCode(record.autoclaveCode || "");
    setOpen(true);
  }

  function updateItem(index: number, patch: Partial<AutoclaveRecordItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function selectMaterial(index: number, productId: string) {
    const product = materialOptions.find((item) => item.id === productId);
    if (!product) {
      updateItem(index, { materialName: "", category: "", unit: "un", stockProductId: undefined, stockProductCode: undefined });
      return;
    }
    updateItem(index, { materialName: product.name, category: product.category, unit: product.unit, stockProductId: product.id, stockProductCode: product.internalCode });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const id = editing?.id ?? `auto-${Date.now()}`;
    const now = new Date().toISOString();
    const finalResult = String(form.get("finalResult")) as AutoclaveRecord["finalResult"];
    const selectedEquipment = autoclaveEquipments.find((item) => item.id === String(form.get("autoclaveProductId")));
    const record: AutoclaveRecord = {
      id,
      companyId: company.id,
      cycleDate: String(form.get("cycleDate")),
      startTime: String(form.get("startTime")),
      endTime: String(form.get("endTime")),
      cycleNumber: String(form.get("cycleNumber")),
      sterilizationLot: String(form.get("sterilizationLot")),
      responsibleUserId: profile.id,
      responsibleName: String(form.get("responsibleName")),
      unitName: company.displayName,
      autoclaveProductId: selectedEquipment?.id || editing?.autoclaveProductId,
      autoclaveName: selectedEquipment?.name || String(form.get("autoclaveName")),
      autoclaveCode: String(form.get("autoclaveCode") || selectedEquipment?.internalCode || ""),
      temperature: String(form.get("temperature")),
      pressure: String(form.get("pressure")),
      exposureTime: String(form.get("exposureTime")),
      cycleType: String(form.get("cycleType")) as AutoclaveRecord["cycleType"],
      chemicalIndicatorResult: String(form.get("chemicalIndicatorResult")) as AutoclaveRecord["chemicalIndicatorResult"],
      biologicalIndicatorResult: String(form.get("biologicalIndicatorResult")) as AutoclaveRecord["biologicalIndicatorResult"],
      integratorResult: String(form.get("integratorResult")) as AutoclaveRecord["integratorResult"],
      bowieDickResult: String(form.get("bowieDickResult")) as AutoclaveRecord["bowieDickResult"],
      finalResult,
      status: finalResult === "approved" ? "approved" : finalResult === "failed" ? "failed" : "reprocess",
      notes: String(form.get("notes") || ""),
      incidents: String(form.get("incidents") || ""),
      correctiveAction: String(form.get("correctiveAction") || ""),
      attachmentUrl: String(form.get("attachmentUrl") || ""),
      attachmentPath: editing?.attachmentPath,
      createdBy: editing?.createdBy ?? profile.id,
      updatedBy: profile.id,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      items: items.filter((item) => item.materialName.trim()).map((item, index) => ({ ...item, id: item.id || `${id}-item-${index + 1}`, companyId: company.id, autoclaveRecordId: id }))
    };
    try {
      await onSave(record);
      setOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">Biosseguranca · esterilizacao</span><h1>Registro de Autoclave</h1><p>Ficha digital dos ciclos, indicadores, materiais esterilizados e responsavel pela liberacao.</p></div>
        <button className="primary-button" onClick={openNew} type="button"><Plus size={18} /> Novo registro</button>
      </div>
      <section className="metrics-grid">
        <MetricCard icon={<ShieldCheck />} label="Ciclos registrados" value={String(companyRecords.length)} detail="Somente desta clínica" tone="primary" />
        <MetricCard icon={<CheckCircle2 />} label="Aprovados" value={String(approved)} detail="Resultado final aprovado" tone="success" />
        <MetricCard icon={<AlertTriangle />} label="Reprocessar/Reprovados" value={String(failed)} detail="Exigem atenção" tone="danger" />
        <MetricCard icon={<Boxes />} label="Materiais" value={String(companyRecords.reduce((sum, record) => sum + record.items.length, 0))} detail="Itens esterilizados" />
      </section>
      <section className="data-panel operational-filters autoclave-filters">
        <div className="filter-grid">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por data, lote, ciclo, responsavel ou equipamento" />
          <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="registered">Registrado</option><option value="approved">Aprovado</option><option value="failed">Reprovado</option><option value="reprocess">Reprocessar</option></select>
          <select value={cycleType} onChange={(event) => setCycleType(event.target.value)}><option value="all">Todos os ciclos</option><option value="instruments">Instrumentais</option><option value="dressings">Curativos</option><option value="mixed_materials">Materiais diversos</option><option value="other">Outro</option></select>
        </div>
        <button className="ghost-action" onClick={() => { setQuery(""); setStatus("all"); setCycleType("all"); }} type="button">Limpar filtros</button>
      </section>
      {filtered.length ? <Table headers={["Data", "Ciclo", "Lote", "Responsável", "Equipamento", "Materiais", "Resultado", "Status", "Ações"]} rows={filtered.map((record) => [formatDate(record.cycleDate), record.cycleNumber, record.sterilizationLot, record.responsibleName, record.autoclaveName, String(record.items.length), autoclaveFinalLabel(record.finalResult), autoclaveStatusLabel(record.status), <div className="table-actions"><button className="ghost-action" onClick={() => setViewing(record)} type="button">Ver</button><button className="ghost-action" onClick={() => openEdit(record)} type="button">Editar</button><button className="ghost-action" onClick={() => exportAutoclaveRecord(record, company)} type="button">Exportar</button><button className="danger-link" onClick={() => setDeleting(record)} type="button">Excluir</button></div>])} /> : <EmptyState title="Nenhum ciclo encontrado" message="Crie um registro ou ajuste os filtros de esterilizacao." />}
      {open && <div className="dialog-backdrop"><form className="dialog-card dialog-card--xlarge" onSubmit={submit}><div><h2>{editing ? "Editar registro de autoclave" : "Novo registro de autoclave"}</h2><p>Preencha os dados do ciclo, indicadores e materiais esterilizados. O registro fica vinculado somente a {company.displayName}.</p></div><div className="form-section-title">Identificação do ciclo</div><div className="form-grid form-grid--three"><label>Data do ciclo<input defaultValue={editing?.cycleDate ?? new Date().toISOString().slice(0, 10)} name="cycleDate" required type="date" /></label><label>Hora de início<input defaultValue={editing?.startTime ?? ""} name="startTime" required type="time" /></label><label>Hora de término<input defaultValue={editing?.endTime ?? ""} name="endTime" required type="time" /></label><label>Número do ciclo<input defaultValue={editing?.cycleNumber ?? ""} name="cycleNumber" required /></label><label>Código/lote<input defaultValue={editing?.sterilizationLot ?? ""} name="sterilizationLot" required /></label><label>Responsável<input defaultValue={editing?.responsibleName ?? profile.fullName} name="responsibleName" required /></label><label>Unidade/empresa<input readOnly value={company.displayName} /></label></div><div className="form-section-title">Autoclave</div>{!autoclaveEquipments.length && <div className="inline-info">Nenhum equipamento cadastrado no estoque. Cadastre uma autoclave/equipamento em Estoque para aparecer aqui.</div>}<div className="form-grid form-grid--three"><label>Equipamento utilizado<select name="autoclaveProductId" required value={selectedEquipmentId} onChange={(event) => { const product = autoclaveEquipments.find((item) => item.id === event.target.value); setSelectedEquipmentId(event.target.value); setEquipmentCode(product?.internalCode || ""); }}><option value="">Selecione no estoque</option>{autoclaveEquipments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input name="autoclaveName" type="hidden" value={autoclaveEquipments.find((item) => item.id === selectedEquipmentId)?.name || editing?.autoclaveName || ""} /></label><label>Código/patrimônio<input value={equipmentCode} onChange={(event) => setEquipmentCode(event.target.value)} name="autoclaveCode" placeholder="AUTO-001" /></label><label>Temperatura programada<input defaultValue={editing?.temperature ?? "134°C"} name="temperature" /></label><label>Pressão<input defaultValue={editing?.pressure ?? ""} name="pressure" /></label><label>Tempo de exposição<input defaultValue={editing?.exposureTime ?? ""} name="exposureTime" /></label><label>Tipo de ciclo<select defaultValue={editing?.cycleType ?? "instruments"} name="cycleType"><option value="instruments">Instrumentais</option><option value="dressings">Curativos</option><option value="mixed_materials">Materiais diversos</option><option value="other">Outro</option></select></label></div><div className="form-section-title">Materiais esterilizados</div><div className="autoclave-items">{items.map((item, index) => <div className="autoclave-item-row" key={item.id || index}><select aria-label="Material" value={item.stockProductId || ""} onChange={(event) => selectMaterial(index, event.target.value)} required><option value="">Selecione material do estoque</option>{materialOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><input aria-label="Categoria" value={item.category} readOnly placeholder="Categoria" /><input aria-label="Quantidade" min="1" type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /><input aria-label="Unidade" value={item.unit} readOnly placeholder="un" /><input aria-label="Observação" value={item.notes || ""} onChange={(event) => updateItem(index, { notes: event.target.value })} placeholder="Observação" /><button className="icon-button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 size={16} /></button></div>)}</div><button className="ghost-action" onClick={() => setItems((current) => [...current, emptyAutoclaveItem(company.id, editing?.id ?? "draft")])} type="button"><Plus size={16} /> Adicionar material</button><div className="form-section-title">Indicadores e resultado</div><div className="form-grid form-grid--three">{indicatorSelect("chemicalIndicatorResult", "Indicador químico", editing?.chemicalIndicatorResult)}{indicatorSelect("biologicalIndicatorResult", "Indicador biológico", editing?.biologicalIndicatorResult, true)}{indicatorSelect("integratorResult", "Integrador químico", editing?.integratorResult, true)}{indicatorSelect("bowieDickResult", "Teste Bowie-Dick", editing?.bowieDickResult, true)}<label>Resultado final<select defaultValue={editing?.finalResult ?? "approved"} name="finalResult"><option value="approved">Aprovado</option><option value="failed">Reprovado</option><option value="reprocess">Reprocessar</option></select></label><label>Anexo/Imagem do resultado<div className="app-upload-field"><UploadCloud size={22} /><span>Clique para enviar ou arraste uma imagem</span><small>PNG, JPG, JPEG ou WEBP até 5 MB.</small><input name="attachmentFile" type="file" accept="image/png,image/jpeg,image/webp" /></div></label><label>URL do anexo<input defaultValue={editing?.attachmentUrl ?? ""} name="attachmentUrl" placeholder="Opcional" /></label></div><div className="form-section-title">Controle</div><label>Observações<textarea defaultValue={editing?.notes ?? ""} name="notes" /></label><label>Intercorrências<textarea defaultValue={editing?.incidents ?? ""} name="incidents" /></label><label>Conduta realizada<textarea defaultValue={editing?.correctiveAction ?? ""} name="correctiveAction" /></label><div className="dialog-card__actions"><button className="ghost-action" disabled={saving} onClick={() => { setOpen(false); setEditing(null); }} type="button">Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar registro"}</button></div></form></div>}
      {viewing && <div className="dialog-backdrop"><section className="dialog-card dialog-card--wide"><div><h2>Ciclo {viewing.cycleNumber}</h2><p>{formatDate(viewing.cycleDate)} · {viewing.responsibleName} · {autoclaveStatusLabel(viewing.status)}</p></div><dl className="definition-grid"><div><dt>Lote</dt><dd>{viewing.sterilizationLot}</dd></div><div><dt>Autoclave</dt><dd>{viewing.autoclaveName} ({viewing.autoclaveCode || "sem código"})</dd></div><div><dt>Temperatura</dt><dd>{viewing.temperature}</dd></div><div><dt>Pressão</dt><dd>{viewing.pressure || "-"}</dd></div><div><dt>Indicador químico</dt><dd>{autoclaveIndicatorLabel(viewing.chemicalIndicatorResult)}</dd></div><div><dt>Indicador biológico</dt><dd>{autoclaveIndicatorLabel(viewing.biologicalIndicatorResult)}</dd></div><div><dt>Resultado final</dt><dd>{autoclaveFinalLabel(viewing.finalResult)}</dd></div></dl><Table headers={["Material", "Categoria", "Qtd.", "Unidade", "Obs."]} rows={viewing.items.map((item) => [item.materialName, item.category || "-", String(item.quantity), item.unit, item.notes || "-"])} /><div className="dialog-card__actions"><button className="ghost-action" onClick={() => setViewing(null)} type="button">Fechar</button><button className="primary-button export-action export-action--print" onClick={() => exportAutoclaveRecord(viewing, company)} type="button"><Printer size={17} /> Imprimir</button></div></section></div>}
      {deleting && <div className="dialog-backdrop"><section className="dialog-card"><span className="dialog-card__icon"><Trash2 size={22} /></span><div><h2>Excluir registro de autoclave?</h2><p>O ciclo será inativado para preservar o histórico da clínica.</p></div><div className="dialog-card__actions"><button className="ghost-action" onClick={() => setDeleting(null)} type="button">Cancelar</button><button className="danger-button" onClick={async () => { await onSave({ ...deleting, deletedAt: new Date().toISOString(), updatedBy: profile.id }); setDeleting(null); }} type="button">Inativar registro</button></div></section></div>}
    </div>
  );
}

function Reports({
  anamneses,
  attendanceImages,
  attendances,
  company,
  companyId,
  financial,
  patient,
  patients,
  profiles,
  report,
  includeHci,
  hciAvailable,
  onIncludeHciChange,
  onGenerate,
  onChangeReport
}: {
  anamneses: AnamnesisRecord[];
  attendanceImages: AttendanceImage[];
  attendances: Attendance[];
  company: Company;
  companyId: string;
  financial: FinancialTransaction[];
  patient: Patient;
  patients: Patient[];
  profiles: typeof demoProfiles;
  report: string;
  includeHci: boolean;
  hciAvailable: boolean;
  onIncludeHciChange: (value: boolean) => void;
  onGenerate: (patientId?: string) => void;
  onChangeReport: (value: string) => void;
}) {
  const [reportType, setReportType] = useState<"medical" | "financial" | "attendance">("medical");
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("month");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [patientId, setPatientId] = useState("all");
  const [professionalId, setProfessionalId] = useState("all");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [query, setQuery] = useState("");
  const [medicalPatientQuery, setMedicalPatientQuery] = useState("");
  const [medicalPatientId, setMedicalPatientId] = useState(patient.id);
  const medicalPatient = patients.find((item) => item.id === medicalPatientId && item.companyId === companyId) ?? patient;
  const medicalPatientAttendances = attendances.filter((item) => item.companyId === companyId && item.patientId === medicalPatient.id);
  const medicalPatientResults = patients.filter((item) => item.companyId === companyId && (!medicalPatientQuery || normalizeText(`${item.fullName} ${item.cpf} ${item.phone} ${item.whatsapp} ${item.uniqueRecordNumber} ${attendances.filter((attendance) => attendance.patientId === item.id).map((attendance) => attendance.baNumber).join(" ")}`).includes(normalizeText(medicalPatientQuery)))).slice(0, 6);
  const financialResults = financial.filter((item) => {
    const attendance = attendances.find((entry) => entry.id === item.attendanceId);
    return item.companyId === companyId &&
      matchesPeriod(item.paidAt || item.dueDate, period, periodStart, periodEnd) &&
      (status === "all" || item.status === status) &&
      (type === "all" || item.type === type) &&
      (paymentMethod === "all" || item.paymentMethod === paymentMethod || (paymentMethod === "private" && item.payerType === "private")) &&
      (patientId === "all" || item.patientId === patientId) &&
      (professionalId === "all" || attendance?.professionalId === professionalId) &&
      (!minValue || item.amount >= parseCurrency(minValue)) &&
      (!maxValue || item.amount <= parseCurrency(maxValue)) &&
      (!query || normalizeText(`${item.baNumber || ""} ${item.category} ${item.description}`).includes(normalizeText(query)));
  });
  const attendanceResults = attendances.filter((item) => item.companyId === companyId &&
    matchesPeriod(item.openedAt || item.scheduledAt, period, periodStart, periodEnd) &&
    (status === "all" || item.status === status) &&
    (patientId === "all" || item.patientId === patientId) &&
    (professionalId === "all" || item.professionalId === professionalId) &&
    (!query || normalizeText(`${item.baNumber} ${item.uniqueRecordNumber} ${item.complaint} ${item.procedure} ${item.conduct} ${item.productsUsed.join(" ")}`).includes(normalizeText(query))));
  const revenue = financialResults.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = financialResults.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);

  async function generate() {
    setLoading(true);
    if (reportType === "medical") await onGenerate(medicalPatient.id);
    setGenerated(true);
    setLoading(false);
  }

  function clear() {
    setPeriod("all"); setPeriodStart(""); setPeriodEnd(""); setStatus("all"); setType("all"); setPaymentMethod("all"); setPatientId("all"); setProfessionalId("all"); setMinValue(""); setMaxValue(""); setQuery(""); setGenerated(false);
  }

  function exportCsv() {
    const rows = reportType === "financial"
      ? [["Descrição", "BA", "Tipo", "Valor", "Status"], ...financialResults.map((item) => [item.description, item.baNumber || "", item.type, String(item.amount), item.status])]
      : [["Paciente", "Prontuário de Evolução", "BA", "Data", "Status", "Procedimento", "Produtos"], ...attendanceResults.map((item) => [patients.find((entry) => entry.id === item.patientId)?.fullName || "", item.uniqueRecordNumber, item.baNumber, item.openedAt, item.status, item.procedure, item.productsUsed.join("; ")])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = `podo360-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportPdf() {
    if (reportType === "medical") {
      openPrintDocument(
        `Encaminhamento medico ${medicalPatient.fullName}`,
        [documentHeader(company, "Relatório de Encaminhamento Médico"), `<pre class="report-text">${report || "Relatório ainda não gerado."}</pre>`].join(""),
        company
      );
      return;
    }
    if (reportType === "financial") {
      const rows = financialResults.map((item) => `<tr><td>${item.description}</td><td>${patients.find((entry) => entry.id === item.patientId)?.fullName || "-"}</td><td>${item.baNumber || "-"}</td><td>${item.type === "income" ? "Receita" : "Despesa"}</td><td>${currency.format(item.amount)}</td><td>${paymentStatusLabel(item.status)}</td></tr>`).join("");
      openPrintDocument("Relatório financeiro", [documentHeader(company, "Relatório Financeiro"), `<h2>Resumo</h2><p>Receitas: ${currency.format(revenue)}<br>Despesas: ${currency.format(expenses)}<br>Saldo: ${currency.format(revenue - expenses)}</p>`, `<table><thead><tr><th>Descrição</th><th>Paciente</th><th>BA</th><th>Tipo</th><th>Valor</th><th>Status</th></tr></thead><tbody>${rows || "<tr><td colspan='6'>Nenhum lançamento encontrado.</td></tr>"}</tbody></table>`].join(""), company);
      return;
    }
    const rows = attendanceResults.map((item) => `<tr><td>${patients.find((entry) => entry.id === item.patientId)?.fullName || "-"}</td><td>${item.uniqueRecordNumber}</td><td>${item.baNumber}</td><td>${formatDateTime(item.openedAt)}</td><td>${statusLabel(item.status)}</td><td>${item.procedure || "-"}</td><td>${item.productsUsed.join(", ") || "-"}</td></tr>`).join("");
    openPrintDocument("Histórico de atendimento", [documentHeader(company, "Histórico de Atendimento"), `<table><thead><tr><th>Paciente</th><th>Prontuário de Evolução</th><th>BA</th><th>Data</th><th>Status</th><th>Procedimento</th><th>Produtos</th></tr></thead><tbody>${rows || "<tr><td colspan='7'>Nenhum atendimento encontrado.</td></tr>"}</tbody></table>`].join(""), company);
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">Relatorios</span><h1>Relatorios clinicos e financeiros</h1><p>Historico de atendimento, financeiro e encaminhamento medico com IA.</p></div>
        <button className="primary-button" disabled={loading} onClick={generate} type="button"><Sparkles size={18} /> {loading ? "Gerando..." : "Gerar relatório"}</button>
      </div>
      <section className="split-grid">
        <div className="data-panel">
          <h2>Filtros</h2>
          <div className="report-list">
            <button className={reportType === "medical" ? "is-active" : ""} onClick={() => { setReportType("medical"); setGenerated(false); }} type="button"><FileText size={18} /> Encaminhamento médico</button>
            <button className={reportType === "financial" ? "is-active" : ""} onClick={() => { setReportType("financial"); setGenerated(false); }} type="button"><Receipt size={18} /> Financeiro</button>
            <button className={reportType === "attendance" ? "is-active" : ""} onClick={() => { setReportType("attendance"); setGenerated(false); }} type="button"><ClipboardEdit size={18} /> Histórico de atendimento</button>
          </div>
          {reportType !== "medical" && <div className="report-filters">
            <label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">Todo período</option><option value="today">Hoje</option><option value="week">Esta semana</option><option value="month">Este mês</option><option value="custom">Personalizado</option></select></label>
            {period === "custom" && <><label>Início<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label><label>Fim<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label></>}
            <label>Paciente<select value={patientId} onChange={(event) => setPatientId(event.target.value)}><option value="all">Todos os pacientes</option>{patients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
            <label>Profissional<select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}><option value="all">Todos os profissionais</option>{profiles.filter((item) => item.role !== "financial").map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
            <label>{reportType === "financial" ? "BA, categoria ou descrição" : "BA, Prontuário de Evolução, queixa, curativo, produto ou procedimento"}<input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option>{reportType === "financial" ? (["paid", "pending", "overdue", "cancelled"] as const).map((item) => <option key={item} value={item}>{paymentStatusLabel(item)}</option>) : (["waiting", "in_progress", "completed", "cancelled", "no_show"] as const).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></label>
            {reportType === "financial" && <><label>Tipo<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Receitas e despesas</option><option value="income">Receita</option><option value="expense">Despesa</option></select></label><label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="all">Todas</option>{(["pix", "cash", "credit_card", "debit_card", "insurance", "other"] as const).map((item) => <option key={item} value={item}>{paymentLabel(item)}</option>)}<option value="private">Particular</option></select></label><label>Valor mínimo<input inputMode="numeric" name="reportMinValue" value={minValue} onChange={(event) => setMinValue(event.target.value)} /></label><label>Valor máximo<input inputMode="numeric" name="reportMaxValue" value={maxValue} onChange={(event) => setMaxValue(event.target.value)} /></label></>}
            <button className="ghost-action" onClick={clear} type="button">Limpar filtros</button>
          </div>}
          {reportType === "medical" && <div className="medical-patient-search">
            <label>Pesquisar paciente para encaminhamento<input value={medicalPatientQuery} onChange={(event) => setMedicalPatientQuery(event.target.value)} placeholder="Nome, CPF, telefone, Prontuário de Evolução ou BA" /></label>
            <div className="patient-search-results">
              {medicalPatientResults.length ? medicalPatientResults.map((item) => <button className={medicalPatient.id === item.id ? "is-selected" : ""} key={item.id} onClick={() => { setMedicalPatientId(item.id); setMedicalPatientQuery(item.fullName); setGenerated(false); }} type="button"><strong>{item.fullName}</strong><small>{item.uniqueRecordNumber} · {item.cpf} · {attendances.filter((attendance) => attendance.patientId === item.id && attendance.companyId === companyId).length} BA(s)</small></button>) : <EmptyState title="Nenhum paciente encontrado." message="Revise nome, CPF, telefone, Prontuário de Evolução ou BA." />}</div>
            <div className="selected-patient-card"><strong>{medicalPatient.fullName}</strong><span>{medicalPatient.uniqueRecordNumber} · {medicalPatient.cpf}</span><small>{medicalPatientAttendances.length} atendimento(s) locais disponíveis para o relatório.</small></div>
          </div>}
          {reportType === "medical" && hciAvailable && (
            <label className="toggle-row">
              <input checked={includeHci} onChange={(event) => onIncludeHciChange(event.target.checked)} type="checkbox" />
              Incluir HCI autorizado no relatorio
            </label>
          )}
          {reportType === "medical" && !hciAvailable && <p className="muted">HCI só aparece quando houver consentimento autorizado e permissão de acesso.</p>}
        </div>
        <div className="data-panel">
          <div className="section-heading section-heading--compact">
            <div><h2>Relatorio editavel</h2><p>A IA organiza o historico sem emitir diagnostico definitivo.</p></div>
            <div className="icon-group">
              <button className="icon-button export-icon-button export-icon-button--pdf" disabled={!generated && reportType !== "medical"} onClick={exportPdf} title="Salvar PDF / imprimir" type="button"><Printer size={17} /></button>
              <button className="icon-button export-icon-button" disabled={!generated || reportType === "medical"} onClick={exportCsv} title="Exportar CSV" type="button"><Download size={17} /></button>
              <button className="icon-button" disabled title="Envio será configurado futuramente" type="button"><Send size={17} /></button>
            </div>
          </div>
          {reportType === "medical" && <textarea className="report-editor" value={report || "Clique em Gerar relatório para criar o encaminhamento."} onChange={(event) => onChangeReport(event.target.value)} />}
          {reportType === "financial" && generated && <><section className="metrics-grid"><MetricCard icon={<TrendingUp />} label="Receitas" value={currency.format(revenue)} detail={`${financialResults.filter((item) => item.type === "income").length} lançamentos`} /><MetricCard icon={<Receipt />} label="Despesas" value={currency.format(expenses)} detail={`${financialResults.filter((item) => item.type === "expense").length} lançamentos`} /><MetricCard icon={<CreditCard />} label="Saldo" value={currency.format(revenue - expenses)} detail="Receitas menos despesas" /><MetricCard icon={<CalendarClock />} label="Pendente" value={currency.format(financialResults.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0))} detail="A receber" /></section>{financialResults.length ? <Table headers={["Descrição", "Paciente", "BA", "Tipo", "Valor", "Status"]} rows={financialResults.map((item) => [item.description, patients.find((entry) => entry.id === item.patientId)?.fullName || "-", item.baNumber || "-", item.type === "income" ? "Receita" : "Despesa", currency.format(item.amount), paymentStatusLabel(item.status)])} /> : <EmptyState title="Nenhum lançamento encontrado para os filtros selecionados." message="Limpe ou ajuste os filtros." />}</>}
          {reportType === "attendance" && generated && (attendanceResults.length ? <Table headers={["Paciente", "Prontuário de Evolução", "BA", "Data", "Profissional", "Status", "Procedimento", "Produtos", "Anamnese", "Imagens"]} rows={attendanceResults.map((item) => [patients.find((entry) => entry.id === item.patientId)?.fullName || "-", item.uniqueRecordNumber, item.baNumber, formatDateTime(item.openedAt), profiles.find((entry) => entry.id === item.professionalId)?.fullName || "-", statusLabel(item.status), item.procedure || "-", item.productsUsed.join(", ") || "-", anamneses.find((entry) => entry.attendanceId === item.id)?.isCompleted ? "Concluída" : "Sem conclusão", String(attendanceImages.filter((image) => image.attendanceId === item.id).length)])} /> : <EmptyState title="Nenhum atendimento encontrado para os filtros selecionados." message="Limpe ou ajuste os filtros." />)}
          {reportType !== "medical" && !generated && <EmptyState title="Configure os filtros e gere o relatório" message="Os resultados aparecerão aqui." />}
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
          <p>Consulta segura pelo Prontuário de Evolução do paciente, sem quebrar isolamento por empresa.</p>
        </div>
        <HeartPulse size={26} />
      </div>

      <section className="data-panel">
        <div className="hci-search">
          <label>
            Buscar por nome, CPF, Prontuário de Evolução, telefone ou data de nascimento
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
                <span>{match.patientName} · Prontuário de Evolução {match.uniqueRecordNumber}</span>
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
                <div><dt>Prontuário de Evolução</dt><dd>{integratedHistory.patient.uniqueRecordNumber}</dd></div>
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
              <p className="muted">Este acesso ao historico integrado e auditado para seguranca e conformidade com a LGPD.</p>
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

function SettingsView({ company, profile, onCompanyChange, onNotify }: { company: Company; profile: Profile; onCompanyChange: (company: Company) => void; onNotify: (title: string, message: string, tone?: AppNotice["tone"]) => void }) {
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(company.logoUrl || "");
  const [logoError, setLogoError] = useState("");
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [accountPasswordError, setAccountPasswordError] = useState("");

  useEffect(() => {
    setLogoPreview(company.logoUrl || "");
  }, [company.logoUrl]);

  function update<K extends keyof Company>(key: K, value: Company[K]) {
    onCompanyChange({ ...company, [key]: value });
  }

  async function handleLogoUpload(file?: File) {
    setLogoError("");
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setLogoError("Envie uma imagem PNG, JPG, JPEG, WEBP ou SVG.");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setLogoError("A logo deve ter no maximo 5 MB.");
      return;
    }

    setLogoPreview(URL.createObjectURL(file));
    setUploadingLogo(true);
    try {
      const uploaded = await uploadCompanyLogo(company.id, file);
      if (!uploaded) {
        const localUrl = await fileToDataUrl(file);
        onCompanyChange({
          ...company,
          logoUrl: localUrl,
          logoPath: `local-preview/${file.name}`,
          logoUploadedAt: new Date().toISOString()
        });
        setLogoPreview(localUrl);
        onNotify("Logo aplicada em prévia", "No ambiente oficial, a imagem será enviada para o armazenamento seguro da clínica.", "success");
        return;
      }

      onCompanyChange({
        ...company,
        logoUrl: uploaded.url,
        logoPath: uploaded.path,
        logoUploadedAt: uploaded.uploadedAt
      });
      setLogoPreview(uploaded.url);
      onNotify("Logo enviada", "A nova logo foi aplicada ao sistema.", "success");
    } catch {
      setLogoError("Nao foi possivel enviar a logo agora. Tente novamente em instantes.");
    } finally {
      setUploadingLogo(false);
    }
  }

  function removeLogo() {
    onCompanyChange({ ...company, logoUrl: "", logoPath: undefined, logoUploadedAt: undefined });
    setLogoPreview("");
    setLogoError("");
    onNotify("Logo removida", "A identidade visual voltara a usar o icone padrao ate uma nova logo ser salva.", "info");
  }

  async function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveCompanySettings(company);
      onNotify("Identidade visual salva", "As cores e informacoes da empresa foram atualizadas.", "success");
    } catch {
      onNotify("Nao foi possivel salvar agora", "As alteracoes continuam aplicadas nesta sessao. Tente novamente em instantes.", "warning");
    } finally {
      setSaving(false);
    }
  }

  async function changeOwnPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    setAccountPasswordError("");

    if (password.length < 8) {
      setAccountPasswordError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setAccountPasswordError("As senhas informadas nao coincidem.");
      return;
    }

    setChangingPassword(true);
    try {
      await updateOwnPassword(password);
      event.currentTarget.reset();
      onNotify("Senha atualizada com sucesso.", `A senha de ${profile.fullName} foi atualizada com seguranca.`, "success");
    } catch {
      setAccountPasswordError("Nao foi possivel atualizar a senha agora. Se voce entrou por link de recuperacao, tente novamente em instantes.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div><span className="eyebrow">Identidade da clinica</span><h1>Configuracoes da empresa</h1><p>Logo, cores, nome exibido e dados comerciais por clinica.</p></div>
        <Palette size={24} />
      </div>
      <section className="split-grid">
        <form className="panel-form" onSubmit={saveIdentity}>
          <label>Nome exibido<input value={company.displayName} onChange={(event) => update("displayName", event.target.value)} /></label>
          <label>E-mail comercial<input value={company.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} /></label>
          <label>Telefone comercial<input inputMode="tel" value={company.contactPhone} onChange={(event) => update("contactPhone", formatPhone(event.target.value))} /></label>
          <label>CNPJ<input inputMode="numeric" value={company.document} onChange={(event) => update("document", formatCnpj(event.target.value))} /></label>
          <div className="logo-upload-field">
            <div className="logo-upload-field__preview">
              {logoPreview ? <img src={logoPreview} alt="Previa da logo da clinica" /> : <ImageIcon size={26} />}
            </div>
            <div className="logo-upload-field__content">
              <span>Upload de logo</span>
              <p>PNG, JPG, WEBP ou SVG ate 5 MB. A imagem aparece no menu, login e aba do navegador.</p>
              <label className="logo-upload-button">
                <UploadCloud size={16} />
                {uploadingLogo ? "Enviando..." : "Selecionar imagem"}
                <input
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  disabled={uploadingLogo}
                  onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                  type="file"
                />
              </label>
              {company.logoUrl && <button className="ghost-action" onClick={removeLogo} type="button">Remover logo</button>}
              {logoError && <small className="inline-error">{logoError}</small>}
            </div>
          </div>
          <label>Logo URL manual (opcional)<input value={company.logoUrl || ""} onChange={(event) => update("logoUrl", event.target.value)} placeholder="https://..." /></label>
          <label>Cor principal<input type="color" value={company.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} /></label>
          <label>Cor secundaria<input type="color" value={company.secondaryColor} onChange={(event) => update("secondaryColor", event.target.value)} /></label>
          <label>Cor de destaque<input type="color" value={company.accentColor} onChange={(event) => update("accentColor", event.target.value)} /></label>
          <label>Cor do fundo do sistema<input type="color" value={company.backgroundColor || "#f3f7fb"} onChange={(event) => update("backgroundColor", event.target.value)} /></label>
          <label>Cor do menu lateral<input type="color" value={company.sidebarColor || "#071923"} onChange={(event) => update("sidebarColor", event.target.value)} /></label>
          <label>Cor do texto do menu<input type="color" value={company.sidebarTextColor || "#f8fbfc"} onChange={(event) => update("sidebarTextColor", event.target.value)} /></label>
          <label>Cor de destaque do menu<input type="color" value={company.sidebarHoverColor || company.primaryColor} onChange={(event) => update("sidebarHoverColor", event.target.value)} /></label>
          <fieldset className="option-fieldset">
            <legend>Campos operacionais</legend>
            <label className="toggle-row">
              <input checked={Boolean(company.enableInsuranceType)} onChange={(event) => update("enableInsuranceType", event.target.checked)} type="checkbox" />
              Exibir Convênio / Particular na agenda e abertura de atendimento
            </label>
          </fieldset>
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
          <div className="dialog-card__actions">
            <button className="primary-button" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar identidade visual"}</button>
          </div>
        </form>
        <div className="brand-preview">
          <span className="brand__mark"><Layers3 /></span>
          <h2>{company.displayName}</h2>
          <p>{company.contactPhone} · {company.contactEmail}</p>
          <button className="primary-button" type="button">Botao com cor da clinica</button>
          <small>Identidade visual aplicada ao sistema.</small>
        </div>
      </section>
      <section className="data-panel">
        <div className="section-heading section-heading--compact">
          <div><h2>Minha senha</h2><p>Altere somente a senha do seu proprio usuario. Nenhuma senha e salva em tabelas comuns.</p></div>
          <KeyRound size={20} />
        </div>
        <form className="panel-form account-password-form" onSubmit={changeOwnPassword}>
          <div className="form-grid form-grid--two">
            <label>Nova senha<span className="password-field"><input autoComplete="new-password" minLength={8} name="newPassword" required type={showAccountPassword ? "text" : "password"} /><button aria-label={showAccountPassword ? "Ocultar senha" : "Mostrar senha"} className="icon-button" onClick={() => setShowAccountPassword((current) => !current)} type="button">{showAccountPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            <label>Confirmar nova senha<input autoComplete="new-password" minLength={8} name="confirmPassword" required type={showAccountPassword ? "text" : "password"} /></label>
          </div>
          {accountPasswordError && <div className="inline-error">{accountPasswordError}</div>}
          <div className="dialog-card__actions"><button className="primary-button" disabled={changingPassword} type="submit">{changingPassword ? "Atualizando..." : "Atualizar minha senha"}</button></div>
        </form>
      </section>
    </div>
  );
}

function SuperAdmin({ company, onNotify }: { company: Company; onNotify: (title: string, message: string, tone?: AppNotice["tone"]) => void }) {
  const [users, setUsers] = useState(demoProfiles.filter((item) => item.companyId === company.id));
  const [open, setOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>(["dashboard", "patients", "schedule"]);
  const [savingUser, setSavingUser] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [actionUser, setActionUser] = useState<{ user: Profile; action: "reset_password" | "deactivate" | "reactivate" } | null>(null);
  const [showInitialPassword, setShowInitialPassword] = useState(false);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const temporaryPassword = String(form.get("temporaryPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    if (!editingUser) {
      if (temporaryPassword.length < 8) {
        setUserMessage("A senha de primeiro acesso deve ter pelo menos 8 caracteres.");
        return;
      }
      if (temporaryPassword !== confirmPassword) {
        setUserMessage("A confirmação da senha de primeiro acesso não confere.");
        return;
      }
    }
    const user = { id: editingUser?.id ?? `user-${Date.now()}`, companyId: company.id, fullName: String(form.get("fullName")), email: editingUser?.email ?? String(form.get("email")), role: String(form.get("role")) as typeof demoProfiles[number]["role"], active: form.get("active") === "on", modulePermissions: selectedModules };
    setSavingUser(true);
    setUserMessage("");
    try {
      if (editingUser) {
        await manageCompanyUser({ action: "update", userId: user.id, companyId: company.id, fullName: user.fullName, role: user.role, active: user.active, modules: selectedModules });
        setUsers((current) => current.map((item) => item.id === user.id ? user : item));
      } else {
        await createCompanyUser({ companyId: company.id, fullName: user.fullName, email: user.email, role: user.role, active: user.active, modules: selectedModules, temporaryPassword, requirePasswordChange: form.get("requirePasswordChange") === "on", sendInviteEmail: form.get("sendInviteEmail") === "on" });
        setUsers((current) => [...current, user]);
      }
      setOpen(false);
      setEditingUser(null);
      onNotify(editingUser ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.", `${user.fullName} ficou vinculado somente a ${company.displayName}.`, "success");
    } catch {
      setUserMessage("Não foi possível criar o usuário. Verifique os dados e tente novamente.");
    } finally {
      setSavingUser(false);
    }
  }

  async function confirmUserAction() {
    if (!actionUser) return;
    await manageCompanyUser({ action: actionUser.action, userId: actionUser.user.id, companyId: company.id });
    if (actionUser.action !== "reset_password") setUsers((current) => current.map((item) => item.id === actionUser.user.id ? { ...item, active: actionUser.action === "reactivate" } : item));
    const message = actionUser.action === "reset_password" ? "Instrução de redefinição de senha enviada." : actionUser.action === "deactivate" ? "Usuario desativado com seguranca." : "Usuario reativado.";
    setUserMessage(message);
    onNotify(message, actionUser.action === "deactivate" ? "Historicos, BAs e auditoria foram preservados." : "Acao administrativa concluida.", "success");
    setActionUser(null);
  }

  const closeUserForm = () => {
    setOpen(false);
    setEditingUser(null);
  };

  const userForm = (
    <form className="user-management-page" onSubmit={createUser}>
      <div className="section-heading section-heading--compact">
        <div>
          <h2>{editingUser ? "Editar perfil e permissoes" : `Criar usuario em ${company.displayName}`}</h2>
          <p>Dados de acesso, perfil e permissões ficam em tela dedicada para evitar campos cortados.</p>
        </div>
      </div>
      <div className="form-section-title">Dados do usuário</div>
      <div className="form-grid form-grid--three">
        <label>Nome<input defaultValue={editingUser?.fullName} name="fullName" required /></label>
        <label>E-mail<input defaultValue={editingUser?.email} disabled={Boolean(editingUser)} name="email" required type="email" /></label>
        <label>Empresa<input readOnly value={company.displayName} /></label>
        <label>Perfil<select defaultValue={editingUser?.role ?? "professional"} name="role">{(["super_admin", "company_admin", "professional", "reception", "financial", "stock", "schedule", "reports", "custom"] as const).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
        <label className="toggle-row"><input defaultChecked={editingUser?.active ?? true} name="active" type="checkbox" /> Usuario ativo</label>
      </div>
      {!editingUser && (
        <>
          <div className="form-section-title">Acesso inicial</div>
          <div className="form-grid form-grid--three">
            <label>Senha de primeiro acesso<span className="password-field"><input autoComplete="new-password" minLength={8} name="temporaryPassword" required type={showInitialPassword ? "text" : "password"} /><button aria-label={showInitialPassword ? "Ocultar senha" : "Mostrar senha"} className="icon-button" onClick={() => setShowInitialPassword((current) => !current)} type="button">{showInitialPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            <label>Confirmar senha<input autoComplete="new-password" minLength={8} name="confirmPassword" required type={showInitialPassword ? "text" : "password"} /></label>
            <label className="toggle-row"><input defaultChecked name="requirePasswordChange" type="checkbox" /> Exigir troca no primeiro acesso</label>
            <label className="toggle-row"><input defaultChecked name="sendInviteEmail" type="checkbox" /> Enviar instruções por e-mail</label>
          </div>
        </>
      )}
      <fieldset className="option-fieldset">
        <legend>Permissoes por abas/modulos</legend>
        <div className="checkbox-grid">{modulePermissionOptions.map(([key, label]) => <label key={key}><input checked={selectedModules.includes(key)} onChange={(event) => setSelectedModules((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} type="checkbox" />{label}</label>)}</div>
      </fieldset>
      {userMessage && <div className="inline-error">{userMessage}</div>}
      <div className="user-management-page__actions">
        <button className="ghost-action" disabled={savingUser} onClick={closeUserForm} type="button">Cancelar</button>
        <button className="ghost-action" disabled={savingUser} onClick={closeUserForm} type="button">Voltar para Administração da Clínica</button>
        <button className="primary-button" disabled={savingUser} type="submit">{savingUser ? "Salvando..." : editingUser ? "Salvar usuario e permissoes" : "Salvar usuário"}</button>
      </div>
    </form>
  );

  if (open) {
    return (
      <ModulePage eyebrow="Administracao interna" title={editingUser ? "Editar usuário" : "Criar usuário"} description={`Usuários e permissões ficam vinculados somente a ${company.displayName}.`}>
        {userForm}
      </ModulePage>
    );
  }

  return (
    <ModulePage eyebrow="Administracao interna" title="Administração da Clínica" description="Controle usuarios, permissoes e configuracoes internas da clinica.">
      <div className="section-heading section-heading--compact"><div><h2>Usuarios da empresa</h2><p>Crie usuarios vinculados a {company.displayName} e defina as abas permitidas.</p></div><button className="primary-button" onClick={() => { setEditingUser(null); setSelectedModules(["dashboard", "patients", "schedule"]); setUserMessage(""); setOpen(true); }} type="button"><Plus size={17} /> Criar usuario</button></div>
      <section className="metrics-grid">
        <MetricCard icon={<BuildingIcon />} label="Clínica atual" value="1" detail="Escopo administrativo limitado à empresa logada" tone="primary" />
        <MetricCard icon={<Users />} label="Usuarios" value={String(users.length)} detail="Vinculados a empresa selecionada" />
        <MetricCard icon={<ShieldCheck />} label="Ativos" value={String(users.filter((item) => item.active).length)} detail="Com acesso liberado" tone="success" />
        <MetricCard icon={<AlertTriangle />} label="Desativados" value={String(users.filter((item) => !item.active).length)} detail="Sem acesso ao sistema" />
      </section>
      {userMessage && <div className="inline-info">{userMessage}</div>}
      <Table headers={["Nome", "E-mail", "Perfil", "Status", "Acoes"]} rows={users.map((user) => [user.fullName, user.email, roleLabel(user.role), user.active ? "Ativo" : "Inativo", <div className="table-actions"><button className="ghost-action" onClick={() => { setEditingUser(user); setSelectedModules(user.modulePermissions ?? []); setUserMessage(""); setOpen(true); }} type="button">Editar / Permissoes</button><button className="ghost-action" onClick={() => setActionUser({ user, action: "reset_password" })} type="button">Resetar senha</button><button className="ghost-action" onClick={() => setActionUser({ user, action: user.active ? "deactivate" : "reactivate" })} type="button">{user.active ? "Desativar" : "Reativar"}</button></div>])} />
      {actionUser && <div className="dialog-backdrop"><section className="dialog-card"><div><h2>{actionUser.action === "reset_password" ? "Resetar senha" : actionUser.action === "deactivate" ? "Desativar usuario" : "Reativar usuario"}</h2><p>{actionUser.action === "reset_password" ? "Um link seguro de redefinicao sera enviado ao e-mail do usuario." : actionUser.action === "deactivate" ? "O acesso sera bloqueado, mas historicos, BAs e auditoria permanecerao preservados." : "O usuario voltara a acessar os modulos permitidos."}</p></div><div className="dialog-card__actions"><button className="ghost-action" onClick={() => setActionUser(null)} type="button">Cancelar</button><button className={actionUser.action === "deactivate" ? "danger-button" : "primary-button"} onClick={confirmUserAction} type="button">Confirmar</button></div></section></div>}
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

function matchesPeriod(date: string, period: string, customStart = "", customEnd = "") {
  if (period === "all") return true;
  const target = new Date(date);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return target >= startToday;
  if (period === "week") {
    const startWeek = new Date(startToday);
    startWeek.setDate(startToday.getDate() - startToday.getDay());
    return target >= startWeek;
  }
  if (period === "month") return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth();
  if (period === "custom") {
    const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
    const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
    return (!start || target >= start) && (!end || target <= end);
  }
  return true;
}

function statusLabel(status: Attendance["status"]) {
  const labels: Record<Attendance["status"], string> = {
    ba_open: "BA aberto",
    waiting: "Aguardando atendimento",
    in_progress: "Em atendimento",
    reopened: "Reaberto para edição",
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

function emptyAutoclaveItem(companyId: string, autoclaveRecordId: string): AutoclaveRecordItem {
  return {
    id: `auto-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companyId,
    autoclaveRecordId,
    stockProductId: undefined,
    stockProductCode: undefined,
    materialName: "",
    category: "",
    quantity: 1,
    unit: "un",
    notes: ""
  };
}

function indicatorSelect(name: string, label: string, current?: string, allowWaiting = false) {
  return (
    <label>{label}
      <select defaultValue={current ?? "approved"} name={name}>
        <option value="approved">Aprovado</option>
        <option value="failed">Reprovado</option>
        <option value="not_used">Não utilizado</option>
        {allowWaiting && <option value="waiting">Aguardando resultado</option>}
      </select>
    </label>
  );
}

function autoclaveIndicatorLabel(value: AutoclaveRecord["biologicalIndicatorResult"]) {
  const labels: Record<AutoclaveRecord["biologicalIndicatorResult"], string> = {
    approved: "Aprovado",
    failed: "Reprovado",
    not_used: "Não utilizado",
    waiting: "Aguardando resultado"
  };
  return labels[value];
}

function autoclaveFinalLabel(value: AutoclaveRecord["finalResult"]) {
  const labels: Record<AutoclaveRecord["finalResult"], string> = {
    approved: "Aprovado",
    failed: "Reprovado",
    reprocess: "Reprocessar"
  };
  return labels[value];
}

function autoclaveStatusLabel(value: AutoclaveRecord["status"]) {
  const labels: Record<AutoclaveRecord["status"], string> = {
    registered: "Registrado",
    approved: "Aprovado",
    failed: "Reprovado",
    reprocess: "Reprocessar"
  };
  return labels[value];
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

function colorWithAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(248, 251, 252, ${alpha})`;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function dashboardDateRange(period: DashboardPeriod, customStart: string, customEnd: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (period === "week") {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (period === "month") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  } else if (period === "custom" && customStart && customEnd) {
    const [startYear, startMonth, startDay] = customStart.split("-").map(Number);
    const [endYear, endMonth, endDay] = customEnd.split("-").map(Number);
    start.setFullYear(startYear, startMonth - 1, startDay);
    end.setFullYear(endYear, endMonth - 1, endDay);
  }
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isDateInRange(value: string | undefined, range: { start: Date; end: Date }) {
  if (!value) return false;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date >= range.start && date <= range.end;
}

function sameLocalDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
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
      `<h2>Paciente</h2><p>${patient.fullName}<br>Prontuário de Evolução: ${patient.uniqueRecordNumber}<br>CPF: ${patient.cpf}</p>`,
      `<h2>Atendimento</h2><p>Data: ${formatDateTime(attendance.scheduledAt)}<br>Queixa: ${attendance.complaint}<br>Procedimento: ${attendance.procedure}<br>Conduta: ${attendance.conduct || "Nao informada"}</p>`,
      `<h2>Anamnese</h2>${formatAnamnesisForPrint(relatedAnamnesis)}`,
      `<h2>Sensibilidade / Pe 3D</h2><ul>${relatedFootMaps.map((entry) => `<li>${entry.footSide} · ${entry.regionKey}: ${entry.sensitivityStatus} · ${entry.notes}</li>`).join("") || "<li>Sem marcacoes</li>"}</ul>`,
      `<h2>Imagens da ferida</h2>${renderImagesForPrint(relatedImages)}`
    ].join(""),
    company
  );
}

function exportAutoclaveRecord(record: AutoclaveRecord, company: Company) {
  const materialRows = record.items.map((item) => `<tr><td>${item.materialName}</td><td>${item.category || "-"}</td><td>${item.quantity}</td><td>${item.unit}</td><td>${item.notes || "-"}</td></tr>`).join("");
  openPrintDocument(
    `Autoclave ${record.cycleNumber}`,
    [
      documentHeader(company, "Ficha de Registro de Resultado de Autoclave"),
      `<h2>Identificacao da Autoclave</h2><p>Ciclo: ${record.cycleNumber}<br>Lote: ${record.sterilizationLot}<br>Data: ${formatDate(record.cycleDate)} · ${record.startTime} ate ${record.endTime}<br>Operador: ${record.responsibleName}<br>Equipamento: ${record.autoclaveName} ${record.autoclaveCode ? `(${record.autoclaveCode})` : ""}</p>`,
      `<h2>Parametros</h2><p>Temperatura: ${record.temperature || "-"}<br>Pressao: ${record.pressure || "-"}<br>Tempo de exposicao: ${record.exposureTime || "-"}<br>Tipo de ciclo: ${record.cycleType}</p>`,
      `<h2>Resultado</h2><p>Indicador quimico: ${autoclaveIndicatorLabel(record.chemicalIndicatorResult)}<br>Indicador biologico: ${autoclaveIndicatorLabel(record.biologicalIndicatorResult)}<br>Integrador: ${autoclaveIndicatorLabel(record.integratorResult)}<br>Bowie-Dick: ${autoclaveIndicatorLabel(record.bowieDickResult)}<br>Resultado final: ${autoclaveFinalLabel(record.finalResult)}</p>`,
      `<h2>Materiais esterilizados</h2><table><thead><tr><th>Material</th><th>Categoria</th><th>Qtd.</th><th>Unidade</th><th>Obs.</th></tr></thead><tbody>${materialRows}</tbody></table>`,
      `<h2>Controle</h2><p>Observacoes: ${record.notes || "-"}<br>Intercorrencias: ${record.incidents || "-"}<br>Conduta: ${record.correctiveAction || "-"}</p><p style="margin-top:42px">Assinatura/responsavel: _______________________________________</p>`
    ].join(""),
    company
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
    `Prontuário de Evolução ${patient.uniqueRecordNumber}`,
    [
      documentHeader(company, `Prontuário de Evolução ${patient.uniqueRecordNumber}`),
      `<h2>Dados do paciente</h2><p>${patient.fullName}<br>CPF: ${patient.cpf}<br>Nascimento: ${formatDate(patient.birthDate)}<br>Telefone/WhatsApp: ${patient.whatsapp}</p>`,
      `<h2>Dados clinicos</h2><p>Queixa principal: ${patient.clinical.chiefComplaint}<br>Historico: ${patient.clinical.diseaseHistory}<br>Medicamentos: ${patient.clinical.medications || "Nao informado"}</p>`,
      `<h2>BAs</h2><ul>${attendances.map((attendance) => `<li>${attendance.baNumber} — ${formatDateTime(attendance.scheduledAt)} — ${attendance.procedure}</li>`).join("")}</ul>`,
      `<h2>Anamneses</h2>${anamneses.map((record) => `<h3>${record.baNumber}</h3>${formatAnamnesisForPrint(record)}`).join("") || "<p>Sem anamneses registradas.</p>"}`,
      `<h2>Sensibilidade / Pe 3D</h2><ul>${footMaps.map((entry) => `<li>${entry.baNumber} · ${entry.footSide} · ${entry.regionKey}: ${entry.sensitivityStatus}</li>`).join("") || "<li>Sem marcacoes</li>"}</ul>`,
      `<h2>Evolucao por imagens</h2>${renderImagesForPrint(images)}`,
      `<p><strong>Data da emissao:</strong> ${new Date().toLocaleString("pt-BR")}</p>`
    ].join(""),
    company
  );
}

function exportDashboardReport(
  company: Company,
  periodLabel: string,
  range: { start: Date; end: Date },
  data: {
    localPatients: Patient[];
    periodPatients: Patient[];
    localAttendances: Attendance[];
    localAppointments: ClinicalAppointment[];
    localFinancial: FinancialTransaction[];
    stock: StockProduct[];
    revenue: number;
    expenses: number;
    recurringPatientIds: Set<string>;
  }
) {
  const lowStock = data.stock.filter((product) => product.companyId === company.id && product.minimumQuantity > 0 && product.currentQuantity <= product.minimumQuantity);
  const pending = data.localFinancial.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
  openPrintDocument(
    `Dashboard ${periodLabel}`,
    [
      documentHeader(company, `Relatório do Dashboard · ${periodLabel}`),
      `<h2>Período</h2><p>${formatDate(range.start.toISOString())} até ${formatDate(range.end.toISOString())}</p>`,
      `<h2>Resumo operacional</h2><table><tbody><tr><th>Pacientes cadastrados no período</th><td>${data.periodPatients.length}</td></tr><tr><th>Atendimentos</th><td>${data.localAttendances.length}</td></tr><tr><th>Atendimentos finalizados</th><td>${data.localAttendances.filter((item) => item.status === "completed").length}</td></tr><tr><th>Agendamentos</th><td>${data.localAppointments.length}</td></tr><tr><th>Faltas</th><td>${data.localAppointments.filter((item) => item.status === "no_show").length}</td></tr><tr><th>Reincidência</th><td>${data.recurringPatientIds.size}</td></tr></tbody></table>`,
      `<h2>Resumo financeiro</h2><table><tbody><tr><th>Receita recebida</th><td>${currency.format(data.revenue)}</td></tr><tr><th>Despesas</th><td>${currency.format(data.expenses)}</td></tr><tr><th>Saldo</th><td>${currency.format(data.revenue - data.expenses)}</td></tr><tr><th>Total pendente</th><td>${currency.format(pending)}</td></tr></tbody></table>`,
      `<h2>Estoque baixo</h2>${lowStock.length ? `<ul>${lowStock.map((product) => `<li>${product.name}: ${product.currentQuantity} ${product.unit} / mínimo ${product.minimumQuantity} ${product.unit}</li>`).join("")}</ul>` : "<p>Nenhum produto em alerta no período.</p>"}`,
      `<p><strong>Data da emissão:</strong> ${new Date().toLocaleString("pt-BR")}</p>`
    ].join(""),
    company
  );
}

function formatAnamnesisForPrint(record?: AnamnesisRecord) {
  if (!record) return "<p>Sem anamnese registrada para este atendimento.</p>";
  const data = record.formData;
  const sections: Array<[string, Array<[string, unknown]>]> = [
    ["Identificação", [["Paciente", data.identification_name], ["Data da avaliação", data.identification_date], ["Idade", data.identification_age], ["Profissão", data.identification_profession]]],
    ["Queixa principal", [["Queixa", data.main_complaint || data.chief_complaint]]],
    ["Histórico de Saúde", [["Condições relatadas", data.health_history], ["Cirurgia", data.surgery_history], ["Descrição da cirurgia", data.surgery_description], ["Medicamentos em uso", data.medications], ["Alergias", data.allergies]]],
    ["Avaliação Podal", [["Alterações podais", data.changes], ["Pele", data.skin_exam], ["Edema", data.edema_present ? `${humanizeAnamnesisValue(data.edema_present)}${data.edema ? ` - ${humanizeAnamnesisValue(data.edema)}` : ""}` : data.edema], ["Glicemia", data.glycemia_result || data.blood_glucose], ["Escala de dor EVA", data.eva_scale ? `${data.eva_scale}/10` : undefined]]],
    ["Indicação de tratamento", [["Indicação", data.treatment_indication], ["Laserterapia", data.lasertherapy_joules ? `${data.lasertherapy_joules} J` : undefined], ["LED", data.led_joules ? `${data.led_joules} J` : undefined], ["Alta frequência", data.high_frequency_minutes ? `${data.high_frequency_minutes} minutos` : undefined], ["Eletrocauterização", data.electrocautery_minutes ? `${data.electrocautery_minutes} minutos` : undefined]]],
    ["Orientações Home Care", [["Orientações", data.home_care_guidance]]],
    ["Retorno", [["Data sugerida", data.return_date || data.follow_up_date], ["Paciente retornou?", data.patient_returned], ["Observações", data.return_notes]]]
  ];
  sections.push(
    ["Avaliação de Sensibilidade", [
      ["Monofilamento pe D", data.monofilament_right],
      ["Monofilamento pe E", data.monofilament_left],
      ["Sensibilidade vibratória D", data.vibration_sensitivity_right || data.vibration_sensitivity || data.vibratory_sensitivity],
      ["Sensibilidade vibratória E", data.vibration_sensitivity_left],
      ["Sensibilidade térmica D", data.thermal_sensitivity_right || data.thermal_sensitivity],
      ["Sensibilidade térmica E", data.thermal_sensitivity_left],
      ["Observações D", data.monofilament_notes_right || data.monofilament_notes],
      ["Observações E", data.monofilament_notes_left]
    ]],
    ["ITB e IHB", [
      ["ITB direito", formatIndexForPrint(data.itb_right_result, data.itb_right_classification)],
      ["ITB esquerdo", formatIndexForPrint(data.itb_left_result, data.itb_left_classification)],
      ["IHB direito", formatIndexForPrint(data.ihb_right_result, data.ihb_right_classification)],
      ["IHB esquerdo", formatIndexForPrint(data.ihb_left_result, data.ihb_left_classification)]
    ]],
    ["Diagnóstico Ungueal", [
      ["Pe direito", getAnamnesisObjectEntry(data.block_14, "right_foot")],
      ["Pe esquerdo", getAnamnesisObjectEntry(data.block_14, "left_foot")],
      ["Local marcado no pe direito", formatWoundLocationForPrint(getAnamnesisObjectEntry(getAnamnesisObjectEntry(data.block_14, "right_foot"), "wound_location"))],
      ["Local marcado no pe esquerdo", formatWoundLocationForPrint(getAnamnesisObjectEntry(getAnamnesisObjectEntry(data.block_14, "left_foot"), "wound_location"))],
      ["Registros anteriores", data.nail_anatomy || data.pathologies || data.structural_changes || data.podology_diagnosis_notes]
    ]],
    ["Procedimento", [
      ["Itens do procedimento", data.block_15 || data.procedure || data.performed_procedure],
      ["Produtos/curativos utilizados", data.used_products],
      ["Conduta", data.conduct],
      ["Retorno", data.return_date || data.follow_up_date]
    ]],
    ["Evolução por Imagem", [
      ["Observações", data.images_notes]
    ]],
    ["Comparativo de evolução", [
      ["Observação comparativa", data.image_evolution_notes]
    ]]
  );
  const rendered = sections
    .map(([title, fields]) => {
      const items = fields
        .map(([label, value]) => [label, humanizeAnamnesisValue(value)] as const)
        .filter(([, value]) => value);
      if (!items.length) return "";
      return `<section class="clinical-section"><h3>${title}</h3><dl>${items.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl></section>`;
    })
    .filter(Boolean)
    .join("");
  return rendered || "<p>Anamnese registrada sem campos clínicos preenchidos.</p>";
}

function formatIndexForPrint(value: unknown, classification: unknown) {
  const result = humanizeAnamnesisValue(value);
  const label = humanizeAnamnesisValue(classification);
  if (!result && !label) return "";
  return [result, label ? `(${label})` : ""].filter(Boolean).join(" ");
}

function getAnamnesisObjectEntry(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

function formatWoundLocationForPrint(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const location = value as Record<string, unknown>;
  return humanizeAnamnesisValue(location.region_label || location.region_key);
}

function humanizeAnamnesisValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.map(humanizeAnamnesisValue).filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") {
    if ("region_label" in value && typeof value.region_label === "string" && "region_key" in value) return fixClinicalText(value.region_label);
    if ("name" in value && typeof value.name === "string") return fixClinicalText(value.name);
    return Object.entries(value).map(([key, entry]) => `${anamnesisLabel(key)}: ${humanizeAnamnesisValue(entry)}`).join("; ");
  }
  return fixClinicalText(String(value));
}

function anamnesisLabel(key: string) {
  const labels: Record<string, string> = {
    right_foot: "Pe direito",
    left_foot: "Pe esquerdo",
    anatomical_laminar: "Anatomico laminar",
    curvature: "Curvatura",
    pathologies: "Patologias",
    onicocriptosis_grade: "Grau da Onicocriptose",
    structural_changes: "Alteracoes estruturais e distrofias",
    observations: "Observacoes",
    wound_location: "Local de alteração acompanhada",
    foot_side: "Lado",
    region_key: "Chave da regiao",
    region_label: "Regiao",
    plantar_debridement: "Debaste plantar",
    checklist: "Procedimentos",
    diamond_burs_text: "Brocas diamantadas",
    ceramic_burs_text: "Brocas Cerâmica",
    curettage: "Curetagem com cureta",
    laminar_sanding: "Lixamento laminar",
    laminar_sanding_file: "Lixa laminar",
    laminar_sanding_grit: "Gramatura laminar",
    plantar_sanding: "Lixamento plantar",
    plantar_sanding_file: "Lixa plantar",
    plantar_sanding_grit: "Gramatura plantar",
    finishing: "Finalização",
    other_procedures: "Outros procedimentos"
  };
  return labels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fixClinicalText(value: string) {
  return value
    .replace(/\bhalux\b/gi, "hálux")
    .replace(/\bHipertensao\b/g, "Hipertensão")
    .replace(/\bhipertensao\b/g, "hipertensão")
    .replace(/\bhigienizacao\b/gi, "higienização")
    .replace(/\bNao\b/g, "Não")
    .replace(/\bnao\b/g, "não")
    .replace(/\bevolucao\b/gi, "evolução")
    .replace(/\bavaliacao\b/gi, "avaliação")
    .replace(/\bclinico\b/gi, "clínico")
    .replace(/\bregiao\b/gi, "região")
    .replace(/\bpe\b/gi, "pé");
}

function documentHeader(company: Company, title: string) {
  return `
    <header>
      ${company.logoUrl ? `<img src="${company.logoUrl}" alt="" />` : ""}
      <div>
        <h1>${title}</h1>
        <p>${company.displayName}<br>${company.contactPhone} · ${company.contactEmail}<br>${company.document}<br>Data de emissão: ${new Date().toLocaleString("pt-BR")}</p>
      </div>
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

function openPrintDocument(title: string, body: string, company: Company) {
  const printWindow = window.open("", "_blank", "width=980,height=720");
  if (!printWindow) return;
  const primaryColor = company.primaryColor;
  const logoUrl = company.logoUrl || "";
  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #172033; margin: 32px; line-height: 1.45; position: relative; }
          body::before { content: ""; position: fixed; inset: 18% 12%; z-index: -1; opacity: ${logoUrl ? "0.055" : "0"}; background: url("${logoUrl}") center / contain no-repeat; pointer-events: none; }
          header { border-bottom: 3px solid ${primaryColor}; margin-bottom: 24px; padding-bottom: 16px; display: grid; grid-template-columns: ${logoUrl ? "82px 1fr" : "1fr"}; gap: 14px; align-items: center; }
          header img { max-height: 70px; max-width: 78px; display: block; object-fit: contain; }
          h1, h2, h3 { margin-bottom: 8px; }
          h2 { border-bottom: 1px solid #dce5ea; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; }
          th, td { border: 1px solid #dce5ea; padding: 8px; text-align: left; vertical-align: top; }
          .clinical-section { break-inside: avoid; margin-bottom: 16px; }
          .clinical-section dl { display: grid; gap: 8px; margin: 0; }
          .clinical-section div { display: grid; grid-template-columns: 190px 1fr; gap: 10px; border-bottom: 1px solid #eef2f5; padding-bottom: 6px; }
          .clinical-section dt { color: #667085; font-weight: 700; }
          .clinical-section dd { margin: 0; }
          footer { border-top: 1px solid #dce5ea; color: #667085; font-size: 12px; margin-top: 30px; padding-top: 10px; }
          .image-print-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
          .image-print-grid article { border: 1px solid #dce5ea; padding: 12px; break-inside: avoid; }
          .image-print-grid img, .image-placeholder { width: 100%; min-height: 160px; object-fit: cover; background: #f8fafc; display: grid; place-items: center; color: #667085; }
          .print-toolbar-button { min-height: 42px; margin: 0 0 20px; padding: 0 18px; border: 0; border-radius: 999px; color: #fff; background: linear-gradient(135deg, ${primaryColor}, #0e7490); box-shadow: 0 12px 24px rgba(15, 118, 110, 0.2); font-weight: 700; cursor: pointer; }
          .print-toolbar-button:hover { filter: brightness(1.04); }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button class="print-toolbar-button" onclick="window.print()">Imprimir / Salvar PDF</button>
        ${body}
        <footer>Documento gerado pelo ${company.displayName} em ${new Date().toLocaleString("pt-BR")}.</footer>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function BuildingIcon() {
  return <span className="text-icon">B</span>;
}
