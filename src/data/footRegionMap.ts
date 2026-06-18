import type { FootSide } from "../types";

export type FootCoordinate = [number, number, number];

export type FootRegionDefinition = {
  baseKey: string;
  label: string;
  clinicalGroup: string;
  position: FootCoordinate;
  zoneScale: FootCoordinate;
};

export type SideAwareFootRegion = FootRegionDefinition & {
  regionKey: string;
  pointKey: string;
  sideLabel: "D" | "E";
  displayLabel: string;
};

// Calibrated in Blender against podo360-foot-segmented.glb, which is a single
// textured mesh with a local bounding box of roughly x/y/z -0.8..0.8. These
// definitions mirror the invisible named click-zone meshes exported into
// podo360-foot-clickable.glb.
export const footRegionDefinitions: FootRegionDefinition[] = [
  { baseKey: "hallux", label: "Hálux", clinicalGroup: "Dedos", position: [-0.78, -0.66, -0.74], zoneScale: [0.28, 0.18, 0.16] },
  { baseKey: "second_toe", label: "2º dedo", clinicalGroup: "Dedos", position: [-0.5, -0.72, -0.73], zoneScale: [0.14, 0.12, 0.12] },
  { baseKey: "third_toe", label: "3º dedo", clinicalGroup: "Dedos", position: [-0.31, -0.7, -0.72], zoneScale: [0.14, 0.12, 0.12] },
  { baseKey: "fourth_toe", label: "4º dedo", clinicalGroup: "Dedos", position: [-0.12, -0.65, -0.69], zoneScale: [0.13, 0.11, 0.12] },
  { baseKey: "fifth_toe", label: "5º dedo", clinicalGroup: "Dedos", position: [0.05, -0.52, -0.64], zoneScale: [0.12, 0.1, 0.11] },
  { baseKey: "hallux_nail", label: "Unha do hálux", clinicalGroup: "Unhas", position: [-0.7, -0.58, -0.82], zoneScale: [0.1, 0.08, 0.05] },
  { baseKey: "second_toe_nail", label: "Unha do 2º dedo", clinicalGroup: "Unhas", position: [-0.5, -0.63, -0.81], zoneScale: [0.09, 0.07, 0.05] },
  { baseKey: "third_toe_nail", label: "Unha do 3º dedo", clinicalGroup: "Unhas", position: [-0.31, -0.62, -0.8], zoneScale: [0.09, 0.07, 0.05] },
  { baseKey: "fourth_toe_nail", label: "Unha do 4º dedo", clinicalGroup: "Unhas", position: [-0.12, -0.57, -0.76], zoneScale: [0.08, 0.07, 0.05] },
  { baseKey: "fifth_toe_nail", label: "Unha do 5º dedo", clinicalGroup: "Unhas", position: [0.05, -0.46, -0.7], zoneScale: [0.07, 0.06, 0.05] },
  { baseKey: "first_metatarsal_head", label: "Cabeça do 1º metatarso", clinicalGroup: "Planta do pé", position: [-0.58, -0.4, -0.3], zoneScale: [0.16, 0.14, 0.14] },
  { baseKey: "second_metatarsal_head", label: "Cabeça do 2º metatarso", clinicalGroup: "Planta do pé", position: [-0.42, -0.4, -0.31], zoneScale: [0.14, 0.13, 0.14] },
  { baseKey: "third_metatarsal_head", label: "Cabeça do 3º metatarso", clinicalGroup: "Planta do pé", position: [-0.26, -0.38, -0.31], zoneScale: [0.14, 0.13, 0.14] },
  { baseKey: "fourth_metatarsal_head", label: "Cabeça do 4º metatarso", clinicalGroup: "Planta do pé", position: [-0.1, -0.34, -0.31], zoneScale: [0.14, 0.13, 0.14] },
  { baseKey: "fifth_metatarsal_head", label: "Cabeça do 5º metatarso", clinicalGroup: "Planta do pé", position: [0.06, -0.25, -0.29], zoneScale: [0.16, 0.14, 0.14] },
  { baseKey: "metatarsal_region", label: "Região metatarsal", clinicalGroup: "Planta do pé", position: [-0.26, -0.28, -0.22], zoneScale: [0.28, 0.26, 0.16] },
  { baseKey: "medial_arch", label: "Arco plantar medial", clinicalGroup: "Planta do pé", position: [0.02, -0.34, -0.1], zoneScale: [0.22, 0.14, 0.12] },
  { baseKey: "lateral_arch", label: "Arco plantar lateral", clinicalGroup: "Planta do pé", position: [0.02, 0.34, -0.1], zoneScale: [0.22, 0.14, 0.12] },
  { baseKey: "plantar_heel", label: "Calcanhar plantar", clinicalGroup: "Planta do pé", position: [0.52, 0, -0.3], zoneScale: [0.36, 0.58, 0.12] },
  { baseKey: "medial_plantar_border", label: "Borda medial plantar", clinicalGroup: "Planta do pé", position: [-0.02, -0.53, 0], zoneScale: [0.38, 0.08, 0.12] },
  { baseKey: "lateral_plantar_border", label: "Borda lateral plantar", clinicalGroup: "Planta do pé", position: [-0.02, 0.53, 0], zoneScale: [0.38, 0.08, 0.12] },
  { baseKey: "dorsal_forefoot", label: "Dorso do antepé", clinicalGroup: "Dorso do pé", position: [-0.42, 0, 0.36], zoneScale: [0.2, 0.36, 0.1] },
  { baseKey: "dorsal_midfoot", label: "Dorso médio", clinicalGroup: "Dorso do pé", position: [-0.02, 0, 0.38], zoneScale: [0.24, 0.34, 0.1] },
  { baseKey: "calcaneus", label: "Calcâneo", clinicalGroup: "Calcanhar e tornozelo", position: [0.6, 0, 0.14], zoneScale: [0.14, 0.28, 0.16] },
  { baseKey: "medial_ankle", label: "Tornozelo medial", clinicalGroup: "Calcanhar e tornozelo", position: [0.72, -0.28, 0.42], zoneScale: [0.1, 0.12, 0.16] },
  { baseKey: "lateral_ankle", label: "Tornozelo lateral", clinicalGroup: "Calcanhar e tornozelo", position: [0.72, 0.28, 0.42], zoneScale: [0.1, 0.12, 0.16] }
];

