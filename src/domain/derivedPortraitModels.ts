import type {
  PortraitConstructionModel,
  PortraitRigGuide,
  RigGuideCategory,
  RigGuideGeometry,
  RigGuideLevel,
  RigPartId,
  RigVector3,
} from './portraitConstructionModel'

export type PortraitConstructionMethod = 'canonical' | 'loomis' | 'reilly' | 'asaro'

export type PortraitConstructionMethodPreset = Readonly<{
  id: PortraitConstructionMethod
  label: string
  description: string
}>

export const portraitConstructionMethods: Record<PortraitConstructionMethod, PortraitConstructionMethodPreset> = {
  canonical: {
    id: 'canonical',
    label: 'Canonique',
    description: 'Le rig commun et ses repères fondamentaux.',
  },
  loomis: {
    id: 'loomis',
    label: 'Loomis',
    description: 'Volume crânien, axe central, coupe latérale et raccord de la mâchoire.',
  },
  reilly: {
    id: 'reilly',
    label: 'Reilly',
    description: 'Rythmes continus reliant front, orbites, joues, bouche et menton.',
  },
  asaro: {
    id: 'asaro',
    label: 'Asaro',
    description: 'Plans du front, des joues, du nez, du museau et du menton.',
  },
}

export const isPortraitConstructionMethod = (value: unknown): value is PortraitConstructionMethod =>
  typeof value === 'string' && Object.hasOwn(portraitConstructionMethods, value)

const levelPriorities: Record<RigGuideLevel, PortraitRigGuide['priority']> = {
  essential: 1,
  construction: 2,
  detailed: 3,
  expert: 4,
}

const getGuide = (model: PortraitConstructionModel, id: string): PortraitRigGuide => {
  const guide = model.guides.find((item) => item.id === id)
  if (!guide) throw new Error(`Canonical guide not found: ${id}`)
  return guide
}

const getPoint = (model: PortraitConstructionModel, id: string): RigVector3 => {
  const geometry = getGuide(model, id).geometry
  if (geometry.kind !== 'point') throw new Error(`Canonical guide is not a point: ${id}`)
  return geometry.position
}

const getLine = (model: PortraitConstructionModel, id: string): Extract<RigGuideGeometry, { kind: 'line' }> => {
  const geometry = getGuide(model, id).geometry
  if (geometry.kind !== 'line') throw new Error(`Canonical guide is not a line: ${id}`)
  return geometry
}

const midpoint = (left: RigVector3, right: RigVector3): RigVector3 => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2,
  z: (left.z + right.z) / 2,
})

const derivedGuide = (
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
  priority: levelPriorities[level],
  visibility: true,
  style,
  source: 'canonical',
  confidence: null,
  locked: false,
})

const derivedPolyline = (
  id: string,
  partId: RigPartId,
  category: RigGuideCategory,
  points: readonly RigVector3[],
  closed = false,
): PortraitRigGuide => derivedGuide(
  id,
  partId,
  category,
  'construction',
  { kind: 'polyline', points, closed },
  'feature',
)

const createLoomisGuides = (model: PortraitConstructionModel): PortraitRigGuide[] => {
  const brow = getLine(model, 'brow-proportion')
  return [
    derivedPolyline('loomis-jaw-wedge', 'jaw', 'structure', [
      getPoint(model, 'left-temple'),
      brow.from,
      brow.to,
      getPoint(model, 'right-temple'),
      getPoint(model, 'right-jaw-angle'),
      getPoint(model, 'chin-center'),
      getPoint(model, 'left-jaw-angle'),
    ], true),
  ]
}

const createReillyGuides = (model: PortraitConstructionModel): PortraitRigGuide[] => [
  derivedPolyline('reilly-left-rhythm', 'face-plane', 'structure', [
    getPoint(model, 'left-temple'),
    getPoint(model, 'left-eye-outer-corner'),
    getPoint(model, 'left-jaw-angle'),
    getPoint(model, 'left-mouth-corner'),
    getPoint(model, 'chin-center'),
  ]),
  derivedPolyline('reilly-right-rhythm', 'face-plane', 'structure', [
    getPoint(model, 'right-temple'),
    getPoint(model, 'right-eye-outer-corner'),
    getPoint(model, 'right-jaw-angle'),
    getPoint(model, 'right-mouth-corner'),
    getPoint(model, 'chin-center'),
  ]),
  derivedPolyline('reilly-center-rhythm', 'face-plane', 'axes', [
    getPoint(model, 'forehead-center'),
    midpoint(getPoint(model, 'left-eye-center'), getPoint(model, 'right-eye-center')),
    getPoint(model, 'nose-tip'),
    getPoint(model, 'cupid-bow-center'),
    getPoint(model, 'chin-center'),
  ]),
]

