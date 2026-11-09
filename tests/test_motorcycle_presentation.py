# SPDX-License-Identifier: GPL-3.0-only
"""Bounded dynamic mapping checks against the pinned Java ModelPart hierarchy.

The active RP test evaluates the checked-in wheel expression. The additional
steering/signed-phase poses are coordinate references only: no mounted-input
mapping, native Molang execution or Java-speed equivalence is assumed.
"""
import copy
import itertools
import json
import math
from pathlib import Path
import re
import unittest

from motorcycle_oracle import parse_java, jfaces, jworld, rpfaces, rpworld


ROOT = Path(__file__).resolve().parents[1]
MODEL = Path("forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java")
SOURCE = ROOT / "upstream/reference" / MODEL
GEOMETRY = ROOT / "runtime/RP/models/entity/motorcycle.geo.json"
ANIMATION = ROOT / "runtime/RP/animations/runtime.animation.json"
CLIENT = ROOT / "runtime/RP/entity/motorcycle.entity.json"
DRIVE = "animation.ordertocook.motorcycle.drive"
TOLERANCE = 1e-5


def verify_source_assignments(text):
    """Check the actual setupAnim values that the independent pose reader uses."""
    body = text.split("public void setupAnim(", 1)[1].split("public void renderToBuffer(", 1)[0]
    body = re.sub(r"//[^\n]*|/\*.*?\*/", "", body, flags=re.S)
    body = re.sub(r"\s+", "", body)
    for assignment in (
        "floatsteeringYaw=moto.getHandleAngle(tickDelta)*((float)Math.PI/180F);",
        "this.handle.yRot=steeringYaw;",
        "this.front_t.yRot=steeringYaw;",
        "floatwheelRot=moto.getWheelAngle(tickDelta)*((float)Math.PI/180F);",
        "this.front_t.xRot=wheelRot;",
        "this.rear_t.xRot=wheelRot;",
    ):
        if assignment not in body:
            raise AssertionError(f"Pinned Java setupAnim contract changed: {assignment}")


def source_pose(java, steering_degrees, wheel_degrees):
    result = copy.deepcopy(java)
    result["handle"]["rotation"][1] = math.radians(steering_degrees)
    result["front_t"]["rotation"][:2] = [math.radians(wheel_degrees), math.radians(steering_degrees)]
    result["rear_t"]["rotation"][0] = math.radians(wheel_degrees)
    return result


def wheel_coefficient(expression):
    """Deliberately bounded evaluator; this is not a general Molang interpreter."""
    match = re.fullmatch(r"q\.modified_distance_moved\s*\*\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))", expression)
    if match is None:
        raise AssertionError(f"Unsupported active wheel expression: {expression!r}")
    value = float(match[1])
    if not math.isfinite(value):
        raise AssertionError("Non-finite wheel coefficient")
    return value


def active_pose(bedrock, drive_clip, distance):
    """Read both actual RP wheel channels; do not substitute desired rotations."""
    if not math.isfinite(distance) or distance < 0:
        raise AssertionError("This active-binding check only supplies nonnegative accumulated distance")
    result = copy.deepcopy(bedrock)
    for name in ("front_t", "rear_t"):
        rotation = drive_clip["bones"][name]["rotation"]
        if len(rotation) != 3 or rotation[1:] != [0, 0]:
            raise AssertionError("Review the newly changed active wheel axes")
        angle = wheel_coefficient(rotation[0]) * distance
        neutral = result[name].get("rotation", [0, 0, 0])
        result[name]["rotation"] = [neutral[0] + angle, neutral[1], neutral[2]]
    return result


def reference_pose(bedrock, steering_degrees, wheel_degrees):
    """UNWIRED source-angle illustration, independent of input/motion readers."""
    result = copy.deepcopy(bedrock)
    result["handle"]["rotation"] = [0, -steering_degrees, 0]
    result["front_t"]["rotation"] = [wheel_degrees, -steering_degrees, 0]
    result["rear_t"]["rotation"] = [wheel_degrees, 0, 0]
    return result


