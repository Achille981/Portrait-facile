import { createPortraitRig } from './portraitRig'
import type { PortraitRigParameters } from './portraitRig'
import { projectPortraitRig } from './portraitRigProjection'
import type { ProjectedPoint } from './portraitRigProjection'
import type { GuideAdjustments } from '../types/project'
import type { VisionLandmark } from '../types/vision'

export type ReferenceFitSuggestion = Readonly<{
  guideAdjustments: GuideAdjustments
  rigParameters: PortraitRigParameters
  quality: 'stable' | 'limited'
  wasClamped: boolean
}>

type Bounds = Readonly<{ left: number; top: number; right: number; bottom: number }>

const FIT_LANDMARK_INDICES = new Set([
  1, 10, 33, 61, 105, 127, 133, 145, 152, 159, 168, 197, 199, 234, 263, 291, 338, 356, 362, 374, 386, 395, 454,
])
const REQUIRED_LANDMARK_INDICES = [1, 33, 152, 234, 263, 454]
const MIN_FACE_WIDTH = 0.08
const MIN_FACE_HEIGHT = 0.08

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const quantile = (values: number[], amount: number): number => {
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * amount
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

const robustBounds = (points: readonly Pick<VisionLandmark, 'x' | 'y'>[]): Bounds | null => {
  if (points.length < 8) return null
  const left = quantile(points.map((point) => point.x), 0.05)
  const right = quantile(points.map((point) => point.x), 0.95)
  const top = quantile(points.map((point) => point.y), 0.05)
  const bottom = quantile(points.map((point) => point.y), 0.95)
  if (right - left < MIN_FACE_WIDTH || bottom - top < MIN_FACE_HEIGHT) return null
  if (left < 0 || top < 0 || right > 1 || bottom > 1) return null
  return { left, top, right, bottom }
}

const projectedBounds = (points: readonly ProjectedPoint[]): Bounds | null => {
  if (points.length < 3) return null
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  }
}

const getCanonicalFaceBounds = (
  parameters: PortraitRigParameters,
  imageWidth: number,
  imageHeight: number,
): Bounds | null => {
  const faceOutline = projectPortraitRig(createPortraitRig(parameters), {
    camera: parameters.camera,
    imageWidth,
    imageHeight,
  }).find((guide) => guide.id === 'face-outline')
  if (!faceOutline || faceOutline.geometry.kind !== 'polyline') return null
  return projectedBounds(faceOutline.geometry.points)
}

export function suggestReferenceFit(
  landmarks: readonly VisionLandmark[],
  currentParameters: PortraitRigParameters,
  imageWidth: number,
  imageHeight: number,
): ReferenceFitSuggestion | null {
  if (imageWidth <= 0 || imageHeight <= 0) return null

  const validLandmarks = landmarks.filter((point) =>
    FIT_LANDMARK_INDICES.has(point.index)
    && Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && point.x >= 0
    && point.x <= 1
    && point.y >= 0
    && point.y <= 1)
  const landmarkByIndex = new Map(validLandmarks.map((point) => [point.index, point]))
  if (REQUIRED_LANDMARK_INDICES.some((index) => !landmarkByIndex.has(index))) return null

  const referenceBounds = robustBounds(validLandmarks)
  if (!referenceBounds) return null

  const eyeA = landmarkByIndex.get(33)
  const eyeB = landmarkByIndex.get(263)
  if (!eyeA || !eyeB) return null
  const eyes = [eyeA, eyeB].sort((left, right) => left.x - right.x)
  const eyeDistance = Math.hypot(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y)
  if (eyeDistance < 0.04) return null

  const estimatedRoll = clamp(
    -Math.atan2(eyes[1].y - eyes[0].y, eyes[1].x - eyes[0].x) * 180 / Math.PI,
    -15,
    15,
  )
  const rigParameters: PortraitRigParameters = {
    ...currentParameters,
    pose: { ...currentParameters.pose, roll: estimatedRoll },
  }
  const modelBounds = getCanonicalFaceBounds(rigParameters, imageWidth, imageHeight)
  if (!modelBounds) return null

  const referenceWidth = referenceBounds.right - referenceBounds.left
  const referenceHeight = referenceBounds.bottom - referenceBounds.top
  const modelWidth = modelBounds.right - modelBounds.left
  const modelHeight = modelBounds.bottom - modelBounds.top
  if (modelWidth <= 0 || modelHeight <= 0) return null

  const requestedScale = Math.sqrt((referenceWidth / modelWidth) * (referenceHeight / modelHeight))
  const scale = clamp(requestedScale, 0.75, 1.35)
  const referenceCenterX = (referenceBounds.left + referenceBounds.right) / 2
  const referenceCenterY = (referenceBounds.top + referenceBounds.bottom) / 2
  const modelCenterX = (modelBounds.left + modelBounds.right) / 2
  const modelCenterY = (modelBounds.top + modelBounds.bottom) / 2
  const requestedOffsetX = referenceCenterX - (0.51 + (modelCenterX - 0.51) * scale)
  const requestedOffsetY = referenceCenterY - (0.43 + (modelCenterY - 0.43) * scale)
  const headOffsetX = clamp(requestedOffsetX, -0.25, 0.25)
  const headOffsetY = clamp(requestedOffsetY, -0.25, 0.25)

  return {
    guideAdjustments: { headOffsetX, headOffsetY, scale },
    rigParameters,
    quality: validLandmarks.length >= 16 ? 'stable' : 'limited',
    wasClamped: scale !== requestedScale || headOffsetX !== requestedOffsetX || headOffsetY !== requestedOffsetY,
  }
}
