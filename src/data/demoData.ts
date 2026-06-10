import type {
  AiReferralReport,
  AnamnesisRecord,
  Attendance,
  AttendanceImage,
  BodyMapEntry,
  Company,
  FinancialTransaction,
  FootSensitivityMap,
  HciPatientConsent,
  HciPatientMatch,
  Patient,
  PatientCompanyLink,
  Profile,
  StockProduct,
  UniqueMedicalRecord
} from "../types";

export const demoCompany: Company = {
  id: "company-podo360-demo",
  name: "clinica-pe-saudavel",
  displayName: "Clinica Pe Saudavel",
  logoUrl: "",
  contactEmail: "contato@podo360.com.br",
  contactPhone: "(11) 93093-8936",
  document: "00.000.000/0001-00",
  planName: "Professional",
  planStatus: "active",
  primaryColor: "#0f766e",
  secondaryColor: "#155e75",
  accentColor: "#f59e0b",
  hciEnabled: true,
  hciConsentValidityDays: 180,
  hciAllowImages: false,
  hciDefaultScope: "history_without_images"
};

export const demoPartnerCompany: Company = {
  id: "company-podo360-partner",
  name: "clinica-integrada-centro",
  displayName: "Clinica Integrada Centro",
  logoUrl: "",
  contactEmail: "contato@integrada.example",
  contactPhone: "(11) 94000-1000",
  document: "11.111.111/0001-11",
  planName: "Professional",
  planStatus: "active",
  primaryColor: "#166534",
  secondaryColor: "#334155",
  accentColor: "#0ea5e9",
  hciEnabled: true,
  hciConsentValidityDays: 90,
  hciAllowImages: true,
  hciDefaultScope: "clinical_summary"
};

export const demoProfiles: Profile[] = [
  { id: "user-1", companyId: demoCompany.id, fullName: "Dra. Marina Costa", email: "marina@podo360.app", role: "company_admin", active: true },
  { id: "user-2", companyId: demoCompany.id, fullName: "Renata Lima", email: "recepcao@podo360.app", role: "reception", active: true },
  { id: "user-3", companyId: demoCompany.id, fullName: "Carlos Nunes", email: "financeiro@podo360.app", role: "financial", active: true },
  { id: "user-4", companyId: null, fullName: "Admin Podo360", email: "admin@podo360.app", role: "super_admin", active: true }
];

export const demoPatients: Patient[] = [
  {
    id: "patient-1",
    companyId: demoCompany.id,
    uniqueMedicalRecordId: "unique-record-1",
    uniqueRecordNumber: "PU-2026-000001",
    fullName: "Ana Paula Santos",
    cpf: "123.456.789-00",
    rg: "12.345.678-9",
    birthDate: "1978-04-12",
    phone: "(11) 99999-1000",
    whatsapp: "(11) 99999-1000",
    email: "ana.santos@email.com",
    address: "Rua das Acacias, 120 - Sao Paulo",
    profession: "Professora",
    notes: "Prefere atendimento no periodo da manha.",
    createdAt: "2026-06-01T09:00:00",
    clinical: {
      chiefComplaint: "Dor recorrente em unha do halux direito.",
      diseaseHistory: "Historico de unha encravada e sensibilidade na regiao lateral.",
      diabetes: false,
      hypertension: true,
      medications: "Losartana",
      allergies: "Dipirona",
      previousSurgeries: "Nao informado",
      vascularProblems: "Sem sinais relatados",
      dermatologicalProblems: "Ressecamento plantar",
      clinicalNotes: "Acompanhar retorno por reincidencia de dor."
    }
  },
  {
    id: "patient-2",
    companyId: demoCompany.id,
    uniqueMedicalRecordId: "unique-record-2",
    uniqueRecordNumber: "PU-2026-000002",
    fullName: "Joao Ricardo Alves",
    cpf: "987.654.321-00",
    birthDate: "1966-09-21",
    phone: "(11) 98888-2000",
    whatsapp: "(11) 98888-2000",
    address: "Av. Brasil, 450 - Osasco",
    profession: "Motorista",
    createdAt: "2026-06-05T14:30:00",
    clinical: {
      chiefComplaint: "Fissuras em calcanhar esquerdo.",
      diseaseHistory: "Diabetes tipo 2 controlada, relata pele seca.",
      diabetes: true,
      hypertension: false,
      medications: "Metformina",
      allergies: "Nao informado",
      previousSurgeries: "Nao informado",
      vascularProblems: "Necessita observacao de perfusao periferica",
      dermatologicalProblems: "Hiperqueratose plantar",
      clinicalNotes: "Orientar avaliacao medica em caso de piora."
    }
  },
  {
    id: "patient-3",
    companyId: demoCompany.id,
    uniqueMedicalRecordId: "unique-record-3",
    uniqueRecordNumber: "PU-2026-000003",
    fullName: "Beatriz Lima Rocha",
    cpf: "456.111.222-33",
    birthDate: "1992-02-10",
    phone: "(11) 97777-3000",
    whatsapp: "(11) 97777-3000",
    address: "Rua Aurora, 88 - Sao Paulo",
    profession: "Designer",
    createdAt: "2026-06-08T10:15:00",
    clinical: {
      chiefComplaint: "Calosidade dolorosa em antepe esquerdo.",
      diseaseHistory: "Uso frequente de sapato social.",
      diabetes: false,
      hypertension: false,
      medications: "Nao informado",
      allergies: "Nao informado",
      previousSurgeries: "Nao informado",
      vascularProblems: "Nao informado",
      dermatologicalProblems: "Calosidade recorrente",
      clinicalNotes: "Avaliar troca de calcado e retorno preventivo."
    }
  }
];

