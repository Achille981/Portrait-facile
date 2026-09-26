import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { getPortraitGuideMetrics } from './domain/portraitGuides'
import { createVisionProvider } from './services/visionProvider'
import { useProjectStore } from './stores/projectStore'
import type { GuideDisplayMode, GuideLevel, VisionProviderName } from './types/project'
import './App.css'

const levelLabels: Record<GuideLevel, string> = {
  essential: 'Essentiel',
  standard: 'Standard',
  detailed: 'Détaillé',
}

const emptyVisionLandmarks: Array<{ x: number; y: number }> = []

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const { project, setProject, isReady, projectList, activeProjectId, switchProject, createProject, duplicateProject, renameProject, deleteProject } = useProjectStore()
  const [isDragging, setIsDragging] = useState(false)
  const [transientStatus, setTransientStatus] = useState<string | null>(null)
  const [visionResult, setVisionResult] = useState<{
    imageUrl: string
    providerName: VisionProviderName
    landmarks: Array<{ x: number; y: number }>
  } | null>(null)

  const imageUrl = project.imageDataUrl ?? ''
  const fileName = project.fileName
  const level = project.level
  const gridVisible = project.gridVisible
  const guidesVisible = project.guidesVisible
  const opacity = project.opacity
  const zoom = project.zoom
  const guideAdjustments = project.guideAdjustments
  const visionProviderName = project.visionProvider
  const visionEnabled = project.visionEnabled
  const guideDisplayMode = project.guideDisplayMode
  const showComparison = project.showComparison
  const visionLandmarks = imageUrl && visionEnabled && visionProviderName !== 'none'
    && visionResult?.imageUrl === imageUrl && visionResult.providerName === visionProviderName
    ? visionResult.landmarks
    : emptyVisionLandmarks

  const updateProject = useCallback((patch: Partial<typeof project>) => {
    setProject((current) => ({
      ...current,
      ...patch,
      updatedAt: Date.now(),
    }))
  }, [setProject])

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
      if (!result.isAvailable || !result.suggestion) {
        setVisionResult({ imageUrl, providerName: visionProviderName, landmarks: [] })
        return
      }

      const message = `${result.suggestion.label} · confiance ${result.suggestion.confidence.toFixed(2)}`
      setTransientStatus(message)
      setVisionResult({
        imageUrl,
        providerName: visionProviderName,
        landmarks: result.suggestion.landmarks,
      })
    }).catch(() => {
      if (active) setVisionResult({ imageUrl, providerName: visionProviderName, landmarks: [] })
    })

    return () => {
      active = false
    }
  }, [imageUrl, visionEnabled, visionProviderName])

  useEffect(() => {
    if (imageUrl) {
      const image = new Image()
      image.onload = () => {
        imageRef.current = image
      }
      image.src = imageUrl
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
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#ede9e1'
    context.fillRect(0, 0, width, height)
    if (!image) return

    const imageScale = Math.min(width / image.width, height / image.height) * zoom
    const imageWidth = image.width * imageScale
    const imageHeight = image.height * imageScale
    const x = (width - imageWidth) / 2
    const y = (height - imageHeight) / 2
    context.drawImage(image, x, y, imageWidth, imageHeight)

    context.save()
    context.translate(x, y)
    context.globalAlpha = opacity / 100
    if (gridVisible) {
      context.strokeStyle = '#f8f4e9'
      context.lineWidth = 1
      const columns = 4
      const rows = 5
      for (let column = 1; column < columns; column += 1) {
        const lineX = (imageWidth / columns) * column
        context.beginPath()
        context.moveTo(lineX, 0)
        context.lineTo(lineX, imageHeight)
        context.stroke()
      }
      for (let row = 1; row < rows; row += 1) {
        const lineY = (imageHeight / rows) * row
        context.beginPath()
        context.moveTo(0, lineY)
        context.lineTo(imageWidth, lineY)
        context.stroke()
      }
    }
    if ((guideDisplayMode === 'both' || guideDisplayMode === 'guide') && guidesVisible) {
      const metrics = getPortraitGuideMetrics(imageWidth, imageHeight, level, guideAdjustments)
      const {
        centerX,
        centerY,
        headWidth,
        headHeight,
        eyeY,
        noseY,
        mouthY,
        leftVerticalX,
        rightVerticalX,
        faceTilt,
        faceOutlineRadiusX,
        faceOutlineRadiusY,
        horizontalGuideY,
      } = metrics

      context.strokeStyle = '#d86b54'
      context.fillStyle = '#d86b54'
      context.lineWidth = 2
      context.setLineDash([8, 6])
      context.beginPath()
      context.ellipse(centerX, centerY, faceOutlineRadiusX, faceOutlineRadiusY, faceTilt, 0, Math.PI * 2)
      context.stroke()
      context.beginPath()
      context.moveTo(centerX, centerY - headHeight / 2)
      context.lineTo(centerX + imageWidth * 0.015, centerY + headHeight * 0.56)
      context.stroke()
      context.setLineDash([])
      context.strokeStyle = '#e5a048'
      context.lineWidth = 1.5
      horizontalGuideY.forEach((lineY) => {
        context.beginPath()
        context.moveTo(centerX - headWidth * 0.54, lineY)
        context.lineTo(centerX + headWidth * 0.54, lineY)
        context.stroke()
      })
      if (level === 'detailed') {
        context.strokeStyle = '#5f7898'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(leftVerticalX, centerY - headHeight * 0.2)
        context.lineTo(leftVerticalX, centerY + headHeight * 0.32)
        context.moveTo(rightVerticalX, centerY - headHeight * 0.2)
        context.lineTo(rightVerticalX, centerY + headHeight * 0.32)
        context.stroke()
      }
      ;[
        [centerX, eyeY],
        [centerX, noseY],
        [centerX, mouthY],
      ].forEach(([pointX, pointY]) => {
        context.beginPath()
        context.arc(pointX, pointY, 4, 0, Math.PI * 2)
        context.fill()
      })
    }

    if ((guideDisplayMode === 'both' || guideDisplayMode === 'assistive') && visionEnabled && visionLandmarks.length > 0) {
      const landmarkAlpha = showComparison ? 0.7 : 0.35
      context.save()
      context.globalAlpha = landmarkAlpha
      context.strokeStyle = '#5ea2ff'
      context.fillStyle = '#5ea2ff'
      context.lineWidth = 1.2
      context.beginPath()
      visionLandmarks.forEach((point, index) => {
        const x = point.x * imageWidth
        const y = point.y * imageHeight
        if (index === 0) {
          context.moveTo(x, y)
        } else {
          context.lineTo(x, y)
        }
      })
      context.stroke()
      visionLandmarks.forEach((point) => {
        context.beginPath()
        context.arc(point.x * imageWidth, point.y * imageHeight, 1.8, 0, Math.PI * 2)
        context.fill()
      })
      context.restore()
    }

    context.restore()
  }, [gridVisible, guideAdjustments, guideDisplayMode, guidesVisible, level, opacity, showComparison, visionEnabled, visionLandmarks, zoom])

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

  const handleRenameProject = async (id: string, value: string) => {
    const renamed = await renameProject(id, value)
    if (renamed) {
      setTransientStatus(`Projet renommé · ${renamed.fileName}`)
    }
  }

  const exportPng = () => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const link = document.createElement('a')
      link.download = `${fileName.replace(/\.[^.]+$/, '') || 'portrait-guide'}.png`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
    }, 'image/png')
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

          <div className="panel-section">
            <div className="section-title"><span>Ajustements manuels</span></div>
            <label className="control-row compact-control">
              <span>Décalage horizontal</span>
              <input className="range" type="range" min="-0.25" max="0.25" step="0.01" value={guideAdjustments.headOffsetX} onChange={(event) => updateProject({ guideAdjustments: { ...guideAdjustments, headOffsetX: Number(event.target.value) } })} />
            </label>
            <label className="control-row compact-control">
              <span>Décalage vertical</span>
              <input className="range" type="range" min="-0.25" max="0.25" step="0.01" value={guideAdjustments.headOffsetY} onChange={(event) => updateProject({ guideAdjustments: { ...guideAdjustments, headOffsetY: Number(event.target.value) } })} />
            </label>
            <label className="control-row compact-control">
              <span>Taille du visage</span>
              <input className="range" type="range" min="0.75" max="1.35" step="0.01" value={guideAdjustments.scale} onChange={(event) => updateProject({ guideAdjustments: { ...guideAdjustments, scale: Number(event.target.value) } })} />
            </label>
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
            <button className="text-button reset-button" onClick={() => updateProject({ guideAdjustments: { headOffsetX: 0, headOffsetY: 0, scale: 1 }, level: 'standard', showComparison: false, guideDisplayMode: 'both' })}>Réinitialiser les repères</button>
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
              <button className="export-button" disabled={!imageUrl} onClick={exportPng}>Exporter <span>↗</span></button>
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
