import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export type VisionSuggestion = {
  landmarks: Array<{ x: number; y: number }>
  confidence: number
  label: string
}

export type VisionAnalysisResult = {
  suggestion: VisionSuggestion | null
  isAvailable: boolean
  provider: 'none' | 'mediapipe'
}

export type VisionProvider = {
  name: 'none' | 'mediapipe'
  isAvailable: () => Promise<boolean>
  analyze: (image: string) => Promise<VisionAnalysisResult>
}

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'

let faceLandmarker: any = null
let faceLandmarkerPromise: Promise<any> | null = null

const loadFaceLandmarker = async () => {
  if (faceLandmarker) return faceLandmarker
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = FilesetResolver.forVisionTasks(WASM_URL).then(async (vision) => {
      const landmarker = await FaceLandmarker.createFromModelPath(vision, MODEL_URL)
      faceLandmarker = landmarker
      return landmarker
    })
  }

  return faceLandmarkerPromise
}

const loadImage = (imageDataUrl: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('Unable to load image for vision analysis'))
  image.src = imageDataUrl
})

const KEY_FACE_INDICES = [
  1, 33, 61, 105, 133, 145, 159, 168, 197, 199, 263, 291, 362, 374, 386, 395, 454,
]

const normalizeLandmarks = (landmarks: Array<{ x: number; y: number }> = []): Array<{ x: number; y: number }> =>
  landmarks.map((point) => ({ x: point.x, y: point.y }))

const keepUsefulLandmarks = (landmarks: Array<{ x: number; y: number }> = []): Array<{ x: number; y: number }> => {
  const useful = new Map<number, { x: number; y: number }>()

  landmarks.forEach((point, index) => {
    if (KEY_FACE_INDICES.includes(index)) {
      useful.set(index, point)
    }
  })

  return Array.from(useful.values())
}

export const noVisionProvider: VisionProvider = {
  name: 'none',
  isAvailable: async () => false,
  analyze: async () => ({
    suggestion: null,
    isAvailable: false,
    provider: 'none',
  }),
}

export const createVisionProvider = (provider: 'none' | 'mediapipe'): VisionProvider => {
  if (provider === 'none') return noVisionProvider

  return {
    name: 'mediapipe',
    isAvailable: async () => {
      try {
        await loadFaceLandmarker()
        return true
      } catch {
        return false
      }
    },
    analyze: async (image) => {
      try {
        const imageElement = await loadImage(image)
        const landmarker = await loadFaceLandmarker()
        const result = landmarker.detect(imageElement)
        const faceLandmarks = result.faceLandmarks?.[0] ?? []

        if (!faceLandmarks.length) {
          return {
            suggestion: null,
            isAvailable: false,
            provider: 'mediapipe',
          }
        }

        const filteredLandmarks = keepUsefulLandmarks(normalizeLandmarks(faceLandmarks))

        return {
          suggestion: {
            landmarks: filteredLandmarks,
            confidence: 0.92,
            label: 'Aide assistée disponible',
          },
          isAvailable: true,
          provider: 'mediapipe',
        }
      } catch {
        return {
          suggestion: null,
          isAvailable: false,
          provider: 'mediapipe',
        }
      }
    },
  }
}
