import type { PortraitRigCamera } from './portraitRig'
import type { PortraitConstructionModel, PortraitRigGuide, RigVector3 } from './portraitConstructionModel'

export type ProjectedPoint = Readonly<{ x: number; y: number }>

export type ProjectedGeometry =
  | { kind: 'point'; position: ProjectedPoint }
  | { kind: 'line'; from: ProjectedPoint; to: ProjectedPoint }
  | { kind: 'polyline'; points: readonly ProjectedPoint[]; closed: boolean }

export type ProjectedPortraitRigGuide = Pick<
  PortraitRigGuide,
  'id' | 'category' | 'level' | 'priority' | 'visibility' | 'style'
> & {
  geometry: ProjectedGeometry
}

export type PortraitRigProjectionSettings = Readonly<{
  camera: PortraitRigCamera
  imageWidth: number
  imageHeight: number
  headOffsetX?: number
  headOffsetY?: number
  guideScale?: number
}>

const BASE_SCALE = 0.52
const CAMERA_DISTANCE = 4
const ELLIPSE_SEGMENTS = 48

const add = (left: RigVector3, right: RigVector3): RigVector3 => ({
  x: left.x + right.x,
  y: left.y + right.y,
  z: left.z + right.z,
})

const addScaled = (
  center: RigVector3,
  axisU: RigVector3,
  amountU: number,
  axisV: RigVector3,
  amountV: number,
): RigVector3 => ({
  x: center.x + axisU.x * amountU + axisV.x * amountV,
  y: center.y + axisU.y * amountU + axisV.y * amountV,
  z: center.z + axisU.z * amountU + axisV.z * amountV,
})

const mapEllipsePoint = (
  center: RigVector3,
  plane: 'xy' | 'xz' | 'yz',
  radiusU: number,
  radiusV: number,
  rotation: number,
  angle: number,
): RigVector3 => {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const rotatedU = cosine * Math.cos(rotation) - sine * Math.sin(rotation)
  const rotatedV = cosine * Math.sin(rotation) + sine * Math.cos(rotation)

  switch (plane) {
    case 'xy':
      return add(center, { x: radiusU * rotatedU, y: radiusV * rotatedV, z: 0 })
    case 'xz':
      return add(center, { x: radiusU * rotatedU, y: 0, z: radiusV * rotatedV })
    case 'yz':
      return add(center, { x: 0, y: radiusU * rotatedU, z: radiusV * rotatedV })
  }
}

export function projectPortraitRigPoint(
  point: RigVector3,
  settings: PortraitRigProjectionSettings,
): ProjectedPoint {
  const perspective = settings.camera.perspective
  const perspectiveScale = 1 / (1 - point.z * perspective / CAMERA_DISTANCE)
  const unitScale = BASE_SCALE
    * Math.min(settings.imageWidth, settings.imageHeight)
    * settings.camera.scale
    * (settings.guideScale ?? 1)
    * perspectiveScale

  return {
    x: 0.51 + point.x * unitScale / settings.imageWidth + (settings.headOffsetX ?? 0),
    y: 0.43 - (point.y - 0.34) * unitScale / settings.imageHeight + (settings.headOffsetY ?? 0),
  }
}

const sampleEllipse = (
  center: RigVector3,
  plane: 'xy' | 'xz' | 'yz',
  radiusU: number,
  radiusV: number,
  rotation = 0,
): RigVector3[] => Array.from({ length: ELLIPSE_SEGMENTS }, (_, index) =>
  mapEllipsePoint(center, plane, radiusU, radiusV, rotation, index * Math.PI * 2 / ELLIPSE_SEGMENTS))

const sampleOrientedEllipse = (
  center: RigVector3,
  radiusU: number,
  radiusV: number,
  axisU: RigVector3,
  axisV: RigVector3,
): RigVector3[] => Array.from({ length: ELLIPSE_SEGMENTS }, (_, index) => {
  const angle = index * Math.PI * 2 / ELLIPSE_SEGMENTS
  return addScaled(center, axisU, radiusU * Math.cos(angle), axisV, radiusV * Math.sin(angle))
})

