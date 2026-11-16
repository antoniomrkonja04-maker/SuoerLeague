import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDragDeltaToSpin,
  buildFacetedCrystalStarBuffers,
  buildFlatSphericalStarBuffers,
  buildSmoothSphericalStarBuffers,
  buildStarballTopology,
  buildStarPolygonPoints,
  createStarballSpinState,
  CRYSTAL_LIGHT_PRESETS,
  projectStarLocalVertexToSphere,
  setStarballButtonOpenState,
  stepStarballSpinPhysics,
  triggerSpinImpulse,
} from '../src/crystal-ball-core.mjs';
import { renderCrystalStarballStage } from '../src/crystal-ball-3d.mjs';

test('buildStarballTopology generates 12 icosahedral stars, 20 crystal panels, and 30 seam edges', () => {
  const topology = buildStarballTopology();
  assert.equal(topology.stars.length, 12);
  assert.equal(topology.faces.length, 20);
  assert.equal(topology.edges.length, 30);

  for (const star of topology.stars) {
    assert.equal(star.neighborIndices.length, 5);
    const nLen = Math.hypot(...star.normal);
    assert.ok(Math.abs(nLen - 1) < 1e-6);
  }
});

test('buildFlatSphericalStarBuffers maps sharp-pointed, flat-flush 5-pointed star onto sphere shell', () => {
  const topology = buildStarballTopology();
  const pts = buildStarPolygonPoints({ outerRadius: 0.52, innerRadius: 0.22, points: 5 });
  assert.equal(pts.length, 10);

  const [wx, wy, wz] = projectStarLocalVertexToSphere(pts[0][0], pts[0][1], 0.05, topology.stars[0], 1.0);
  const r = Math.hypot(wx, wy, wz);
  assert.ok(Math.abs(r - 1.05) < 1e-5);

  const flatBuffers = buildFlatSphericalStarBuffers(topology.stars[0]);
  assert.ok(flatBuffers.bodyPositions.length > 1000);
  assert.ok(flatBuffers.bodyIndices.length > 2000);
  assert.ok(flatBuffers.rimPositions.length > 1000);
  assert.ok(flatBuffers.rimIndices.length > 1000);

  const smoothBuffers = buildSmoothSphericalStarBuffers(topology.stars[0]);
  assert.ok(smoothBuffers.bodyPositions.length > 1000);

  const buffers = buildFacetedCrystalStarBuffers(topology.stars[0]);
  assert.equal(buffers.facePositions.length, 10 * 3 * 3);
  assert.equal(buffers.rimPositions.length, 10 * 4 * 3 * 3);
});

test('360-degree spin physics, button-select star opening, and clean stage markup work deterministically', () => {
  let state = createStarballSpinState();
  assert.equal(state.lightPreset, 'neonYellow');
  assert.ok(CRYSTAL_LIGHT_PRESETS.neonYellow.keyColor === 0xefff00);

  const initialQuat = [...state.quaternion];
  state = applyDragDeltaToSpin(state, 48, -24, 0.016);
  assert.notDeepEqual(state.quaternion, initialQuat);
  assert.ok(Math.abs(state.omegaY) > 0.4);

  const opened = setStarballButtonOpenState(state, true, 0.36);
  assert.equal(opened.targetExploded, 0.36);

  const boosted = triggerSpinImpulse(opened, 1);
  assert.equal(boosted.spinBoostCount, 1);
  assert.ok(boosted.omegaY > 5);

  const stepped = stepStarballSpinPhysics(boosted, 0.05);
  assert.ok(stepped.exploded > 0);
  assert.ok(stepped.omegaY < boosted.omegaY);

  const stageHtml = renderCrystalStarballStage({ mountId: 'test-crystal-mount', variant: 'title' });
  assert.match(stageHtml, /test-crystal-mount/);
  assert.doesNotMatch(stageHtml, /SPIN-IMPULS/);
  assert.doesNotMatch(stageHtml, /KRISTALL-FACETTEN/);
});
