import type { ProjectDocument } from '../types/project'

const DB_NAME = 'portrait-facile'
const STORE_NAME = 'projects'
const REQUEST_TIMEOUT_MS = 5000
const ACTIVE_PROJECT_KEY = '__active-project-id__'

class ProjectStorage {
  private dbPromise: Promise<IDBDatabase> | null = null

  private openDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)

      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB is blocked'))
    })

    return this.dbPromise
  }

  private withStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      void this.openDatabase().then((database) => {
        const transaction = database.transaction(STORE_NAME, mode)
        const store = transaction.objectStore(STORE_NAME)

        const timer = window.setTimeout(() => reject(new Error('IndexedDB request timed out')), REQUEST_TIMEOUT_MS)

        Promise.resolve(callback(store))
          .then((value) => {
            transaction.oncomplete = () => {
              window.clearTimeout(timer)
              resolve(value)
            }
            transaction.onerror = () => {
              window.clearTimeout(timer)
              reject(transaction.error)
            }
            transaction.onabort = () => {
              window.clearTimeout(timer)
              reject(transaction.error)
            }
          })
          .catch((error) => {
            window.clearTimeout(timer)
            reject(error)
          })
      }).catch((error) => {
        reject(error)
      })
    })
  }

  async getProject(id: string): Promise<ProjectDocument | null> {
    try {
      const value = await this.withStore('readonly', async (store) => {
        return new Promise<ProjectDocument | null>((resolve, reject) => {
          const request = store.get(id)
          request.onsuccess = () => resolve((request.result as ProjectDocument | undefined) ?? null)
          request.onerror = () => reject(request.error)
        })
      })
      return value
    } catch {
      return null
    }
  }

  async getCurrentProject(): Promise<ProjectDocument | null> {
    const activeId = await this.getActiveProjectId()
    if (!activeId) return null
    return this.getProject(activeId)
  }

  async listProjects(): Promise<ProjectDocument[]> {
    try {
      const items = await this.withStore('readonly', async (store) => {
        return new Promise<ProjectDocument[]>((resolve, reject) => {
          const request = store.getAll()
          request.onsuccess = () => {
            const records = (request.result as Array<ProjectDocument & { activeProjectId?: string }> | undefined) ?? []
            resolve(records
              .filter((item) => item.id !== ACTIVE_PROJECT_KEY)
              .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0)))
          }
          request.onerror = () => reject(request.error)
        })
      })
      return items
    } catch {
      return []
    }
  }

  async getActiveProjectId(): Promise<string> {
    try {
      const item = await this.getProject(ACTIVE_PROJECT_KEY) as (ProjectDocument & { activeProjectId?: string }) | null
      const activeId = item?.activeProjectId ?? item?.id ?? 'current'
      return activeId === ACTIVE_PROJECT_KEY ? 'current' : activeId
    } catch {
      return 'current'
    }
  }

  async setActiveProjectId(id: string): Promise<void> {
    await this.withStore('readwrite', async (store) => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put({
          id: ACTIVE_PROJECT_KEY,
          version: 1,
          fileName: 'meta',
          level: 'standard',
          gridVisible: true,
          guidesVisible: true,
          opacity: 76,
          zoom: 1,
          guideAdjustments: { headOffsetX: 0, headOffsetY: 0, scale: 1 },
          visionProvider: 'none',
          visionEnabled: false,
          guideDisplayMode: 'both',
          showComparison: false,
          activeProjectId: id,
          updatedAt: Date.now(),
        } as ProjectDocument & { activeProjectId?: string })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })
  }

  async saveProject(project: ProjectDocument): Promise<void> {
    const normalized = {
      ...project,
      updatedAt: Date.now(),
    }

    await this.withStore('readwrite', async (store) => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put(normalized)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })

    await this.setActiveProjectId(project.id)
  }

  async clearProject(id?: string): Promise<void> {
    const targetId = id ?? 'current'
    const remaining = (await this.listProjects()).filter((project) => project.id !== targetId)
    await this.withStore('readwrite', async (store) => {
      return new Promise<void>((resolve, reject) => {
        const request = store.delete(targetId)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })

    if (remaining.length > 0) {
      await this.setActiveProjectId(remaining[0].id)
    } else {
      await this.setActiveProjectId('current')
    }
  }
}

export const projectStorage = new ProjectStorage()
