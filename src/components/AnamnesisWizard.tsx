import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Save, SkipForward, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { AnamnesisFormData, AnamnesisRecord, AnamnesisStepStatus, Patient, StockProduct, UsedProduct } from "../types";

type Field =
  | { name: string; label: string; type: "text" | "date" | "number" | "textarea" }
  | { name: string; label: string; type: "radio" | "checkbox"; options: string[] };

type Module = {
  key: string;
  title: string;
  description: string;
  fields: Field[];
};

type AnamnesisWizardProps = {
  patient: Patient;
  record?: AnamnesisRecord;
  onSave: (record: AnamnesisRecord) => void;
  companyId: string;
  attendanceId: string;
  uniqueMedicalRecordId: string;
  uniqueRecordNumber: string;
  baNumber: string;
  createdBy: string;
  footSensitivitySlot?: ReactNode;
  woundImagesSlot?: ReactNode;
  imageEvolutionSlot?: ReactNode;
  products?: StockProduct[];
};

const modules: Module[] = [
  { key: "identification", title: "Identificacao", description: "Dados basicos da ficha.", fields: [
    { name: "identification_name", label: "Nome", type: "text" },
    { name: "identification_date", label: "Data", type: "date" },
    { name: "identification_age", label: "Idade", type: "number" },
    { name: "identification_profession", label: "Profissao", type: "text" },
    { name: "identification_evaluation_type", label: "Tipo de avaliacao", type: "radio", options: ["1a Avaliacao", "Reavaliacao"] }
  ] },
  { key: "chief_complaint", title: "Queixa principal", description: "Motivo do atendimento.", fields: [
    { name: "main_complaint", label: "Queixa principal", type: "textarea" },
    { name: "main_complaint_notes", label: "Observacoes livres", type: "textarea" }
  ] },
  { key: "medications", title: "Medicamentos em uso", description: "Medicamentos e observacoes.", fields: [
    { name: "medications", label: "Medicamentos em uso", type: "textarea" },
    { name: "medications_notes", label: "Observacoes", type: "textarea" }
  ] },
  { key: "health_history", title: "Historico de saude", description: "Condicoes relatadas.", fields: [
    { name: "health_history", label: "Historico de saude", type: "checkbox", options: ["Diabetes", "AVC", "Saude mental", "Hipertensao", "CA", "Doencas neurodegenerativas", "Tabagismo", "DPOC", "Doencas vasculares", "Outros"] }
  ] },
  { key: "skin_exam", title: "Exame fisico / Pele", description: "Estado da pele.", fields: [
    { name: "skin_exam", label: "Pele", type: "checkbox", options: ["Hidratada", "Anidrose", "Descamacao", "Psoriase", "Hiperhidrose"] }
  ] },
  { key: "changes", title: "Alteracoes", description: "Alteracoes podologicas.", fields: [
    { name: "changes", label: "Alteracoes", type: "checkbox", options: ["Calos com nucleo", "Calosidades", "Verruga plantar"] }
  ] },
  { key: "edema", title: "Edema", description: "Grau de edema.", fields: [
    { name: "edema", label: "Edema", type: "radio", options: ["Grau 1 + / ++++", "Grau 2 ++ / ++++", "Grau 3 +++ / ++++", "Grau 4 ++++ / ++++"] }
  ] },
  { key: "monofilament_3d", title: "Sensibilidade Monofilamento", description: "Mapa tecnico do pe para pontos de monofilamento.", fields: [
    { name: "monofilament_notes", label: "Observacoes de sensibilidade", type: "textarea" }
  ] },
  { key: "vibration_thermal", title: "Sensibilidade vibratoria e termica", description: "Diapasao e temperatura.", fields: [
    { name: "vibration_sensitivity", label: "Sensibilidade vibratoria com Diapasao", type: "radio", options: ["Presente", "Ausente"] },
    { name: "thermal_sensitivity", label: "Sensibilidade termica", type: "radio", options: ["Positivo", "Negativo"] }
  ] },
  { key: "eco_itb", title: "ECO / ITB", description: "Indice tornozelo-braco.", fields: [
    { name: "itb_right_foot", label: "Pe D mmHg", type: "number" },
    { name: "itb_left_foot", label: "Pe E mmHg", type: "number" },
    { name: "itb_right_arm", label: "Braco D mmHg", type: "number" },
    { name: "itb_left_arm", label: "Braco E mmHg", type: "number" },
    { name: "itb_result", label: "Resultado ITB", type: "radio", options: ["1,0 a 1,30 Normal", "0,91 a 0,99 Limitrofe", "0,41 a 0,90 Anormal/Baixo", "Abaixo de 0,40 Severo"] }
  ] },
  { key: "eco_ihb", title: "ECO / IHB", description: "Indice halux-braco.", fields: [
    { name: "ihb_right_hallux", label: "Halux D mmHg", type: "number" },
    { name: "ihb_left_hallux", label: "Halux E mmHg", type: "number" },
    { name: "ihb_right_arm", label: "Braco D mmHg", type: "number" },
    { name: "ihb_left_arm", label: "Braco E mmHg", type: "number" },
    { name: "ihb_result", label: "Resultado IHB", type: "radio", options: ["Maior que 0,70 Normal", "Menor ou igual a 0,70 Alterado", "Menor que 0,30 Grave"] }
  ] },
  { key: "glycemia", title: "Glicemia", description: "Resultado em mg/dL.", fields: [
    { name: "glycemia_result", label: "Resultado em mg/dL", type: "number" },
    { name: "glycemia_context", label: "Contexto", type: "radio", options: ["Em jejum", "Apos alimentacao"] }
  ] },
  { key: "eva", title: "Escala EVA", description: "Dor de 0 a 10.", fields: [
    { name: "eva_scale", label: "Valor EVA", type: "number" },
    { name: "eva_notes", label: "Observacoes", type: "textarea" }
  ] },
  { key: "podology_diagnosis", title: "Diagnostico / avaliacao podologica", description: "Avaliacao podologica sem diagnostico medico definitivo.", fields: [
    { name: "nail_anatomy", label: "Anatomico laminar", type: "checkbox", options: ["Quadrada / Retangular", "Arredondada / Ovalada", "Involuta / Unha em funil", "Curvatura", "Plana", "Normal / fisiologica", "Telha", "Gancho / Uncinada", "Caracol / Em pinca"] },
    { name: "pathologies", label: "Patologias", type: "checkbox", options: ["Onicomicose", "Paroniquia / Unheiro", "Sindrome da unha verde", "Onicocriptose / Unha encravada", "Onicogrifose", "Hematoma subungueal", "Outras"] },
    { name: "structural_changes", label: "Alteracoes estruturais e distrofias", type: "checkbox", options: ["Onicolise", "Coiloniquia", "Linhas de Beau", "Psoriase ungueal", "Paroniquia", "Onicogrifose", "Coloníquia / Unha em colher", "Unhas de Hipocrates / Baqueteamento digital", "Onicosquizia"] },
    { name: "podology_diagnosis_notes", label: "Observacoes", type: "textarea" }
  ] },
  { key: "procedure", title: "Procedimento", description: "Procedimentos, instrumentos e produtos.", fields: [
    { name: "procedure", label: "Procedimento", type: "checkbox", options: ["Debaste plantar", "Realizado", "Nao realizado", "Lixa", "Laminar", "Plantar", "Instrumentos", "Kit diabetico", "Kit nao diabetico", "Cuidados", "Higienizante", "Emoliente", "Creme hidratante", "Finalizador"] },
    { name: "sandpaper", label: "Gramatura de lixa", type: "checkbox", options: ["80g", "180g", "220g", "400g"] },
    { name: "drills", label: "Brocas", type: "checkbox", options: ["Diamantadas", "718g", "720g", "Ceramica", "Azul", "Vermelha", "Preta", "Esferica bolinha", "1014g", "1016g", "1018g"] },
    { name: "procedure_notes", label: "Observacoes do procedimento", type: "textarea" }
  ] },
  { key: "dressing", title: "Curativo", description: "Curativo e local de aplicacao.", fields: [
    { name: "dressing_type", label: "Tipo de curativo", type: "checkbox", options: ["Curativo oclusivo", "Curativo nao oclusivo"] },
    { name: "dressing_location", label: "Local do curativo", type: "text" },
    { name: "dressing_description", label: "Descricao", type: "textarea" },
    { name: "dressing_products", label: "Produtos utilizados", type: "textarea" },
    { name: "dressing_notes", label: "Observacoes", type: "textarea" }
  ] },
  { key: "wound_images", title: "Imagens da ferida", description: "Anexos ficam preparados para armazenamento seguro.", fields: [
    { name: "images_notes", label: "Observacoes sobre imagens antes, durante e depois", type: "textarea" }
  ] },
  { key: "image_evolution", title: "Comparativo de evolucao", description: "Compare imagens por BA, regiao e momento do tratamento.", fields: [
    { name: "image_evolution_notes", label: "Observacao comparativa geral", type: "textarea" }
  ] },
  { key: "return", title: "Retorno", description: "Retorno sugerido.", fields: [
    { name: "return_date", label: "Data sugerida de retorno", type: "date" },
    { name: "return_needed", label: "Necessita retorno?", type: "radio", options: ["Sim", "Nao"] },
    { name: "return_priority", label: "Prioridade do retorno", type: "radio", options: ["Baixa", "Media", "Alta"] },
    { name: "return_notes", label: "Observacoes", type: "textarea" }
  ] },
  { key: "evolution", title: "Evolucao e observacoes finais", description: "Evolucao, orientacoes e fechamento do atendimento.", fields: [
    { name: "evolution_notes", label: "Evolucao e observacoes finais", type: "textarea" },
    { name: "home_care_guidance", label: "Orientacoes domiciliares", type: "textarea" }
  ] }
];