export const legacyFootRegionMap: Record<string, string> = {
  hallux: "hallux",
  hallux_pulp: "hallux",
  halux: "hallux",
  hallux_nail: "hallux_nail",
  nails: "hallux_nail",
  toe_2: "second_toe",
  segundo_dedo: "second_toe",
  dedo_indicador: "second_toe",
  dedo_indicador_d: "second_toe",
  dedo_indicador_e: "second_toe",
  index_toe: "second_toe",
  index_toe_right: "second_toe",
  index_toe_left: "second_toe",
  toe_3: "third_toe",
  toe_4: "fourth_toe",
  toe_5: "fifth_toe",
  plantar: "metatarsal_region",
  plantar_center: "metatarsal_region",
  forefoot: "dorsal_forefoot",
  forefoot_medial: "first_metatarsal_head",
  forefoot_lateral: "fifth_metatarsal_head",
  metatarsal: "metatarsal_region",
  metatarsal_1: "first_metatarsal_head",
  metatarsal_5: "fifth_metatarsal_head",
  arch: "medial_arch",
  arch_medial: "medial_arch",
  heel: "plantar_heel",
  heel_center: "plantar_heel",
  medial_border: "medial_plantar_border",
  lateral_border: "lateral_plantar_border",
  dorsal: "dorsal_midfoot",
  dorsum_center: "dorsal_midfoot",
  ankle: "medial_ankle",
  ankle_front: "medial_ankle",
  point_1: "hallux",
  foot_point_1: "hallux",
  mesh001: "hallux"
};

export const meshNameFootRegionMap: Record<string, string> = {
  hallux: "hallux",
  big_toe: "hallux",
  second_toe: "second_toe",
  third_toe: "third_toe",
  fourth_toe: "fourth_toe",
  fifth_toe: "fifth_toe",
  metatarsal: "metatarsal_region",
  arch: "medial_arch",
  heel: "plantar_heel",
  calcaneus: "calcaneus",
  dorsal: "dorsal_midfoot",
  plantar: "metatarsal_region",
  medial_border: "medial_plantar_border",
  lateral_border: "lateral_plantar_border",
  ankle: "medial_ankle"
};

export function withFootSide(region: FootRegionDefinition, footSide: FootSide): SideAwareFootRegion {
  const prefix = footSide === "right" ? "right" : "left";
  const sideLabel = footSide === "right" ? "D" : "E";
  return {
    ...region,
    sideLabel,
    regionKey: `${prefix}_${region.baseKey}`,
    pointKey: `${prefix}_${region.baseKey}`,
    displayLabel: `${region.label} ${sideLabel}`
  };
}
