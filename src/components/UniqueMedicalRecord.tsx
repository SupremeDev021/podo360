import { CheckCircle2, ClipboardEdit } from "lucide-react";
import type { Attendance, AttendanceImage, Patient, UniqueMedicalRecord } from "../types";
import { ImageEvolutionComparison } from "./ImageEvolutionComparison";

type UniqueMedicalRecordViewProps = {
  patient: Patient;
  uniqueMedicalRecord?: UniqueMedicalRecord;
  attendances: Attendance[];
  attendanceImages: AttendanceImage[];
};

export function UniqueMedicalRecordView({ patient, uniqueMedicalRecord, attendances, attendanceImages }: UniqueMedicalRecordViewProps) {
  return (
    <section className="page-stack">
      <div className="split-grid">
        <div className="data-panel">
          <div className="section-heading">
            <div>
              <h2>Dados do Prontuário de Evolução</h2>
              <p>Identificador unico do paciente no Podo360; dados clinicos seguem separados por clinica.</p>
            </div>
            <ClipboardEdit size={20} />
          </div>
          <dl className="definition-grid">
            <div><dt>Numero do Prontuário de Evolução</dt><dd>{uniqueMedicalRecord?.uniqueRecordNumber ?? patient.uniqueRecordNumber}</dd></div>
            <div><dt>Queixa principal local</dt><dd>{patient.clinical.chiefComplaint}</dd></div>
            <div><dt>Historico local</dt><dd>{patient.clinical.diseaseHistory}</dd></div>
            <div><dt>Diabetes</dt><dd>{patient.clinical.diabetes ? "Sim" : "Nao"}</dd></div>
            <div><dt>Hipertensao</dt><dd>{patient.clinical.hypertension ? "Sim" : "Nao"}</dd></div>
            <div><dt>Medicamentos</dt><dd>{patient.clinical.medications || "Nao informado"}</dd></div>
            <div><dt>Alergias</dt><dd>{patient.clinical.allergies || "Nao informado"}</dd></div>
          </dl>
        </div>

        <div className="data-panel">
          <div className="section-heading">
            <div>
              <h2>Linha do tempo de BAs</h2>
              <p>Atendimentos da clinica atual vinculados ao Prontuário de Evolução.</p>
            </div>
            <CheckCircle2 size={20} />
          </div>
          <UniqueMedicalRecordTimeline attendances={attendances} />
        </div>
      </div>

      <div className="data-panel">
        <ImageEvolutionComparison
          images={attendanceImages}
          attendances={attendances}
          patientId={patient.id}
          uniqueMedicalRecordId={patient.uniqueMedicalRecordId}
        />
      </div>
    </section>
  );
}

export function UniqueMedicalRecordTimeline({ attendances }: { attendances: Attendance[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>BA</th>
            <th>Data</th>
            <th>Procedimento</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {attendances.map((attendance) => (
            <tr key={attendance.id}>
              <td>{attendance.baNumber}</td>
              <td>{new Date(attendance.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              <td>{attendance.procedure}</td>
              <td>{attendance.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