export const demoUniqueMedicalRecords: UniqueMedicalRecord[] = demoPatients.map((patient) => ({
  id: patient.uniqueMedicalRecordId,
  uniqueRecordNumber: patient.uniqueRecordNumber,
  patientUniqueId: `patient-identity-${patient.id}`,
  cpfHash: `hash:${patient.cpf}`,
  normalizedPatientName: patient.fullName.toLowerCase(),
  birthDate: patient.birthDate,
  phoneHash: `hash:${patient.whatsapp}`,
  emailHash: patient.email ? `hash:${patient.email}` : undefined,
  createdAt: patient.createdAt,
  updatedAt: patient.createdAt
}));

export const demoPatientCompanyLinks: PatientCompanyLink[] = demoPatients.map((patient) => ({
  id: `link-${patient.id}-${patient.companyId}`,
  uniqueMedicalRecordId: patient.uniqueMedicalRecordId,
  patientId: patient.id,
  companyId: patient.companyId,
  localPatientId: patient.id,
  firstAttendanceDate: patient.createdAt,
  lastAttendanceDate: patient.createdAt,
  status: "active",
  createdAt: patient.createdAt,
  updatedAt: patient.createdAt
}));

export const demoAttendances: Attendance[] = [
  {
    id: "attendance-1",
    companyId: demoCompany.id,
    patientId: "patient-1",
    uniqueMedicalRecordId: "unique-record-1",
    uniqueRecordNumber: "PU-2026-000001",
    baNumber: "BA-2026-000001",
    professionalId: "user-1",
    appointmentId: "appointment-1",
    scheduledAt: "2026-06-09T09:30:00",
    attendanceDate: "2026-06-09T09:30:00",
    type: "Podologia clinica",
    procedure: "Onicocriptose - orientacao e curativo",
    complaint: "Dor lateral em halux direito",
    clinicalEvaluation: "Sensibilidade local e discreto eritema, sem secrecao evidente.",
    conduct: "Higienizacao, alivio de espicula e curativo protetor.",
    productsUsed: ["Gaze esteril", "Soro fisiologico", "Antisseptico"],
    notes: "Retorno recomendado em 7 dias.",
    recommendedReturn: "2026-06-16",
    status: "completed",
    value: 140
  },
  {
    id: "attendance-2",
    companyId: demoCompany.id,
    patientId: "patient-1",
    uniqueMedicalRecordId: "unique-record-1",
    uniqueRecordNumber: "PU-2026-000001",
    baNumber: "BA-2026-000002",
    professionalId: "user-1",
    appointmentId: "appointment-2",
    scheduledAt: "2026-06-02T10:00:00",
    attendanceDate: "2026-06-02T10:00:00",
    type: "Retorno",
    procedure: "Reavaliacao de unha encravada",
    complaint: "Retorno por dor ao caminhar",
    clinicalEvaluation: "Regiao com melhora parcial.",
    conduct: "Limpeza, orientacoes de calcado e curativo.",
    productsUsed: ["Gaze esteril", "Micropore"],
    notes: "Paciente recorrente no periodo.",
    status: "completed",
    value: 90
  },
  {
    id: "attendance-3",
    companyId: demoCompany.id,
    patientId: "patient-2",
    uniqueMedicalRecordId: "unique-record-2",
    uniqueRecordNumber: "PU-2026-000002",
    baNumber: "BA-2026-000003",
    professionalId: "user-1",
    appointmentId: "appointment-3",
    scheduledAt: "2026-06-10T15:00:00",
    attendanceDate: "2026-06-10T15:00:00",
    type: "Avaliacao",
    procedure: "Avaliacao de fissura plantar",
    complaint: "Fissura dolorosa no calcanhar esquerdo",
    clinicalEvaluation: "Hiperqueratose e fissuras superficiais.",
    conduct: "Desbaste tecnico, hidratacao e orientacao de cuidado domiciliar.",
    productsUsed: ["Creme hidratante", "Lamina descartavel"],
    notes: "Agendado.",
    status: "scheduled",
    value: 160
  }
];

