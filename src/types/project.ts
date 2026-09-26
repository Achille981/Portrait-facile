export type GuideLevel = 'essential' | 'standard' | 'detailed'
export type GuideDisplayMode = 'both' | 'guide' | 'assistive'
export type VisionProviderName = 'none' | 'mediapipe'

export type GuideAdjustments = {
  headOffsetX: number
  headOffsetY: number
  scale: number
}

export type ProjectDocument = {
  id: string
  version: 1
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
  updatedAt: number
}

export const defaultGuideAdjustments: GuideAdjustments = {
  headOffsetX: 0,
  headOffsetY: 0,
  scale: 1,
}

export const createDefaultProject = (id = 'current'): ProjectDocument => ({
  id,
  version: 1,
  fileName: '',
  level: 'standard',
  gridVisible: true,
  guidesVisible: true,
  opacity: 76,
  zoom: 1,
  guideAdjustments: { ...defaultGuideAdjustments },
  visionProvider: 'none',
  visionEnabled: false,
  guideDisplayMode: 'both',
  showComparison: false,
  updatedAt: Date.now(),
})

export const defaultProject = createDefaultProject()
