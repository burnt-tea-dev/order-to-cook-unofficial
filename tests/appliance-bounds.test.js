// SPDX-License-Identifier: GPL-3.0-only
// Independent decoded-JSON bounds checks. Float32 arithmetic is a conservative
// regression model, not a claim to emulate Bedrock's renderer exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../runtime/RP/models/blocks/', import.meta.url);
const meshes = readdirSync(root).filter(p => p.endsWith('.geo.json')).map(path => ({
  path, mesh: JSON.parse(readFileSync(new URL(path, root), 'utf8'))['minecraft:geometry'][0],
}));
const min = [-22, -14, -22], max = [22, 30, 22];
function rotate(point, angles = [0, 0, 0], pivot = [0, 0, 0], round = x => x) {
  let [x, y, z] = point.map((v, i) => round(round(v) - round(pivot[i])));
  for (let i = 0; i < 3; i++) {
    const r = round(round(angles[i]) * Math.PI / 180);
    const c = round(Math.cos(r)), s = round(Math.sin(r));
    if (i === 0) [y, z] = [round(round(y*c) - round(z*s)), round(round(y*s) + round(z*c))];
    if (i === 1) [x, z] = [round(round(x*c) + round(z*s)), round(-round(x*s) + round(z*c))];
    if (i === 2) [x, y] = [round(round(x*c) - round(y*s)), round(round(x*s) + round(y*c))];
  }
  return [x, y, z].map((v, i) => round(v + round(pivot[i])));
}
function corners(mesh, round, facing) {
  const bones = new Map(mesh.bones.map(b => [b.name, b])), points = [];
  for (const bone of mesh.bones) for (const cube of bone.cubes ?? []) for (let mask = 0; mask < 8; mask++) {
    let p = cube.origin.map((v, i) => round(round(v) + round(((mask >> i) & 1) * round(cube.size[i]))));
    p = rotate(p, cube.rotation, cube.pivot, round);
    for (let b = bone; b; b = bones.get(b.parent)) p = rotate(p, b.rotation, b.pivot, round);
    // Exact cardinal transforms do not add artificial sin(90) roundoff.
    for (let n = 0; n < facing; n++) p = [p[2], p[1], -p[0]];
    points.push(p);
  }
  return points;
}
function check(mesh, path, round, facing) {
  const points = corners(mesh, round, facing);
  for (let axis = 0; axis < 3; axis++) {
    const low = Math.min(...points.map(p => p[axis])), high = Math.max(...points.map(p => p[axis]));
    assert.ok(low >= min[axis] && high <= max[axis] && high-low <= 30,
      `${path}, facing ${facing}, axis ${axis}: ${low}..${high}; extent ${high-low}`);
  }
}

test('all generated block meshes stay strictly within the observed native envelope and 30px extent', () => {
  assert.equal(meshes.length, 184);
  for (const { path, mesh } of meshes) for (let facing = 0; facing < 4; facing++) check(mesh, path, x => x, facing);
});
test('serialized block geometry remains bounded with Float32 arithmetic in all four facings', () => {
  for (const { path, mesh } of meshes) for (let facing = 0; facing < 4; facing++) check(mesh, path, Math.fround, facing);
});
test('both corrected fridge swing extremes retain a positive inward rounding guard', () => {
  for (const path of ['refrigerator_lower_7.geo.json', 'refrigerator_upper_6.geo.json']) {
    const mesh = meshes.find(m => m.path === path).mesh;
    const lowZ = Math.min(...corners(mesh, Math.fround, 0).map(p => p[2]));
    assert.ok(lowZ >= -22 + 1/2048, `${path}: ${lowZ} must not be rounded onto the edge`);
  }
});
