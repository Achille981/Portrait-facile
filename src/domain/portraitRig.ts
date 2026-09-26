import { canonicalPortraitModel } from './portraitConstructionModel'
import type {
  PortraitConstructionModel,
  PortraitRigGuide,
  RigPartId,
  RigVector3,
} from './portraitConstructionModel'

export type PortraitRigDimensions = {
  headScale: number
  cranialWidth: number
  cranialHeight: number
  faceWidth: number
  faceHeight: number
  jawWidth: number
  jawHeight: number
  jawAngle: number
  chinWidth: number
  chinProjection: number
  eyeSpacing: number
  eyeWidth: number
  eyeHeight: number
  eyeTilt: number
  browHeight: number
  browTilt: number
  noseLength: number
  noseWidth: number
  noseProjection: number
  noseAngle: number
  mouthWidth: number
  mouthHeight: number
  mouthProjection: number
  earWidth: number
  earHeight: number
  earPosition: number
  neckWidth: number
  neckAngle: number
}

export type PortraitRigPose = {
  yaw: number
  pitch: number
  roll: number
}

export type PortraitRigGaze = {
  horizontal: number
  vertical: number
  convergence: number
}

export type PortraitRigExpression = {
  mouthOpen: number
  smile: number
  browRaiseLeft: number
  browRaiseRight: number
  eyeOpennessLeft: number
  eyeOpennessRight: number
  squint: number
  jawOpen: number
}

export type PortraitRigCamera = {
  scale: number
  perspective: number
}

export type PortraitRigView =
  | 'front'
  | 'three-quarter-left'
  | 'three-quarter-right'
  | 'profile-left'
  | 'profile-right'

export type PortraitRigViewPreset = Readonly<{
  id: PortraitRigView
  label: string
  description: string
  yaw: number
  pitch: number
  roll: number
  perspective: number
}>

export type PortraitRigParameters = {
  dimensions: PortraitRigDimensions
  pose: PortraitRigPose
  gaze: PortraitRigGaze
  expression: PortraitRigExpression
  camera: PortraitRigCamera
}

type Bounds = Readonly<{ min: number; max: number }>

export const portraitRigViewPresets: Record<PortraitRigView, PortraitRigViewPreset> = {
  front: {
    id: 'front',
    label: 'Front',
    description: 'Axe médian et symétrie apparente',
    yaw: 0,
    pitch: 0,
    roll: 0,
    perspective: 0.18,
  },
  'three-quarter-left': {
    id: 'three-quarter-left',
    label: '3/4 gauche',
    description: 'Rotation initiale vers la gauche',
    yaw: -32,
    pitch: 0,
    roll: 0,
    perspective: 0.58,
  },
  'three-quarter-right': {
    id: 'three-quarter-right',
    label: '3/4 droit',
    description: 'Rotation initiale vers la droite',
    yaw: 32,
    pitch: 0,
    roll: 0,
    perspective: 0.58,
  },
  'profile-left': {
    id: 'profile-left',
    label: 'Profil gauche',
    description: 'Silhouette et projection latérale vers la gauche',
    yaw: -82,
    pitch: 0,
    roll: 0,
    perspective: 0.78,
  },
  'profile-right': {
    id: 'profile-right',
    label: 'Profil droit',
    description: 'Silhouette et projection latérale vers la droite',
    yaw: 82,
    pitch: 0,
    roll: 0,
    perspective: 0.78,
  },
}

export const isPortraitRigView = (value: unknown): value is PortraitRigView =>
  typeof value === 'string' && Object.hasOwn(portraitRigViewPresets, value)

const dimensionBounds: Record<keyof PortraitRigDimensions, Bounds> = {
  headScale: { min: 0.75, max: 1.25 },
  cranialWidth: { min: 0.78, max: 1.22 },
  cranialHeight: { min: 0.78, max: 1.22 },
  faceWidth: { min: 0.78, max: 1.22 },
  faceHeight: { min: 0.78, max: 1.22 },
  jawWidth: { min: 0.72, max: 1.28 },
  jawHeight: { min: 0.78, max: 1.22 },
  jawAngle: { min: -18, max: 18 },
  chinWidth: { min: 0.75, max: 1.25 },
  chinProjection: { min: 0.75, max: 1.25 },
  eyeSpacing: { min: 0.82, max: 1.18 },
  eyeWidth: { min: 0.78, max: 1.22 },
  eyeHeight: { min: 0.78, max: 1.22 },
  eyeTilt: { min: -15, max: 15 },
  browHeight: { min: -0.18, max: 0.18 },
  browTilt: { min: -15, max: 15 },
  noseLength: { min: 0.78, max: 1.22 },
  noseWidth: { min: 0.78, max: 1.22 },
  noseProjection: { min: 0.75, max: 1.25 },
  noseAngle: { min: -12, max: 12 },
  mouthWidth: { min: 0.78, max: 1.22 },
  mouthHeight: { min: 0.78, max: 1.22 },
  mouthProjection: { min: 0.75, max: 1.25 },
  earWidth: { min: 0.78, max: 1.22 },
  earHeight: { min: 0.78, max: 1.22 },
  earPosition: { min: 0.82, max: 1.18 },
  neckWidth: { min: 0.78, max: 1.22 },
  neckAngle: { min: -12, max: 12 },
}

