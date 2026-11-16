// Pure mathematical, topological, and physics/kinematics logic for the
// Interactive 3D Super League Crystal Starball (UEFA Champions League / ESL inspired).

const PHI = (1 + Math.sqrt(5)) / 2;

export const CRYSTAL_LIGHT_PRESETS = {
  neonYellow: {
    id: 'neonYellow',
    label: 'Neon-Gelb Studio',
    keyColor: 0xefff00,
    keyIntensity: 4.4,
    rimColor: 0xd4ff00,
    rimIntensity: 3.8,
    coreColor: 0xf6ff00,
    coreIntensity: 2.5,
    hemiSkyColor: 0x244c8a,
    hemiGroundColor: 0x050811,
    emissiveHex: 0xe8ff00,
    emissiveIntensity: 0.68,
  },
  cyberGold: {
    id: 'cyberGold',
    label: 'Supernova Gold-Gelb',
    keyColor: 0xffe600,
    keyIntensity: 4.8,
    rimColor: 0xaaff00,
    rimIntensity: 4.2,
    coreColor: 0xffff33,
    coreIntensity: 3.1,
    hemiSkyColor: 0x1b3b6f,
    hemiGroundColor: 0x04070e,
    emissiveHex: 0xffee00,
    emissiveIntensity: 0.85,
  },
  obsidianVolt: {
    id: 'obsidianVolt',
    label: 'Obsidian Volt',
    keyColor: 0xdfff00,
    keyIntensity: 3.9,
    rimColor: 0x99ff00,
    rimIntensity: 3.4,
    coreColor: 0xeaff00,
    coreIntensity: 2.1,
    hemiSkyColor: 0x162d54,
    hemiGroundColor: 0x03050a,
    emissiveHex: 0xd8ff00,
    emissiveIntensity: 0.52,
  },
};

