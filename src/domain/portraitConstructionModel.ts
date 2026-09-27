export type RigVector3 = Readonly<{
  x: number
  y: number
  z: number
}>

export type RigPartId =
  | 'head'
  | 'cranium'
  | 'face-plane'
  | 'jaw'
  | 'eyes'
  | 'eyebrows'
  | 'nose'
  | 'mouth'
  | 'ears'
  | 'neck'

export type RigGuideLevel = 'essential' | 'construction' | 'detailed' | 'expert'

export type RigGuideCategory =
  | 'cranium'
  | 'structure'
  | 'axes'
  | 'proportions'
  | 'eyes'
  | 'eyebrows'
  | 'nose'
  | 'mouth'
  | 'jaw'
  | 'ears'
  | 'neck'

export type RigGuideGeometry =
  | { kind: 'point'; position: RigVector3 }
  | { kind: 'line'; from: RigVector3; to: RigVector3 }
  | { kind: 'polyline'; points: readonly RigVector3[]; closed?: boolean }
  | {
      kind: 'ellipse'
      plane: 'xy' | 'xz' | 'yz'
      center: RigVector3
      radiusU: number
      radiusV: number
      rotation?: number
      axisU?: RigVector3
      axisV?: RigVector3
    }
  | { kind: 'ellipsoid'; center: RigVector3; radii: RigVector3; axisU?: RigVector3; axisV?: RigVector3 }
  | {
      kind: 'plane'
      center: RigVector3
      width: number
      height: number
      normal: RigVector3
      axisU?: RigVector3
      axisV?: RigVector3
    }

export type PortraitRigPart = Readonly<{
  id: RigPartId
  parentId: RigPartId | null
  label: string
}>

export type PortraitRigGuide = Readonly<{
  id: string
  type: RigGuideGeometry['kind']
  partId: RigPartId
  category: RigGuideCategory
  level: RigGuideLevel
  geometry: RigGuideGeometry
  priority: 1 | 2 | 3 | 4
  visibility: boolean
  style: 'volume' | 'axis' | 'proportion' | 'feature' | 'landmark' | 'detail'
  source: 'canonical' | 'assistive' | 'manual'
  confidence: number | null
  locked: boolean
}>

export type PortraitConstructionModel = Readonly<{
  modelId: string
  version: number
  name: string
  description: string
  coordinateSystem: Readonly<{
    units: 'normalized-head-height'
    headHeight: 2
    origin: string
    positiveX: string
    positiveY: string
    positiveZ: string
  }>
  initialPose: Readonly<{ yaw: number; pitch: number; roll: number }>
  parts: readonly PortraitRigPart[]
  guides: readonly PortraitRigGuide[]
}>

const vector = (x: number, y: number, z: number): RigVector3 => ({ x, y, z })
const guidePriorities: Record<RigGuideLevel, PortraitRigGuide['priority']> = {
  essential: 1,
  construction: 2,
  detailed: 3,
  expert: 4,
}

const guide = (
  id: string,
  partId: RigPartId,
  category: RigGuideCategory,
  level: RigGuideLevel,
  geometry: RigGuideGeometry,
  style: PortraitRigGuide['style'],
): PortraitRigGuide => ({
  id,
  type: geometry.kind,
  partId,
  category,
  level,
  geometry,
  priority: guidePriorities[level],
  visibility: true,
  style,
  source: 'canonical',
  confidence: null,
  locked: false,
})

const point = (
  id: string,
  partId: RigPartId,
  category: RigGuideCategory,
  level: RigGuideLevel,
  position: RigVector3,
  style: PortraitRigGuide['style'] = 'landmark',
) => guide(id, partId, category, level, { kind: 'point', position }, style)

const line = (
  id: string,
  partId: RigPartId,
  category: RigGuideCategory,
  level: RigGuideLevel,
  from: RigVector3,
  to: RigVector3,
  style: PortraitRigGuide['style'] = 'proportion',
) => guide(id, partId, category, level, { kind: 'line', from, to }, style)

const polyline = (
  id: string,
  partId: RigPartId,
  category: RigGuideCategory,
  level: RigGuideLevel,
  points: readonly RigVector3[],
  style: PortraitRigGuide['style'] = 'feature',
  closed = false,
) => guide(id, partId, category, level, { kind: 'polyline', points, closed }, style)

const ellipse = (
  id: string,
  partId: RigPartId,
  category: RigGuideCategory,
  level: RigGuideLevel,
  plane: 'xy' | 'xz' | 'yz',
  center: RigVector3,
  radiusU: number,
  radiusV: number,
  style: PortraitRigGuide['style'] = 'volume',
) => guide(id, partId, category, level, {
  kind: 'ellipse',
  plane,
  center,
  radiusU,
  radiusV,
}, style)

