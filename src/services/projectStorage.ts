import { normalizeProjectDocument } from '../types/project'
import type { ProjectDocument } from '../types/project'
const KEY='portrait-facile-projects'
const read=():ProjectDocument[]=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]').map(normalizeProjectDocument).filter(Boolean) as ProjectDocument[]}catch{return[]}}
export const projectStorage={
  async listProjects(){return read()},
  async getProject(id:string){return read().find(p=>p.id===id)||null},
  async getCurrentProject(){return read()[0]||null},
  async getActiveProjectId(){return read()[0]?.id||'current'},
  async setActiveProjectId(id:string){const items=read();const hit=items.find(p=>p.id===id);if(hit){localStorage.setItem(KEY,JSON.stringify([hit,...items.filter(p=>p.id!==id)]))}},
  async saveProject(project:ProjectDocument){const items=read().filter(p=>p.id!==project.id);localStorage.setItem(KEY,JSON.stringify([{...project,updatedAt:Date.now()},...items]))},
  async clearProject(id:string){localStorage.setItem(KEY,JSON.stringify(read().filter(p=>p.id!==id)))}
}