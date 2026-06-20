import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Save, SkipForward, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { FootRegionSelector3D } from "./FootRegionSelector3D";
import type { FootRegionSelection } from "./FootRegionSelector3D";
import { footRegionDefinitions, withFootSide } from "../data/footRegionMap";
import type { SideAwareFootRegion } from "../data/footRegionMap";
import type { AnamnesisFormData, AnamnesisRecord, AnamnesisStepStatus, FootSide, Patient, StockProduct, UsedProduct } from "../types";

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
  readOnly?: boolean;
  readOnlyMessage?: string;
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
  { key: "vascular_exams", title: "Sensibilidade Monofilamento", description: "Monofilamento, sensibilidade vibratoria e termica sem mapa 3D.", fields: [
    { name: "monofilament_right", label: "Sensibilidade Monofilamento - Pe D", type: "radio", options: ["Presente", "Diminuida", "Ausente"] },
    { name: "monofilament_left", label: "Sensibilidade Monofilamento - Pe E", type: "radio", options: ["Presente", "Diminuida", "Ausente"] },
    { name: "vibration_sensitivity", label: "Sensibilidade vibratoria com Diapasao", type: "radio", options: ["Presente", "Ausente"] },
    { name: "thermal_sensitivity", label: "Sensibilidade termica", type: "radio", options: ["Positivo", "Negativo"] },
    { name: "monofilament_notes", label: "Observacoes de sensibilidade", type: "textarea" }
  ] },
  { key: "itb", title: "ITB", description: "Indice tornozelo-braco com calculo automatico.", fields: [
    { name: "itb_right_foot", label: "Pe D mmHg", type: "number" },
    { name: "itb_left_foot", label: "Pe E mmHg", type: "number" },
    { name: "itb_right_arm", label: "Braco D mmHg", type: "number" },
    { name: "itb_left_arm", label: "Braco E mmHg", type: "number" }
  ] },
  { key: "ihb", title: "IHB", description: "Indice halux-braco com calculo automatico.", fields: [
    { name: "ihb_right_hallux", label: "Halux D mmHg", type: "number" },
    { name: "ihb_left_hallux", label: "Halux E mmHg", type: "number" },
    { name: "ihb_right_arm", label: "Braco D mmHg", type: "number" },
    { name: "ihb_left_arm", label: "Braco E mmHg", type: "number" }
  ] },
  { key: "glycemia", title: "Glicemia", description: "Resultado em mg/dL.", fields: [
    { name: "glycemia_result", label: "Resultado em mg/dL", type: "number" },
    { name: "glycemia_context", label: "Contexto", type: "radio", options: ["Em jejum", "Apos alimentacao"] }
  ] },
  { key: "eva", title: "Escala EVA", description: "Dor de 0 a 10.", fields: [
    { name: "eva_scale", label: "Valor EVA", type: "number" },
    { name: "eva_notes", label: "Observacoes", type: "textarea" }
  ] },
  { key: "podology_diagnosis", title: "Diagnostico ungueal", description: "Alteracoes ungueais separadas por pe e local da ferida.", fields: [
    { name: "nail_anatomy", label: "Anatomico laminar", type: "checkbox", options: ["Quadrada / Retangular", "Arredondada / Ovalada", "Involuta / Unha em funil", "Curvatura", "Plana", "Normal / fisiologica", "Telha", "Gancho / Uncinada", "Caracol / Em pinca"] },
    { name: "pathologies", label: "Patologias", type: "checkbox", options: ["Onicomicose", "Paroniquia / Unheiro", "Sindrome da unha verde", "Onicocriptose / Unha encravada", "Onicogrifose", "Hematoma subungueal", "Outras"] },
    { name: "structural_changes", label: "Alteracoes estruturais e distrofias", type: "checkbox", options: ["Onicolise", "Coiloniquia", "Linhas de Beau", "Psoriase ungueal", "Paroniquia", "Onicogrifose", "Coloníquia / Unha em colher", "Unhas de Hipocrates / Baqueteamento digital", "Onicosquizia"] },
    { name: "podology_diagnosis_notes", label: "Observacoes", type: "textarea" }
  ] },
  { key: "procedure", title: "Procedimento", description: "Procedimentos, instrumentos, cuidados, lixas e brocas.", fields: [
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

const nailGroups = {
  anatomical_laminar: ["Quadrada / Retangular", "Arredondada / Ovalada", "Involuta / Unha em funil"],
  curvature: ["Plana", "Normal / fisiológica", "Telha", "Gancho / Uncinada", "Caracol / Em pinça"],
  pathologies: ["Onicomicose", "Paroníquia / Unheiro", "Síndrome da unha verde", "Onicocriptose / Unha encravada", "Onicogrifose", "Hematoma subungueal", "Outras"],
  structural_changes: ["Onicólise", "Coiloniquia", "Linhas de Beau", "Psoríase ungueal", "Paroníquia", "Onicogrifose", "Coloníquia / Unha em colher", "Unhas de Hipócrates / Baqueteamento digital", "Onicosquizia"]
};

const procedureGroups = {
  plantar_debridement: ["Realizado", "Não realizado"],
  sandpaper: ["Laminar", "Plantar"],
  instruments: ["Kit diabético", "Kit não diabético"],
  care: ["Higienizante", "Emoliente", "Creme hidratante", "Finalizador"],
  sandpaper_grit: ["80g", "180g", "220g", "400g"],
  burs: {
    diamond: ["718g", "720g"],
    ceramic: ["Azul", "Vermelha", "Preta"],
    spherical_ball: ["1014g", "1016g", "1018g"]
  }
};

type FootDiagnosisSide = {
  anatomical_laminar: string[];
  curvature: string[];
  pathologies: string[];
  structural_changes: string[];
  observations: string;
  wound_location: FootRegionSelection | null;
  foot_side?: FootSide;
  region_key?: string;
  region_label?: string;
};

type NailBlockData = {
  selectedFoot?: FootSide;
  right_foot: FootDiagnosisSide;
  left_foot: FootDiagnosisSide;
};

type ProcedureBlockData = {
  plantar_debridement: string;
  sandpaper: string[];
  instruments: string[];
  care: string[];
  sandpaper_grit: string[];
  burs: {
    diamond: string[];
    ceramic: string[];
    spherical_ball: string[];
  };
};

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
  woundImagesSlot,
  imageEvolutionSlot,
  products = [],
  readOnly = false,
  readOnlyMessage = "Não é possível editar atendimento finalizado."
}: AnamnesisWizardProps) {
  const [step, setStep] = useState(record?.currentStep ?? 1);
  const [formData, setFormData] = useState<AnamnesisFormData>({
    identification_name: patient.fullName,
    identification_age: calculateAgeValue(patient.birthDate),
    identification_profession: patient.profession,
    ...record?.formData
  });
  const [stepStatuses, setStepStatuses] = useState<Record<string, AnamnesisStepStatus>>(
    () => modules.reduce<Record<string, AnamnesisStepStatus>>((acc, module) => ({ ...acc, [module.key]: getInitialStepStatus(module.key, record?.stepStatuses) }), {})
  );
  const [usedProducts, setUsedProducts] = useState<UsedProduct[]>(() => {
    const saved = record?.formData.used_products;
    return Array.isArray(saved) && saved.length && typeof saved[0] === "object" ? saved as UsedProduct[] : [{ name: "", quantity: 1, unit: "un" }];
  });
  const currentModule = modules[step - 1];
  const progress = useMemo(() => Math.round((step / modules.length) * 100), [step]);
  const dressingLocationOptions = useMemo(
    () => (["right", "left"] as FootSide[]).flatMap((side) => footRegionDefinitions.map((region) => withFootSide(region, side))),
    []
  );

  function moduleHasValue(module: Module) {
    if (module.key === "podology_diagnosis") return hasNailBlockValue(formData);
    if (module.key === "procedure") return hasProcedureBlockValue(formData);
    return module.fields.some((field) => {
      const value = formData[field.name];
      return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== "";
    });
  }

  function save(nextStep = step, completed = false, overrideStatuses = stepStatuses) {
    if (readOnly) return;
    const selectedProducts = usedProducts.filter((item) => item.name.trim());
    const nextFormData = normalizeAnamnesisFormData({
      ...formData,
      dressing_products: selectedProducts.map((item) => item.name),
      used_products: selectedProducts
    });
    onSave({
      id: record?.id ?? `anamnesis-${attendanceId}`,
      companyId,
      patientId: patient.id,
      uniqueMedicalRecordId,
      attendanceId,
      uniqueRecordNumber,
      baNumber,
      formData: nextFormData,
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
    if (readOnly) return;
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
    if (readOnly) return;
    const nextStep = Math.min(modules.length, step + 1);
    const nextStatuses = { ...stepStatuses, [currentModule.key]: "skipped" as const };
    setStepStatuses(nextStatuses);
    save(nextStep, false, nextStatuses);
    setStep(nextStep);
  }

  function updateField(name: string, value: string | number | boolean | string[]) {
    if (readOnly) return;
    setFormData((current) => ({ ...current, [name]: value }));
    setStepStatuses((current) => ({ ...current, [currentModule.key]: current[currentModule.key] === "completed" ? "completed" : "in_progress" }));
  }

  function updateFields(patch: AnamnesisFormData) {
    if (readOnly) return;
    setFormData((current) => ({ ...current, ...patch }));
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
    if (readOnly) return;
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

      {readOnly && (
        <div className="locked-attendance-banner">
          <strong>Atendimento finalizado</strong>
          <span>{readOnlyMessage}</span>
        </div>
      )}

      <div className="stepper">
        {modules.map((item, index) => (
          <button className={`${step === index + 1 ? "is-active" : ""} stepper__${stepStatuses[item.key] ?? "not_started"}`} key={item.title} onClick={() => setStep(index + 1)} title={`${item.title}: ${stepStatusLabel(stepStatuses[item.key] ?? "not_started")}`} type="button">
            <small>{index + 1}</small>
            <span>{item.title}</span>
            <em>{stepStatusLabel(stepStatuses[item.key] ?? "not_started")}</em>
          </button>
        ))}
      </div>

      <form className={`wizard-form wizard-form--${currentModule.key}`} onSubmit={handleSubmit}>
        {currentModule.key === "podology_diagnosis" && (
          <NailDiagnosisBlock disabled={readOnly} formData={formData} onPatch={updateFields} />
        )}
        {currentModule.key === "procedure" && (
          <ProcedureBlock disabled={readOnly} formData={formData} onPatch={updateFields} />
        )}
        {currentModule.key !== "podology_diagnosis" && currentModule.key !== "procedure" && currentModule.fields.map((field) => (
          field.name === "dressing_products" ? (
            <div className="used-products-editor" key={field.name}>
              {usedProducts.map((usedProduct, index) => {
                const registered = products.find((item) => item.name === usedProduct.name);
                const isOther = Boolean(usedProduct.name) && !registered;
                return <div className="used-product-row" key={`${index}-${usedProduct.productId || "new"}`}>
                  <label>Produto<select disabled={readOnly} onChange={(event) => { const selected = products.find((item) => item.id === event.target.value); updateUsedProduct(index, selected ? { productId: selected.id, name: selected.name, category: selected.category, unit: selected.unit, unitPrice: selected.saleValue } : { productId: undefined, name: event.target.value === "__other__" ? " " : "" }); }} value={registered?.id || (isOther ? "__other__" : "")}><option value="">Selecione um produto</option>{productsByCategory.map(([category, items]) => <optgroup key={category} label={category}>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}<option value="__other__">Outro produto</option></select>{isOther && <input disabled={readOnly} onChange={(event) => updateUsedProduct(index, { name: event.target.value })} placeholder="Nome do outro produto" value={usedProduct.name.trimStart()} />}</label>
                  <label>Quantidade<input disabled={readOnly} min="0.001" onChange={(event) => updateUsedProduct(index, { quantity: Number(event.target.value) })} step="0.001" type="number" value={usedProduct.quantity} /></label>
                  <label>Unidade<input disabled={readOnly} onChange={(event) => updateUsedProduct(index, { unit: event.target.value })} value={usedProduct.unit} /></label>
                  <label>Observação<input onChange={(event) => updateUsedProduct(index, { notes: event.target.value })} value={usedProduct.notes || ""} /></label>
                  <button aria-label="Remover produto" className="icon-button" disabled={readOnly || usedProducts.length === 1} onClick={() => setUsedProducts((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 size={16} /></button>
                </div>;
              })}
              <button className="ghost-action used-products-add" disabled={readOnly} onClick={() => setUsedProducts((current) => [...current, { name: "", quantity: 1, unit: "un" }])} type="button"><Plus size={16} /> Adicionar produto</button>
            </div>
          ) : <FieldRenderer disabled={readOnly} field={field} footRegionOptions={dressingLocationOptions} formData={formData} key={field.name} onChange={updateField} onPatch={updateFields} />
        ))}

        {currentModule.key === "itb" && <IndexResultPanel type="itb" formData={formData} />}
        {currentModule.key === "ihb" && <IndexResultPanel type="ihb" formData={formData} />}
        {currentModule.key === "wound_images" && woundImagesSlot}
        {currentModule.key === "image_evolution" && imageEvolutionSlot}

        <div className="wizard-actions">
          <button className="ghost-action" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))} type="button">
            <ArrowLeft size={17} /> Voltar
          </button>
          <button className="ghost-action" disabled={readOnly} onClick={() => save(step, false)} title={readOnly ? "Não é possível editar atendimento finalizado." : undefined} type="button">
            <Save size={17} /> Salvar rascunho
          </button>
          <button className="ghost-action" disabled={readOnly} onClick={handleSkip} title={readOnly ? "Não é possível editar atendimento finalizado." : undefined} type="button">
            <SkipForward size={17} /> Pular modulo
          </button>
          <button className="primary-button" disabled={readOnly} title={readOnly ? "Não é possível editar atendimento finalizado." : undefined} type="submit">
            {step === modules.length ? <CheckCircle2 size={17} /> : <ArrowRight size={17} />}
            {step === modules.length ? "Finalizar" : "Avancar"}
          </button>
        </div>
      </form>
    </section>
  );
}

function NailDiagnosisBlock({
  disabled,
  formData,
  onPatch
}: {
  disabled: boolean;
  formData: AnamnesisFormData;
  onPatch: (patch: AnamnesisFormData) => void;
}) {
  const [activeFoot, setActiveFoot] = useState<"right_foot" | "left_foot">(() => getNailBlockData(formData).selectedFoot === "left" ? "left_foot" : "right_foot");
  const block = getNailBlockData(formData);
  const current = block[activeFoot];
  const activeSide: FootSide = activeFoot === "right_foot" ? "right" : "left";

  function handleSelectFoot(nextFoot: "right_foot" | "left_foot") {
    setActiveFoot(nextFoot);
    onPatch({
      block_14: {
        ...block,
        selectedFoot: nextFoot === "right_foot" ? "right" : "left"
      } as unknown as Record<string, unknown>
    });
  }

  function patchSide(patch: Partial<FootDiagnosisSide>) {
    const next: NailBlockData = {
      ...block,
      [activeFoot]: {
        ...current,
        ...patch
      }
    };
    onPatch({ block_14: next as unknown as Record<string, unknown> });
  }

  function toggle(group: keyof Pick<FootDiagnosisSide, "anatomical_laminar" | "curvature" | "pathologies" | "structural_changes">, option: string, checked: boolean) {
    const selected = current[group];
    patchSide({ [group]: checked ? [...selected, option] : selected.filter((item) => item !== option) });
  }

  function selectWoundLocation(selection: FootRegionSelection) {
    const footKey: "right_foot" | "left_foot" = selection.foot_side === "right" ? "right_foot" : "left_foot";
    const next: NailBlockData = {
      ...block,
      selectedFoot: selection.foot_side,
      [footKey]: {
        ...block[footKey],
        wound_location: selection,
        foot_side: selection.foot_side,
        region_key: selection.region_key,
        region_label: selection.region_label
      }
    };
    onPatch({ block_14: next as unknown as Record<string, unknown> });
  }

  return (
    <div className="clinical-block">
      <div className="foot-tabs" role="tablist" aria-label="Selecionar pe">
        <button className={activeFoot === "right_foot" ? "is-active" : ""} onClick={() => handleSelectFoot("right_foot")} type="button">Pé Direito</button>
        <button className={activeFoot === "left_foot" ? "is-active" : ""} onClick={() => handleSelectFoot("left_foot")} type="button">Pé Esquerdo</button>
      </div>

      <div className="nail-block-grid">
        <CheckboxGroup disabled={disabled} label="Anatômico laminar" options={nailGroups.anatomical_laminar} selected={current.anatomical_laminar} onToggle={(option, checked) => toggle("anatomical_laminar", option, checked)} />
        <CheckboxGroup disabled={disabled} label="Curvatura" options={nailGroups.curvature} selected={current.curvature} onToggle={(option, checked) => toggle("curvature", option, checked)} />
        <CheckboxGroup disabled={disabled} label="Patologias" options={nailGroups.pathologies} selected={current.pathologies} onToggle={(option, checked) => toggle("pathologies", option, checked)} />
        <CheckboxGroup disabled={disabled} label="Alterações estruturais e distrofias" options={nailGroups.structural_changes} selected={current.structural_changes} onToggle={(option, checked) => toggle("structural_changes", option, checked)} />
      </div>

      <label>
        Observações
        <textarea disabled={disabled} value={current.observations} onChange={(event) => patchSide({ observations: event.target.value })} />
      </label>

      <FootRegionSelector3D
        disabled={disabled}
        footSide={activeSide}
        value={current.wound_location ?? null}
        onChange={selectWoundLocation}
        title="Local da ferida / alteração acompanhada"
        helperText="Marque no pé 3D a região acompanhada neste diagnóstico ungueal. O fallback por seleção continua disponível."
      />
    </div>
  );
}

function ProcedureBlock({
  disabled,
  formData,
  onPatch
}: {
  disabled: boolean;
  formData: AnamnesisFormData;
  onPatch: (patch: AnamnesisFormData) => void;
}) {
  const block = getProcedureBlockData(formData);

  function patch(next: ProcedureBlockData) {
    onPatch({ block_15: next as unknown as Record<string, unknown> });
  }

  function toggleArray(group: keyof Pick<ProcedureBlockData, "sandpaper" | "instruments" | "care" | "sandpaper_grit">, option: string, checked: boolean) {
    const selected = block[group];
    patch({ ...block, [group]: checked ? [...selected, option] : selected.filter((item) => item !== option) });
  }

  function toggleBur(group: keyof ProcedureBlockData["burs"], option: string, checked: boolean) {
    const selected = block.burs[group];
    patch({
      ...block,
      burs: {
        ...block.burs,
        [group]: checked ? [...selected, option] : selected.filter((item) => item !== option)
      }
    });
  }

  return (
    <div className="clinical-block procedure-block">
      <RadioGroup disabled={disabled} label="Debaste plantar" options={procedureGroups.plantar_debridement} selected={block.plantar_debridement} onChange={(value) => patch({ ...block, plantar_debridement: value })} />
      <CheckboxGroup disabled={disabled} label="Lixa" options={procedureGroups.sandpaper} selected={block.sandpaper} onToggle={(option, checked) => toggleArray("sandpaper", option, checked)} />
      <CheckboxGroup disabled={disabled} label="Instrumentos" options={procedureGroups.instruments} selected={block.instruments} onToggle={(option, checked) => toggleArray("instruments", option, checked)} />
      <CheckboxGroup disabled={disabled} label="Cuidados" options={procedureGroups.care} selected={block.care} onToggle={(option, checked) => toggleArray("care", option, checked)} />
      <CheckboxGroup disabled={disabled} label="Gramatura de lixa" options={procedureGroups.sandpaper_grit} selected={block.sandpaper_grit} onToggle={(option, checked) => toggleArray("sandpaper_grit", option, checked)} />
      <fieldset className="option-fieldset clinical-subgroups">
        <legend>Brocas</legend>
        <CheckboxGroup disabled={disabled} label="Diamantadas" options={procedureGroups.burs.diamond} selected={block.burs.diamond} onToggle={(option, checked) => toggleBur("diamond", option, checked)} />
        <CheckboxGroup disabled={disabled} label="Cerâmica" options={procedureGroups.burs.ceramic} selected={block.burs.ceramic} onToggle={(option, checked) => toggleBur("ceramic", option, checked)} />
        <CheckboxGroup disabled={disabled} label="Esférica bolinha" options={procedureGroups.burs.spherical_ball} selected={block.burs.spherical_ball} onToggle={(option, checked) => toggleBur("spherical_ball", option, checked)} />
      </fieldset>
    </div>
  );
}

function CheckboxGroup({ disabled, label, options, selected, onToggle }: { disabled: boolean; label: string; options: string[]; selected: string[]; onToggle: (option: string, checked: boolean) => void }) {
  return (
    <fieldset className="option-fieldset">
      <legend>{label}</legend>
      <div className="checkbox-grid">
        {options.map((option) => (
          <label key={option}>
            <input checked={selected.includes(option)} disabled={disabled} onChange={(event) => onToggle(option, event.target.checked)} type="checkbox" />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RadioGroup({ disabled, label, options, selected, onChange }: { disabled: boolean; label: string; options: string[]; selected: string; onChange: (option: string) => void }) {
  return (
    <fieldset className="option-fieldset">
      <legend>{label}</legend>
      <div className="checkbox-grid">
        {options.map((option) => (
          <label key={option}>
            <input checked={selected === option} disabled={disabled} onChange={() => onChange(option)} type="radio" />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function IndexResultPanel({ type, formData }: { type: "itb" | "ihb"; formData: AnamnesisFormData }) {
  const result = type === "itb" ? calculateItb(formData) : calculateIhb(formData);
  const label = type.toUpperCase();

  return (
    <div className="index-result-panel">
      <strong>Resultado {label}</strong>
      {!result.right && !result.left ? (
        <p>Preencha os valores para calcular.</p>
      ) : (
        <div className="index-result-grid">
          <IndexResultCard
            classification={result.right?.classification}
            label={`${label} Direito`}
            value={result.right?.value}
          />
          <IndexResultCard
            classification={result.left?.classification}
            label={`${label} Esquerdo`}
            value={result.left?.value}
          />
        </div>
      )}
    </div>
  );
}

function IndexResultCard({ classification, label, value }: { classification?: string; label: string; value?: string }) {
  const tone = getIndexResultTone(classification);
  return (
    <div className={`index-result-card index-result-card--${tone}`}>
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
      <small className={`index-result-badge index-result-badge--${tone}`}>
        {classification ?? "Preencha os valores"}
      </small>
    </div>
  );
}

function getIndexResultTone(classification?: string) {
  if (!classification) return "empty";
  const normalized = classification.toLowerCase();
  if (normalized.includes("lim")) return "warning";
  if (classification === "Normal") return "normal";
  if (classification === "LimÃ­trofe" || classification === "Alterado" || classification === "Anormal / Alto") return "warning";
  if (classification === "Severo / Grave" || classification === "Grave") return "severe";
  return "danger";
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

function FieldRenderer({
  field,
  footRegionOptions,
  formData,
  onChange,
  onPatch,
  disabled = false
}: {
  field: Field;
  footRegionOptions: SideAwareFootRegion[];
  formData: AnamnesisFormData;
  onChange: (name: string, value: string | number | boolean | string[]) => void;
  onPatch: (patch: AnamnesisFormData) => void;
  disabled?: boolean;
}) {
  if (field.name === "dressing_location") {
    return <DressingLocationField disabled={disabled} field={field} footRegionOptions={footRegionOptions} formData={formData} onPatch={onPatch} />;
  }

  if (field.type === "textarea") {
    return (
      <label>
        {field.label}
        <textarea disabled={disabled} value={String(formData[field.name] || "")} onChange={(event) => onChange(field.name, event.target.value)} />
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
                disabled={disabled}
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
              <input checked={formData[field.name] === option} disabled={disabled} onChange={() => onChange(field.name, option)} type="radio" />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const isCompactIndexField = field.type === "number" && /^(itb|ihb)_/.test(field.name);

  return (
    <label className={isCompactIndexField ? "index-number-field" : undefined}>
      {field.label}
      <input
        type={field.type}
        disabled={disabled}
        value={String(formData[field.name] || "")}
        onChange={(event) => onChange(field.name, field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
      />
    </label>
  );
}

function DressingLocationField({
  disabled = false,
  field,
  footRegionOptions,
  formData,
  onPatch
}: {
  disabled?: boolean;
  field: Field;
  footRegionOptions: SideAwareFootRegion[];
  formData: AnamnesisFormData;
  onPatch: (patch: AnamnesisFormData) => void;
}) {
  const currentText = getTextValue(formData.dressing_location);
  const savedRegionKey = getTextValue(formData.dressing_location_region_key);
  const selectedRegionKey = savedRegionKey || (footRegionOptions.some((region) => region.regionKey === currentText) ? currentText : "");
  const selectedRegion = footRegionOptions.find((region) => region.regionKey === selectedRegionKey);
  const legacyText = !selectedRegion && currentText ? currentText : getTextValue(formData.dressing_location_legacy_text);

  function handleRegionChange(regionKey: string) {
    const region = footRegionOptions.find((item) => item.regionKey === regionKey);
    if (!region) {
      onPatch({
        dressing_location: "",
        dressing_location_label: "",
        dressing_location_region_key: "",
        dressing_location_foot_side: ""
      });
      return;
    }

    onPatch({
      dressing_location: region.displayLabel,
      dressing_location_label: region.displayLabel,
      dressing_location_region_key: region.regionKey,
      dressing_location_foot_side: region.regionKey.startsWith("right_") ? "right" : "left",
      ...(legacyText && !getTextValue(formData.dressing_location_legacy_text) ? { dressing_location_legacy_text: legacyText } : {})
    });
  }

  return (
    <label>
      {field.label}
      <select disabled={disabled} value={selectedRegion?.regionKey ?? ""} onChange={(event) => handleRegionChange(event.target.value)}>
        <option value="">Selecione a regiao do pe</option>
        {footRegionOptions.map((region) => (
          <option key={region.regionKey} value={region.regionKey}>{region.clinicalGroup} - {region.displayLabel}</option>
        ))}
      </select>
      {selectedRegion && <small className="field-help">Selecionado: {selectedRegion.displayLabel} ({selectedRegion.sideLabel})</small>}
      {legacyText && <small className="field-help">Local informado anteriormente: {legacyText}</small>}
    </label>
  );
}

function getTextValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getInitialStepStatus(key: string, statuses?: Record<string, AnamnesisStepStatus>) {
  if (!statuses) return "not_started";
  if (statuses[key]) return statuses[key];
  if (key === "vascular_exams") return statuses.vascular_exams ?? statuses.monofilament_3d ?? statuses.vibration_thermal ?? "not_started";
  if (key === "itb") return statuses.eco_itb ?? "not_started";
  if (key === "ihb") return statuses.eco_ihb ?? "not_started";
  return "not_started";
}

function normalizeAnamnesisFormData(data: AnamnesisFormData): AnamnesisFormData {
  const itb = calculateItb(data);
  const ihb = calculateIhb(data);
  return {
    ...data,
    block_14: getNailBlockData(data) as unknown as Record<string, unknown>,
    block_15: getProcedureBlockData(data) as unknown as Record<string, unknown>,
    itb_right_result: itb.right?.value ?? "",
    itb_right_classification: itb.right?.classification ?? "",
    itb_left_result: itb.left?.value ?? "",
    itb_left_classification: itb.left?.classification ?? "",
    itb_result: itb.generalClassification,
    ihb_right_result: ihb.right?.value ?? "",
    ihb_right_classification: ihb.right?.classification ?? "",
    ihb_left_result: ihb.left?.value ?? "",
    ihb_left_classification: ihb.left?.classification ?? "",
    ihb_result: ihb.generalClassification
  };
}

function hasNailBlockValue(data: AnamnesisFormData) {
  const block = getNailBlockData(data);
  return [block.right_foot, block.left_foot].some((foot) =>
    foot.anatomical_laminar.length ||
    foot.curvature.length ||
    foot.pathologies.length ||
    foot.structural_changes.length ||
    foot.observations ||
    foot.region_key ||
    foot.wound_location?.region_key
  );
}

function hasProcedureBlockValue(data: AnamnesisFormData) {
  const block = getProcedureBlockData(data);
  return Boolean(
    block.plantar_debridement ||
    block.sandpaper.length ||
    block.instruments.length ||
    block.care.length ||
    block.sandpaper_grit.length ||
    block.burs.diamond.length ||
    block.burs.ceramic.length ||
    block.burs.spherical_ball.length
  );
}

function getNailBlockData(data: AnamnesisFormData): NailBlockData {
  const block = getObjectValue(data.block_14);
  let rightFoot = getFootDiagnosisSide(getObjectValue(block.right_foot), "right", data);
  let leftFoot = getFootDiagnosisSide(getObjectValue(block.left_foot), "left", data);
  const legacyTopLocation = getWoundLocationSelection(block.wound_location);
  if (legacyTopLocation?.foot_side === "right" && !rightFoot.wound_location) {
    rightFoot = { ...rightFoot, wound_location: legacyTopLocation, foot_side: "right", region_key: legacyTopLocation.region_key, region_label: legacyTopLocation.region_label };
  }
  if (legacyTopLocation?.foot_side === "left" && !leftFoot.wound_location) {
    leftFoot = { ...leftFoot, wound_location: legacyTopLocation, foot_side: "left", region_key: legacyTopLocation.region_key, region_label: legacyTopLocation.region_label };
  }
  const selectedFoot = getTextValue(block.selectedFoot);
  return {
    selectedFoot: selectedFoot === "right" || selectedFoot === "left" ? selectedFoot : legacyTopLocation?.foot_side,
    right_foot: rightFoot,
    left_foot: leftFoot
  };
}

function getFootDiagnosisSide(value: Record<string, unknown>, side: FootSide, data: AnamnesisFormData): FootDiagnosisSide {
  const useLegacy = side === "right";
  return {
    anatomical_laminar: getStringArray(value.anatomical_laminar, useLegacy ? getStringArray(data.nail_anatomy).filter((item) => nailGroups.anatomical_laminar.includes(item)) : []),
    curvature: getStringArray(value.curvature, useLegacy ? getStringArray(data.nail_anatomy).filter((item) => nailGroups.curvature.includes(item)) : []),
    pathologies: getStringArray(value.pathologies, useLegacy ? getStringArray(data.pathologies) : []),
    structural_changes: getStringArray(value.structural_changes, useLegacy ? getStringArray(data.structural_changes) : []),
    observations: getTextValue(value.observations) || (useLegacy ? getTextValue(data.podology_diagnosis_notes) : ""),
    wound_location: getWoundLocationSelection(value.wound_location, side, getTextValue(value.region_key), getTextValue(value.region_label)) ?? null,
    foot_side: side,
    region_key: getTextValue(value.region_key),
    region_label: getTextValue(value.region_label)
  };
}

function getWoundLocationSelection(value: unknown, fallbackSide?: FootSide, fallbackRegionKey?: string, fallbackRegionLabel?: string): FootRegionSelection | undefined {
  const current = getObjectValue(value);
  const footSide = getTextValue(current.foot_side) as FootSide;
  const regionKey = getTextValue(current.region_key);
  const regionLabel = getTextValue(current.region_label);
  if ((footSide === "right" || footSide === "left") && regionKey && regionLabel) {
    const coordinates = getObjectValue(current.coordinates);
    const x = Number(coordinates.x);
    const y = Number(coordinates.y);
    const z = Number(coordinates.z);
    return {
      foot_side: footSide,
      region_key: regionKey,
      region_label: regionLabel,
      mesh_name: getTextValue(current.mesh_name) || undefined,
      coordinates: Number.isFinite(x) && Number.isFinite(y) ? { x, y, z: Number.isFinite(z) ? z : 0 } : undefined
    };
  }

  if (!fallbackSide || !fallbackRegionKey || !fallbackRegionLabel) return undefined;
  return {
    foot_side: fallbackSide,
    region_key: fallbackRegionKey,
    region_label: fallbackRegionLabel
  };
}

function getProcedureBlockData(data: AnamnesisFormData): ProcedureBlockData {
  const block = getObjectValue(data.block_15);
  const burs = getObjectValue(block.burs);
  const legacyProcedure = getStringArray(data.procedure);
  const legacyDrills = getStringArray(data.drills);
  return {
    plantar_debridement: getTextValue(block.plantar_debridement) || legacyProcedure.find((item) => ["Realizado", "Nao realizado", "Não realizado"].includes(item)) || "",
    sandpaper: getStringArray(block.sandpaper, legacyProcedure.filter((item) => procedureGroups.sandpaper.includes(item))),
    instruments: getStringArray(block.instruments, legacyProcedure.filter((item) => ["Kit diabetico", "Kit diabético", "Kit nao diabetico", "Kit não diabético"].includes(item)).map(normalizeProcedureOption)),
    care: getStringArray(block.care, legacyProcedure.filter((item) => procedureGroups.care.includes(item))),
    sandpaper_grit: getStringArray(block.sandpaper_grit, getStringArray(data.sandpaper)),
    burs: {
      diamond: getStringArray(getObjectValue(burs).diamond, legacyDrills.filter((item) => procedureGroups.burs.diamond.includes(item))),
      ceramic: getStringArray(getObjectValue(burs).ceramic, legacyDrills.filter((item) => procedureGroups.burs.ceramic.includes(item))),
      spherical_ball: getStringArray(getObjectValue(burs).spherical_ball, legacyDrills.filter((item) => procedureGroups.burs.spherical_ball.includes(item)))
    }
  };
}

function normalizeProcedureOption(value: string) {
  if (value === "Kit diabetico") return "Kit diabético";
  if (value === "Kit nao diabetico") return "Kit não diabético";
  return value;
}

function getObjectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

function toPressure(value: unknown) {
  const number = typeof value === "number" ? value : Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function calculateItb(data: AnamnesisFormData) {
  const maxArm = Math.max(toPressure(data.itb_right_arm) ?? 0, toPressure(data.itb_left_arm) ?? 0);
  const right = calculateIndexResult(toPressure(data.itb_right_foot), maxArm, classifyItb);
  const left = calculateIndexResult(toPressure(data.itb_left_foot), maxArm, classifyItb);
  return { right, left, generalClassification: lowestClassification(right, left) };
}

function calculateIhb(data: AnamnesisFormData) {
  const maxArm = Math.max(toPressure(data.ihb_right_arm) ?? 0, toPressure(data.ihb_left_arm) ?? 0);
  const right = calculateIndexResult(toPressure(data.ihb_right_hallux), maxArm, classifyIhb);
  const left = calculateIndexResult(toPressure(data.ihb_left_hallux), maxArm, classifyIhb);
  return { right, left, generalClassification: lowestClassification(right, left) };
}

function calculateIndexResult(pressure: number | undefined, maxArm: number, classify: (value: number) => string) {
  if (!pressure || !maxArm) return undefined;
  const value = Number((pressure / maxArm).toFixed(2));
  return { value: value.toFixed(2), classification: classify(value), numericValue: value };
}

function classifyItb(value: number) {
  if (value > 1.3) return "Anormal / Alto";
  if (value >= 1) return "Normal";
  if (value >= 0.91) return "Limítrofe";
  if (value >= 0.41) return "Anormal / Baixo";
  return "Severo / Grave";
}

function classifyIhb(value: number) {
  if (value < 0.3) return "Grave";
  if (value <= 0.7) return "Alterado";
  return "Normal";
}

function lowestClassification(
  right?: { classification: string; numericValue: number },
  left?: { classification: string; numericValue: number }
) {
  const values = [right, left].filter(Boolean) as Array<{ classification: string; numericValue: number }>;
  if (!values.length) return "";
  return values.sort((a, b) => a.numericValue - b.numericValue)[0].classification;
}

function calculateAgeValue(birthDate?: string) {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : "";
}