function normalizeVec3([x, y, z]) {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function dotVec3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function crossVec3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function subVec3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function addVec3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVec3(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

/**
 * Computes the complete icosahedral Starball topology:
 * - 12 star centers (regular icosahedron vertices on the unit sphere)
 * - For each star center, its 5 ordered neighbor vertices around the tangent plane
 *   so every 5-pointed star points directly at its 5 neighboring stars (tip-to-tip!)
 * - 20 hexagonal/triangular crystal panel centers (dual dodecahedron vertices)
 * - 30 geodesic seam edges connecting adjacent star centers
 */
export function buildStarballTopology() {
  const rawVertices = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  const vertices = rawVertices.map(normalizeVec3);

  // Build adjacency: in a unit icosahedron, nearest neighbors have dot product = 1 / sqrt(5) ≈ 0.4472136
  const stars = vertices.map((normal, idx) => {
    // Construct local tangent basis (u, v, n)
    const ref = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const uBase = normalizeVec3(crossVec3(ref, normal));
    const vBase = normalizeVec3(crossVec3(normal, uBase));

    const neighbors = [];
    vertices.forEach((other, otherIdx) => {
      if (otherIdx === idx) return;
      const d = dotVec3(normal, other);
      if (d > 0.4) {
        // Project neighbor direction onto tangent plane
        const proj = subVec3(other, scaleVec3(normal, d));
        const angle = Math.atan2(dotVec3(proj, vBase), dotVec3(proj, uBase));
        neighbors.push({ index: otherIdx, angle, dot: d, position: other });
      }
    });

    neighbors.sort((a, b) => a.angle - b.angle);
    // Align uAxis directly with the first neighbor so the 5 star points point straight at the 5 neighbors
    const firstAngle = neighbors[0]?.angle ?? 0;
    const cosA = Math.cos(firstAngle);
    const sinA = Math.sin(firstAngle);
    const uAxis = normalizeVec3(addVec3(scaleVec3(uBase, cosA), scaleVec3(vBase, sinA)));
    const vAxis = normalizeVec3(crossVec3(normal, uAxis));

    return {
      index: idx,
      normal,
      uAxis,
      vAxis,
      neighborIndices: neighbors.map((n) => n.index),
    };
  });

  // 30 unique edges
  const edges = [];
  const edgeSet = new Set();
  for (const star of stars) {
    for (const nIdx of star.neighborIndices) {
      const a = Math.min(star.index, nIdx);
      const b = Math.max(star.index, nIdx);
      const key = `${a}-${b}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        const midpoint = normalizeVec3(addVec3(vertices[a], vertices[b]));
        edges.push({ a, b, midpoint });
      }
    }
  }

  // 20 triangular faces (centers of the 20 crystal panels nestled between the 12 stars)
  const faces = [];
  const faceSet = new Set();
  for (let i = 0; i < stars.length; i += 1) {
    const nList = stars[i].neighborIndices;
    for (let j = 0; j < nList.length; j += 1) {
      const a = nList[j];
      const b = nList[(j + 1) % nList.length];
      if (stars[a].neighborIndices.includes(b)) {
        const sorted = [i, a, b].sort((x, y) => x - y);
        const key = sorted.join('-');
        if (!faceSet.has(key)) {
          faceSet.add(key);
          const center = normalizeVec3(
            addVec3(addVec3(vertices[sorted[0]], vertices[sorted[1]]), vertices[sorted[2]]),
          );
          const ref = subVec3(vertices[sorted[0]], scaleVec3(center, dotVec3(vertices[sorted[0]], center)));
          const uAxis = normalizeVec3(ref);
          const vAxis = normalizeVec3(crossVec3(center, uAxis));
          faces.push({
            index: faces.length,
            vertexIndices: sorted,
            normal: center,
            uAxis,
            vAxis,
          });
        }
      }
    }
  }

  return {
    stars,
    edges,
    faces,
  };
}

/**
 * Generates the 10 perimeter points (5 outer tips + 5 inner valleys) in 2D local tangent coordinates
 * for a 5-pointed Champions League / Super League star.
 */
export function buildStarPolygonPoints({ outerRadius = 0.56, innerRadius = 0.235, points = 5 } = {}) {
  const coords = [];
  const totalVertices = points * 2;
  for (let i = 0; i < totalVertices; i += 1) {
    const angle = (i * Math.PI) / points;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    coords.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return coords;
}

/**
 * Projects a local 3D point (u, v, zHeight) from a star's tangent basis onto a spherical shell
 * of radius `sphereRadius + zHeight`, so each extruded 3D star hugs the crystal sphere curvature.
 */
export function projectStarLocalVertexToSphere(u, v, zHeight, starBasis, sphereRadius = 1.0) {
  const { normal, uAxis, vAxis } = starBasis;
  const planarDist = Math.hypot(u, v);
  const targetRadius = sphereRadius + zHeight;
  if (planarDist < 1e-6) {
    return scaleVec3(normal, targetRadius);
  }
  const dirU = u / planarDist;
  const dirV = v / planarDist;
  const tangentDir = addVec3(scaleVec3(uAxis, dirU), scaleVec3(vAxis, dirV));
  const theta = planarDist;
  const radialDir = normalizeVec3(
    addVec3(scaleVec3(normal, Math.cos(theta)), scaleVec3(tangentDir, Math.sin(theta))),
  );
  return scaleVec3(radialDir, targetRadius);
}

/**
 * Builds a sharp-pointed ("eckiger Stern"), flat-flush ("aber flach") 5-pointed star
 * projected smoothly onto the spherical shell.
 * - Uses exact linear interpolation between the 5 sharp outer tips and 5 sharp inner valleys
 *   so the star silhouette has crisp, straight edges and sharp points.
 * - Subdivides each of the 10 star sectors into a radial x edge grid at constant spherical
 *   elevation `flatHeight` so the star face is completely flat/flush on the round sphere
 *   (no central pyramid spike) and reflects the stadium environment like curved optical crystal.
 */
export function buildFlatSphericalStarBuffers(starBasis, {
  sphereRadius = 1.0,
  outerTipRadius = 0.552,
  outerValleyRadius = 0.224,
  rimWidthRatio = 0.13,
  flatHeight = 0.015,
  rimHeight = 0.021,
  radialSteps = 10,
  edgeSteps = 12,
  rimSteps = 4,
} = {}) {
  const innerScale = 1 - rimWidthRatio;
  const outerPoly = buildStarPolygonPoints({
    outerRadius: outerTipRadius,
    innerRadius: outerValleyRadius,
    points: 5,
  });
  const innerPoly = buildStarPolygonPoints({
    outerRadius: outerTipRadius * innerScale,
    innerRadius: outerValleyRadius * innerScale,
    points: 5,
  });

  // 1. Flat-flush spherical star body (10 sectors, each subdivided into radialSteps x edgeSteps)
  const bodyVertices = [];
  const bodyIndices = [];

  for (let sector = 0; sector < 10; sector += 1) {
    const nextSector = (sector + 1) % 10;
    const pA = innerPoly[sector];
    const pB = innerPoly[nextSector];
    const baseVertexOffset = bodyVertices.length / 3;

    for (let r = 0; r <= radialSteps; r += 1) {
      const s = r / radialSteps; // 0 at star center, 1 at inner rim boundary
      for (let e = 0; e <= edgeSteps; e += 1) {
        const t = e / edgeSteps; // linear along straight star edge from pA to pB
        const u = s * ((1 - t) * pA[0] + t * pB[0]);
        const v = s * ((1 - t) * pA[1] + t * pB[1]);
        const pos = projectStarLocalVertexToSphere(u, v, flatHeight, starBasis, sphereRadius);
        bodyVertices.push(...pos);
      }
    }

    const stride = edgeSteps + 1;
    for (let r = 0; r < radialSteps; r += 1) {
      for (let e = 0; e < edgeSteps; e += 1) {
        const i0 = baseVertexOffset + r * stride + e;
        const i1 = i0 + 1;
        const i2 = baseVertexOffset + (r + 1) * stride + e;
        const i3 = i2 + 1;
        bodyIndices.push(i0, i2, i3);
        bodyIndices.push(i0, i3, i1);
      }
    }
  }

  // 2. Crisp, flat-beveled 5-pointed star border frame (10 straight star edges with sharp corners)
  const rimVertices = [];
  const rimIndices = [];

  for (let sector = 0; sector < 10; sector += 1) {
    const nextSector = (sector + 1) % 10;
    const inA = innerPoly[sector];
    const inB = innerPoly[nextSector];
    const outA = outerPoly[sector];
    const outB = outerPoly[nextSector];
    const baseVertexOffset = rimVertices.length / 3;

    // Cross-section profile across the rim:
    // r=0: inner edge at flatHeight
    // r=1..rimSteps-1: flat top bevel at rimHeight
    // r=rimSteps: outer base atsphere surface (0.002)
    for (let r = 0; r <= rimSteps; r += 1) {
      const s = r / rimSteps;
      let z = rimHeight;
      if (r === 0) z = flatHeight;
      else if (r === rimSteps) z = 0.002;

      for (let e = 0; e <= edgeSteps; e += 1) {
        const t = e / edgeSteps;
        const uIn = (1 - t) * inA[0] + t * inB[0];
        const vIn = (1 - t) * inA[1] + t * inB[1];
        const uOut = (1 - t) * outA[0] + t * outB[0];
        const vOut = (1 - t) * outA[1] + t * outB[1];
        const u = (1 - s) * uIn + s * uOut;
        const v = (1 - s) * vIn + s * vOut;
        const pos = projectStarLocalVertexToSphere(u, v, z, starBasis, sphereRadius);
        rimVertices.push(...pos);
      }
    }

    const stride = edgeSteps + 1;
    for (let r = 0; r < rimSteps; r += 1) {
      for (let e = 0; e < edgeSteps; e += 1) {
        const i0 = baseVertexOffset + r * stride + e;
        const i1 = i0 + 1;
        const i2 = baseVertexOffset + (r + 1) * stride + e;
        const i3 = i2 + 1;
        rimIndices.push(i0, i2, i3);
        rimIndices.push(i0, i3, i1);
      }
    }
  }

  return {
    bodyPositions: new Float32Array(bodyVertices),
    bodyIndices: new Uint16Array(bodyIndices),
    rimPositions: new Float32Array(rimVertices),
    rimIndices: new Uint16Array(rimIndices),
  };
}

/**
 * Sets the subtle star-opening state when the user selects/hovers a UI button.
 */
export function setStarballButtonOpenState(spinState, isOpen = false, amount = 0.34) {
  if (!spinState) return spinState;
  const target = isOpen ? amount : 0;
  const boostOmega = isOpen ? Math.max(spinState.omegaY, 1.15) : spinState.omegaY;
  return {
    ...spinState,
    targetExploded: target,
    omegaY: boostOmega,
  };
}

/**
 * Evaluates the smooth polar radius R(angle) of a 5-pointed star at any angle,
 * using rounded cosine/Power interpolation at the tips and valleys so the star
 * contour is sleek and organic rather than sharp/jagged.
 */
export function getSmoothStarContourRadius(angle, {
  outerRadius = 0.552,
  innerRadius = 0.236,
  points = 5,
  sharpness = 1.55,
} = {}) {
  const sector = Math.PI / points;
  const wrapped = ((angle % (2 * sector)) + 2 * sector) % (2 * sector);
  const distFromTip = wrapped <= sector ? wrapped : 2 * sector - wrapped;
  const t = distFromTip / sector; // 0 at outer tip, 1 at inner valley
  // Smooth C1-continuous blend at the valley (t=1) with crisp but rounded star arms
  const shaped = Math.pow(Math.sin((t * Math.PI) / 2), sharpness);
  return outerRadius + (innerRadius - outerRadius) * shaped;
}

/**
 * Builds high-resolution, spherically curved, smooth-normal indexed BufferGeometry arrays
 * for a 5-pointed Crystal Star body and its raised 3D rounded rim ribbon.
 * Every grid vertex is projected onto the sphere so the star follows a true spherical arc.
 */
export function buildSmoothSphericalStarBuffers(starBasis, {
  sphereRadius = 1.0,
  outerTipRadius = 0.554,
  outerValleyRadius = 0.236,
  rimWidthRatio = 0.145,
  domeHeight = 0.036,
  rimHeight = 0.032,
  angularSegments = 120,
  radialSegments = 12,
  rimRadialSegments = 8,
} = {}) {
  const innerScale = 1 - rimWidthRatio;

  // 1. Smoothly domed inner crystal star body (polar grid with welded vertices for smooth normals)
  const bodyVertices = [];
  const bodyIndices = [];

  // Center vertex (index 0)
  const centerPos = projectStarLocalVertexToSphere(0, 0, domeHeight, starBasis, sphereRadius);
  bodyVertices.push(...centerPos);

  for (let rIdx = 1; rIdx <= radialSegments; rIdx += 1) {
    const frac = rIdx / radialSegments; // (0..1]
    // Smooth cosine pillow profile: smooth at center, smooth roll-off at rim edge
    const edgeRoll = Math.cos(frac * Math.PI * 0.5);
    const zHeight = 0.008 + domeHeight * Math.pow(edgeRoll, 0.72);

    for (let aIdx = 0; aIdx < angularSegments; aIdx += 1) {
      const angle = (aIdx / angularSegments) * Math.PI * 2;
      const contourR = getSmoothStarContourRadius(angle, {
        outerRadius: outerTipRadius * innerScale,
        innerRadius: outerValleyRadius * innerScale,
        points: 5,
        sharpness: 1.5,
      });
      const r = contourR * frac;
      const u = Math.cos(angle) * r;
      const v = Math.sin(angle) * r;
      const pos = projectStarLocalVertexToSphere(u, v, zHeight, starBasis, sphereRadius);
      bodyVertices.push(...pos);
    }
  }

  // Center fan triangles (ring 1)
  for (let aIdx = 0; aIdx < angularSegments; aIdx += 1) {
    const nextA = (aIdx + 1) % angularSegments;
    bodyIndices.push(0, 1 + aIdx, 1 + nextA);
  }

  // Quad rings (ring 1 .. radialSegments - 1)
  for (let rIdx = 1; rIdx < radialSegments; rIdx += 1) {
    const ringStart = 1 + (rIdx - 1) * angularSegments;
    const nextRingStart = 1 + rIdx * angularSegments;
    for (let aIdx = 0; aIdx < angularSegments; aIdx += 1) {
      const nextA = (aIdx + 1) % angularSegments;
      const i0 = ringStart + aIdx;
      const i1 = ringStart + nextA;
      const i2 = nextRingStart + aIdx;
      const i3 = nextRingStart + nextA;
      bodyIndices.push(i0, i2, i3);
      bodyIndices.push(i0, i3, i1);
    }
  }

  // 2. Smooth rounded 3D star rim ribbon (semi-tubular arch cross-section around the star contour)
  const rimVertices = [];
  const rimIndices = [];

  for (let rIdx = 0; rIdx <= rimRadialSegments; rIdx += 1) {
    const s = rIdx / rimRadialSegments; // 0 = inner rim edge, 1 = outer rim edge
    const scale = innerScale + (1 - innerScale) * s;
    // Smooth rounded arch profile across the rim width
    const arch = Math.sin(s * Math.PI);
    const zHeight = 0.005 + rimHeight * Math.pow(arch, 0.78);

    for (let aIdx = 0; aIdx < angularSegments; aIdx += 1) {
      const angle = (aIdx / angularSegments) * Math.PI * 2;
      const r = getSmoothStarContourRadius(angle, {
        outerRadius: outerTipRadius * scale,
        innerRadius: outerValleyRadius * scale,
        points: 5,
        sharpness: 1.5,
      });
      const u = Math.cos(angle) * r;
      const v = Math.sin(angle) * r;
      const pos = projectStarLocalVertexToSphere(u, v, zHeight, starBasis, sphereRadius);
      rimVertices.push(...pos);
    }
  }

  for (let rIdx = 0; rIdx < rimRadialSegments; rIdx += 1) {
    const ringStart = rIdx * angularSegments;
    const nextRingStart = (rIdx + 1) * angularSegments;
    for (let aIdx = 0; aIdx < angularSegments; aIdx += 1) {
      const nextA = (aIdx + 1) % angularSegments;
      const i0 = ringStart + aIdx;
      const i1 = ringStart + nextA;
      const i2 = nextRingStart + aIdx;
      const i3 = nextRingStart + nextA;
      rimIndices.push(i0, i2, i3);
      rimIndices.push(i0, i3, i1);
    }
  }

  return {
    bodyPositions: new Float32Array(bodyVertices),
    bodyIndices: new Uint16Array(bodyIndices),
    rimPositions: new Float32Array(rimVertices),
    rimIndices: new Uint16Array(rimIndices),
  };
}

/**
 * Builds non-indexed 3D triangle positions for a diamond-faceted 5-pointed crystal star
 * and its raised 3D beveled perimeter frame on the sphere.
 */
export function buildFacetedCrystalStarBuffers(starBasis, {
  sphereRadius = 0.99,
  outerTipRadius = 0.548,
  outerValleyRadius = 0.222,
  innerTipRadius = 0.452,
  innerValleyRadius = 0.178,
  apexHeight = 0.056,
  rimHeight = 0.042,
  baseHeight = 0.006,
} = {}) {
  const outerRing = buildStarPolygonPoints({ outerRadius: outerTipRadius, innerRadius: outerValleyRadius, points: 5 });
  const midRing = buildStarPolygonPoints({
    outerRadius: (outerTipRadius + innerTipRadius) * 0.5,
    innerRadius: (outerValleyRadius + innerValleyRadius) * 0.5,
    points: 5,
  });
  const innerRing = buildStarPolygonPoints({ outerRadius: innerTipRadius, innerRadius: innerValleyRadius, points: 5 });

  const facePositions = [];
  const rimPositions = [];

  const pushTri = (arr, pA, pB, pC) => {
    arr.push(pA[0], pA[1], pA[2], pB[0], pB[1], pB[2], pC[0], pC[1], pC[2]);
  };

  const centerApex = projectStarLocalVertexToSphere(0, 0, apexHeight, starBasis, sphereRadius);

  // 10 diamond-cut inner star facets + 10 beveled star rim segments
  for (let i = 0; i < 10; i += 1) {
    const next = (i + 1) % 10;
    const isTipA = i % 2 === 0;
    const isTipB = next % 2 === 0;

    // Inner crystal star facet (centerApex -> innerRing[i] -> innerRing[next])
    const zInnerA = isTipA ? rimHeight * 0.82 : rimHeight * 0.48;
    const zInnerB = isTipB ? rimHeight * 0.82 : rimHeight * 0.48;
    const pInnerA = projectStarLocalVertexToSphere(innerRing[i][0], innerRing[i][1], zInnerA, starBasis, sphereRadius);
    const pInnerB = projectStarLocalVertexToSphere(innerRing[next][0], innerRing[next][1], zInnerB, starBasis, sphereRadius);
    pushTri(facePositions, centerApex, pInnerA, pInnerB);

    // Beveled rim crown around the star perimeter (innerRing -> midRing ridge -> outerRing base)
    const pMidA = projectStarLocalVertexToSphere(midRing[i][0], midRing[i][1], rimHeight, starBasis, sphereRadius);
    const pMidB = projectStarLocalVertexToSphere(midRing[next][0], midRing[next][1], rimHeight, starBasis, sphereRadius);
    const pOuterA = projectStarLocalVertexToSphere(outerRing[i][0], outerRing[i][1], baseHeight, starBasis, sphereRadius);
    const pOuterB = projectStarLocalVertexToSphere(outerRing[next][0], outerRing[next][1], baseHeight, starBasis, sphereRadius);

    // Inner bevel slope (innerRing to midRing ridge)
    pushTri(rimPositions, pInnerA, pMidA, pMidB);
    pushTri(rimPositions, pInnerA, pMidB, pInnerB);

    // Outer bevel slope (midRing ridge to outerRing base)
    pushTri(rimPositions, pMidA, pOuterA, pOuterB);
    pushTri(rimPositions, pMidA, pOuterB, pMidB);
  }

  return {
    facePositions: new Float32Array(facePositions),
    rimPositions: new Float32Array(rimPositions),
  };
}

/**
 * Creates the initial inertial spin state for the 3D Crystal Starball.
 */
export function createStarballSpinState() {
  return {
    // Quaternion [x, y, z, w]
    quaternion: [0.11, -0.22, 0.04, Math.sqrt(1 - 0.11 * 0.11 - 0.22 * 0.22 - 0.04 * 0.04)],
    // Angular velocity (rad/s) around world X, Y, Z
    omegaX: 0.08,
    omegaY: 0.55,
    omegaZ: 0.04,
    // Idle auto-spin speed
    idleOmegaY: 0.42,
    autoRotate: true,
    isDragging: false,
    // Exploded view state (0 = closed crystal ball, 1 = stars & crystal facets expanded)
    exploded: 0,
    targetExploded: 0,
    // Active lighting preset
    lightPreset: 'neonYellow',
    // Zoom distance
    cameraDistance: 3.48,
    targetCameraDistance: 3.48,
    spinBoostCount: 0,
  };
}

function multiplyQuaternions(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  const rx = aw * bx + ax * bw + ay * bz - az * by;
  const ry = aw * by - ax * bz + ay * bw + az * bx;
  const rz = aw * bz + ax * by - ay * bx + az * bw;
  const rw = aw * bw - ax * bx - ay * by - az * bz;
  const len = Math.hypot(rx, ry, rz, rw) || 1;
  return [rx / len, ry / len, rz / len, rw / len];
}

function axisAngleToQuaternion(ax, ay, az, angle) {
  const len = Math.hypot(ax, ay, az);
  if (len < 1e-7 || Math.abs(angle) < 1e-7) return [0, 0, 0, 1];
  const half = angle * 0.5;
  const s = Math.sin(half) / len;
  return [ax * s, ay * s, az * s, Math.cos(half)];
}

/**
 * Applies pointer drag delta (dx, dy in pixels) to rotate the crystal ball freely in 360°
 * and imparts angular momentum for inertial spinning when released.
 */
export function applyDragDeltaToSpin(spinState, dx, dy, dt = 0.016, sensitivity = 0.0075) {
  if (!spinState) return spinState;
  const rotY = dx * sensitivity;
  const rotX = dy * sensitivity;
  const qYaw = axisAngleToQuaternion(0, 1, 0, rotY);
  const qPitch = axisAngleToQuaternion(1, 0, 0, rotX);
  const deltaQ = multiplyQuaternions(qYaw, qPitch);
  const nextQuat = multiplyQuaternions(deltaQ, spinState.quaternion);

  const safeDt = Math.max(0.004, Math.min(0.1, Number(dt) || 0.016));
  const instOmegaX = Math.max(-14, Math.min(14, rotX / safeDt));
  const instOmegaY = Math.max(-14, Math.min(14, rotY / safeDt));

  return {
    ...spinState,
    quaternion: nextQuat,
    omegaX: spinState.omegaX * 0.35 + instOmegaX * 0.65,
    omegaY: spinState.omegaY * 0.35 + instOmegaY * 0.65,
  };
}

/**
 * Triggers a high-energy ceremonial spin impulse on the 3D Crystal Starball.
 */
export function triggerSpinImpulse(spinState, direction = 1) {
  const dir = direction >= 0 ? 1 : -1;
  return {
    ...spinState,
    omegaY: dir * 6.8,
    omegaX: 1.35 * dir,
    omegaZ: 0.45,
    spinBoostCount: (spinState.spinBoostCount || 0) + 1,
  };
}

/**
 * Advances the crystal ball's quaternion orientation, angular momentum damping,
 * and exploded-view interpolation by `dt` seconds.
 */
export function stepStarballSpinPhysics(spinState, dt = 0.016) {
  const clampedDt = Math.max(0.001, Math.min(0.1, Number(dt) || 0.016));
  let {
    quaternion,
    omegaX,
    omegaY,
    omegaZ,
    idleOmegaY,
    autoRotate,
    isDragging,
    exploded,
    targetExploded,
    cameraDistance,
    targetCameraDistance,
  } = spinState;

  if (!isDragging) {
    const angularSpeed = Math.hypot(omegaX, omegaY, omegaZ);
    if (angularSpeed > 1e-4) {
      const deltaQ = axisAngleToQuaternion(omegaX, omegaY, omegaZ, angularSpeed * clampedDt);
      quaternion = multiplyQuaternions(deltaQ, quaternion);
    }
    const damping = Math.exp(-3.2 * clampedDt);
    const targetY = autoRotate ? idleOmegaY : 0;
    omegaX *= damping;
    omegaY = targetY + (omegaY - targetY) * damping;
    omegaZ *= damping;
  }

  const dampFactor = 1 - Math.exp(-8.5 * clampedDt);
  exploded += (targetExploded - exploded) * dampFactor;
  cameraDistance += (targetCameraDistance - cameraDistance) * dampFactor;

  return {
    ...spinState,
    quaternion,
    omegaX,
    omegaY,
    omegaZ,
    exploded,
    cameraDistance,
  };
}
