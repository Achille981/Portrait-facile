import { defaultPortraitRigParameters, isPortraitRigView, normalizePortraitRigParameters } from '../domain/portraitRig'
import type { PortraitRigParameters, PortraitRigView } from '../domain/portraitRig'
import { isPortraitConstructionMethod } from '../domain/derivedPortraitModels'
import type { PortraitConstructionMethod } from '../domain/derivedPortraitModels'

export type GuideLevel = 'essential' | 'construction' | 'detailed' | 'expert'
export type GuideDisplayMode = 'both' | 'guide' | 'assistive'
export type VisionProviderName = 'none' | 'mediapipe'

export type GuideAdjustments = {
  headOffsetX: number
  headOffsetY: number
  scale: number
}

export type ProjectDocument = {
  id: string
  version: 5
  imageDataUrl?: string
  fileName: string
  level: GuideLevel
  gridVisible: boolean
  guidesVisible: boolean
  opacity: number
  zoom: number
  guideAdjustments: GuideAdjustments
  visionProvider: VisionProviderName
  visionEnabled: boolean
  guideDisplayMode: GuideDisplayMode
  showComparison: boolean
  rigView: PortraitRigView
  rigParameters: PortraitRigParameters
  constructionMethod: PortraitConstructionMethod
  updatedAt: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function normalizeProjectDocument(value: unknown): ProjectDocument | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null

  const defaults = createDefaultProject(value.id)
  const guideAdjustments = isRecord(value.guideAdjustments) ? value.guideAdjustments : {}

  return {
    ...defaults,
    ...value,
    id: value.id,
    version: 5,
    level: value.level === 'standard'
      ? 'construction'
      : value.level === 'essential' || value.level === 'construction' || value.level === 'detailed' || value.level === 'expert'
        ? value.level
        : defaults.level,
    rigView: isPortraitRigView(value.rigView) ? value.rigView : defaults.rigView,
    constructionMethod: isPortraitConstructionMethod(value.constructionMethod) ? value.constructionMethod : defaults.constructionMethod,
    guideAdjustments: {
      headOffsetX: typeof guideAdjustments.headOffsetX === 'number' ? guideAdjustments.headOffsetX : defaults.guideAdjustments.headOffsetX,
      headOffsetY: typeof guideAdjustments.headOffsetY === 'number' ? guideAdjustments.headOffsetY : defaults.guideAdjustments.headOffsetY,
      scale: typeof guideAdjustments.scale === 'number' ? guideAdjustments.scale : defaults.guideAdjustments.scale,
    },
    rigParameters: normalizePortraitRigParameters(value.rigParameters),
  } as ProjectDocument
}

export const defaultGuideAdjustments: GuideAdjustments = {
  headOffsetX: 0,
  headOffsetY: 0,
  scale: 1,
}

export const createDefaultProject = (id = 'current'): ProjectDocument => ({
  id,
  version: 5,
  fileName: '',
  level: 'construction',
  gridVisible: true,
  guidesVisible: true,
  opacity: 76,
  zoom: 1,
  guideAdjustments: { ...defaultGuideAdjustments },
  visionProvider: 'none',
  visionEnabled: false,
  guideDisplayMode: 'both',
  showComparison: false,
  rigView: 'front',
  rigParameters: normalizePortraitRigParameters(defaultPortraitRigParameters),
  constructionMethod: 'canonical',
  updatedAt: Date.now(),
})

export const defaultProject = createDefaultProject()
