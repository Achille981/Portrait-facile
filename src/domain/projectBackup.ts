import { normalizeProjectDocument } from '../types/project'
import type { ProjectDocument } from '../types/project'

const BACKUP_FORMAT = 'portrait-facile-project'
const BACKUP_VERSION = 1
export const MAX_PROJECT_BACKUP_BYTES = 100 * 1024 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function serializeProjectBackup(project: ProjectDocument): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    project,
  }, null, 2)
}

export function parseProjectBackup(contents: string): ProjectDocument {
  let value: unknown
  try {
    value = JSON.parse(contents)
  } catch {
    throw new Error('Le fichier ne contient pas un JSON valide.')
  }

  if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.formatVersion !== BACKUP_VERSION) {
    throw new Error('Ce fichier n’est pas une sauvegarde Portrait Facile reconnue.')
  }

  const candidate = value.project
  if (!isRecord(candidate)
    || typeof candidate.id !== 'string'
    || typeof candidate.fileName !== 'string'
    || (candidate.imageDataUrl !== undefined
      && (typeof candidate.imageDataUrl !== 'string'
        || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(candidate.imageDataUrl)))
    || (candidate.level !== 'essential' && candidate.level !== 'construction'
      && candidate.level !== 'detailed' && candidate.level !== 'expert')
    || !isRecord(candidate.guideAdjustments)
    || typeof candidate.guideAdjustments.headOffsetX !== 'number'
    || !Number.isFinite(candidate.guideAdjustments.headOffsetX)
    || typeof candidate.guideAdjustments.headOffsetY !== 'number'
    || !Number.isFinite(candidate.guideAdjustments.headOffsetY)
    || typeof candidate.guideAdjustments.scale !== 'number'
    || !Number.isFinite(candidate.guideAdjustments.scale)
    || candidate.guideAdjustments.headOffsetX < -0.25 || candidate.guideAdjustments.headOffsetX > 0.25
    || candidate.guideAdjustments.headOffsetY < -0.25 || candidate.guideAdjustments.headOffsetY > 0.25
    || candidate.guideAdjustments.scale < 0.75 || candidate.guideAdjustments.scale > 1.35
    || typeof candidate.opacity !== 'number' || candidate.opacity < 20 || candidate.opacity > 100
    || typeof candidate.zoom !== 'number' || candidate.zoom < 0.5 || candidate.zoom > 2
    || typeof candidate.gridVisible !== 'boolean'
    || typeof candidate.guidesVisible !== 'boolean'
    || typeof candidate.visionEnabled !== 'boolean'
    || typeof candidate.showComparison !== 'boolean'
    || (candidate.visionProvider !== 'none' && candidate.visionProvider !== 'mediapipe')
    || (candidate.guideDisplayMode !== 'both' && candidate.guideDisplayMode !== 'guide'
      && candidate.guideDisplayMode !== 'assistive')) {
    throw new Error('La sauvegarde est incomplète ou contient des réglages invalides.')
  }

  const normalized = normalizeProjectDocument(candidate)
  if (!normalized) throw new Error('Le projet de cette sauvegarde ne peut pas être restauré.')
  return normalized
}
