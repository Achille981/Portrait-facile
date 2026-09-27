import { useCallback,useEffect,useState } from 'react'
import { projectStorage } from '../services/projectStorage'
import { createDefaultProject } from '../types/project'
import type { ProjectDocument } from '../types/project'
export const useProjectStore=()=>{const [project,setProject]=useState(createDefaultProject());const [projectList,setProjectList]=useState<ProjectDocument[]>([]);const [activeProjectId,setActiveProjectId]=useState('current');const [isReady,setIsReady]=useState(false)
useEffect(()=>{let live=true;Promise.all([projectStorage.listProjects(),projectStorage.getCurrentProject()]).then(([list,current])=>{if(!live)return;const p=current||list[0]||createDefaultProject();setProject(p);setProjectList(list.length?list:[p]);setActiveProjectId(p.id);setIsReady(true)}).catch(()=>setIsReady(true));return()=>{live=false}},[])
useEffect(()=>{if(!isReady)return;void projectStorage.saveProject(project);setProjectList(list=>[project,...list.filter(p=>p.id!==project.id)])},[project,isReady])
const switchProject=useCallback(async(id:string)=>{const p=await projectStorage.getProject(id);if(p){setProject(p);setActiveProjectId(id);}},[])
const createProject=useCallback(async(label='Nouveau projet')=>{const p=createDefaultProject(`project-${Date.now()}`);p.fileName=label;setProject(p);setActiveProjectId(p.id);setProjectList(list=>[p,...list]);return p},[])
const duplicateProject=useCallback(async(source:ProjectDocument)=>{const p={...source,id:`project-${Date.now()}`,fileName:`${source.fileName||'Projet'} copie`,updatedAt:Date.now()};setProject(p);setActiveProjectId(p.id);setProjectList(list=>[p,...list]);return p},[])
const importProject=useCallback(async(source:ProjectDocument)=>{const p={...source,id:`project-${Date.now()}`,fileName:`${source.fileName||'Projet'} importé`,updatedAt:Date.now()};setProject(p);setActiveProjectId(p.id);setProjectList(list=>[p,...list]);return p},[])
const renameProject=useCallback(async(id:string,label:string)=>{setProject(p=>p.id===id?{...p,fileName:label||'Projet sans titre',updatedAt:Date.now()}:p)},[])
const deleteProject=useCallback(async(id:string)=>{const next=projectList.filter(p=>p.id!==id);setProjectList(next);await projectStorage.clearProject(id);if(id===activeProjectId){const p=next[0]||createDefaultProject();setProject(p);setActiveProjectId(p.id)}},[activeProjectId,projectList])
return {project,setProject,isReady,projectList,activeProjectId,switchProject,createProject,duplicateProject,importProject,renameProject,deleteProject}}