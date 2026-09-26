import type { GuideAdjustments, GuideLevel } from '../types/project'

export type PortraitGuideMetrics = {
  centerX: number
  centerY: number
  headWidth: number
  headHeight: number
  browY: number
  eyeY: number
  noseY: number
  mouthY: number
  leftVerticalX: number
  rightVerticalX: number
  faceTilt: number
  faceOutlineRadiusX: number
  faceOutlineRadiusY: number
  horizontalGuideY: number[]
}

const guidePresets: Record<GuideLevel, {
  centerXRatio: number
  centerYRatio: number
  headWidthRatio: number
  headHeightRatio: number
  browOffsetRatio: number
  eyeOffsetRatio: number
  noseOffsetRatio: number
  mouthOffsetRatio: number
  verticalOffsetRatio: number
  faceTilt: number
}> = {
  essential: {
    centerXRatio: 0.51,
    centerYRatio: 0.43,
    headWidthRatio: 0.3,
    headHeightRatio: 0.46,
    browOffsetRatio: -0.03,
    eyeOffsetRatio: 0.09,
    noseOffsetRatio: 0.29,
    mouthOffsetRatio: 0.43,
    verticalOffsetRatio: 0.46,
    faceTilt: -0.05,
  },
  standard: {
    centerXRatio: 0.51,
    centerYRatio: 0.43,
    headWidthRatio: 0.31,
    headHeightRatio: 0.47,
    browOffsetRatio: -0.025,
    eyeOffsetRatio: 0.1,
    noseOffsetRatio: 0.3,
    mouthOffsetRatio: 0.45,
    verticalOffsetRatio: 0.48,
    faceTilt: -0.04,
  },
  detailed: {
    centerXRatio: 0.51,
    centerYRatio: 0.43,
    headWidthRatio: 0.32,
    headHeightRatio: 0.49,
    browOffsetRatio: -0.02,
    eyeOffsetRatio: 0.11,
    noseOffsetRatio: 0.31,
    mouthOffsetRatio: 0.47,
    verticalOffsetRatio: 0.5,
    faceTilt: -0.02,
  },
}

export function getPortraitGuideMetrics(
  imageWidth: number,
  imageHeight: number,
  level: GuideLevel,
  adjustments: GuideAdjustments = { headOffsetX: 0, headOffsetY: 0, scale: 1 },
): PortraitGuideMetrics {
  const preset = guidePresets[level]
  const centerX = imageWidth * preset.centerXRatio + adjustments.headOffsetX * imageWidth
  const centerY = imageHeight * preset.centerYRatio + adjustments.headOffsetY * imageHeight
  const headWidth = imageWidth * preset.headWidthRatio * adjustments.scale
  const headHeight = imageHeight * preset.headHeightRatio * adjustments.scale

  const metrics: PortraitGuideMetrics = {
    centerX,
    centerY,
    headWidth,
    headHeight,
    browY: centerY + headHeight * preset.browOffsetRatio,
    eyeY: centerY + headHeight * preset.eyeOffsetRatio,
    noseY: centerY + headHeight * preset.noseOffsetRatio,
    mouthY: centerY + headHeight * preset.mouthOffsetRatio,
    leftVerticalX: centerX - headWidth * preset.verticalOffsetRatio,
    rightVerticalX: centerX + headWidth * preset.verticalOffsetRatio,
    faceTilt: preset.faceTilt,
    faceOutlineRadiusX: headWidth / 2,
    faceOutlineRadiusY: headHeight / 2,
    horizontalGuideY: [
      centerY + headHeight * preset.browOffsetRatio,
      centerY + headHeight * preset.eyeOffsetRatio,
      centerY + headHeight * preset.noseOffsetRatio,
      centerY + headHeight * preset.mouthOffsetRatio,
    ],
  }

  return metrics
}