export function AnamnesisWizard({
  patient,
  record,
  onSave,
  companyId,
  attendanceId,
  uniqueMedicalRecordId,
  uniqueRecordNumber,
  baNumber,
  createdBy,
  footSensitivitySlot,
  woundImagesSlot,
  imageEvolutionSlot,
  products = []
}: AnamnesisWizardProps) {
  const [step, setStep] = useState(record?.currentStep ?? 1);
  const [formData, setFormData] = useState<AnamnesisFormData>({
    identification_name: patient.fullName,
    identification_profession: patient.profession,
    ...record?.formData
  });
  const [stepStatuses, setStepStatuses] = useState<Record<string, AnamnesisStepStatus>>(
    () => modules.reduce<Record<string, AnamnesisStepStatus>>((acc, module) => ({ ...acc, [module.key]: record?.stepStatuses?.[module.key] ?? "not_started" }), {})
  );
  const [usedProducts, setUsedProducts] = useState<UsedProduct[]>(() => {
    const saved = record?.formData.used_products;
    return Array.isArray(saved) && saved.length && typeof saved[0] === "object" ? saved as UsedProduct[] : [{ name: "", quantity: 1, unit: "un" }];
  });
  const currentModule = modules[step - 1];
  const progress = useMemo(() => Math.round((step / modules.length) * 100), [step]);

  function moduleHasValue(module: Module) {
    return module.fields.some((field) => {
      const value = formData[field.name];
      return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== "";
    });
  }

  function save(nextStep = step, completed = false, overrideStatuses = stepStatuses) {
    const selectedProducts = usedProducts.filter((item) => item.name.trim());
    onSave({
      id: record?.id ?? `anamnesis-${attendanceId}`,
      companyId,
      patientId: patient.id,
      uniqueMedicalRecordId,
      attendanceId,
      uniqueRecordNumber,
      baNumber,
      formData: { ...formData, dressing_products: selectedProducts.map((item) => item.name), used_products: selectedProducts },
      currentStep: nextStep,
      stepStatuses: overrideStatuses,
      isCompleted: completed,
      createdBy,
      createdAt: record?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextStep = Math.min(step + 1, modules.length);
    const nextStatuses: Record<string, AnamnesisStepStatus> = {
      ...stepStatuses,
      [currentModule.key]: moduleHasValue(currentModule) ? "completed" : "partially_filled"
    };
    setStepStatuses(nextStatuses);
    save(nextStep, step === modules.length, nextStatuses);
    setStep(nextStep);
  }

  function handleSkip() {
    const nextStep = Math.min(modules.length, step + 1);
    const nextStatuses = { ...stepStatuses, [currentModule.key]: "skipped" as const };
    setStepStatuses(nextStatuses);
    save(nextStep, false, nextStatuses);
    setStep(nextStep);
  }

  function updateField(name: string, value: string | number | boolean | string[]) {
    setFormData((current) => ({ ...current, [name]: value }));
    setStepStatuses((current) => ({ ...current, [currentModule.key]: current[currentModule.key] === "completed" ? "completed" : "in_progress" }));
  }

  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, StockProduct[]>();
    products.filter((item) => item.active !== false).forEach((product) => {
      grouped.set(product.category || "Sem categoria", [...(grouped.get(product.category || "Sem categoria") ?? []), product]);
    });
    return Array.from(grouped.entries());
  }, [products]);

  function updateUsedProduct(index: number, patch: Partial<UsedProduct>) {
    setUsedProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    setStepStatuses((current) => ({ ...current, [currentModule.key]: "in_progress" }));
  }

  return (
    <section className="data-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Ficha modular de anamnese</span>
          <h2>{currentModule.title}</h2>
          <p>{currentModule.description}</p>
        </div>
        <strong className="progress-pill">{step}/{modules.length} · {progress}%</strong>
      </div>

      <div className="stepper">
        {modules.map((item, index) => (
          <button className={`${step === index + 1 ? "is-active" : ""} stepper__${stepStatuses[item.key] ?? "not_started"}`} key={item.title} onClick={() => setStep(index + 1)} title={`${item.title}: ${stepStatusLabel(stepStatuses[item.key] ?? "not_started")}`} type="button">
            <small>{index + 1}</small>
            <span>{item.title}</span>
            <em>{stepStatusLabel(stepStatuses[item.key] ?? "not_started")}</em>
          </button>
        ))}
      </div>

      <form className="wizard-form" onSubmit={handleSubmit}>
        {currentModule.fields.map((field) => (
          field.name === "dressing_products" ? (
            <div className="used-products-editor" key={field.name}>
              {usedProducts.map((usedProduct, index) => {
                const registered = products.find((item) => item.name === usedProduct.name);
                const isOther = Boolean(usedProduct.name) && !registered;
                return <div className="used-product-row" key={`${index}-${usedProduct.productId || "new"}`}>
                  <label>Produto<select onChange={(event) => { const selected = products.find((item) => item.id === event.target.value); updateUsedProduct(index, selected ? { productId: selected.id, name: selected.name, category: selected.category, unit: selected.unit, unitPrice: selected.saleValue } : { productId: undefined, name: event.target.value === "__other__" ? " " : "" }); }} value={registered?.id || (isOther ? "__other__" : "")}><option value="">Selecione um produto</option>{productsByCategory.map(([category, items]) => <optgroup key={category} label={category}>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}<option value="__other__">Outro produto</option></select>{isOther && <input onChange={(event) => updateUsedProduct(index, { name: event.target.value })} placeholder="Nome do outro produto" value={usedProduct.name.trimStart()} />}</label>
                  <label>Quantidade<input min="0.001" onChange={(event) => updateUsedProduct(index, { quantity: Number(event.target.value) })} step="0.001" type="number" value={usedProduct.quantity} /></label>
                  <label>Unidade<input onChange={(event) => updateUsedProduct(index, { unit: event.target.value })} value={usedProduct.unit} /></label>
                  <label>Observação<input onChange={(event) => updateUsedProduct(index, { notes: event.target.value })} value={usedProduct.notes || ""} /></label>
                  <button aria-label="Remover produto" className="icon-button" disabled={usedProducts.length === 1} onClick={() => setUsedProducts((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 size={16} /></button>
                </div>;
              })}
              <button className="ghost-action used-products-add" onClick={() => setUsedProducts((current) => [...current, { name: "", quantity: 1, unit: "un" }])} type="button"><Plus size={16} /> Adicionar produto</button>
            </div>
          ) : <FieldRenderer field={field} formData={formData} key={field.name} onChange={updateField} />
        ))}

        {currentModule.key === "monofilament_3d" && footSensitivitySlot}
        {currentModule.key === "wound_images" && woundImagesSlot}
        {currentModule.key === "image_evolution" && imageEvolutionSlot}

        <div className="wizard-actions">
          <button className="ghost-action" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))} type="button">
            <ArrowLeft size={17} /> Voltar
          </button>
          <button className="ghost-action" onClick={() => save(step, false)} type="button">
            <Save size={17} /> Salvar rascunho
          </button>
          <button className="ghost-action" onClick={handleSkip} type="button">
            <SkipForward size={17} /> Pular modulo
          </button>
          <button className="primary-button" type="submit">
            {step === modules.length ? <CheckCircle2 size={17} /> : <ArrowRight size={17} />}
            {step === modules.length ? "Finalizar" : "Avancar"}
          </button>
        </div>
      </form>
    </section>
  );
}

function stepStatusLabel(status: AnamnesisStepStatus) {
  const labels: Record<AnamnesisStepStatus, string> = {
    not_started: "Nao iniciado",
    in_progress: "Em preenchimento",
    partially_filled: "Preenchido parcialmente",
    completed: "Concluido",
    skipped: "Pulado"
  };
  return labels[status];
}

function FieldRenderer({ field, formData, onChange }: { field: Field; formData: AnamnesisFormData; onChange: (name: string, value: string | number | boolean | string[]) => void }) {
  if (field.type === "textarea") {
    return (
      <label>
        {field.label}
        <textarea value={String(formData[field.name] || "")} onChange={(event) => onChange(field.name, event.target.value)} />
      </label>
    );
  }

  if (field.type === "checkbox") {
    const selected = Array.isArray(formData[field.name]) ? formData[field.name] as string[] : [];
    return (
      <fieldset className="option-fieldset">
        <legend>{field.label}</legend>
        <div className="checkbox-grid">
          {field.options.map((option) => (
            <label key={option}>
              <input
                checked={selected.includes(option)}
                onChange={(event) => {
                  const next = event.target.checked ? [...selected, option] : selected.filter((item) => item !== option);
                  onChange(field.name, next);
                }}
                type="checkbox"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "radio") {
    return (
      <fieldset className="option-fieldset">
        <legend>{field.label}</legend>
        <div className="checkbox-grid">
          {field.options.map((option) => (
            <label key={option}>
              <input checked={formData[field.name] === option} onChange={() => onChange(field.name, option)} type="radio" />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <label>
      {field.label}
      <input
        type={field.type}
        value={String(formData[field.name] || "")}
        onChange={(event) => onChange(field.name, field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
      />
    </label>
  );
}
