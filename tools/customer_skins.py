# SPDX-License-Identifier: GPL-3.0-only
"""Offline customer-skin resource generation. Player PNGs retain their own rights."""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import shutil

from PIL import Image

NS = "ordertocook"
SKIN_ROOT = "textures/ordertocook/entity/customer_skins"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def copy_skin(source, target, expected_sha256=None, allow_legacy=False):
    # Input validation belongs to normal conversion, not a runtime network lookup.
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if expected_sha256 is not None and digest != expected_sha256:
        raise ValueError(f"Customer skin source hash changed: {source}")
    with Image.open(source) as image:
        size = image.size
        if image.format != "PNG" or size not in ((64, 64), (64, 32)) or (size == (64, 32) and not allow_legacy):
            raise ValueError(f"Customer skin must be 64x64, or an explicitly classic legacy 64x32 PNG: {source}")
        if size == (64, 32):
            rgba = image.convert("RGBA")
            # This UV-only adapter intentionally does not rewrite PNG alpha.
            # Reject legacy inputs requiring Java's pixel-opacity normalization.
            base_faces = [(8, 0, 24, 8), (0, 8, 32, 16),
                          (20, 16, 36, 20), (16, 20, 40, 32),
                          (44, 16, 52, 20), (40, 20, 56, 32),
                          (4, 16, 12, 20), (0, 20, 16, 32)]
            if any(rgba.getpixel((x, y))[3] != 255
                   for x0, y0, x1, y1 in base_faces
                   for x in range(x0, x1) for y in range(y0, y1)):
                raise ValueError(f"Legacy base alpha needs pixel normalization, not this unchanged-PNG adapter: {source}")
            if not any(rgba.getpixel((x, y))[3] < 128 for x in range(32, 64) for y in range(32)):
                raise ValueError(f"Legacy opaque hat needs pixel normalization, not this unchanged-PNG adapter: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    return digest, size



def make_legacy_customer_geometry(rp: Path):
    # Keep the original 64x32 PNG unchanged. Map the original animated classic
    # rig onto its legacy layout: mirrored opposite limbs, no body/limb overlays.
    # Assumine's captured image has transparent hat pixels, so retain its hat.
    document = read_json(rp / "models/entity/customer.geo.json")
    geometry = document["minecraft:geometry"][0]
    geometry["description"]["identifier"] = f"geometry.{NS}.customer_legacy"
    geometry["description"]["texture_height"] = 32
    bones = {bone["name"]: bone for bone in geometry["bones"]}
    for name, bone in bones.items():
        if "cubes" in bone and name != "head":
            bone["cubes"] = [cube for cube in bone["cubes"] if cube.get("inflate", 0) <= 0]
    for part in ("arm", "hand", "leg", "foot"):
        left = bones[f"left_{part}"]["cubes"]
        right = bones[f"right_{part}"]["cubes"]
        if len(left) != len(right):
            raise ValueError(f"Legacy customer rig has unmatched {part} cubes")
        for target, source in zip(left, right):
            faces = {}
            for face in target["uv"]:
                opposite = {"east": "west", "west": "east"}.get(face, face)
                data = copy.deepcopy(source["uv"][opposite])
                data["uv"][0] += data["uv_size"][0]
                data["uv_size"][0] *= -1
                faces[face] = data
            target["uv"] = faces
    write_json(rp / "models/entity/customer_legacy.geo.json", document)

def make_customer_skin_resources(root: Path, bp: Path, rp: Path):
    """Update only the canonical customer appearance definitions and their inputs."""
    inputs = root / "assets/customer_skins"
    previous_path = bp.parent / "customer_skin_manifest.json"
    previous = read_json(previous_path) if previous_path.is_file() else {}
    manifest = read_json(inputs / "manifest.json")
    skins = manifest["skins"]
    if len(skins) != 7 or len({skin["uuid"] for skin in skins}) != 7:
        raise ValueError("Expected the seven distinct pinned Java customer identities")

    entity_path = bp / "entities/customer.json"
    entity = read_json(entity_path)
    properties = entity["minecraft:entity"]["description"]["properties"]
    properties.update({
        f"{NS}:skin_profile": {"type": "int", "range": [0, 7], "default": 0, "client_sync": True},
        f"{NS}:custom_skins": {"type": "bool", "default": False, "client_sync": True},
        f"{NS}:skin_seed": {"type": "int", "range": [0, 1048575], "default": 0, "client_sync": True},
    })

    client_path = rp / "entity/customer.entity.json"
    client = read_json(client_path)
    description = client["minecraft:client_entity"]["description"]
    textures = description["textures"]
    description["geometry"].pop("wide_legacy", None)
    for key in list(textures):
        if key.startswith(("special_", "custom_wide_", "custom_slim_")):
            del textures[key]
    profiles = ["Texture.wide"]
    models = ["Geometry.wide"]
    records = []
    catalog = []
    for index, skin in enumerate(skins, 1):
        if skin["model"] not in ("wide", "slim") or Path(skin["file"]).name != skin["file"]:
            raise ValueError("Invalid customer skin model or source filename")
        source = inputs / "special" / skin["file"]
        relative = f"{SKIN_ROOT}/special/{skin['file']}"
        digest, size = copy_skin(source, rp / relative, skin["sha256"], allow_legacy=skin["model"] == "wide")
        geometry_model = skin["model"]
        if size == (64, 32):
            make_legacy_customer_geometry(rp)
            description["geometry"]["wide_legacy"] = f"geometry.{NS}.customer_legacy"
            geometry_model = "wide_legacy"
        alias = f"special_{index}"
        textures[alias] = relative[:-4]
        profiles.append(f"Texture.{alias}")
        models.append(f"Geometry.{geometry_model}")
        uuid = skin["uuid"]
        dashed = f"{uuid[:8]}-{uuid[8:12]}-{uuid[12:16]}-{uuid[16:20]}-{uuid[20:]}"
        catalog.append([skin["account"], skin["customer_name"], dashed])
        records.append({**skin, "source": source.relative_to(root).as_posix(),
                        "output": relative, "sha256": digest, "profile": index,
                        "source_size": list(size), "geometry": geometry_model,
                        "image_transform": "none; exact source PNG"})

    custom_arrays = {}
    custom_records = []
    for model in ("wide", "slim"):
        choices = []
        # Java scans 1..512 and stops at the first missing member of each model.
        for number in range(1, 513):
            source = inputs / "customs" / f"custom_{model}_{number}.png"
            if not source.is_file():
                break
            notice = source.parent / "NOTICE.md"
            if not notice.is_file():
                raise ValueError("Custom skins need assets/customer_skins/customs/NOTICE.md with source/rights information")
            relative = f"{SKIN_ROOT}/customs/{source.name}"
            digest, _ = copy_skin(source, rp / relative)
            alias = f"custom_{model}_{number}"
            textures[alias] = relative[:-4]
            choices.append(f"Texture.{alias}")
            custom_records.append({"model": model, "index": number,
                "source": source.relative_to(root).as_posix(), "output": relative, "sha256": digest})
        custom_arrays[f"Array.custom_{model}"] = choices or [f"Texture.{model}"]

    # A profile's own model and texture always take precedence over custom lists.
    variant = f"q.property('{NS}:variant')"
    profile = f"q.property('{NS}:skin_profile')"
    custom = f"q.property('{NS}:custom_skins')"
    seed = f"q.property('{NS}:skin_seed')"
    counts = {model: len(custom_arrays[f"Array.custom_{model}"]) for model in ("wide", "slim")}
    custom_texture = (f"({variant} == 1 ? Array.custom_slim[math.mod({seed}, {counts['slim']})]"
                      f" : Array.custom_wide[math.mod({seed}, {counts['wide']})])")
    render_path = rp / "render_controllers/ordertocook.render_controllers.json"
    render = read_json(render_path)
    render["render_controllers"][f"controller.render.{NS}.customer"] = {
        "arrays": {
            "textures": {"Array.skins": ["Texture.wide", "Texture.slim"],
                         "Array.profiles": profiles, **custom_arrays},
            "geometries": {"Array.models": ["Geometry.wide", "Geometry.slim"], "Array.profile_models": models},
        },
        "geometry": f"{profile} > 0 ? Array.profile_models[{profile}] : Array.models[{variant}]",
        "materials": [{"*": "Material.default"}],
        "textures": [f"{profile} > 0 ? Array.profiles[{profile}] : ({custom} ? {custom_texture} : Array.skins[{variant}])"],
    }
    write_json(entity_path, entity)
    write_json(client_path, client)
    write_json(render_path, render)
    catalog_path = bp / "scripts/customer-skin-catalog.js"
    catalog_path.write_text(
        "// SPDX-License-Identifier: GPL-3.0-only\n"
        "// Generated from assets/customer_skins/manifest.json. Identity order is from pinned Java.\n"
        "// This metadata license does not relicense the external player PNGs.\n"
        "export const EASTER_EGG_CUSTOMERS = Object.freeze(" +
        json.dumps(catalog, ensure_ascii=False, indent=2) + ");\n", encoding="utf-8")
    # Remove only files recorded as this generator's prior skin outputs. Merely
    # dropping a reference must not leave removed private/custom artwork in RP.
    outputs = {record["output"] for record in records + custom_records}
    for record in previous.get("special_skins", []) + previous.get("custom_skins", []):
        relative = record.get("output", "")
        candidate = rp / relative
        if (relative not in outputs and relative.startswith(SKIN_ROOT + "/")
                and candidate.suffix == ".png" and candidate.is_file()
                and candidate.resolve().is_relative_to((rp / SKIN_ROOT).resolve())):
            candidate.unlink()
    if not custom_records:
        (rp / "LEGAL/CUSTOMER_CUSTOM_SKINS.md").unlink(missing_ok=True)
    uses_legacy = any(record["geometry"] == "wide_legacy" for record in records)
    if not uses_legacy and previous.get("legacy_geometry", {}).get("output") == "RP/models/entity/customer_legacy.geo.json":
        # Retire only this generator's recorded geometry, not an unrelated file.
        (rp / "models/entity/customer_legacy.geo.json").unlink(missing_ok=True)
    geometry_source = rp / "models/entity/customer.geo.json"
    provenance = {
        "legacy_geometry": {
            "source": geometry_source.relative_to(bp.parent).as_posix(),
            "source_sha256": hashlib.sha256(geometry_source.read_bytes()).hexdigest(),
            "upstream_source": "common/src/main/resources/assets/ordertocook/geo/drive_idle.geo.json",
            "output": "RP/models/entity/customer_legacy.geo.json",
            "operation": "Unchanged classic rig and PNG; 32px texture height, mirrored left limb UVs, omit non-head outer cubes",
            "captured_skin_alpha": "Assumine sampled base face rectangles are opaque; head overlay contains transparency"
        },
        "upstream": manifest["upstream"],
        "mode": "offline public Mojang snapshots; no live profile lookup",
        "rights_status": manifest["rights_status"],
        "special_skins": records,
        "custom_skins": custom_records,
        "custom_selection": "Java contiguous 1..512 per model; stable saved-order seed, not Java entity UUID",
    }
    if not uses_legacy:
        del provenance["legacy_geometry"]
    write_json(bp.parent / "customer_skin_manifest.json", provenance)
    write_json(rp / "LEGAL/CUSTOMER_SKINS.json", provenance)
    shutil.copyfile(inputs / "README.md", rp / "LEGAL/CUSTOMER_SKINS.md")
    if custom_records:
        shutil.copyfile(inputs / "customs/NOTICE.md", rp / "LEGAL/CUSTOMER_CUSTOM_SKINS.md")
