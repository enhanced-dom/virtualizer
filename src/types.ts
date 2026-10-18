export type IVirtualizerEntry = { level?: number; id: string | number; maxSize?: number; weight?: number } & (
  { minSize: number; fixedSize?: number } | { minSize?: number; fixedSize: number }
)

export interface IVirtualizerConfig {
  viewportSize: number
  offset?: number
  overscan?: number
}

export interface IVirtualizerResultFlat extends Pick<IVirtualizerEntry, 'id'> {
  size: number
  offset: number
  level?: never
}

export interface IVirtualizerResultLevel extends Omit<IVirtualizerResultFlat, 'level'> {
  levelOffset: number
  minOffset: number
  maxOffset: number
  level: number
}

export type IVirtualizerResult = IVirtualizerResultFlat | IVirtualizerResultLevel

export enum TreePartType {
  NODE = 'node',
  FOREST = 'forest',
}

export interface ITreePart {
  type: TreePartType
}
