import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortraitRig, defaultPortraitRigParameters, initializePortraitRigView, portraitRigViewPresets } from './domain/portraitRig'
import type {
  PortraitRigDimensions,
  PortraitRigExpression,
  PortraitRigGaze,
  PortraitRigPose,
  PortraitRigView,
} from './domain/portraitRig'
import { getRelevantPortraitRigGuides, projectPortraitRig } from './domain/portraitRigProjection'
import type { ProjectedPortraitRigGuide } from './domain/portraitRigProjection'
import { suggestReferenceFit } from './domain/referenceFitting'
import { derivePortraitConstructionModel, portraitConstructionMethods } from './domain/derivedPortraitModels'
import type { PortraitConstructionMethod } from './domain/derivedPortraitModels'
import { MAX_PROJECT_BACKUP_BYTES, parseProjectBackup, serializeProjectBackup } from './domain/projectBackup'
import { createVisionProvider } from './services/visionProvider'
import { useProjectStore } from './stores/projectStore'
import type { GuideAdjustments, GuideDisplayMode, GuideLevel, VisionProviderName } from './types/project'
import type { VisionLandmark } from './types/vision'
import './App.css'

const levelLabels: Record<GuideLevel, string> = {
  essential: 'Essentiel',
  construction: 'Construction',
  detailed: 'Détaillé',
  expert: 'Expert',
}

const emptyVisionLandmarks: VisionLandmark[] = []

type GuideCanvasBounds = Readonly<{
  left: number
  top: number
  right: number
  bottom: number
  imageLeft: number
  imageTop: number
  imageWidth: number
  imageHeight: number
}>

type GuidePointerDrag = {
  pointerId: number
  mode: 'move' | 'scale'
  projectId: string
  startX: number
  startY: number
  startBounds: GuideCanvasBounds
  startAdjustments: GuideAdjustments
  latestAdjustments: GuideAdjustments
}

const guideLevelRank = {
  essential: 1,
  construction: 2,
  detailed: 3,
  expert: 4,
} as const

const guideColors: Record<ProjectedPortraitRigGuide['category'], string> = {
  cranium: '#d86b54',
  structure: '#d86b54',
  axes: '#607f9d',
  proportions: '#e5a048',
  eyes: '#607f9d',
  eyebrows: '#607f9d',
  nose: '#607f9d',
  mouth: '#607f9d',
  jaw: '#d86b54',
  ears: '#607f9d',
  neck: '#d86b54',
}

