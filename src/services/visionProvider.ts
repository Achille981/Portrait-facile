import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { VisionLandmark } from '../types/vision'

export type VisionSuggestion = {
  landmarks: VisionLandmark[]
  label: string
}

export type VisionAnalysisResult = {
  suggestion: VisionSuggestion | null
  isAvailable: boolean
  provider: 'none' | 'mediapipe'
  error?: string
}

export type VisionProvider = {
  name: 'none' | 'mediapipe'
  isAvailable: () => Promise<boolean>
  analyze: (image: string) => Promise<VisionAnalysisResult>
}

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'

let faceLandmarker: FaceLandmarker | null = null
let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null

const loadFaceLandmarker = async () => {
  if (faceLandmarker) return faceLandmarker
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = FilesetResolver.forVisionTasks(WASM_URL).then(async (vision) => {
      const landmarker = await FaceLandmarker.createFromModelPath(vision, MODEL_URL)
      faceLandmarker = landmarker
      return landmarker
    })
  }

  try {
    return await faceLandmarkerPromise
  } catch (error) {
    faceLandmarkerPromise = null
    throw error
  }
}

const loadImage = (imageDataUrl: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('Unable to load image for vision analysis'))
  image.src = imageDataUrl
})

const KEY_FACE_INDICES = [
  1, 10, 33, 61, 105, 127, 133, 145, 152, 159, 168, 197, 199, 234, 263, 291, 338, 356, 362, 374, 386, 395, 454,
]

const normalizeLandmarks = (landmarks: NormalizedLandmark[] = []): VisionLandmark[] =>
  landmarks.map((point, index) => ({ index, x: point.x, y: point.y, z: point.z }))

const keepUsefulLandmarks = (landmarks: VisionLandmark[] = []): VisionLandmark[] => {
  const useful = new Map<number, VisionLandmark>()

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
            isAvailable: true,
            provider: 'mediapipe',
            error: 'Aucun visage exploitable n’a été détecté dans cette image.',
          }
        }

        const filteredLandmarks = keepUsefulLandmarks(normalizeLandmarks(faceLandmarks))

        return {
          suggestion: {
            landmarks: filteredLandmarks,
            label: 'Repères détectés · estimation assistée',
          },
          isAvailable: true,
          provider: 'mediapipe',
        }
      } catch (error) {
        return {
          suggestion: null,
          isAvailable: false,
          provider: 'mediapipe',
          error: error instanceof Error ? error.message : 'L’analyse assistée a échoué.',
        }
      }
    },
  }
}
