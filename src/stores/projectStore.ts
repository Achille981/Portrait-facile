import { useCallback, useEffect, useState } from 'react'

import { projectStorage } from '../services/projectStorage'
import { createDefaultProject } from '../types/project'
import type { ProjectDocument } from '../types/project'

export const useProjectStore = () => {
  const [project, setProject] = useState<ProjectDocument>(() => createDefaultProject())
  const [projectList, setProjectList] = useState<ProjectDocument[]>([])
  const [activeProjectId, setActiveProjectId] = useState('current')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true

    Promise.all([
      projectStorage.listProjects(),
      projectStorage.getActiveProjectId(),
      projectStorage.getCurrentProject(),
    ]).then(([projects, activeId, saved]) => {
      if (!active) return

      const nextProject = saved ?? createDefaultProject(activeId)
      setProject(nextProject)
      setActiveProjectId(activeId)
      setProjectList(projects.length > 0 ? projects : [nextProject])
      setIsReady(true)
    }).catch(() => {
      if (active) {
        const fallback = createDefaultProject()
        setProject(fallback)
        setActiveProjectId('current')
        setProjectList([fallback])
        setIsReady(true)
      }
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isReady) return

    projectStorage.saveProject(project).then(() => {
      setProjectList((currentList) => {
        const filtered = currentList.filter((item) => item.id !== project.id)
        return [project, ...filtered].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
      })
    })
  }, [isReady, project])

  const switchProject = useCallback(async (nextId: string) => {
    const saved = await projectStorage.getProject(nextId)
    const nextProject = saved ?? createDefaultProject(nextId)
    setProject(nextProject)
    setActiveProjectId(nextId)
    await projectStorage.setActiveProjectId(nextId)
  }, [])

  const createProject = useCallback(async (label = 'Nouveau projet') => {
    const nextProject = createDefaultProject(`project-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`)
    nextProject.fileName = label
    setProject(nextProject)
    setActiveProjectId(nextProject.id)
    setProjectList((currentList) => [nextProject, ...currentList.filter((item) => item.id !== nextProject.id)])
    await projectStorage.saveProject(nextProject)
    return nextProject
  }, [])

  const duplicateProject = useCallback(async (source: ProjectDocument) => {
    const clone = {
      ...source,
      id: `project-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      fileName: `${source.fileName || 'Projet'} copie`,
      updatedAt: Date.now(),
    }
    setProject(clone)
    setActiveProjectId(clone.id)
    setProjectList((currentList) => [clone, ...currentList.filter((item) => item.id !== clone.id)])
    await projectStorage.saveProject(clone)
    return clone
  }, [])

  const importProject = useCallback(async (source: ProjectDocument) => {
    const restored = {
      ...source,
      id: `project-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      fileName: `${source.fileName || 'Projet'} (importé)`,
      updatedAt: Date.now(),
    }
    await projectStorage.saveProject(restored)
    setProject(restored)
    setActiveProjectId(restored.id)
    setProjectList((currentList) => [restored, ...currentList.filter((item) => item.id !== restored.id)])
    return restored
  }, [])

  const renameProject = useCallback(async (id: string, label: string) => {
    const nextName = label.trim() || 'Projet sans titre'
    setProject((current) => {
      if (current.id !== id) return current
      return { ...current, fileName: nextName, updatedAt: Date.now() }
    })

    setProjectList((currentList) => currentList.map((item) => item.id === id ? { ...item, fileName: nextName, updatedAt: Date.now() } : item))

    const saved = await projectStorage.getProject(id)
    if (saved) {
      const renamed = { ...saved, fileName: nextName, updatedAt: Date.now() }
      await projectStorage.saveProject(renamed)
      setProject(renamed)
      return renamed
    }

    return null
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    if (id === activeProjectId) {
      const remaining = projectList.filter((item) => item.id !== id)
      if (remaining.length > 0) {
        await switchProject(remaining[0].id)
      } else {
        const fresh = createDefaultProject('current')
        setProject(fresh)
        setActiveProjectId('current')
        await projectStorage.setActiveProjectId('current')
      }
    }

    await projectStorage.clearProject(id)
    setProjectList((currentList) => currentList.filter((item) => item.id !== id))
  }, [activeProjectId, projectList, switchProject])

  return { project, setProject, isReady, projectList, activeProjectId, switchProject, createProject, duplicateProject, importProject, renameProject, deleteProject }
}