export const demoAnamneses: AnamnesisRecord[] = [
  {
    id: "anamnesis-1",
    companyId: demoCompany.id,
    patientId: "patient-1",
    uniqueMedicalRecordId: "unique-record-1",
    attendanceId: "attendance-1",
    uniqueRecordNumber: "PU-2026-000001",
    baNumber: "BA-2026-000001",
    currentStep: 18,
    isCompleted: true,
    createdBy: "user-1",
    createdAt: "2026-06-09T09:40:00",
    updatedAt: "2026-06-09T10:20:00",
    formData: {
      identification_name: "Ana Paula Santos",
      identification_date: "2026-06-09",
      identification_age: 48,
      identification_profession: "Professora",
      identification_evaluation_type: "1a avaliacao",
      main_complaint: "Dor lateral em halux direito",
      health_history: ["Hipertensao"],
      medications: "Losartana",
      skin_exam: ["Descamacao"],
      edema: "Grau 1 + / ++++",
      vibration_sensitivity: "Presente",
      thermal_sensitivity: "Positivo",
      glycemia_result: "Nao aferida",
      eva_scale: 6,
      podology_diagnosis: ["Onicocriptose / Unha encravada"],
      procedure_notes: "Alivio local, higienizacao e curativo protetor.",
      return_needed: true,
      return_date: "2026-06-16"
    }
  }
];

export const demoFootSensitivityMaps: FootSensitivityMap[] = [
  {
    id: "foot-map-1",
    companyId: demoCompany.id,
    patientId: "patient-1",
    uniqueMedicalRecordId: "unique-record-1",
    attendanceId: "attendance-1",
    uniqueRecordNumber: "PU-2026-000001",
    baNumber: "BA-2026-000001",
    footSide: "right",
    regionKey: "hallux",
    coordinates: { x: 0.2, y: 0.28, z: 0.18 },
    sensitivityStatus: "reduced",
    notes: "Paciente relata dor e sensibilidade diminuida no halux direito.",
    createdBy: "user-1",
    createdAt: "2026-06-09T10:05:00"
  }
];

export const demoAttendanceImages: AttendanceImage[] = [
  {
    id: "image-1",
    companyId: demoCompany.id,
    patientId: "patient-1",
    uniqueMedicalRecordId: "unique-record-1",
    attendanceId: "attendance-1",
    uniqueRecordNumber: "PU-2026-000001",
    baNumber: "BA-2026-000001",
    imageType: "before",
    fileUrl: "supabase://attendance-images/patient-1/attendance-1/before-1.jpg",
    notes: "Estrutura preparada para Supabase Storage.",
    createdBy: "user-1",
    createdAt: "2026-06-09T09:55:00"
  }
];

export const demoHciMatches: HciPatientMatch[] = [
  {
    id: "hci-match-1",
    patientId: "external-patient-1",
    companyId: demoPartnerCompany.id,
    companyName: demoPartnerCompany.displayName,
    uniqueMedicalRecordId: "unique-record-1",
    uniqueRecordNumber: "PU-2026-000001",
    patientName: "Ana Paula Santos",
    birthDate: "1978-04-12",
    matchPriority: "CPF + data de nascimento",
    consentStatus: "authorized",
    accessScope: "history_without_images"
  },
  {
    id: "hci-match-2",
    patientId: "external-patient-2",
    companyId: "company-podo360-north",
    companyName: "Podologia Norte",
    uniqueMedicalRecordId: "unique-record-1",
    uniqueRecordNumber: "PU-2026-000001",
    patientName: "Ana P. Santos",
    birthDate: "1978-04-12",
    matchPriority: "Nome completo + data de nascimento",
    consentStatus: "pending",
    accessScope: "clinical_summary"
  }
];

export const demoHciConsents: HciPatientConsent[] = [
  {
    id: "consent-1",
    uniqueMedicalRecordId: "unique-record-1",
    patientId: "external-patient-1",
    patientCpf: "hash:patient-1-cpf",
    requesterCompanyId: demoCompany.id,
    sourceCompanyId: demoPartnerCompany.id,
    consentStatus: "authorized",
    accessScope: "history_without_images",
    authorizedBy: "patient",
    requestedBy: "user-1",
    requestedAt: "2026-06-01T08:00:00",
    authorizedAt: "2026-06-01T08:20:00",
    expiresAt: "2026-11-28T23:59:59",
    notes: "Consentimento autorizado para historico sem imagens."
  }
];

