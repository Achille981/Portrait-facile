// import type { PortraitConstructionModel,RigGuideGeometry,RigVector3 } from './portraitConstructionModel'
// export type ProjectedPoint={x:number;y:number}; export type ProjectedGeometry={kind:'point';position:ProjectedPoint}|{kind:'line';from:ProjectedPoint;to:ProjectedPoint}|{kind:'polyline';points:ProjectedPoint[];closed:boolean}
// export type ProjectedPortraitRigGuide={id:string;category:string;level:string;priority:number;visibility:boolean;style:string;geometry:ProjectedGeometry}
// const project=(p:RigVector3,ox=0,oy=0,s=1):ProjectedPoint=>({x:.5+(p.x-.5)*s+ox,y:p.y*s+oy})
// const projectGeo=(g:RigGuideGeometry,ox:number,oy:number,s:number):ProjectedGeometry=>g.kind==='point'?{kind:'point',position:project(g.position,ox,oy,s)}:g.kind==='line'?{kind:'line',from:project(g.from,ox,oy,s),to:project(g.to,ox,oy,s)}:{kind:'polyline',points:g.points.map(p=>project(p,ox,oy,s)),closed:Boolean(g.closed)}
// export function projectPortraitRig(rig:PortraitConstructionModel,settings:{headOffsetX?:number;headOffsetY?:number;guideScale?:number}):ProjectedPortraitRigGuide[]{return rig.guides.map(g=>({...g,geometry:projectGeo(g.geometry,settings.headOffsetX??0,settings.headOffsetY??0,settings.guideScale??1)}))}
// export function getRelevantPortraitRigGuides(g:ProjectedPortraitRigGuide[],yaw:number){return g.map(item=>({...item,visibility:item.visibility&&!(Math.abs(yaw)>65&&['eyes','mouth'].includes(item.category))}))}

import type {
  PortraitConstructionModel,
  RigGuideGeometry,
  RigVector3,
} from './portraitConstructionModel'

export type ProjectedPoint = {
  x: number
  y: number
}

export type ProjectedGeometry =
  | {
      kind: 'point'
      position: ProjectedPoint
    }
  | {
      kind: 'line'
      from: ProjectedPoint
      to: ProjectedPoint
    }
  | {
      kind: 'polyline'
      points: ProjectedPoint[]
      closed: boolean
    }

export type ProjectedPortraitRigGuide = {
  id: string
  category: string
  level: string
  priority: number
  visibility: boolean
  style: string
  geometry: ProjectedGeometry
}

const project = (
  p: RigVector3,
  ox = 0,
  oy = 0,
  s = 1,
): ProjectedPoint => ({
  x: 0.5 + (p.x - 0.5) * s + ox,
  y: p.y * s + oy,
})

const projectGeo = (
  g: RigGuideGeometry,
  ox: number,
  oy: number,
  s: number,
): ProjectedGeometry => {
  if (g.kind === 'point') {
    return {
      kind: 'point',
      position: project(g.position, ox, oy, s),
    }
  }

  if (g.kind === 'line') {
    return {
      kind: 'line',
      from: project(g.from, ox, oy, s),
      to: project(g.to, ox, oy, s),
    }
  }

  if (g.kind === 'polyline') {
    return {
      kind: 'polyline',
      points: g.points.map((p) => project(p, ox, oy, s)),
      closed: Boolean(g.closed),
    }
  }

  /*
   * Les géométries volumétriques (ellipse, ellipsoïde et plan)
   * ne possèdent pas encore de représentation 2D dans ProjectedGeometry.
   *
   * On utilise donc une représentation de secours basée sur leur
   * centre afin de conserver ces guides dans le système de projection
   * sans perdre les autres informations du modèle.
   */

  if (g.kind === 'ellipse') {
    const center = project(g.center, ox, oy, s)

    return {
      kind: 'point',
      position: center,
    }
  }

  if (g.kind === 'ellipsoid') {
    const center = project(g.center, ox, oy, s)

    return {
      kind: 'point',
      position: center,
    }
  }

  if (g.kind === 'plane') {
    const center = project(g.center, ox, oy, s)

    return {
      kind: 'point',
      position: center,
    }
  }

  return {
    kind: 'point',
    position: {
      x: 0.5 + ox,
      y: oy,
    },
  }
}

export function projectPortraitRig(
  rig: PortraitConstructionModel,
  settings: {
    headOffsetX?: number
    headOffsetY?: number
    guideScale?: number
  },
): ProjectedPortraitRigGuide[] {
  return rig.guides.map((g) => ({
    ...g,
    geometry: projectGeo(
      g.geometry,
      settings.headOffsetX ?? 0,
      settings.headOffsetY ?? 0,
      settings.guideScale ?? 1,
    ),
  }))
}

export function getRelevantPortraitRigGuides(
  g: ProjectedPortraitRigGuide[],
  yaw: number,
) {
  return g.map((item) => ({
    ...item,
    visibility:
      item.visibility &&
      !(Math.abs(yaw) > 65 && ['eyes', 'mouth'].includes(item.category)),
  }))
}