export const defaultPortraitRigParameters: PortraitRigParameters = {
  dimensions: {
    headScale: 1,
    cranialWidth: 1,
    cranialHeight: 1,
    faceWidth: 1,
    faceHeight: 1,
    jawWidth: 1,
    jawHeight: 1,
    jawAngle: 0,
    chinWidth: 1,
    chinProjection: 1,
    eyeSpacing: 1,
    eyeWidth: 1,
    eyeHeight: 1,
    eyeTilt: 0,
    browHeight: 0,
    browTilt: 0,
    noseLength: 1,
    noseWidth: 1,
    noseProjection: 1,
    noseAngle: 0,
    mouthWidth: 1,
    mouthHeight: 1,
    mouthProjection: 1,
    earWidth: 1,
    earHeight: 1,
    earPosition: 1,
    neckWidth: 1,
    neckAngle: 0,
  },
  pose: { yaw: 0, pitch: 0, roll: 0 },
  gaze: { horizontal: 0, vertical: 0, convergence: 0 },
  expression: {
    mouthOpen: 0,
    smile: 0,
    browRaiseLeft: 0,
    browRaiseRight: 0,
    eyeOpennessLeft: 1,
    eyeOpennessRight: 1,
    squint: 0,
    jawOpen: 0,
  },
  camera: { scale: 1, perspective: 0.18 },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const boundedValue = (value: unknown, fallback: number, bounds: Bounds): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(bounds.max, Math.max(bounds.min, value))
}

const readNumber = (
  value: unknown,
  key: string,
  fallback: number,
  bounds: Bounds,
): number => boundedValue(isRecord(value) ? value[key] : undefined, fallback, bounds)

const yawBounds = { min: -88, max: 88 }
const pitchBounds = { min: -45, max: 45 }
const rollBounds = { min: -45, max: 45 }
const normalizedBounds = { min: -1, max: 1 }
const unitBounds = { min: 0, max: 1 }

export function normalizePortraitRigParameters(value: unknown): PortraitRigParameters {
  const source = isRecord(value) ? value : {}
  const dimensionsSource = source.dimensions
  const poseSource = source.pose
  const gazeSource = source.gaze
  const expressionSource = source.expression
  const cameraSource = source.camera
  const dimensions = { ...defaultPortraitRigParameters.dimensions }

  for (const key of Object.keys(dimensionBounds) as Array<keyof PortraitRigDimensions>) {
    dimensions[key] = readNumber(
      dimensionsSource,
      key,
      defaultPortraitRigParameters.dimensions[key],
      dimensionBounds[key],
    )
  }

  return {
    dimensions,
    pose: {
      yaw: readNumber(poseSource, 'yaw', 0, yawBounds),
      pitch: readNumber(poseSource, 'pitch', 0, pitchBounds),
      roll: readNumber(poseSource, 'roll', 0, rollBounds),
    },
    gaze: {
      horizontal: readNumber(gazeSource, 'horizontal', 0, normalizedBounds),
      vertical: readNumber(gazeSource, 'vertical', 0, normalizedBounds),
      convergence: readNumber(gazeSource, 'convergence', 0, normalizedBounds),
    },
    expression: {
      mouthOpen: readNumber(expressionSource, 'mouthOpen', 0, unitBounds),
      smile: readNumber(expressionSource, 'smile', 0, unitBounds),
      browRaiseLeft: readNumber(expressionSource, 'browRaiseLeft', 0, normalizedBounds),
      browRaiseRight: readNumber(expressionSource, 'browRaiseRight', 0, normalizedBounds),
      eyeOpennessLeft: readNumber(expressionSource, 'eyeOpennessLeft', 1, unitBounds),
      eyeOpennessRight: readNumber(expressionSource, 'eyeOpennessRight', 1, unitBounds),
      squint: readNumber(expressionSource, 'squint', 0, unitBounds),
      jawOpen: readNumber(expressionSource, 'jawOpen', 0, unitBounds),
    },
    camera: {
      scale: readNumber(cameraSource, 'scale', 1, { min: 0.5, max: 2 }),
      perspective: readNumber(cameraSource, 'perspective', 0, unitBounds),
    },
  }
}

