import type { SupabaseClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";

const runIdPattern = /^TESTE_CLINICO_FINAL_SEGURO_[0-9]{8}_[0-9]{6}_[0-9a-f]{8}$/;

export type CleanupReport = {
  runId: string;
  patientIds: string[];
  attendanceIds: string[];
  storagePaths: string[];
  rpcResult: Record<string, number>;
};

export async function cleanupClinicalTestData(client: SupabaseClient, runId: string): Promise<CleanupReport> {
  if (!runIdPattern.test(runId)) throw new Error("invalid_safe_test_run_id");

  const { data: patients, error: patientLookupError } = await client
    .from("patients")
    .select("id")
    .like("full_name", `${runId}%`);
  expect(patientLookupError, "cleanup: consulta de pacientes").toBeNull();
  const patientIds = (patients ?? []).map((row) => row.id);

  const { data: userData, error: userError } = await client.auth.getUser();
  expect(userError, "cleanup: usuario autenticado").toBeNull();
  const { data: markedAttendances, error: markedAttendanceError } = await client
    .from("attendances")
    .select("id,patient_id")
    .eq("opened_by", userData.user!.id)
    .like("initial_notes", `${runId}%`);
  expect(markedAttendanceError, "cleanup: consulta de BAs marcados").toBeNull();

  const attendanceIds: string[] = (markedAttendances ?? []).map((row) => row.id);
  const storagePaths: string[] = [];
  if (patientIds.length) {
    const { data: attendances, error: attendanceLookupError } = await client
      .from("attendances")
      .select("id")
      .in("patient_id", patientIds);
    expect(attendanceLookupError, "cleanup: consulta de atendimentos").toBeNull();
    attendanceIds.push(...(attendances ?? []).map((row) => row.id).filter((id) => !attendanceIds.includes(id)));

    const { data: images, error: imageLookupError } = await client
      .from("attendance_images")
      .select("file_url")
      .in("patient_id", patientIds);
    expect(imageLookupError, "cleanup: consulta de imagens").toBeNull();
    storagePaths.push(...(images ?? [])
      .map((row) => row.file_url)
      .filter((path): path is string => Boolean(path && !/^(https?:|data:|blob:)/i.test(path))));
  }

  if (storagePaths.length) {
    const { data: removed, error: storageError } = await client.storage.from("clinical-images").remove(storagePaths);
    expect(storageError, "cleanup: remocao dos objetos clinicos").toBeNull();
    expect(removed?.length, "cleanup: todos os objetos devem ser removidos").toBe(storagePaths.length);
  }

  if (attendanceIds.length) {
    const { data: deletedAttendances, error: attendanceDeleteError } = await client
      .from("attendances")
      .delete()
      .in("id", attendanceIds)
      .select("id");
    expect(attendanceDeleteError, "cleanup: remocao exata dos BAs marcados").toBeNull();
    expect(deletedAttendances?.length, "cleanup: todos os BAs marcados devem ser removidos").toBe(attendanceIds.length);
  }

  const { data: rpcResult, error: cleanupError } = await client.rpc("cleanup_safe_clinical_test_run", {
    test_run_id: runId
  });
  expect(cleanupError, "cleanup: RPC restrita").toBeNull();

  const tableChecks = [
    client.from("patients").select("id", { count: "exact", head: true }).like("full_name", `${runId}%`),
    client.from("attendances").select("id", { count: "exact", head: true }).eq("opened_by", userData.user!.id).like("initial_notes", `${runId}%`),
    patientIds.length
      ? client.from("patient_company_links").select("id", { count: "exact", head: true }).in("patient_id", patientIds)
      : Promise.resolve({ count: 0, error: null }),
    patientIds.length
      ? client.from("attendances").select("id", { count: "exact", head: true }).in("patient_id", patientIds)
      : Promise.resolve({ count: 0, error: null }),
    patientIds.length
      ? client.from("anamnesis_records").select("id", { count: "exact", head: true }).in("patient_id", patientIds)
      : Promise.resolve({ count: 0, error: null }),
    patientIds.length
      ? client.from("attendance_images").select("id", { count: "exact", head: true }).in("patient_id", patientIds)
      : Promise.resolve({ count: 0, error: null }),
    attendanceIds.length
      ? client.from("attendance_audit_logs").select("id", { count: "exact", head: true }).in("attendance_id", attendanceIds)
      : Promise.resolve({ count: 0, error: null })
  ];

  for (const result of await Promise.all(tableChecks)) {
    expect(result.error, "cleanup: verificacao pos-limpeza").toBeNull();
    expect(result.count, "cleanup: nao pode restar registro da rodada").toBe(0);
  }

  for (const path of storagePaths) {
    const folder = path.slice(0, path.lastIndexOf("/"));
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    const { data, error } = await client.storage.from("clinical-images").list(folder, { search: fileName });
    expect(error, "cleanup: conferencia do Storage").toBeNull();
    expect(data?.some((item) => item.name === fileName), `cleanup: objeto remanescente ${path}`).toBe(false);
  }

  return {
    runId,
    patientIds,
    attendanceIds,
    storagePaths,
    rpcResult: (rpcResult ?? {}) as Record<string, number>
  };
}
