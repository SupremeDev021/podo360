import json
import os
from pathlib import Path

import bpy


# Calibrated against public/models/podo360-foot-segmented.glb.
# The Meshy model is a single textured mesh, so the safe production strategy is
# a set of invisible named click-zone meshes aligned over the anatomical regions.
REGIONS = [
    # Toes and nails use larger volumes because these small distal regions were
    # the least reliable in browser raycasting during visual validation.
    ("hallux", (-0.78, -0.66, -0.74), (0.28, 0.18, 0.16)),
    ("second_toe", (-0.5, -0.72, -0.73), (0.18, 0.16, 0.15)),
    ("third_toe", (-0.3, -0.68, -0.72), (0.18, 0.16, 0.15)),
    ("fourth_toe", (-0.1, -0.62, -0.69), (0.17, 0.15, 0.14)),
    ("fifth_toe", (0.08, -0.5, -0.64), (0.15, 0.13, 0.13)),
    ("hallux_nail", (-0.84, -0.56, -0.82), (0.12, 0.1, 0.06)),
    ("second_toe_nail", (-0.5, -0.62, -0.81), (0.1, 0.08, 0.06)),
    ("third_toe_nail", (-0.3, -0.6, -0.8), (0.1, 0.08, 0.06)),
    ("fourth_toe_nail", (-0.1, -0.55, -0.76), (0.09, 0.08, 0.06)),
    ("fifth_toe_nail", (0.08, -0.44, -0.7), (0.08, 0.07, 0.06)),
    ("first_metatarsal_head", (-0.62, -0.62, -0.3), (0.12, 0.1, 0.12)),
    ("second_metatarsal_head", (-0.43, -0.6, -0.31), (0.11, 0.1, 0.12)),
    ("third_metatarsal_head", (-0.24, -0.56, -0.31), (0.11, 0.1, 0.12)),
    ("fourth_metatarsal_head", (-0.06, -0.48, -0.31), (0.11, 0.1, 0.12)),
    ("fifth_metatarsal_head", (0.1, -0.36, -0.29), (0.12, 0.1, 0.12)),
    ("metatarsal_region", (-0.24, -0.48, -0.22), (0.22, 0.2, 0.14)),
    ("medial_arch", (0.02, -0.34, -0.18), (0.25, 0.17, 0.16)),
    ("lateral_arch", (0.02, 0.34, -0.18), (0.25, 0.17, 0.16)),
    # Plantar heel must sit on the inferior plantar surface, centered across
    # the heel width. Keep it separated from calcaneus (posterior/superior) and
    # from medial/lateral plantar borders so raycasting does not steal clicks.
    ("plantar_heel", (0.52, 0.0, -0.3), (0.36, 0.58, 0.12)),
    ("medial_plantar_border", (-0.02, -0.53, -0.18), (0.4, 0.1, 0.16)),
    ("lateral_plantar_border", (-0.02, 0.53, -0.18), (0.4, 0.1, 0.16)),
    ("dorsal_forefoot", (-0.42, 0.0, 0.02), (0.24, 0.38, 0.16)),
    ("dorsal_midfoot", (-0.02, 0.0, 0.08), (0.28, 0.36, 0.16)),
    ("calcaneus", (0.6, 0.0, -0.02), (0.18, 0.32, 0.2)),
    ("medial_ankle", (0.72, -0.28, 0.2), (0.14, 0.15, 0.2)),
    ("lateral_ankle", (0.72, 0.28, 0.2), (0.14, 0.15, 0.2)),
]


def root_dir() -> Path:
    return Path(__file__).resolve().parents[2]


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_glb(path: Path) -> None:
    bpy.ops.import_scene.gltf(filepath=str(path))


def remove_old_click_zones() -> None:
    for obj in list(bpy.context.scene.objects):
        name = obj.name.lower()
        if name.startswith("right_") or name.startswith("left_") or name.endswith("_click_zone"):
            bpy.data.objects.remove(obj, do_unlink=True)


def remove_extras() -> None:
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)


def make_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Alpha"].default_value = color[3]
        bsdf.inputs["Base Color"].default_value = color
    material.blend_method = "BLEND"
    material.use_screen_refraction = False
    return material


def create_zone(name: str, position, scale, material: bpy.types.Material, side: str) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.scale = scale
    obj.data.materials.append(material)
    obj.display_type = "WIRE"
    obj.show_wire = True
    obj["purpose"] = "foot_click_zone"
    obj["footSide"] = side
    obj["regionKey"] = name
    obj["clickable"] = True
    return obj


def create_click_zones(visible_debug: bool) -> list[str]:
    alpha = 0.38 if visible_debug else 0.0
    right_material = make_material("podo360_click_zone_right", (0.1, 0.85, 1.0, alpha))
    left_material = make_material("podo360_click_zone_left", (1.0, 0.7, 0.1, alpha))
    created = []
    for side, material in (("right", right_material), ("left", left_material)):
        for base_key, position, scale in REGIONS:
            name = f"{side}_{base_key}"
            create_zone(name, position, scale, material, side)
            created.append(name)
    return created


def export_glb(path: Path) -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_apply=True,
        use_selection=True,
        export_materials="EXPORT",
        export_yup=True,
    )


def render_debug(path: Path) -> None:
    camera_data = bpy.data.cameras.new("podo360_debug_camera")
    camera = bpy.data.objects.new("podo360_debug_camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.05, -4.2, 2.35)
    camera.rotation_euler = (1.05, 0.02, 0.0)
    camera.data.lens = 35
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.25
    bpy.context.scene.camera = camera

    light_data = bpy.data.lights.new("podo360_debug_light", "AREA")
    light = bpy.data.objects.new("podo360_debug_light", light_data)
    bpy.context.collection.objects.link(light)
    light.location = (0, -3, 4)
    light.data.energy = 500
    light.data.size = 4

    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.render.resolution_x = 1400
    bpy.context.scene.render.resolution_y = 1200
    bpy.context.scene.render.film_transparent = False
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    root = root_dir()
    source = Path(os.environ.get("PODO360_FOOT_SOURCE_GLB", root / "public" / "models" / "podo360-foot-segmented.glb"))
    output = Path(os.environ.get("PODO360_FOOT_OUTPUT_GLB", root / "public" / "models" / "podo360-foot-clickable.glb"))
    report_path = Path(os.environ.get("PODO360_FOOT_REPORT", root / "public" / "models" / "podo360-foot-clickable-report.json"))
    debug_render = Path(os.environ.get("PODO360_FOOT_DEBUG_RENDER", root / "public" / "models" / "podo360-foot-clickable-debug.png"))
    visible_debug = os.environ.get("PODO360_FOOT_VISIBLE_ZONES", "0") == "1"

    reset_scene()
    import_glb(source)
    remove_extras()
    remove_old_click_zones()
    created = create_click_zones(visible_debug)

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    textured_meshes = [obj.name for obj in mesh_objects if obj.name not in created]
    report = {
        "source_glb": str(source),
        "output_glb": str(output),
        "debug_render": str(debug_render),
        "strategy": "single textured mesh plus named Blender click-zone meshes",
        "textured_meshes": textured_meshes,
        "click_zone_count": len(created),
        "click_zone_objects": created,
        "vertices_total": sum(len(obj.data.vertices) for obj in mesh_objects),
        "polygons_total": sum(len(obj.data.polygons) for obj in mesh_objects),
        "materials": sorted(material.name for material in bpy.data.materials),
        "images": [{"name": image.name, "size": list(image.size)} for image in bpy.data.images],
    }

    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    if visible_debug:
        render_debug(debug_render)
    export_glb(output)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
