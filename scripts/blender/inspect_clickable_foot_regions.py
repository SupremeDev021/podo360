import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


TARGETS = {
    "right_plantar_heel",
    "left_plantar_heel",
    "right_calcaneus",
    "left_calcaneus",
    "right_medial_arch",
    "left_medial_arch",
    "right_lateral_arch",
    "left_lateral_arch",
    "right_medial_plantar_border",
    "left_medial_plantar_border",
    "right_lateral_plantar_border",
    "left_lateral_plantar_border",
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_glb(path: Path) -> None:
    bpy.ops.import_scene.gltf(filepath=str(path))


def world_bbox(obj: bpy.types.Object):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "min": [min(point[i] for point in points) for i in range(3)],
        "max": [max(point[i] for point in points) for i in range(3)],
        "center": [sum(point[i] for point in points) / len(points) for i in range(3)],
        "dimensions": list(obj.dimensions),
    }


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: blender --background --python inspect_clickable_foot_regions.py -- <glb>")

    glb = Path(sys.argv[-1]).resolve()
    reset_scene()
    import_glb(glb)

    objects = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        if obj.name in TARGETS or obj.get("regionKey") in TARGETS or obj.name == "Mesh_0":
            objects.append(
                {
                    "name": obj.name,
                    "regionKey": obj.get("regionKey"),
                    "purpose": obj.get("purpose"),
                    "location": list(obj.location),
                    "scale": list(obj.scale),
                    "rotation_euler": list(obj.rotation_euler),
                    "dimensions": list(obj.dimensions),
                    "bbox": world_bbox(obj),
                    "vertices": len(obj.data.vertices),
                    "polygons": len(obj.data.polygons),
                }
            )

    print(json.dumps({"glb": str(glb), "objects": objects}, indent=2))


if __name__ == "__main__":
    main()