const rotateZ = (point: RigVector3, radians: number, pivot: RigVector3): RigVector3 => {
  const x = point.x - pivot.x
  const y = point.y - pivot.y
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    ...point,
    x: pivot.x + x * cosine - y * sine,
    y: pivot.y + x * sine + y * cosine,
  }
}

const rotatePose = (point: RigVector3, pose: PortraitRigPose): RigVector3 => {
  const yaw = pose.yaw * Math.PI / 180
  const pitch = pose.pitch * Math.PI / 180
  const roll = pose.roll * Math.PI / 180

  const afterYaw = {
    x: point.x * Math.cos(yaw) + point.z * Math.sin(yaw),
    y: point.y,
    z: -point.x * Math.sin(yaw) + point.z * Math.cos(yaw),
  }
  const afterPitch = {
    x: afterYaw.x,
    y: afterYaw.y * Math.cos(pitch) - afterYaw.z * Math.sin(pitch),
    z: afterYaw.y * Math.sin(pitch) + afterYaw.z * Math.cos(pitch),
  }
  return {
    x: afterPitch.x * Math.cos(roll) - afterPitch.y * Math.sin(roll),
    y: afterPitch.x * Math.sin(roll) + afterPitch.y * Math.cos(roll),
    z: afterPitch.z,
  }
}

const getEllipseAxes = (
  plane: 'xy' | 'xz' | 'yz',
  rotation: number,
): [RigVector3, RigVector3] => {
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  switch (plane) {
    case 'xy':
      return [{ x: cosine, y: sine, z: 0 }, { x: -sine, y: cosine, z: 0 }]
    case 'xz':
      return [{ x: cosine, y: 0, z: sine }, { x: -sine, y: 0, z: cosine }]
    case 'yz':
      return [{ x: 0, y: cosine, z: sine }, { x: 0, y: -sine, z: cosine }]
  }
}

const partScale = (partId: RigPartId, parameters: PortraitRigParameters): RigVector3 => {
  const dimensions = parameters.dimensions
  const scales: Record<RigPartId, RigVector3> = {
    head: { x: 1, y: 1, z: 1 },
    cranium: { x: dimensions.cranialWidth, y: dimensions.cranialHeight, z: 1 },
    'face-plane': { x: dimensions.faceWidth, y: dimensions.faceHeight, z: 1 },
    jaw: { x: dimensions.jawWidth, y: dimensions.jawHeight, z: 1 },
    eyes: { x: dimensions.eyeWidth, y: dimensions.eyeHeight, z: 1 },
    eyebrows: { x: 1, y: 1, z: 1 },
    nose: { x: dimensions.noseWidth, y: dimensions.noseLength, z: dimensions.noseProjection },
    mouth: { x: dimensions.mouthWidth, y: dimensions.mouthHeight, z: dimensions.mouthProjection },
    ears: { x: dimensions.earWidth, y: dimensions.earHeight, z: 1 },
    neck: { x: dimensions.neckWidth, y: 1, z: 1 },
  }
  const localScale = scales[partId]
  const inheritsFacePlane = ['jaw', 'eyes', 'eyebrows', 'nose', 'mouth'].includes(partId)
  return {
    x: localScale.x * dimensions.headScale * (inheritsFacePlane ? dimensions.faceWidth : 1),
    y: localScale.y * dimensions.headScale * (inheritsFacePlane ? dimensions.faceHeight : 1),
    z: localScale.z * dimensions.headScale,
  }
}

const ellipseAxisScale = (plane: 'xy' | 'xz' | 'yz', scale: RigVector3): [number, number] => {
  switch (plane) {
    case 'xy': return [scale.x, scale.y]
    case 'xz': return [scale.x, scale.z]
    case 'yz': return [scale.y, scale.z]
  }
}

