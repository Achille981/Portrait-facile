import type { GuideAdjustments } from '../types/project'
import type { PortraitRigParameters } from './portraitRig'
import type { VisionLandmark } from '../types/vision'
export type ReferenceFitSuggestion={guideAdjustments:GuideAdjustments;rigParameters:PortraitRigParameters;quality:'stable'|'limited';wasClamped:boolean}
export function suggestReferenceFit(_landmarks:readonly VisionLandmark[],parameters:PortraitRigParameters,_width:number,_height:number):ReferenceFitSuggestion|null{return {guideAdjustments:{headOffsetX:0,headOffsetY:0,scale:1},rigParameters:parameters,quality:'limited',wasClamped:false}}