function getGuideCanvasBounds(
  guides: readonly ProjectedPortraitRigGuide[],
  level: GuideLevel,
  imageLeft: number,
  imageTop: number,
  imageWidth: number,
  imageHeight: number,
): GuideCanvasBounds | null {
  const points = guides.flatMap((guide) => {
    if (!guide.visibility || guideLevelRank[guide.level] > guideLevelRank[level]) return []
    const geometry = guide.geometry
    if (geometry.kind === 'point') return [geometry.position]
    if (geometry.kind === 'line') return [geometry.from, geometry.to]
    return geometry.points
  })
  if (points.length === 0) return null

  const left = imageLeft + clamp(Math.min(...points.map((point) => point.x)), 0, 1) * imageWidth
  const top = imageTop + clamp(Math.min(...points.map((point) => point.y)), 0, 1) * imageHeight
  const right = imageLeft + clamp(Math.max(...points.map((point) => point.x)), 0, 1) * imageWidth
  const bottom = imageTop + clamp(Math.max(...points.map((point) => point.y)), 0, 1) * imageHeight

  if (![left, top, right, bottom].every(Number.isFinite) || right - left < 24 || bottom - top < 24) return null
  return { left, top, right, bottom, imageLeft, imageTop, imageWidth, imageHeight }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const keepGuideCenterWhileScaling = (
  bounds: GuideCanvasBounds,
  startAdjustments: GuideAdjustments,
  nextScale: number,
): GuideAdjustments => {
  const centerX = ((bounds.left + bounds.right) / 2 - bounds.imageLeft) / bounds.imageWidth
  const centerY = ((bounds.top + bounds.bottom) / 2 - bounds.imageTop) / bounds.imageHeight
  const canonicalCenterX = 0.51 + (centerX - startAdjustments.headOffsetX - 0.51) / startAdjustments.scale
  const canonicalCenterY = 0.43 + (centerY - startAdjustments.headOffsetY - 0.43) / startAdjustments.scale
  return {
    headOffsetX: clamp(centerX - (0.51 + (canonicalCenterX - 0.51) * nextScale), -0.25, 0.25),
    headOffsetY: clamp(centerY - (0.43 + (canonicalCenterY - 0.43) * nextScale), -0.25, 0.25),
    scale: nextScale,
  }
}

function drawPortraitGuides(
  context: CanvasRenderingContext2D,
  guides: ProjectedPortraitRigGuide[],
  level: GuideLevel,
  imageWidth: number,
  imageHeight: number,
  lineScaleOverride?: number,
) {
  const maxLevel = guideLevelRank[level]
  const lineScale = lineScaleOverride ?? Math.max(0.8, Math.min(1.5, Math.min(imageWidth, imageHeight) / 700))

  guides.forEach((guide) => {
    if (!guide.visibility || guideLevelRank[guide.level] > maxLevel) return
    const geometry = guide.geometry
    context.strokeStyle = guideColors[guide.category]
    context.fillStyle = guideColors[guide.category]
    context.lineWidth = (guide.style === 'volume' ? 1.5 : 1.1) * lineScale
    context.setLineDash(guide.style === 'volume' ? [7 * lineScale, 5 * lineScale] : [])
    context.beginPath()

    if (geometry.kind === 'point') {
      context.arc(
        geometry.position.x * imageWidth,
        geometry.position.y * imageHeight,
        2.5 * lineScale,
        0,
        Math.PI * 2,
      )
      context.fill()
      return
    }

    const points = geometry.kind === 'line'
      ? [geometry.from, geometry.to]
      : geometry.points
    if (points.length === 0) return

    context.moveTo(points[0].x * imageWidth, points[0].y * imageHeight)
    points.slice(1).forEach((point) => context.lineTo(point.x * imageWidth, point.y * imageHeight))
    if (geometry.kind === 'polyline' && geometry.closed) context.closePath()
    context.stroke()
    context.setLineDash([])
  })
}

function drawPortraitComposition(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  imageWidth: number,
  imageHeight: number,
  options: {
    constructionModel: ReturnType<typeof derivePortraitConstructionModel>
    camera: typeof defaultPortraitRigParameters.camera
    yaw: number
    guideAdjustments: GuideAdjustments
    level: GuideLevel
    gridVisible: boolean
    guidesVisible: boolean
    opacity: number
    guideDisplayMode: GuideDisplayMode
    visionEnabled: boolean
    visionLandmarks: readonly VisionLandmark[]
    showComparison: boolean
    scaleLineworkToImage?: boolean
  },
): ProjectedPortraitRigGuide[] | null {
  const lineScale = options.scaleLineworkToImage
    ? Math.max(0.8, Math.min(8, Math.min(imageWidth, imageHeight) / 700))
    : 1
  context.drawImage(image, 0, 0, imageWidth, imageHeight)
  context.save()
  context.globalAlpha = options.opacity / 100

  if (options.gridVisible) {
    context.strokeStyle = '#f8f4e9'
    context.lineWidth = lineScale
    for (let column = 1; column < 4; column += 1) {
      const lineX = (imageWidth / 4) * column
      context.beginPath()
      context.moveTo(lineX, 0)
      context.lineTo(lineX, imageHeight)
      context.stroke()
    }
    for (let row = 1; row < 5; row += 1) {
      const lineY = (imageHeight / 5) * row
      context.beginPath()
      context.moveTo(0, lineY)
      context.lineTo(imageWidth, lineY)
      context.stroke()
    }
  }

  let projectedGuides: ProjectedPortraitRigGuide[] | null = null
  if ((options.guideDisplayMode === 'both' || options.guideDisplayMode === 'guide') && options.guidesVisible) {
    projectedGuides = getRelevantPortraitRigGuides(projectPortraitRig(options.constructionModel, {
      camera: options.camera,
      imageWidth,
      imageHeight,
      headOffsetX: options.guideAdjustments.headOffsetX,
      headOffsetY: options.guideAdjustments.headOffsetY,
      guideScale: options.guideAdjustments.scale,
    }), options.yaw)
    drawPortraitGuides(context, projectedGuides, options.level, imageWidth, imageHeight, options.scaleLineworkToImage ? lineScale : undefined)
  }

  if ((options.guideDisplayMode === 'both' || options.guideDisplayMode === 'assistive')
    && options.visionEnabled && options.visionLandmarks.length > 0) {
    context.save()
    context.globalAlpha = options.showComparison ? 0.7 : 0.35
    context.strokeStyle = '#5ea2ff'
    context.fillStyle = '#5ea2ff'
    context.lineWidth = 1.2 * lineScale
    context.beginPath()
    options.visionLandmarks.forEach((point, index) => {
      const x = point.x * imageWidth
      const y = point.y * imageHeight
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
    options.visionLandmarks.forEach((point) => {
      context.beginPath()
      context.arc(point.x * imageWidth, point.y * imageHeight, 1.8 * lineScale, 0, Math.PI * 2)
      context.fill()
    })
    context.restore()
  }

  context.restore()
  return projectedGuides
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const drawRef = useRef<() => void>(() => {})
  const frameRef = useRef<HTMLDivElement>(null)
  const exportActionsRef = useRef<HTMLDivElement>(null)
  const projectBackupInputRef = useRef<HTMLInputElement>(null)
  const guidePointerDragRef = useRef<GuidePointerDrag | null>(null)
  const { project, setProject, isReady, projectList, activeProjectId, switchProject, createProject, duplicateProject, importProject, renameProject, deleteProject } = useProjectStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isGuideManipulationEnabled, setIsGuideManipulationEnabled] = useState(false)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [sourceImageInfo, setSourceImageInfo] = useState<{ imageUrl: string; width: number; height: number } | null>(null)
  const [guideCanvasBounds, setGuideCanvasBounds] = useState<GuideCanvasBounds | null>(null)
  const [guidePreviewAdjustments, setGuidePreviewAdjustments] = useState<GuideAdjustments | null>(null)
  const [fitRequest, setFitRequest] = useState<{ projectId: string; imageUrl: string } | null>(null)
  const [transientStatus, setTransientStatus] = useState<string | null>(null)
  const fitRequestRef = useRef(0)
  const activeReferenceRef = useRef({ projectId: project.id, imageUrl: project.imageDataUrl ?? '', updatedAt: project.updatedAt })
  const isFitPending = fitRequest?.projectId === project.id && fitRequest.imageUrl === (project.imageDataUrl ?? '')
  const [visionResult, setVisionResult] = useState<{
    imageUrl: string
    providerName: VisionProviderName
    landmarks: VisionLandmark[]
  } | null>(null)

  useEffect(() => {
    if (!isExportMenuOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !exportActionsRef.current?.contains(event.target)) {
        setIsExportMenuOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExportMenuOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isExportMenuOpen])

  const imageUrl = project.imageDataUrl ?? ''
  const sourceImageSize = sourceImageInfo?.imageUrl === imageUrl ? sourceImageInfo : null
  const fileName = project.fileName
  const level = project.level
  const gridVisible = project.gridVisible
  const guidesVisible = project.guidesVisible
  const opacity = project.opacity
  const zoom = project.zoom
  const guideAdjustments = project.guideAdjustments
  const displayedGuideAdjustments = guidePreviewAdjustments ?? guideAdjustments
  const rigParameters = project.rigParameters
  const rigView = project.rigView
  const constructionMethod = project.constructionMethod
  const visionProviderName = project.visionProvider
  const visionEnabled = project.visionEnabled
  const guideDisplayMode = project.guideDisplayMode
  const showComparison = project.showComparison
  const canManipulateGuides = Boolean(imageUrl && guidesVisible && (guideDisplayMode === 'both' || guideDisplayMode === 'guide'))
  const visionLandmarks = imageUrl && visionEnabled && visionProviderName !== 'none'
    && visionResult?.imageUrl === imageUrl && visionResult.providerName === visionProviderName
    ? visionResult.landmarks
    : emptyVisionLandmarks
  const rig = useMemo(() => createPortraitRig(rigParameters), [rigParameters])
  const constructionModel = useMemo(
    () => derivePortraitConstructionModel(rig, constructionMethod),
    [constructionMethod, rig],
  )

  const updateProject = useCallback((patch: Partial<typeof project>) => {
    setProject((current) => ({
      ...current,
      ...patch,
      updatedAt: Date.now(),
    }))
  }, [setProject])

  const updateRigDimension = (key: keyof PortraitRigDimensions, value: number) => {
    updateProject({
      rigParameters: {
        ...rigParameters,
        dimensions: { ...rigParameters.dimensions, [key]: value },
      },
    })
  }

  const updateRigPose = (key: keyof PortraitRigPose, value: number) => {
    const nextRigView: PortraitRigView = key === 'yaw'
      ? value <= -68
        ? 'profile-left'
        : value >= 68
          ? 'profile-right'
          : value < -16
            ? 'three-quarter-left'
            : value > 16
              ? 'three-quarter-right'
              : 'front'
      : rigView
    updateProject({
      rigView: nextRigView,
      rigParameters: {
        ...rigParameters,
        pose: { ...rigParameters.pose, [key]: value },
        ...(key === 'yaw' ? {
          camera: {
            ...rigParameters.camera,
            perspective: 0.18 + Math.min(Math.abs(value) / 82, 1) * 0.6,
          },
        } : {}),
      },
    })
  }

  const updateRigGaze = (key: keyof PortraitRigGaze, value: number) => {
    updateProject({
      rigParameters: {
        ...rigParameters,
        gaze: { ...rigParameters.gaze, [key]: value },
      },
    })
  }

  const updateRigExpression = (key: keyof PortraitRigExpression, value: number) => {
    updateProject({
      rigParameters: {
        ...rigParameters,
        expression: { ...rigParameters.expression, [key]: value },
      },
    })
  }

  const selectRigView = (view: PortraitRigView) => {
    updateProject({
      rigView: view,
      rigParameters: initializePortraitRigView(view, rigParameters),
    })
    setTransientStatus(`Modèle ${portraitRigViewPresets[view].label} sélectionné · point de départ manuel`)
  }

  const selectConstructionMethod = (method: PortraitConstructionMethod) => {
    updateProject({ constructionMethod: method })
    setTransientStatus(`Méthode ${portraitConstructionMethods[method].label} sélectionnée · dérivée du rig canonique`)
  }

  const startGuidePointer = (event: ReactPointerEvent<HTMLButtonElement>, mode: GuidePointerDrag['mode']) => {
    if (!guideCanvasBounds || !canManipulateGuides || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const frameBounds = frameRef.current?.getBoundingClientRect()
    if (!frameBounds) return
    guidePointerDragRef.current = {
      pointerId: event.pointerId,
      mode,
      projectId: project.id,
      startX: event.clientX - frameBounds.left,
      startY: event.clientY - frameBounds.top,
      startBounds: guideCanvasBounds,
      startAdjustments: guideAdjustments,
      latestAdjustments: guideAdjustments,
    }
  }

  const moveGuidePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = guidePointerDragRef.current
    const frameBounds = frameRef.current?.getBoundingClientRect()
    if (!drag || drag.pointerId !== event.pointerId || !frameBounds || drag.projectId !== project.id) return
    const pointerX = event.clientX - frameBounds.left
    const pointerY = event.clientY - frameBounds.top
    let nextAdjustments: GuideAdjustments

    if (drag.mode === 'move') {
      nextAdjustments = {
        ...drag.startAdjustments,
        headOffsetX: clamp(
          drag.startAdjustments.headOffsetX + (pointerX - drag.startX) / drag.startBounds.imageWidth,
          -0.25,
          0.25,
        ),
        headOffsetY: clamp(
          drag.startAdjustments.headOffsetY + (pointerY - drag.startY) / drag.startBounds.imageHeight,
          -0.25,
          0.25,
        ),
      }
    } else {
      const centerX = (drag.startBounds.left + drag.startBounds.right) / 2
      const centerY = (drag.startBounds.top + drag.startBounds.bottom) / 2
      const initialRadius = Math.max(12, Math.hypot(drag.startX - centerX, drag.startY - centerY))
      const nextScale = clamp(
        drag.startAdjustments.scale * Math.hypot(pointerX - centerX, pointerY - centerY) / initialRadius,
        0.75,
        1.35,
      )
      nextAdjustments = keepGuideCenterWhileScaling(drag.startBounds, drag.startAdjustments, nextScale)
    }

    drag.latestAdjustments = nextAdjustments
    setGuidePreviewAdjustments(nextAdjustments)
  }

  const finishGuidePointer = (event: ReactPointerEvent<HTMLButtonElement>, commit: boolean) => {
    const drag = guidePointerDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    guidePointerDragRef.current = null
    setGuidePreviewAdjustments(null)

    if (commit && drag.projectId === project.id) {
      updateProject({ guideAdjustments: drag.latestAdjustments })
      setTransientStatus('Repères repositionnés · ajustement enregistré')
    }
  }

  const handleGuideKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    mode: GuidePointerDrag['mode'],
  ) => {
    if (!guideCanvasBounds || !canManipulateGuides) return
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
        : 0
    if (!direction) return
    event.preventDefault()

    if (mode === 'move') {
      const horizontalDelta = event.key === 'ArrowRight' ? 0.01 : event.key === 'ArrowLeft' ? -0.01 : 0
      const verticalDelta = event.key === 'ArrowDown' ? 0.01 : event.key === 'ArrowUp' ? -0.01 : 0
      updateProject({
        guideAdjustments: {
          ...guideAdjustments,
          headOffsetX: clamp(guideAdjustments.headOffsetX + horizontalDelta, -0.25, 0.25),
          headOffsetY: clamp(guideAdjustments.headOffsetY + verticalDelta, -0.25, 0.25),
        },
      })
      setTransientStatus('Repères déplacés au clavier · ajustement enregistré')
      return
    }

    const nextScale = clamp(guideAdjustments.scale + direction * 0.02, 0.75, 1.35)
    updateProject({ guideAdjustments: keepGuideCenterWhileScaling(guideCanvasBounds, guideAdjustments, nextScale) })
    setTransientStatus('Taille des repères ajustée au clavier · modification enregistrée')
  }

  const status = transientStatus ?? (isReady && (project.imageDataUrl || project.fileName)
    ? 'Projet restauré depuis le stockage local'
    : 'Importez une image pour commencer')

  const assistiveStatus = visionEnabled && visionProviderName !== 'none' ? 'Assistance active' : 'Assistance inactive'

  useEffect(() => {
    if (!imageUrl || !visionEnabled || visionProviderName === 'none') return

    let active = true
    const provider = createVisionProvider(visionProviderName)
    provider.analyze(imageUrl).then((result) => {
      if (!active) return
      if (!result.suggestion) {
        if (result.error) setTransientStatus(result.error)
        setVisionResult({ imageUrl, providerName: visionProviderName, landmarks: [] })
        return
      }

      setTransientStatus(result.suggestion.label)
      setVisionResult({
        imageUrl,
        providerName: visionProviderName,
        landmarks: result.suggestion.landmarks,
      })
    })

    return () => {
      active = false
    }
  }, [imageUrl, visionEnabled, visionProviderName])

  useLayoutEffect(() => {
    activeReferenceRef.current = { projectId: project.id, imageUrl, updatedAt: project.updatedAt }
  }, [imageUrl, project.id, project.updatedAt])

  const fitReference = async () => {
    if (!imageUrl || !imageRef.current || isFitPending) return

    const requestId = ++fitRequestRef.current
    const requestedProjectId = project.id
    const requestedImageUrl = imageUrl
    const requestedUpdatedAt = project.updatedAt
    const referenceImage = imageRef.current
    setFitRequest({ projectId: requestedProjectId, imageUrl: requestedImageUrl })
    setTransientStatus('Analyse locale de la référence en cours…')

    try {
      const result = await createVisionProvider('mediapipe').analyze(requestedImageUrl)
      const activeReference = activeReferenceRef.current
      if (requestId !== fitRequestRef.current
        || activeReference.projectId !== requestedProjectId
        || activeReference.imageUrl !== requestedImageUrl) return
      if (activeReference.updatedAt !== requestedUpdatedAt) {
        setTransientStatus('Projet modifié pendant l’analyse · proposition ignorée pour préserver vos corrections')
        return
      }

      if (!result.suggestion) {
        setTransientStatus(result.error ?? 'Aucun repère fiable ; le guide n’a pas été modifié.')
        return
      }

      const suggestion = suggestReferenceFit(
        result.suggestion.landmarks,
        rigParameters,
        referenceImage.naturalWidth,
        referenceImage.naturalHeight,
      )
      if (!suggestion) {
        setTransientStatus('Repères insuffisants ou incohérents ; le guide n’a pas été modifié.')
        return
      }

      updateProject({
        guideAdjustments: suggestion.guideAdjustments,
        rigParameters: suggestion.rigParameters,
      })
      setVisionResult({
        imageUrl: requestedImageUrl,
        providerName: 'mediapipe',
        landmarks: result.suggestion.landmarks,
      })
      const qualityMessage = suggestion.quality === 'stable'
        ? 'repères cohérents'
        : 'vérification manuelle conseillée'
      const clampMessage = suggestion.wasClamped ? ' · correction limitée aux plages sûres' : ''
      setTransientStatus(`Ajustement initial appliqué · ${qualityMessage}${clampMessage} · corrigez-le si besoin`)
    } finally {
      if (requestId === fitRequestRef.current) setFitRequest(null)
    }
  }

  useEffect(() => {
    if (imageUrl) {
      let active = true
      const image = new Image()
      image.onload = () => {
        if (!active) return
        imageRef.current = image
        setSourceImageInfo({ imageUrl, width: image.naturalWidth, height: image.naturalHeight })
        drawRef.current()
      }
      image.onerror = () => {
        if (active) setTransientStatus('Impossible de décoder cette image dans le navigateur.')
      }
      imageRef.current = null
      image.src = imageUrl
      return () => {
        active = false
        image.onload = null
        image.onerror = null
      }
    } else {
      imageRef.current = null
    }
  }, [imageUrl])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        return
      }
      if (event.key.toLowerCase() === 'g') {
        updateProject({ gridVisible: !project.gridVisible })
      }
      if (event.key.toLowerCase() === 'h') {
        updateProject({ guidesVisible: !project.guidesVisible })
      }
      if (event.key === '+') {
        updateProject({ zoom: Math.min(2, Number((project.zoom + 0.1).toFixed(2))) })
      }
      if (event.key === '-') {
        updateProject({ zoom: Math.max(0.5, Number((project.zoom - 0.1).toFixed(2))) })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [project.gridVisible, project.guidesVisible, project.zoom, updateProject])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    const frame = frameRef.current
    if (!canvas || !frame) return
    const context = canvas.getContext('2d')
    if (!context) return
    const width = frame.clientWidth
    const height = frame.clientHeight
    const ratio = window.devicePixelRatio || 1
    canvas.width = width * ratio
    canvas.height = height * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#ede9e1'
    context.fillRect(0, 0, width, height)
    if (!image) {
      setGuideCanvasBounds(null)
      return
    }

    const imageScale = Math.min(width / image.width, height / image.height) * zoom
    const imageWidth = image.width * imageScale
    const imageHeight = image.height * imageScale
    const x = (width - imageWidth) / 2
    const y = (height - imageHeight) / 2
    context.save()
    context.translate(x, y)
    const projectedGuides = drawPortraitComposition(context, image, imageWidth, imageHeight, {
      constructionModel,
      camera: rigParameters.camera,
      yaw: rigParameters.pose.yaw,
      guideAdjustments: displayedGuideAdjustments,
      level,
      gridVisible,
      guidesVisible,
      opacity,
      guideDisplayMode,
      visionEnabled,
      visionLandmarks,
      showComparison,
    })
    setGuideCanvasBounds((current) => {
      const nextGuideBounds = canManipulateGuides && projectedGuides
        ? getGuideCanvasBounds(projectedGuides, level, x, y, imageWidth, imageHeight)
        : null
      if (!nextGuideBounds && !current) return current
      if (nextGuideBounds && current
        && Math.abs(nextGuideBounds.left - current.left) < 0.1
        && Math.abs(nextGuideBounds.top - current.top) < 0.1
        && Math.abs(nextGuideBounds.right - current.right) < 0.1
        && Math.abs(nextGuideBounds.bottom - current.bottom) < 0.1) return current
      return nextGuideBounds
    })

    context.restore()
  }, [canManipulateGuides, constructionModel, displayedGuideAdjustments, gridVisible, guideDisplayMode, guidesVisible, level, opacity, rigParameters.camera, rigParameters.pose.yaw, showComparison, visionEnabled, visionLandmarks, zoom])

  useEffect(() => {
    drawRef.current = draw
  }, [draw])

  useEffect(() => {
    draw()
    const observer = new ResizeObserver(draw)
    if (frameRef.current) observer.observe(frameRef.current)
    return () => observer.disconnect()
  }, [draw, imageUrl, level, gridVisible, guidesVisible, opacity, visionEnabled, visionLandmarks, zoom])

  const loadFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) {
      setTransientStatus('Format non pris en charge. Utilisez JPG, PNG ou WebP.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const image = new Image()
      image.onload = () => {
        imageRef.current = image
        updateProject({ imageDataUrl: result, fileName: file.name })
        setTransientStatus('Image prête · ajustez les repères selon votre dessin')
      }
      image.src = result
    }
    reader.readAsDataURL(file)
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0])
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    loadFile(event.dataTransfer.files[0])
  }

  const handleCreateProject = async () => {
    const next = await createProject(`Projet ${projectList.length + 1}`)
    setTransientStatus(`Nouveau projet créé · ${next.fileName}`)
  }

  const handleDuplicateProject = async () => {
    const clone = await duplicateProject(project)
    setTransientStatus(`Projet dupliqué · ${clone.fileName}`)
  }

  const exportProjectBackup = () => {
    const contents = serializeProjectBackup(project)
    const blob = new Blob([contents], { type: 'application/json' })
    if (blob.size > MAX_PROJECT_BACKUP_BYTES) {
      setTransientStatus('Sauvegarde trop volumineuse pour être exportée par le navigateur.')
      return
    }

    const link = document.createElement('a')
    const baseName = project.fileName.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\n\r\t]/g, '-')
    link.download = `${baseName || 'portrait-facile'}.portrait-facile.json`
    link.href = URL.createObjectURL(blob)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    setTransientStatus('Sauvegarde du projet exportée · photo et réglages inclus')
  }

  const importProjectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      if (file.size > MAX_PROJECT_BACKUP_BYTES) {
        throw new Error('La sauvegarde dépasse la limite de 100 Mo.')
      }
      const restored = parseProjectBackup(await file.text())
      if (restored.imageDataUrl) {
        const image = new Image()
        image.src = restored.imageDataUrl
        await image.decode()
      }
      const imported = await importProject(restored)
      setTransientStatus(`Sauvegarde restaurée dans un nouveau projet · ${imported.fileName}`)
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Erreur inconnue'
      setTransientStatus(`Échec de la restauration · ${details}`)
    } finally {
      input.value = ''
    }
  }

  const handleRenameProject = async (id: string, value: string) => {
    const renamed = await renameProject(id, value)
    if (renamed) {
      setTransientStatus(`Projet renommé · ${renamed.fileName}`)
    }
  }

  const exportPng = async (resolution: 'viewport' | 'source' = 'viewport') => {
    const visibleCanvas = canvasRef.current
    const image = imageRef.current
    if (isExporting) return
    if (!visibleCanvas || !image) {
      setTransientStatus('Veuillez attendre le chargement de la photo avant l’export.')
      return
    }

    const outputWidth = resolution === 'viewport' ? visibleCanvas.width : image.naturalWidth
    const outputHeight = resolution === 'viewport' ? visibleCanvas.height : image.naturalHeight
    if (outputWidth > 16384 || outputHeight > 16384 || outputWidth * outputHeight > 40_000_000) {
      setTransientStatus('Image trop grande pour l’export haute résolution. Utilisez l’export du canvas.')
      setIsExportMenuOpen(false)
      return
    }

    setIsExporting(true)
    setIsExportMenuOpen(false)
    setTransientStatus('Préparation de l’export PNG…')

    try {
      let canvasToEncode = visibleCanvas
      if (resolution === 'source') {
        const sourceCanvas = document.createElement('canvas')
        canvasToEncode = sourceCanvas
        sourceCanvas.width = outputWidth
        sourceCanvas.height = outputHeight
        const context = sourceCanvas.getContext('2d')
        if (!context) throw new Error('Contexte de dessin indisponible')
        drawPortraitComposition(context, image, outputWidth, outputHeight, {
          constructionModel,
          camera: rigParameters.camera,
          yaw: rigParameters.pose.yaw,
          guideAdjustments: displayedGuideAdjustments,
          level,
          gridVisible,
          guidesVisible,
          opacity,
          guideDisplayMode,
          visionEnabled,
          visionLandmarks,
          showComparison,
          scaleLineworkToImage: true,
        })
      }

      const blob = await new Promise<Blob | null>((resolve) => canvasToEncode.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Le navigateur n’a pas pu encoder le PNG')

      const link = document.createElement('a')
      const baseName = fileName.replace(/\.[^.]+$/, '') || 'portrait-guide'
      link.download = `${baseName}${resolution === 'source' ? '-resolution-originale' : ''}.png`
      link.href = URL.createObjectURL(blob)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      setTransientStatus(`PNG exporté · ${outputWidth} × ${outputHeight} px`)
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Erreur inconnue'
      setTransientStatus(`Échec de l’export PNG · ${details}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Portrait Facile accueil">
          <span className="brand-mark">◒</span>
          <span>Portrait <em>facile</em></span>
        </a>
        <div className="topbar-actions">
          <div className="project-summary">
            <span className="summary-label">Projet actif</span>
            <strong>{fileName || 'Nouveau projet'}</strong>
          </div>
          <div className="header-actions">
            <button className="header-button" onClick={() => {
              const nextLabel = window.prompt('Renommer le projet', fileName || 'Nouveau projet')
              if (nextLabel !== null) {
                void handleRenameProject(project.id, nextLabel)
              }
            }}>Renommer</button>
            <button className="header-button" onClick={() => void handleDuplicateProject()}>Dupliquer</button>
          </div>
          <span className="privacy-note"><span className="status-dot" /> Vos images restent sur votre appareil</span>
          <button className="icon-button" aria-label="Aide">?</button>
          <button className="avatar" aria-label="Profil">A</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">Nouveau projet</span>
              <h1>Construire un portrait</h1>
            </div>
            <button className="more-button" aria-label="Plus d'options">•••</button>
          </div>

          <div className="step-list" aria-label="Étapes du projet">
            <div className="step active"><span>01</span><div><strong>Référence</strong><small>Importer une image</small></div></div>
            <div className="step"><span>02</span><div><strong>Repères</strong><small>Structurer le visage</small></div></div>
            <div className="step"><span>03</span><div><strong>Finaliser</strong><small>Exporter votre guide</small></div></div>
          </div>

          <div className="panel-section project-list-panel">
            <div className="section-title"><span>Projets enregistrés</span><button className="text-button tiny-button" onClick={() => void handleCreateProject()}>+ Nouveau</button></div>
            <div className="project-list">
              {projectList.length === 0 && <div className="empty-projects">Aucun projet enregistré.</div>}
              {projectList.map((item) => (
                <div key={item.id} className={`project-item ${activeProjectId === item.id ? 'selected' : ''}`}>
                  <button className="project-main" onClick={() => void switchProject(item.id)}>
                    <span className="project-name">{item.fileName || 'Projet sans titre'}</span>
                    <span className="project-meta">{new Date(item.updatedAt).toLocaleDateString('fr-FR')}</span>
                  </button>
                  <div className="project-actions">
                    <button className="project-action" aria-label={`Renommer ${item.fileName || 'ce projet'}`} onClick={() => {
                      const nextLabel = window.prompt('Renommer le projet', item.fileName || 'Projet sans titre')
                      if (nextLabel !== null) {
                        void handleRenameProject(item.id, nextLabel)
                      }
                    }}>✎</button>
                    <button className="project-action" aria-label={`Dupliquer ${item.fileName || 'ce projet'}`} onClick={() => void duplicateProject(item)}>⧉</button>
                    <button className="project-delete" aria-label={`Supprimer ${item.fileName || 'ce projet'}`} onClick={() => void deleteProject(item.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="text-button secondary-project-action" onClick={() => void handleDuplicateProject()}>Dupliquer le projet actuel</button>
            <div className="project-backup-actions">
              <button type="button" onClick={exportProjectBackup}>Exporter la sauvegarde</button>
              <button type="button" onClick={() => projectBackupInputRef.current?.click()}>Restaurer une sauvegarde</button>
              <input
                ref={projectBackupInputRef}
                className="backup-file-input"
                type="file"
                accept=".json,application/json"
                aria-label="Fichier de sauvegarde Portrait Facile"
                onChange={(event) => { void importProjectBackup(event) }}
              />
              <span className="project-backup-note">La restauration crée un projet distinct · 100 Mo maximum</span>
            </div>
          </div>

          <div className="panel-section">
            <div className="section-title"><span>Affichage</span><span className="live-label">EN DIRECT</span></div>
            <label className="control-row">
              <span><span className="swatch swatch-grid" />Grille</span>
              <input type="checkbox" checked={gridVisible} onChange={(event) => updateProject({ gridVisible: event.target.checked })} />
            </label>
            <label className="control-row">
              <span><span className="swatch swatch-guide" />Repères de construction</span>
              <input type="checkbox" checked={guidesVisible} onChange={(event) => updateProject({ guidesVisible: event.target.checked })} />
            </label>
          </div>

          <div className="panel-section">
            <div className="section-title"><span>Niveau de repères</span><button className="info" aria-label="À propos des niveaux">i</button></div>
            <div className="level-picker">
              {(Object.keys(levelLabels) as GuideLevel[]).map((item) => (
                <button key={item} className={level === item ? 'selected' : ''} onClick={() => updateProject({ level: item })}>{levelLabels[item]}</button>
              ))}
            </div>
            <p className="helper-text">Commencez simplement. Vous pourrez affiner chaque repère ensuite.</p>
          </div>

          <div className="panel-section">
            <div className="section-title"><span>Opacité des repères</span><strong>{opacity}%</strong></div>
            <input className="range" type="range" min="20" max="100" value={opacity} onChange={(event) => updateProject({ opacity: Number(event.target.value) })} />
          </div>

          <div className="panel-section fit-panel">
            <div className="section-title"><span>Fitting de référence</span></div>
            <p className="helper-text">Proposition locale de cadrage et d’inclinaison, jamais une vérité anatomique. Vérifiez puis corrigez le résultat à la main.</p>
            <button className="fit-action" type="button" disabled={!imageUrl || isFitPending} onClick={() => void fitReference()}>
              {isFitPending ? 'Analyse en cours…' : 'Analyser et ajuster'}
            </button>
            <span className="fit-note">Au premier usage, le modèle MediaPipe est téléchargé ; l’image est analysée dans ce navigateur.</span>
            <div className="section-title manual-fit-title"><span>Correction manuelle</span></div>
            <label className="control-row compact-control">
              <span>Décalage horizontal</span>
              <input className="range" type="range" min="-0.25" max="0.25" step="0.01" value={displayedGuideAdjustments.headOffsetX} onChange={(event) => updateProject({ guideAdjustments: { ...displayedGuideAdjustments, headOffsetX: Number(event.target.value) } })} />
            </label>
            <label className="control-row compact-control">
              <span>Décalage vertical</span>
              <input className="range" type="range" min="-0.25" max="0.25" step="0.01" value={displayedGuideAdjustments.headOffsetY} onChange={(event) => updateProject({ guideAdjustments: { ...displayedGuideAdjustments, headOffsetY: Number(event.target.value) } })} />
            </label>
            <label className="control-row compact-control">
              <span>Taille du visage</span>
              <input className="range" type="range" min="0.75" max="1.35" step="0.01" value={displayedGuideAdjustments.scale} onChange={(event) => updateProject({ guideAdjustments: { ...displayedGuideAdjustments, scale: Number(event.target.value) } })} />
            </label>
          </div>

          <div className="panel-section rig-panel">
            <div className="section-title"><span>Modèle de construction</span></div>
            <div className="method-picker" role="group" aria-label="Méthode de construction">
              {Object.values(portraitConstructionMethods).map((method) => (
                <button
                  key={method.id}
                  type="button"
                  className={constructionMethod === method.id ? 'selected' : ''}
                  aria-pressed={constructionMethod === method.id}
                  title={method.description}
                  onClick={() => selectConstructionMethod(method.id)}
                >
                  {method.label}
                </button>
              ))}
            </div>
            <p className="helper-text">{portraitConstructionMethods[constructionMethod].description} La géométrie reste partagée entre les méthodes.</p>
            <div className="section-title"><span>Vue du rig</span></div>
            <div className="view-picker" role="group" aria-label="Vues du rig">
              {(Object.values(portraitRigViewPresets)).map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={rigView === view.id ? 'selected' : ''}
                  aria-pressed={rigView === view.id}
                  title={view.description}
                  onClick={() => selectRigView(view.id)}
                >
                  {view.label}
                </button>
              ))}
            </div>
            <p className="helper-text">{portraitRigViewPresets[rigView].description} · orientation ajustable ensuite</p>
            <div className="section-title"><span>Rig paramétrique · {portraitRigViewPresets[rigView].label}</span></div>
            <label className="control-row compact-control">
              <span>Largeur du crâne · {rigParameters.dimensions.cranialWidth.toFixed(2)}×</span>
              <input className="range" type="range" min="0.78" max="1.22" step="0.01" value={rigParameters.dimensions.cranialWidth} onChange={(event) => updateRigDimension('cranialWidth', Number(event.target.value))} />
            </label>
            <label className="control-row compact-control">
              <span>Largeur de mâchoire · {rigParameters.dimensions.jawWidth.toFixed(2)}×</span>
              <input className="range" type="range" min="0.72" max="1.28" step="0.01" value={rigParameters.dimensions.jawWidth} onChange={(event) => updateRigDimension('jawWidth', Number(event.target.value))} />
            </label>
            <label className="control-row compact-control">
              <span>Écart des yeux · {rigParameters.dimensions.eyeSpacing.toFixed(2)}×</span>
              <input className="range" type="range" min="0.82" max="1.18" step="0.01" value={rigParameters.dimensions.eyeSpacing} onChange={(event) => updateRigDimension('eyeSpacing', Number(event.target.value))} />
            </label>
            <label className="control-row compact-control">
              <span>Longueur du nez · {rigParameters.dimensions.noseLength.toFixed(2)}×</span>
              <input className="range" type="range" min="0.78" max="1.22" step="0.01" value={rigParameters.dimensions.noseLength} onChange={(event) => updateRigDimension('noseLength', Number(event.target.value))} />
            </label>
            <label className="control-row compact-control">
              <span>Orientation horizontale · {Math.round(rigParameters.pose.yaw)}°</span>
              <input className="range" type="range" min="-88" max="88" step="1" value={rigParameters.pose.yaw} onChange={(event) => updateRigPose('yaw', Number(event.target.value))} />
            </label>
            <label className="control-row compact-control">
              <span>Inclinaison verticale · {Math.round(rigParameters.pose.pitch)}°</span>
              <input className="range" type="range" min="-45" max="45" step="1" value={rigParameters.pose.pitch} onChange={(event) => updateRigPose('pitch', Number(event.target.value))} />
            </label>
            <label className="control-row compact-control">
              <span>Rotation de tête · {Math.round(rigParameters.pose.roll)}°</span>
              <input className="range" type="range" min="-45" max="45" step="1" value={rigParameters.pose.roll} onChange={(event) => updateRigPose('roll', Number(event.target.value))} />
            </label>
            <p className="helper-text">En 3/4, les volumes sont projetés avec une asymétrie de profondeur. Ajustez le modèle, pas la photo ; les plages préservent des proportions cohérentes.</p>
            <details className="rig-advanced">
              <summary>Regard</summary>
              <label className="control-row compact-control">
                <span>Horizontal · {rigParameters.gaze.horizontal.toFixed(2)}</span>
                <input className="range" type="range" min="-1" max="1" step="0.05" value={rigParameters.gaze.horizontal} onChange={(event) => updateRigGaze('horizontal', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Vertical · {rigParameters.gaze.vertical.toFixed(2)}</span>
                <input className="range" type="range" min="-1" max="1" step="0.05" value={rigParameters.gaze.vertical} onChange={(event) => updateRigGaze('vertical', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Convergence · {rigParameters.gaze.convergence.toFixed(2)}</span>
                <input className="range" type="range" min="-1" max="1" step="0.05" value={rigParameters.gaze.convergence} onChange={(event) => updateRigGaze('convergence', Number(event.target.value))} />
              </label>
            </details>
            <details className="rig-advanced">
              <summary>Expression</summary>
              <label className="control-row compact-control">
                <span>Ouverture de bouche · {rigParameters.expression.mouthOpen.toFixed(2)}</span>
                <input className="range" type="range" min="0" max="1" step="0.05" value={rigParameters.expression.mouthOpen} onChange={(event) => updateRigExpression('mouthOpen', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Sourire · {rigParameters.expression.smile.toFixed(2)}</span>
                <input className="range" type="range" min="0" max="1" step="0.05" value={rigParameters.expression.smile} onChange={(event) => updateRigExpression('smile', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Ouverture de la mâchoire · {rigParameters.expression.jawOpen.toFixed(2)}</span>
                <input className="range" type="range" min="0" max="1" step="0.05" value={rigParameters.expression.jawOpen} onChange={(event) => updateRigExpression('jawOpen', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Plissement des yeux · {rigParameters.expression.squint.toFixed(2)}</span>
                <input className="range" type="range" min="0" max="1" step="0.05" value={rigParameters.expression.squint} onChange={(event) => updateRigExpression('squint', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Sourcil gauche · {rigParameters.expression.browRaiseLeft.toFixed(2)}</span>
                <input className="range" type="range" min="-1" max="1" step="0.05" value={rigParameters.expression.browRaiseLeft} onChange={(event) => updateRigExpression('browRaiseLeft', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Sourcil droit · {rigParameters.expression.browRaiseRight.toFixed(2)}</span>
                <input className="range" type="range" min="-1" max="1" step="0.05" value={rigParameters.expression.browRaiseRight} onChange={(event) => updateRigExpression('browRaiseRight', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Œil gauche · {rigParameters.expression.eyeOpennessLeft.toFixed(2)}</span>
                <input className="range" type="range" min="0" max="1" step="0.05" value={rigParameters.expression.eyeOpennessLeft} onChange={(event) => updateRigExpression('eyeOpennessLeft', Number(event.target.value))} />
              </label>
              <label className="control-row compact-control">
                <span>Œil droit · {rigParameters.expression.eyeOpennessRight.toFixed(2)}</span>
                <input className="range" type="range" min="0" max="1" step="0.05" value={rigParameters.expression.eyeOpennessRight} onChange={(event) => updateRigExpression('eyeOpennessRight', Number(event.target.value))} />
              </label>
            </details>
          </div>

          <div className="panel-section">
            <div className="section-title"><span>Aide assistée</span></div>
            <label className="control-row">
              <span>Activer la couche d'assistance</span>
              <input type="checkbox" checked={visionEnabled} onChange={(event) => updateProject({ visionEnabled: event.target.checked })} />
            </label>
            <label className="control-row compact-control">
              <span>Fournisseur</span>
              <select value={visionProviderName} onChange={(event) => updateProject({ visionProvider: event.target.value as VisionProviderName })}>
                <option value="none">Aucun</option>
                <option value="mediapipe">MediaPipe</option>
              </select>
            </label>
            <label className="control-row compact-control">
              <span>Mode d'affichage</span>
              <select value={guideDisplayMode} onChange={(event) => updateProject({ guideDisplayMode: event.target.value as GuideDisplayMode })}>
                <option value="both">Guide + assistance</option>
                <option value="guide">Guide seul</option>
                <option value="assistive">Assistance seule</option>
              </select>
            </label>
            <label className="control-row">
              <span>Comparer avec le guide</span>
              <input type="checkbox" checked={showComparison} onChange={(event) => updateProject({ showComparison: event.target.checked })} />
            </label>
            <button className="text-button reset-button" onClick={() => updateProject({ guideAdjustments: { headOffsetX: 0, headOffsetY: 0, scale: 1 }, rigParameters: defaultPortraitRigParameters, rigView: 'front', constructionMethod: 'canonical', level: 'construction', showComparison: false, guideDisplayMode: 'both' })}>Réinitialiser le guide et le rig</button>
          </div>

          <div className="sidebar-footer">
            <button className="text-button" onClick={() => { void handleCreateProject() }}>＋ Nouveau projet</button>
            <span className="version">v0.1 · local</span>
          </div>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div className="breadcrumb"><span>Mes projets</span><b>/</b><strong>{fileName || 'Sans titre'}</strong></div>
            <div className="toolbar-actions">
              <button className="tool-button" onClick={() => updateProject({ zoom: Math.max(0.5, Number((zoom - 0.1).toFixed(2))) })}>−</button>
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <button className="tool-button" onClick={() => updateProject({ zoom: Math.min(2, Number((zoom + 0.1).toFixed(2))) })}>＋</button>
              <button className="fit-button" onClick={() => updateProject({ zoom: 1 })}>Ajuster</button>
              <button
                className={`manipulate-button ${isGuideManipulationEnabled ? 'selected' : ''}`}
                type="button"
                aria-pressed={isGuideManipulationEnabled}
                disabled={!canManipulateGuides}
                title="Déplacer les repères dans le cadre ou redimensionner avec la poignée"
                onClick={() => {
                  const nextEnabled = !isGuideManipulationEnabled
                  setIsGuideManipulationEnabled(nextEnabled)
                  setTransientStatus(nextEnabled
                    ? 'Glissez le cadre pour déplacer les repères ou la poignée pour les redimensionner'
                    : 'Manipulation directe désactivée')
                }}
              >
                ↔ Guide
              </button>
              <div className="export-actions" ref={exportActionsRef}>
                <button className="export-button" disabled={!imageUrl || !sourceImageSize || isExporting} onClick={() => { void exportPng() }}>
                  {isExporting ? 'Export…' : 'Exporter'} <span>↗</span>
                </button>
                <button
                  className="export-options-button"
                  type="button"
                  aria-label="Options d’export"
                  aria-expanded={isExportMenuOpen}
                  disabled={!imageUrl || !sourceImageSize || isExporting}
                  onClick={() => setIsExportMenuOpen((open) => !open)}
                >
                  ▾
                </button>
                {isExportMenuOpen && (
                  <div className="export-menu-panel">
                    <button type="button" disabled={!sourceImageSize} onClick={() => { void exportPng('source') }}>
                      <strong>Résolution de la photo</strong>
                      <span>{sourceImageSize ? `${sourceImageSize.width} × ${sourceImageSize.height} px` : 'Chargement des dimensions…'} · recadré à l’image</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div
            className={`canvas-frame ${isDragging ? 'dragging' : ''} ${imageUrl ? 'has-image' : ''}`}
            ref={frameRef}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <canvas ref={canvasRef} aria-label="Aperçu du portrait et de ses repères" />
            {isGuideManipulationEnabled && guideCanvasBounds && canManipulateGuides && (
              <div
                className="guide-selection"
                style={{
                  left: guideCanvasBounds.left,
                  top: guideCanvasBounds.top,
                  width: guideCanvasBounds.right - guideCanvasBounds.left,
                  height: guideCanvasBounds.bottom - guideCanvasBounds.top,
                }}
              >
                <button
                  className="guide-move-target"
                  type="button"
                  aria-label="Déplacer les repères"
                  title="Glisser pour déplacer · flèches du clavier pour ajuster"
                  onPointerDown={(event) => startGuidePointer(event, 'move')}
                  onPointerMove={moveGuidePointer}
                  onPointerUp={(event) => finishGuidePointer(event, true)}
                  onPointerCancel={(event) => finishGuidePointer(event, false)}
                  onKeyDown={(event) => handleGuideKeyboard(event, 'move')}
                />
                <button
                  className="guide-scale-handle"
                  type="button"
                  aria-label={`Redimensionner les repères · ${Math.round(displayedGuideAdjustments.scale * 100)} %`}
                  title="Glisser pour redimensionner · flèches haut/bas pour ajuster"
                  onPointerDown={(event) => startGuidePointer(event, 'scale')}
                  onPointerMove={moveGuidePointer}
                  onPointerUp={(event) => finishGuidePointer(event, true)}
                  onPointerCancel={(event) => finishGuidePointer(event, false)}
                  onKeyDown={(event) => handleGuideKeyboard(event, 'scale')}
                />
              </div>
            )}
            {!imageUrl && (
              <div className="drop-message">
                <div className="upload-icon">↥</div>
                <h2>Votre référence commence ici</h2>
                <p>Déposez une image dans cette zone<br />ou choisissez un fichier depuis votre appareil.</p>
                <label className="upload-button">Importer une image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} /></label>
                <span className="file-hint">JPG, PNG ou WebP · 20 Mo maximum</span>
              </div>
            )}
          </div>
          <div className="canvas-footer">
            <span className="status-message"><span className="status-dot" />{status}</span>
            <span className="shortcut-hint"><kbd>G</kbd> Grille <kbd>H</kbd> Repères <span className="assistive-pill">{assistiveStatus}</span></span>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