const transformPartPoint = (
  point: RigVector3,
  partId: RigPartId,
  guideId: string,
  parameters: PortraitRigParameters,
): RigVector3 => {
  const dimensions = parameters.dimensions
  let next = {
    x: point.x * dimensions.headScale,
    y: point.y * dimensions.headScale,
    z: point.z * dimensions.headScale,
  }

  if (['jaw', 'eyes', 'eyebrows', 'nose', 'mouth'].includes(partId)) {
    next = {
      ...next,
      x: next.x * dimensions.faceWidth,
      y: -0.12 + (next.y + 0.12) * dimensions.faceHeight,
    }
  }

  if (partId === 'cranium') {
    next = {
      ...next,
      x: next.x * dimensions.cranialWidth,
      y: 0.34 + (next.y - 0.34) * dimensions.cranialHeight,
    }
  }

  if (partId === 'face-plane') {
    next = {
      ...next,
      x: next.x * dimensions.faceWidth,
      y: -0.12 + (next.y + 0.12) * dimensions.faceHeight,
    }
  }

  if (partId === 'jaw') {
    const pivot = { x: 0, y: -0.58, z: 0.47 }
    next = {
      ...next,
      x: next.x * dimensions.jawWidth * (next.y < -0.72 ? dimensions.chinWidth : 1),
      y: pivot.y + (next.y - pivot.y) * dimensions.jawHeight,
      z: next.z * (next.y < -0.72 ? dimensions.chinProjection : 1),
    }
    next = rotateZ(next, dimensions.jawAngle * Math.PI / 180, pivot)
  }

  if (partId === 'eyes') {
    const side = Math.sign(next.x)
    const eyeCenter = side * 0.23 * dimensions.eyeSpacing
    const pivot = { x: eyeCenter, y: 0.18, z: 0.5 }
    next = {
      ...next,
      x: pivot.x + (next.x - pivot.x) * dimensions.eyeWidth,
      y: pivot.y + (next.y - pivot.y) * dimensions.eyeHeight,
    }
    next = rotateZ(next, dimensions.eyeTilt * Math.PI / 180, pivot)
  }

  if (partId === 'eyebrows') {
    const side = Math.sign(next.x) || 1
    const pivot = { x: side * 0.22, y: 0.35, z: 0.45 }
    next = { ...next, y: next.y + dimensions.browHeight }
    next = rotateZ(next, dimensions.browTilt * Math.PI / 180, pivot)
  }

  if (partId === 'nose') {
    const pivot = { x: 0, y: -0.08, z: 0.5 }
    next = {
      ...next,
      x: next.x * dimensions.noseWidth,
      y: pivot.y + (next.y - pivot.y) * dimensions.noseLength,
      z: pivot.z + (next.z - pivot.z) * dimensions.noseProjection,
    }
    next = rotateZ(next, dimensions.noseAngle * Math.PI / 180, pivot)
  }

  if (partId === 'mouth') {
    const pivot = { x: 0, y: -0.57, z: 0.53 }
    next = {
      ...next,
      x: next.x * dimensions.mouthWidth,
      y: pivot.y + (next.y - pivot.y) * dimensions.mouthHeight,
      z: pivot.z + (next.z - pivot.z) * dimensions.mouthProjection,
    }
  }

  if (partId === 'ears') {
    const side = Math.sign(next.x) || 1
    const pivot = { x: side * 0.68 * dimensions.earPosition, y: -0.06, z: 0.06 }
    next = {
      x: pivot.x + (next.x - side * 0.68) * dimensions.earWidth,
      y: pivot.y + (next.y + 0.06) * dimensions.earHeight,
      z: next.z,
    }
  }

  if (partId === 'neck') {
    const pivot = { x: 0, y: -0.82, z: 0.25 }
    next = { ...next, x: next.x * dimensions.neckWidth }
    next = rotateZ(next, dimensions.neckAngle * Math.PI / 180, pivot)
  }

  if (partId === 'eyes' && guideId.includes('gaze-axis')) {
    next = {
      ...next,
      x: next.x + parameters.gaze.horizontal * 0.12,
      y: next.y + parameters.gaze.vertical * 0.12,
      z: next.z + parameters.gaze.convergence * Math.abs(next.x) * 0.08,
    }
  }

  if (partId === 'eyebrows') {
    const raise = next.x < 0
      ? parameters.expression.browRaiseLeft
      : parameters.expression.browRaiseRight
    next = { ...next, y: next.y + raise * 0.12 }
  }

  if (partId === 'eyes') {
    const openness = next.x < 0
      ? parameters.expression.eyeOpennessLeft
      : parameters.expression.eyeOpennessRight
    const eyeCenterY = 0.18
    const opennessFactor = openness * (1 - parameters.expression.squint)
    next = { ...next, y: eyeCenterY + (next.y - eyeCenterY) * opennessFactor }
  }

  if (partId === 'mouth') {
    const expression = parameters.expression
    const lowerLip = next.y < -0.57
    const openedY = lowerLip
      ? next.y - expression.mouthOpen * 0.12
      : next.y + expression.mouthOpen * 0.06
    next = {
      ...next,
      x: next.x * (1 + expression.smile * 0.08),
      y: openedY + Math.abs(next.x) * expression.smile * 0.06,
    }
  }

  if (partId === 'jaw' && next.y < -0.58) {
    next = { ...next, y: next.y - parameters.expression.jawOpen * 0.12 }
  }

  return rotatePose(next, parameters.pose)
}