const left = (x: number, y: number, z: number) => vector(-x, y, z)
const right = (x: number, y: number, z: number) => vector(x, y, z)

const parts: readonly PortraitRigPart[] = [
  { id: 'head', parentId: null, label: 'Tête' },
  { id: 'cranium', parentId: 'head', label: 'Crâne' },
  { id: 'face-plane', parentId: 'head', label: 'Plan facial' },
  { id: 'jaw', parentId: 'face-plane', label: 'Mâchoire et menton' },
  { id: 'eyes', parentId: 'face-plane', label: 'Yeux' },
  { id: 'eyebrows', parentId: 'face-plane', label: 'Sourcils' },
  { id: 'nose', parentId: 'face-plane', label: 'Nez' },
  { id: 'mouth', parentId: 'face-plane', label: 'Bouche' },
  { id: 'ears', parentId: 'head', label: 'Oreilles' },
  { id: 'neck', parentId: 'head', label: 'Cou' },
]

const guides: readonly PortraitRigGuide[] = [
  guide('cranium-volume', 'cranium', 'cranium', 'essential', {
    kind: 'ellipsoid',
    center: vector(0, 0.34, -0.02),
    radii: vector(0.66, 0.66, 0.48),
  }, 'volume'),
  line('head-major-axis', 'head', 'axes', 'essential', vector(0, 1, 0.05), vector(0, -0.98, 0.45), 'axis'),
  line('face-midline', 'face-plane', 'axes', 'essential', vector(0, 0.36, 0.47), vector(0, -0.96, 0.52), 'axis'),
  line('brow-proportion', 'face-plane', 'proportions', 'essential', left(0.5, 0.31, 0.46), right(0.5, 0.31, 0.46)),
  line('eye-proportion', 'eyes', 'proportions', 'essential', left(0.5, 0.18, 0.48), right(0.5, 0.18, 0.48)),
  line('nose-proportion', 'nose', 'proportions', 'essential', left(0.42, -0.34, 0.53), right(0.42, -0.34, 0.53)),
  line('mouth-proportion', 'mouth', 'proportions', 'essential', left(0.36, -0.55, 0.52), right(0.36, -0.55, 0.52)),
  line('chin-proportion', 'jaw', 'proportions', 'essential', left(0.25, -0.83, 0.45), right(0.25, -0.83, 0.45)),

  ellipse('cranial-equator', 'cranium', 'cranium', 'construction', 'xz', vector(0, 0.34, -0.02), 0.66, 0.48),
  line('cranium-transverse-axis', 'cranium', 'axes', 'construction', left(0.66, 0.34, -0.02), right(0.66, 0.34, -0.02), 'axis'),
  guide('facial-plane', 'face-plane', 'structure', 'construction', {
    kind: 'plane',
    center: vector(0, -0.12, 0.3),
    width: 0.96,
    height: 1.42,
    normal: vector(0, 0, 1),
  }, 'volume'),
  polyline('face-outline', 'face-plane', 'structure', 'construction', [
    left(0.38, 0.36, 0.35),
    left(0.44, 0.08, 0.42),
    left(0.4, -0.28, 0.48),
    left(0.27, -0.68, 0.48),
    vector(0, -0.96, 0.47),
    right(0.27, -0.68, 0.48),
    right(0.4, -0.28, 0.48),
    right(0.44, 0.08, 0.42),
    right(0.38, 0.36, 0.35),
  ], 'volume'),
  {
    ...polyline('profile-contour', 'face-plane', 'structure', 'construction', [
      vector(0, 1, -0.02),
      vector(0, 0.68, 0.24),
      vector(0, 0.43, 0.4),
      vector(0, 0.29, 0.48),
      vector(0, 0.11, 0.52),
      vector(0, -0.08, 0.59),
      vector(0, -0.34, 0.7),
      vector(0, -0.4, 0.59),
      vector(0, -0.5, 0.6),
      vector(0, -0.57, 0.62),
      vector(0, -0.63, 0.59),
      vector(0, -0.77, 0.52),
      vector(0, -0.94, 0.48),
      vector(0, -1, 0.37),
      vector(0, -0.91, 0.2),
      vector(0, -0.55, 0.05),
      vector(0, -0.18, -0.28),
      vector(0, 0.38, -0.48),
      vector(0, 0.77, -0.3),
      vector(0, 1, -0.02),
    ], 'volume', true),
    visibility: false,
  },
  polyline('jaw-contour', 'jaw', 'jaw', 'construction', [
    left(0.4, -0.25, 0.46),
    left(0.35, -0.52, 0.49),
    left(0.25, -0.76, 0.48),
    vector(0, -0.96, 0.47),
    right(0.25, -0.76, 0.48),
    right(0.35, -0.52, 0.49),
    right(0.4, -0.25, 0.46),
  ], 'feature'),
  line('face-third-upper', 'face-plane', 'proportions', 'construction', left(0.43, 0.31, 0.46), right(0.43, 0.31, 0.46)),
  line('face-third-lower', 'face-plane', 'proportions', 'construction', left(0.4, -0.34, 0.53), right(0.4, -0.34, 0.53)),
  line('face-width-axis', 'face-plane', 'axes', 'construction', left(0.45, 0.04, 0.43), right(0.45, 0.04, 0.43), 'axis'),
  ellipse('left-orbit', 'eyes', 'eyes', 'construction', 'xy', left(0.23, 0.18, 0.48), 0.21, 0.14, 'volume'),
  ellipse('right-orbit', 'eyes', 'eyes', 'construction', 'xy', right(0.23, 0.18, 0.48), 0.21, 0.14, 'volume'),
  polyline('nose-bridge', 'nose', 'nose', 'construction', [
    vector(0, 0.2, 0.48),
    vector(0, -0.08, 0.55),
    vector(0, -0.34, 0.65),
  ]),
  line('nose-base', 'nose', 'nose', 'construction', left(0.16, -0.36, 0.56), right(0.16, -0.36, 0.56)),
  polyline('neck-contour', 'neck', 'neck', 'construction', [
    left(0.3, -0.82, 0.25),
    left(0.34, -1.18, 0.2),
    left(0.52, -1.58, 0.08),
  ]),
  polyline('neck-contour-opposite', 'neck', 'neck', 'construction', [
    right(0.3, -0.82, 0.25),
    right(0.34, -1.18, 0.2),
    right(0.52, -1.58, 0.08),
  ]),

  point('crown', 'cranium', 'cranium', 'detailed', vector(0, 1, 0)),
  point('rear-cranium', 'cranium', 'cranium', 'detailed', vector(0, 0.32, -0.5)),
  point('forehead-center', 'cranium', 'cranium', 'detailed', vector(0, 0.55, 0.38)),
  point('left-temple', 'cranium', 'cranium', 'detailed', left(0.57, 0.17, 0.25)),
  point('right-temple', 'cranium', 'cranium', 'detailed', right(0.57, 0.17, 0.25)),
  point('left-jaw-angle', 'jaw', 'jaw', 'detailed', left(0.38, -0.38, 0.46)),
  point('right-jaw-angle', 'jaw', 'jaw', 'detailed', right(0.38, -0.38, 0.46)),
  point('chin-center', 'jaw', 'jaw', 'detailed', vector(0, -0.96, 0.47)),

  point('left-eye-inner-corner', 'eyes', 'eyes', 'detailed', left(0.1, 0.18, 0.51)),
  point('left-eye-outer-corner', 'eyes', 'eyes', 'detailed', left(0.37, 0.18, 0.46)),
  point('right-eye-inner-corner', 'eyes', 'eyes', 'detailed', right(0.1, 0.18, 0.51)),
  point('right-eye-outer-corner', 'eyes', 'eyes', 'detailed', right(0.37, 0.18, 0.46)),
  point('left-eye-center', 'eyes', 'eyes', 'detailed', left(0.23, 0.18, 0.53)),
  point('right-eye-center', 'eyes', 'eyes', 'detailed', right(0.23, 0.18, 0.53)),
  polyline('left-eye-contour', 'eyes', 'eyes', 'detailed', [
    left(0.1, 0.18, 0.51),
    left(0.18, 0.24, 0.53),
    left(0.28, 0.24, 0.51),
    left(0.37, 0.18, 0.46),
    left(0.28, 0.12, 0.51),
    left(0.18, 0.12, 0.53),
  ]),
  polyline('right-eye-contour', 'eyes', 'eyes', 'detailed', [
    right(0.1, 0.18, 0.51),
    right(0.18, 0.24, 0.53),
    right(0.28, 0.24, 0.51),
    right(0.37, 0.18, 0.46),
    right(0.28, 0.12, 0.51),
    right(0.18, 0.12, 0.53),
  ]),
  polyline('left-eyebrow', 'eyebrows', 'eyebrows', 'detailed', [
    left(0.08, 0.34, 0.45),
    left(0.22, 0.39, 0.45),
    left(0.39, 0.34, 0.4),
  ]),
  polyline('right-eyebrow', 'eyebrows', 'eyebrows', 'detailed', [
    right(0.08, 0.34, 0.45),
    right(0.22, 0.39, 0.45),
    right(0.39, 0.34, 0.4),
  ]),

  point('nose-tip', 'nose', 'nose', 'detailed', vector(0, -0.34, 0.67)),
  point('left-nose-wing', 'nose', 'nose', 'detailed', left(0.16, -0.36, 0.56)),
  point('right-nose-wing', 'nose', 'nose', 'detailed', right(0.16, -0.36, 0.56)),
  point('nose-base-center', 'nose', 'nose', 'detailed', vector(0, -0.39, 0.57)),
  polyline('nose-base-curve', 'nose', 'nose', 'detailed', [
    left(0.16, -0.36, 0.56),
    left(0.08, -0.41, 0.59),
    vector(0, -0.42, 0.6),
    right(0.08, -0.41, 0.59),
    right(0.16, -0.36, 0.56),
  ]),
  point('left-mouth-corner', 'mouth', 'mouth', 'detailed', left(0.31, -0.55, 0.52)),
  point('right-mouth-corner', 'mouth', 'mouth', 'detailed', right(0.31, -0.55, 0.52)),
  point('cupid-bow-center', 'mouth', 'mouth', 'detailed', vector(0, -0.51, 0.56)),
  line('mouth-opening', 'mouth', 'mouth', 'detailed', left(0.28, -0.56, 0.55), right(0.28, -0.56, 0.55), 'detail'),
  polyline('upper-lip-contour', 'mouth', 'mouth', 'detailed', [
    left(0.31, -0.55, 0.52),
    left(0.14, -0.51, 0.55),
    vector(0, -0.54, 0.57),
    right(0.14, -0.51, 0.55),
    right(0.31, -0.55, 0.52),
  ]),
  polyline('lower-lip-contour', 'mouth', 'mouth', 'detailed', [
    left(0.31, -0.56, 0.52),
    left(0.16, -0.62, 0.54),
    vector(0, -0.64, 0.55),
    right(0.16, -0.62, 0.54),
    right(0.31, -0.56, 0.52),
  ]),
  ellipse('left-ear-construction', 'ears', 'ears', 'detailed', 'xy', left(0.68, -0.06, 0.06), 0.13, 0.25, 'feature'),
  ellipse('right-ear-construction', 'ears', 'ears', 'detailed', 'xy', right(0.68, -0.06, 0.06), 0.13, 0.25, 'feature'),
  point('left-ear-top', 'ears', 'ears', 'detailed', left(0.68, 0.19, 0.06)),
  point('left-ear-base', 'ears', 'ears', 'detailed', left(0.68, -0.31, 0.06)),
  point('right-ear-top', 'ears', 'ears', 'detailed', right(0.68, 0.19, 0.06)),
  point('right-ear-base', 'ears', 'ears', 'detailed', right(0.68, -0.31, 0.06)),

  line('left-eye-gaze-axis', 'eyes', 'axes', 'expert', left(0.23, 0.18, 0.53), left(0.4, 0.18, 0.53), 'axis'),
  line('right-eye-gaze-axis', 'eyes', 'axes', 'expert', right(0.23, 0.18, 0.53), right(0.4, 0.18, 0.53), 'axis'),
  line('jaw-hinge-axis', 'jaw', 'axes', 'expert', left(0.38, -0.38, 0.46), right(0.38, -0.38, 0.46), 'axis'),
  ellipse('nose-projection-ellipse', 'nose', 'structure', 'expert', 'xz', vector(0, -0.34, 0.5), 0.16, 0.17, 'detail'),
  line('neck-center-axis', 'neck', 'axes', 'expert', vector(0, -0.88, 0.26), vector(0, -1.58, 0.08), 'axis'),
]

export const canonicalPortraitModel: PortraitConstructionModel = {
  modelId: 'portrait-head-canonical',
  version: 1,
  name: 'Tête canonique',
  description: 'Volume de construction canonique, normalisé et conçu pour être transformé par un rig paramétrique partagé.',
  coordinateSystem: {
    units: 'normalized-head-height',
    headHeight: 2,
    origin: 'centre du volume crânien',
    positiveX: 'gauche anatomique du sujet',
    positiveY: 'vers le sommet du crâne',
    positiveZ: 'vers l’avant du visage',
  },
  initialPose: { yaw: 0, pitch: 0, roll: 0 },
  parts,
  guides,
}
