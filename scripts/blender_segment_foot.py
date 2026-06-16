import json
import shutil
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
SOURCE_GLB = ROOT / "public" / "models" / "podo360-foot-textured.glb"
BACKUP_GLB = ROOT / "public" / "models" / "podo360-foot-original-backup.glb"
OUTPUT_GLB = ROOT / "public" / "models" / "podo360-foot-segmented.glb"
DIAGNOSTIC_JSON = ROOT / "public" / "models" / "podo360-foot-segmented-diagnostics.json"


REGIONS = [
    ("hallux", "Hálux", [-0.70, -0.33, 0.18], [0.12, 0.16, 0.12]),
    ("second_toe", "2º dedo", [-0.74, -0.16, 0.18], [0.10, 0.11, 0.11]),
    ("third_toe", "3º dedo", [-0.75, 0.00, 0.18], [0.10, 0.11, 0.11]),
    ("fourth_toe", "4º dedo", [-0.72, 0.16, 0.17], [0.10, 0.11, 0.10]),
    ("fifth_toe", "5º dedo", [-0.65, 0.32, 0.14], [0.10, 0.12, 0.10]),
    ("hallux_nail", "Unha do hálux", [-0.77, -0.33, 0.32], [0.07, 0.12, 0.05]),
    ("second_toe_nail", "Unha do 2º dedo", [-0.79, -0.16, 0.31], [0.06, 0.08, 0.05]),
    ("third_toe_nail", "Unha do 3º dedo", [-0.79, 0.00, 0.31], [0.06, 0.08, 0.05]),
    ("fourth_toe_nail", "Unha do 4º dedo", [-0.76, 0.16, 0.30], [0.06, 0.08, 0.05]),
    ("fifth_toe_nail", "Unha do 5º dedo", [-0.70, 0.31, 0.27], [0.06, 0.08, 0.05]),
    ("first_metatarsal_head", "Cabeça do 1º metatarso", [-0.42, -0.34, 0.02], [0.12, 0.12, 0.10]),
    ("second_metatarsal_head", "Cabeça do 2º metatarso", [-0.46, -0.17, 0.01], [0.11, 0.11, 0.10]),
    ("third_metatarsal_head", "Cabeça do 3º metatarso", [-0.47, 0.00, 0.00], [0.11, 0.11, 0.10]),
    ("fourth_metatarsal_head", "Cabeça do 4º metatarso", [-0.46, 0.17, 0.01], [0.11, 0.11, 0.10]),
    ("fifth_metatarsal_head", "Cabeça do 5º metatarso", [-0.40, 0.34, 0.02], [0.12, 0.12, 0.10]),
    ("metatarsal_region", "Região metatarsal", [-0.32, 0.00, -0.02], [0.16, 0.34, 0.12]),
    ("medial_arch", "Arco plantar medial", [0.02, -0.34, -0.10], [0.22, 0.14, 0.12]),
    ("lateral_arch", "Arco plantar lateral", [0.02, 0.34, -0.10], [0.22, 0.14, 0.12]),
    ("plantar_heel", "Calcanhar plantar", [0.52, 0.00, -0.10], [0.22, 0.34, 0.14]),
    ("medial_plantar_border", "Borda medial plantar", [-0.02, -0.53, 0.00], [0.38, 0.08, 0.12]),
    ("lateral_plantar_border", "Borda lateral plantar", [-0.02, 0.53, 0.00], [0.38, 0.08, 0.12]),
    ("dorsal_forefoot", "Dorso do antepé", [-0.42, 0.00, 0.36], [0.20, 0.36, 0.10]),
    ("dorsal_midfoot", "Dorso médio", [-0.02, 0.00, 0.38], [0.24, 0.34, 0.10]),
    ("calcaneus", "Calcâneo", [0.60, 0.00, 0.14], [0.14, 0.28, 0.16]),
    ("medial_ankle", "Tornozelo medial", [0.72, -0.28, 0.42], [0.10, 0.12, 0.16]),
    ("lateral_ankle", "Tornozelo lateral", [0.72, 0.28, 0.42], [0.10, 0.12, 0.16]),
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_invisible_material():
    material = bpy.data.materials.new("podo360_click_zone_invisible")
    material.use_nodes = True
    material.blend_method = "BLEND"
    material.show_transparent_back = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Alpha"].default_value = 0.0
        principled.inputs["Base Color"].default_value = (0.0, 0.85, 1.0, 0.0)
        principled.inputs["Roughness"].default_value = 1.0
        principled.inputs["Metallic"].default_value = 0.0
    material["podo360InvisibleClickZone"] = True
    return material


def create_click_zone(name, location, scale, material, foot_side, clinical_label):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=location)
    zone = bpy.context.object
    zone.name = name
    zone.data.name = f"{name}_mesh"
    zone.scale = scale
    zone.data.materials.append(material)
    zone.show_transparent = True
    zone.hide_select = False
    zone["podo360ClickZone"] = True
    zone["regionKey"] = name
    zone["pointKey"] = name
    zone["footSide"] = foot_side
    zone["clinicalLabel"] = clinical_label
    return zone


def collect_diagnostics():
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    original_meshes = [obj for obj in mesh_objects if not obj.get("podo360ClickZone")]
    click_zones = [obj for obj in mesh_objects if obj.get("podo360ClickZone")]
    vertices = sum(len(obj.data.vertices) for obj in original_meshes)
    polygons = sum(len(obj.data.polygons) for obj in original_meshes)
    materials = sorted({slot.material.name for obj in original_meshes for slot in obj.material_slots if slot.material})
    return {
        "source_glb": str(SOURCE_GLB),
        "output_glb": str(OUTPUT_GLB),
        "backup_glb": str(BACKUP_GLB),
        "original_mesh_objects": [obj.name for obj in original_meshes],
        "click_zone_objects": [obj.name for obj in click_zones],
        "original_mesh_count": len(original_meshes),
        "click_zone_count": len(click_zones),
        "vertices": vertices,
        "polygons": polygons,
        "materials": materials,
        "textures_preserved": True,
        "strategy": "Blender-generated invisible named click-zone meshes over single source mesh",
    }


def export_glb():
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_apply=True,
    )


def main():
    if not SOURCE_GLB.exists():
        raise FileNotFoundError(f"GLB de origem nao encontrado: {SOURCE_GLB}")
    if not BACKUP_GLB.exists():
        shutil.copy2(SOURCE_GLB, BACKUP_GLB)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))

    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and not obj.name:
            obj.name = "podo360_foot_textured_mesh"
            obj.data.name = "podo360_foot_textured_mesh_data"

    invisible_material = make_invisible_material()
    for side, suffix in (("right", "D"), ("left", "E")):
        for base_key, label, location, scale in REGIONS:
            create_click_zone(
                name=f"{side}_{base_key}",
                location=location,
                scale=scale,
                material=invisible_material,
                foot_side=side,
                clinical_label=f"{label} {suffix}",
            )

    diagnostics = collect_diagnostics()
    DIAGNOSTIC_JSON.write_text(json.dumps(diagnostics, ensure_ascii=False, indent=2), encoding="utf-8")
    export_glb()
    print(json.dumps(diagnostics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