const transformGeometry = (
  geometry: PortraitRigGuide['geometry'],
  guide: PortraitRigGuide,
  parameters: PortraitRigParameters,
): PortraitRigGuide['geometry'] => {
  const transformPoint = (point: RigVector3) =>
    transformPartPoint(point, guide.partId, guide.id, parameters)

  switch (geometry.kind) {
    case 'point':
      return { ...geometry, position: transformPoint(geometry.position) }
    case 'line':
      return { ...geometry, from: transformPoint(geometry.from), to: transformPoint(geometry.to) }
    case 'polyline':
      return { ...geometry, points: geometry.points.map(transformPoint) }
    case 'ellipse': {
      const scale = partScale(guide.partId, parameters)
      const [scaleU, scaleV] = ellipseAxisScale(geometry.plane, scale)
      const partTilt = guide.partId === 'eyes' ? parameters.dimensions.eyeTilt : 0
      const rotation = (geometry.rotation ?? 0) + partTilt * Math.PI / 180
      const [axisU, axisV] = getEllipseAxes(geometry.plane, rotation)
      return {
        ...geometry,
        center: transformPoint(geometry.center),
        radiusU: geometry.radiusU * scaleU,
        radiusV: geometry.radiusV * scaleV,
        rotation,
        axisU: rotatePose(axisU, parameters.pose),
        axisV: rotatePose(axisV, parameters.pose),
      }
    }
    case 'ellipsoid': {
      const scale = partScale(guide.partId, parameters)
      return {
        ...geometry,
        center: transformPoint(geometry.center),
        radii: {
          x: geometry.radii.x * scale.x,
          y: geometry.radii.y * scale.y,
          z: geometry.radii.z * scale.z,
        },
        axisU: rotatePose({ x: 1, y: 0, z: 0 }, parameters.pose),
        axisV: rotatePose({ x: 0, y: 1, z: 0 }, parameters.pose),
      }
    }
    case 'plane': {
      const scale = partScale(guide.partId, parameters)
      return {
        ...geometry,
        center: transformPoint(geometry.center),
        width: geometry.width * scale.x,
        height: geometry.height * scale.y,
        normal: rotatePose(geometry.normal, parameters.pose),
        axisU: rotatePose({ x: 1, y: 0, z: 0 }, parameters.pose),
        axisV: rotatePose({ x: 0, y: 1, z: 0 }, parameters.pose),
      }
    }
  }
}

export function createPortraitRig(
  suppliedParameters: unknown = defaultPortraitRigParameters,
  model: PortraitConstructionModel = canonicalPortraitModel,
): PortraitConstructionModel {
  const parameters = normalizePortraitRigParameters(suppliedParameters)
  if (JSON.stringify(parameters) === JSON.stringify(defaultPortraitRigParameters)) return model

  return {
    ...model,
    initialPose: parameters.pose,
    guides: model.guides.map((item) => ({
      ...item,
      geometry: transformGeometry(item.geometry, item, parameters),
    })),
  }
}

export function createPortraitRigForView(
  view: PortraitRigView,
  suppliedParameters: unknown = defaultPortraitRigParameters,
  model: PortraitConstructionModel = canonicalPortraitModel,
): PortraitConstructionModel {
  return createPortraitRig(initializePortraitRigView(view, suppliedParameters), model)
}

export function initializePortraitRigView(
  view: PortraitRigView,
  suppliedParameters: unknown = defaultPortraitRigParameters,
): PortraitRigParameters {
  const preset = portraitRigViewPresets[view]
  const parameters = normalizePortraitRigParameters(suppliedParameters)
  return {
    ...parameters,
    pose: { yaw: preset.yaw, pitch: preset.pitch, roll: preset.roll },
    camera: { ...parameters.camera, perspective: preset.perspective },
  }
}