def compare_pose(java, bedrock):
    """Compare matching physical corners and UVs through separate hierarchies."""
    if list(java) != list(bedrock):
        raise AssertionError("Bone identities changed")
    maximum = 0.0
    uv_maximum = 0.0
    affected = []
    corner_count = 0
    for name, source_bone in java.items():
        candidate = bedrock[name]
        if candidate.get("parent") != source_bone["parent"]:
            raise AssertionError(f"Changed parent for {name}")
        if len(candidate.get("cubes", [])) != len(source_bone["cubes"]):
            raise AssertionError(f"Changed cube count for {name}")
        for index, (jc, bc) in enumerate(zip(source_bone["cubes"], candidate["cubes"])):
            if jc["size"] != bc["size"] or jc["inflate"] != bc.get("inflate", 0):
                raise AssertionError(f"Changed dimensions/inflation for {name}/{index}")
            size, inflation = jc["size"], jc["inflate"]
            low = [-bc["origin"][0] - size[0], *bc["origin"][1:]]
            error = 0.0
            for bits in itertools.product((0, 1), repeat=3):
                jp = [jc["origin"][axis] + size[axis] * bits[axis] + inflation * (2 * bits[axis] - 1)
                      for axis in range(3)]
                reflected = [bits[0], 1 - bits[1], bits[2]]
                bp = [low[axis] + size[axis] * reflected[axis] + inflation * (2 * reflected[axis] - 1)
                      for axis in range(3)]
                error = max(error, math.dist(jworld(java, name, jp), rpworld(bedrock, name, bp)))
                corner_count += 1
            maximum = max(maximum, error)
            if error > TOLERANCE:
                affected.append(f"{name}/{index}")
            source_uv = jfaces(jc)
            candidate_uv = rpfaces(dict(bc, mirror=bc.get("mirror", candidate.get("mirror", False))))
            uv_maximum = max(uv_maximum, max(
                abs(a - b) for face in source_uv for uv_a, uv_b in zip(source_uv[face], candidate_uv[face])
                for a, b in zip(uv_a, uv_b)))
    return {"max_corner_residual_pixels": maximum, "max_uv_residual_pixels": uv_maximum,
            "corner_checks": corner_count, "affected_boxes": affected}


def assert_pose(java, bedrock):
    report = compare_pose(java, bedrock)
    if report["max_corner_residual_pixels"] >= TOLERANCE or report["max_uv_residual_pixels"]:
        raise AssertionError(report)
    return report


def load_inputs(root=ROOT):
    text = (root / "upstream/reference" / MODEL).read_text()
    verify_source_assignments(text)
    java = parse_java(text)
    bedrock = {b["name"]: b for b in json.loads((root / GEOMETRY.relative_to(ROOT)).read_text())["minecraft:geometry"][0]["bones"]}
    drive = json.loads((root / ANIMATION.relative_to(ROOT)).read_text())["animations"][DRIVE]
    return java, bedrock, drive


class MotorcyclePresentation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.java, cls.bedrock, cls.drive = load_inputs()

    def test_actual_active_binding_matches_positive_source_wheel_angles(self):
        client = json.loads(CLIENT.read_text())["minecraft:client_entity"]["description"]
        self.assertEqual(client["animations"]["drive"], DRIVE)
        self.assertIn("drive", client["scripts"]["animate"])
        # Preserve the existing gain as a scope invariant. 114.6 is not a Java
        # speed equivalence: these synthetic distances only isolate angle sign.
        for bone in ("front_t", "rear_t"):
            self.assertEqual(abs(wheel_coefficient(self.drive["bones"][bone]["rotation"][0])), 114.6)
        for phase in (0, 15, 60, 120):
            with self.subTest(phase=phase):
                assert_pose(source_pose(self.java, 0, phase), active_pose(self.bedrock, self.drive, phase / 114.6))

    def test_old_active_wheel_sign_is_rejected_without_changing_uv(self):
        old = copy.deepcopy(self.drive)
        for bone in ("front_t", "rear_t"):
            old["bones"][bone]["rotation"][0] = "q.modified_distance_moved * -114.6"
        expected = source_pose(self.java, 0, 60)
        actual = active_pose(self.bedrock, old, 60 / 114.6)
        report = compare_pose(expected, actual)
        self.assertGreater(report["max_corner_residual_pixels"], 10)
        self.assertEqual(report["max_uv_residual_pixels"], 0)
        self.assertTrue(all(name.split("/")[0] in ("front_t", "rear_t", "cube_r10", "cube_r11")
                            for name in report["affected_boxes"]))
        with self.assertRaises(AssertionError):
            assert_pose(expected, actual)

    def test_unwired_signed_phase_and_steering_reference_in_both_axes(self):
        # These are explicit model-space poses, not values from an input API.
        for steer, wheel in ((-45, 0), (45, 0), (0, -60), (0, 60), (-45, 120), (45, -60)):
            with self.subTest(steer=steer, wheel=wheel):
                report = assert_pose(source_pose(self.java, steer, wheel), reference_pose(self.bedrock, steer, wheel))
                self.assertEqual(report["corner_checks"], 41 * 8)

    def test_reference_rejects_missing_front_yaw_or_steering_on_rear_wheel(self):
        expected = source_pose(self.java, 45, -60)
        correct = reference_pose(self.bedrock, 45, -60)
        for name, axis, value in (("front_t", 1, 0), ("handle", 1, 45), ("rear_t", 1, -45)):
            with self.subTest(bone=name, axis=axis):
                wrong = copy.deepcopy(correct)
                wrong[name]["rotation"][axis] = value
                self.assertGreater(compare_pose(expected, wrong)["max_corner_residual_pixels"], 1)
                with self.assertRaises(AssertionError):
                    assert_pose(expected, wrong)


if __name__ == "__main__":
    unittest.main()