const createAsaroGuides = (model: PortraitConstructionModel): PortraitRigGuide[] => {
  const brow = getLine(model, 'brow-proportion')
  return [
    derivedPolyline('asaro-forehead-plane', 'cranium', 'structure', [
      getPoint(model, 'left-temple'),
      getPoint(model, 'forehead-center'),
      getPoint(model, 'right-temple'),
      brow.to,
      brow.from,
    ], true),
    derivedPolyline('asaro-left-cheek-plane', 'face-plane', 'structure', [
      getPoint(model, 'left-temple'),
      getPoint(model, 'left-eye-outer-corner'),
      getPoint(model, 'left-nose-wing'),
      getPoint(model, 'left-jaw-angle'),
    ], true),
    derivedPolyline('asaro-right-cheek-plane', 'face-plane', 'structure', [
      getPoint(model, 'right-temple'),
      getPoint(model, 'right-eye-outer-corner'),
      getPoint(model, 'right-nose-wing'),
      getPoint(model, 'right-jaw-angle'),
    ], true),
    derivedPolyline('asaro-nose-plane', 'nose', 'nose', [
      getPoint(model, 'nose-tip'),
      getPoint(model, 'right-nose-wing'),
      getPoint(model, 'nose-base-center'),
      getPoint(model, 'left-nose-wing'),
    ], true),
    derivedPolyline('asaro-muzzle-plane', 'mouth', 'mouth', [
      getPoint(model, 'left-nose-wing'),
      getPoint(model, 'right-nose-wing'),
      getPoint(model, 'right-mouth-corner'),
      getPoint(model, 'cupid-bow-center'),
      getPoint(model, 'left-mouth-corner'),
    ], true),
    derivedPolyline('asaro-chin-plane', 'jaw', 'jaw', [
      getPoint(model, 'left-jaw-angle'),
      getPoint(model, 'right-jaw-angle'),
      getPoint(model, 'chin-center'),
    ], true),
  ]
}

const methodBaseGuideIds: Record<Exclude<PortraitConstructionMethod, 'canonical'>, ReadonlySet<string>> = {
  loomis: new Set([
    'cranium-volume',
    'head-major-axis',
    'face-midline',
    'brow-proportion',
    'cranium-equator',
    'cranium-transverse-axis',
    'face-outline',
    'jaw-contour',
    'face-third-upper',
    'face-width-axis',
  ]),
  reilly: new Set([
    'head-major-axis',
    'face-midline',
    'face-outline',
    'jaw-contour',
    'face-third-upper',
    'left-eye-contour',
    'right-eye-contour',
    'left-eyebrow',
    'right-eyebrow',
    'nose-bridge',
    'nose-base-curve',
    'upper-lip-contour',
    'lower-lip-contour',
  ]),
  asaro: new Set([
    'face-outline',
    'jaw-contour',
    'left-eye-contour',
    'right-eye-contour',
    'left-eyebrow',
    'right-eyebrow',
    'nose-bridge',
    'nose-base-curve',
    'upper-lip-contour',
    'lower-lip-contour',
  ]),
}

const methodGuideFactories: Record<
  Exclude<PortraitConstructionMethod, 'canonical'>,
  (model: PortraitConstructionModel) => PortraitRigGuide[]
> = {
  loomis: createLoomisGuides,
  reilly: createReillyGuides,
  asaro: createAsaroGuides,
}

export function derivePortraitConstructionModel(
  model: PortraitConstructionModel,
  method: PortraitConstructionMethod,
): PortraitConstructionModel {
  if (method === 'canonical') return model

  const preset = portraitConstructionMethods[method]
  return {
    ...model,
    modelId: `${model.modelId}-${method}`,
    name: `${model.name} · ${preset.label}`,
    description: preset.description,
    guides: [
      ...model.guides.map((guide) => ({
        ...guide,
        visibility: guide.visibility && methodBaseGuideIds[method].has(guide.id),
      })),
      ...methodGuideFactories[method](model),
    ],
  }
}