export const demoIntegratedHistories = [
  {
    patient: {
      ...demoPatients[0],
      id: "external-patient-1",
      companyId: demoPartnerCompany.id,
      uniqueMedicalRecordId: "unique-record-1",
      uniqueRecordNumber: "PU-2026-000001",
      notes: "Registro de outra clinica autorizado via HCI."
    },
    sourceCompany: demoPartnerCompany,
    attendances: [
      {
        ...demoAttendances[1],
        id: "external-attendance-1",
        companyId: demoPartnerCompany.id,
        patientId: "external-patient-1",
        uniqueMedicalRecordId: "unique-record-1",
        uniqueRecordNumber: "PU-2026-000001",
        baNumber: "BA-2026-000044",
        scheduledAt: "2026-05-14T11:00:00",
        attendanceDate: "2026-05-14T11:00:00",
        procedure: "Avaliacao preventiva de halux",
        complaint: "Desconforto ao usar calcado fechado",
        clinicalEvaluation: "Sem secrecao, pele ressecada e sensibilidade preservada.",
        conduct: "Orientacao preventiva, hidratacao e retorno se houver piora."
      }
    ],
    anamneses: [],
    footSensitivityMaps: [],
    reports: [] as AiReferralReport[],
    images: [] as AttendanceImage[]
  }
];

export const demoFinancial: FinancialTransaction[] = [
  { id: "fin-1", companyId: demoCompany.id, patientId: "patient-1", attendanceId: "attendance-1", description: "Atendimento Ana Paula", type: "income", amount: 140, dueDate: "2026-06-09", paidAt: "2026-06-09", paymentMethod: "pix", category: "Atendimento", status: "paid" },
  { id: "fin-2", companyId: demoCompany.id, patientId: "patient-1", attendanceId: "attendance-2", description: "Retorno Ana Paula", type: "income", amount: 90, dueDate: "2026-06-02", paidAt: "2026-06-02", paymentMethod: "cash", category: "Retorno", status: "paid" },
  { id: "fin-3", companyId: demoCompany.id, patientId: "patient-2", attendanceId: "attendance-3", description: "Avaliacao Joao Ricardo", type: "income", amount: 160, dueDate: "2026-06-10", paymentMethod: "credit_card", category: "Avaliacao", status: "pending" },
  { id: "fin-4", companyId: demoCompany.id, description: "Compra de insumos descartaveis", type: "expense", amount: 320, dueDate: "2026-06-06", paidAt: "2026-06-06", paymentMethod: "pix", category: "Estoque", status: "paid" }
];

export const demoStock: StockProduct[] = [
  { id: "stock-1", companyId: demoCompany.id, name: "Gaze esteril", category: "Curativo", internalCode: "CUR-001", currentQuantity: 18, minimumQuantity: 25, unit: "pacote", costValue: 8.5, saleValue: 12, supplier: "MedSul", expiresAt: "2027-02-20" },
  { id: "stock-2", companyId: demoCompany.id, name: "Soro fisiologico 500ml", category: "Higienizacao", internalCode: "HIG-010", currentQuantity: 8, minimumQuantity: 10, unit: "un", costValue: 6, saleValue: 9, supplier: "Saude Mais", expiresAt: "2026-09-10" },
  { id: "stock-3", companyId: demoCompany.id, name: "Lamina descartavel", category: "Instrumental", internalCode: "INS-004", currentQuantity: 60, minimumQuantity: 20, unit: "un", costValue: 1.2, saleValue: 3, supplier: "Podotech", expiresAt: "2028-01-01" }
];

export const demoBodyMaps: BodyMapEntry[] = [
  {
    id: "body-1",
    companyId: demoCompany.id,
    patientId: "patient-1",
    attendanceId: "attendance-1",
    bodyRegion: "Halux",
    bodySide: "right",
    regionKey: "right-foot-hallux",
    coordinates: { x: 72, y: 88, z: 0 },
    dressingType: "Curativo protetor",
    woundDescription: "Sensibilidade lateral em unha do halux direito.",
    procedureDescription: "Alivio local e cobertura com gaze.",
    productsUsed: ["Gaze esteril", "Antisseptico"],
    notes: "Monitorar evolucao em 7 dias.",
    images: [],
    createdBy: "user-1",
    createdAt: "2026-06-09T10:15:00"
  }
];