const projectGuideGeometry = (
  guide: PortraitRigGuide,
  settings: PortraitRigProjectionSettings,
): ProjectedGeometry => {
  const project = (point: RigVector3) => projectPortraitRigPoint(point, settings)
  const geometry = guide.geometry

  switch (geometry.kind) {
    case 'point':
      return { kind: 'point', position: project(geometry.position) }
    case 'line':
      return { kind: 'line', from: project(geometry.from), to: project(geometry.to) }
    case 'polyline':
      return {
        kind: 'polyline',
        points: geometry.points.map(project),
        closed: geometry.closed ?? false,
      }
    case 'ellipse':
      return {
        kind: 'polyline',
        points: (geometry.axisU && geometry.axisV
          ? sampleOrientedEllipse(
              geometry.center,
              geometry.radiusU,
              geometry.radiusV,
              geometry.axisU,
              geometry.axisV,
            )
          : sampleEllipse(
              geometry.center,
              geometry.plane,
              geometry.radiusU,
              geometry.radiusV,
              geometry.rotation,
            )).map(project),
        closed: true,
      }
    case 'ellipsoid':
      return {
        kind: 'polyline',
        points: (geometry.axisU && geometry.axisV
          ? sampleOrientedEllipse(
              geometry.center,
              geometry.radii.x,
              geometry.radii.y,
              geometry.axisU,
              geometry.axisV,
            )
          : sampleEllipse(
              geometry.center,
              'xy',
              geometry.radii.x,
              geometry.radii.y,
            )).map(project),
        closed: true,
      }
    case 'plane': {
      const halfWidth = geometry.width / 2
      const halfHeight = geometry.height / 2
      return {
        kind: 'polyline',
        points: [
          addScaled(geometry.center, geometry.axisU ?? { x: 1, y: 0, z: 0 }, -halfWidth, geometry.axisV ?? { x: 0, y: 1, z: 0 }, halfHeight),
          addScaled(geometry.center, geometry.axisU ?? { x: 1, y: 0, z: 0 }, halfWidth, geometry.axisV ?? { x: 0, y: 1, z: 0 }, halfHeight),
          addScaled(geometry.center, geometry.axisU ?? { x: 1, y: 0, z: 0 }, halfWidth, geometry.axisV ?? { x: 0, y: 1, z: 0 }, -halfHeight),
          addScaled(geometry.center, geometry.axisU ?? { x: 1, y: 0, z: 0 }, -halfWidth, geometry.axisV ?? { x: 0, y: 1, z: 0 }, -halfHeight),
        ].map(project),
        closed: true,
      }
    }
  }
}

export function projectPortraitRig(
  rig: PortraitConstructionModel,
  settings: PortraitRigProjectionSettings,
): ProjectedPortraitRigGuide[] {
  return rig.guides.map((guide) => ({
    id: guide.id,
    category: guide.category,
    level: guide.level,
    priority: guide.priority,
    visibility: guide.visibility,
    style: guide.style,
    geometry: projectGuideGeometry(guide, settings),
  }))
}

export function getRelevantPortraitRigGuides(
  guides: readonly ProjectedPortraitRigGuide[],
  yaw: number,
): ProjectedPortraitRigGuide[] {
  const absoluteYaw = Math.abs(yaw)
  const isProfile = absoluteYaw >= 68
  const farSide = yaw < 0 ? 'right' : 'left'
  const farEarPrefix = `${farSide}-ear-`
  const farFeaturePrefixes = [
    `${farSide}-eye-`,
    `${farSide}-eyebrow`,
    `${farSide}-temple`,
    `${farSide}-jaw-angle`,
    `${farSide}-mouth-corner`,
    `${farSide}-nose-wing`,
  ]
  const farMethodPrefixes = [
    `asaro-${farSide}-cheek-plane`,
    `reilly-${farSide}-rhythm`,
  ]

  return guides.map((guide) => {
    if (isProfile) {
      const shouldHide = guide.id === 'face-outline'
        || guide.id === 'jaw-contour'
        || guide.id === 'facial-plane'
        || guide.id === 'face-width-axis'
        || guide.id === 'face-third-upper'
        || guide.id === 'face-third-lower'
        || guide.id === 'eye-proportion'
        || guide.id === 'nose-base'
        || guide.id.startsWith(farEarPrefix)
        || farFeaturePrefixes.some((prefix) => guide.id.startsWith(prefix))
        || farMethodPrefixes.some((prefix) => guide.id.startsWith(prefix))
        || guide.id.startsWith('asaro-')
        || guide.id.startsWith('reilly-')
        || guide.id === 'loomis-jaw-wedge'
      if (shouldHide) return { ...guide, visibility: false }
      if (guide.id === 'profile-contour') return { ...guide, visibility: true }
      return guide
    }

    if (guide.id === 'profile-contour') return { ...guide, visibility: false }
    if (absoluteYaw < 18) return guide
    return guide.id.startsWith(farEarPrefix) || farMethodPrefixes.some((prefix) => guide.id.startsWith(prefix))
      ? { ...guide, visibility: false }
      : guide
  })
}
