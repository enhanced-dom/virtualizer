import { IVirtualizerEntry, IVirtualizerConfig, IVirtualizerResult, IVirtualizerResultFlat, IVirtualizerResultLevel } from './types'
import { StickyGroupNode, StickyGroupForest, findStickyGroupAncestor } from './StickyGroup'

const distributeRemainingSpace = (
  entries: IVirtualizerEntry[],
  entriesWithDynamicSpace: IVirtualizerEntry[],
  unboundedEntries: IVirtualizerEntry['id'][],
  totalSpaceToDistribute: number,
  getEntryWeight: (e: IVirtualizerEntry) => number,
): IVirtualizerResultFlat[] => {
  const totalWeights = entriesWithDynamicSpace.reduce((acc, e) => acc + getEntryWeight(e), 0)
  const unitOfSpace = totalSpaceToDistribute / totalWeights
  let remainingSpaceToDistribute = totalSpaceToDistribute
  let runningOffset = 0
  const transformedEntries = entries.map((e) => {
    let size = e.fixedSize
    if (size == null) {
      let computedSize = e.minSize!
      if (remainingSpaceToDistribute > 0) {
        const entryWeight = getEntryWeight(e)
        let entryExtraSpace = Math.min(remainingSpaceToDistribute, Math.max(Math.round(entryWeight * unitOfSpace), 1))
        computedSize = (e.minSize ?? 0) + entryExtraSpace
        if (e.maxSize && computedSize > e.maxSize) {
          computedSize = e.maxSize
          entryExtraSpace = e.maxSize - (e.minSize ?? 0)
        }
        remainingSpaceToDistribute -= entryExtraSpace
      }
      size = computedSize
    }
    const entryOffset = runningOffset
    runningOffset += size
    return { id: e.id, size, offset: entryOffset }
  })
  // extra space could only be handed to unbounded entries after every size above was settled, so if that
  // happens the offsets computed above are stale for everything following the first adjusted entry
  if (remainingSpaceToDistribute > 0 && unboundedEntries.length) {
    const outstandingUnitOfSpace = remainingSpaceToDistribute / unboundedEntries.length
    transformedEntries.forEach((e) => {
      if (unboundedEntries.includes(e.id) && remainingSpaceToDistribute > 0) {
        const extraEntrySpace =
          e.id === unboundedEntries[unboundedEntries.length - 1] ? remainingSpaceToDistribute : Math.round(outstandingUnitOfSpace)
        e.size = e.size + extraEntrySpace
        remainingSpaceToDistribute -= extraEntrySpace
      }
    })
    runningOffset = 0
    transformedEntries.forEach((e) => {
      e.offset = runningOffset
      runningOffset += e.size
    })
  }
  return transformedEntries
}

interface ICompleteEntryMapping {
  lowerBoundSize: number
  entriesOffsets: { id: string | number; offset: number; size: number }[]
  entryOffsetById: Record<string | number, { start: number; end: number }>
  entryById: Record<string, IVirtualizerEntry>
  stickyGroups: StickyGroupForest
  stickyGroupNodeById: Map<IVirtualizerEntry['id'], StickyGroupNode>
  entriesWithDynamicSpace: IVirtualizerEntry[]
  unboundedEntries: IVirtualizerEntry['id'][]
  minimumExplicitWeight: number
  minimumDerivedWeight: number
}

const buildCompleteEntryMapping = (entries: IVirtualizerEntry[]): ICompleteEntryMapping => {
  let lowerBoundSize = 0
  // while we iterate over the entries, we should also find out some 'statisticts' about weights
  const entriesWithDynamicSpace: IVirtualizerEntry[] = []
  const unboundedEntries: IVirtualizerEntry['id'][] = []
  const entriesOffsets: { id: string | number; offset: number; size: number }[] = []
  const entryOffsetById: Record<string | number, { start: number; end: number }> = {}
  const stickyGroups = new StickyGroupForest()
  const stickyGroupNodeById = new Map<IVirtualizerEntry['id'], StickyGroupNode>()
  const entryById: Record<string, IVirtualizerEntry> = {}
  let currentStickyGroupNode: StickyGroupNode | null = null
  let minimumExplicitWeight = Infinity
  let minimumDerivedWeight = Infinity
  for (const e of entries) {
    const entryMinSize = (e.fixedSize ?? e.minSize)!
    entriesOffsets.push({ id: e.id, offset: lowerBoundSize, size: entryMinSize })
    entryOffsetById[e.id] = { start: lowerBoundSize, end: lowerBoundSize + entryMinSize }
    lowerBoundSize += entryMinSize ?? 0
    entryById[e.id] = e
    if (e.level != null) {
      const ancestor = findStickyGroupAncestor(currentStickyGroupNode, e.level)
      if (ancestor == null) {
        currentStickyGroupNode = new StickyGroupNode(e.id, e.level)
        stickyGroups.addChild(currentStickyGroupNode)
      } else {
        currentStickyGroupNode = ancestor.addChild(new StickyGroupNode(e.id, e.level))
      }
      stickyGroupNodeById.set(e.id, currentStickyGroupNode)
    }
    if (e.fixedSize == null && (e.weight || e.maxSize == null || e.maxSize > e.minSize!)) {
      entriesWithDynamicSpace.push(e)
      if (e.maxSize == null) {
        unboundedEntries.push(e.id)
      }
      if (e.weight && e.weight < minimumExplicitWeight) {
        minimumExplicitWeight = e.weight
      }
      // TODO: we assume that the input is 'sane', and maxSize > minSize if given
      if (e.maxSize && e.maxSize - (e.minSize ?? 0) < minimumDerivedWeight) {
        minimumDerivedWeight = e.maxSize - (e.minSize ?? 0)
      }
    }
  }
  if (!isFinite(minimumExplicitWeight)) {
    minimumExplicitWeight = 1
  }
  if (!isFinite(minimumDerivedWeight)) {
    minimumDerivedWeight = 1
  }
  return {
    lowerBoundSize,
    entriesOffsets,
    entryOffsetById,
    entryById,
    stickyGroups,
    stickyGroupNodeById,
    entriesWithDynamicSpace,
    unboundedEntries,
    minimumExplicitWeight,
    minimumDerivedWeight,
  }
}

const buildResultWithLevel = (entry: IVirtualizerEntry, size: number, offset: number): IVirtualizerResult =>
  entry.level == null
    ? { id: entry.id, size, offset }
    : { id: entry.id, size, offset, level: entry.level, minOffset: offset, maxOffset: offset, levelOffset: 0 }

// derives levelOffset/minOffset/maxOffset for whichever already-placed entries carry a level, based on
// their position in the sticky group tree. Shared by both the 'everything fits' and windowed paths.
const attachStickyLevelOffsets = (transformedEntries: IVirtualizerResult[], completeEntryMapping: ICompleteEntryMapping): void => {
  const { entryOffsetById, stickyGroupNodeById, lowerBoundSize } = completeEntryMapping
  const relativeOffsets: Record<string, number> = {}
  transformedEntries
    .filter((te): te is IVirtualizerResultLevel => te.level != null)
    .sort((e1, e2) => e2.level - e1.level)
    .forEach((te) => {
      const stickyGroupNode = stickyGroupNodeById.get(te.id)!
      const nextSiblingGroupNode = stickyGroupNode.findNextSibling()
      te.maxOffset = nextSiblingGroupNode ? entryOffsetById[nextSiblingGroupNode.id]!.start - te.size : lowerBoundSize - te.size
      te.minOffset = te.offset
      const parentGroupNode = StickyGroupNode.isInstance(stickyGroupNode.parent) ? stickyGroupNode.parent : null
      const levelOffset = relativeOffsets[String(parentGroupNode?.id)] ?? 0
      te.levelOffset = levelOffset
      relativeOffsets[te.id] = levelOffset + te.size
    })
}

const virtualizeFromMapping = (
  config: IVirtualizerConfig,
  entries: IVirtualizerEntry[],
  completeEntryMapping: ICompleteEntryMapping,
): IVirtualizerResult[] => {
  const { offset, overscan, viewportSize } = {
    offset: 0,
    overscan: 5,
    ...config,
  }
  const {
    lowerBoundSize,
    entriesOffsets,
    entryOffsetById,
    entryById,
    stickyGroups,
    stickyGroupNodeById,
    entriesWithDynamicSpace,
    unboundedEntries,
    minimumExplicitWeight,
    minimumDerivedWeight,
  } = completeEntryMapping

  // first, let us figure out if the size is smaller than the viewport
  if (lowerBoundSize <= viewportSize) {
    // we will show ALL entries
    const totalSpaceToDistribute = viewportSize - lowerBoundSize
    let flatResults: IVirtualizerResultFlat[]
    if (entriesWithDynamicSpace.some((e) => e.weight)) {
      // we will attempt distribute the rest of the available space among entries that have not maxSize based on their weights
      flatResults = distributeRemainingSpace(
        entries,
        entriesWithDynamicSpace,
        unboundedEntries,
        totalSpaceToDistribute,
        (e) => e.weight ?? minimumExplicitWeight,
      )
    } else if (entriesWithDynamicSpace.length) {
      // we attempt to distribute the remaining space based on the maxSize - minSize
      flatResults = distributeRemainingSpace(entries, entriesWithDynamicSpace, unboundedEntries, totalSpaceToDistribute, (e) =>
        e.maxSize ? e.maxSize - (e.minSize ?? 0) : minimumDerivedWeight,
      )
    } else {
      // nothing to distribute to (every entry has a fixedSize) - entriesOffsets already has everything we need, no need to re-map entries
      flatResults = entriesOffsets
    }
    // even though every entry fits without virtualizing the window, sticky entries still need their level/offsets attached
    const resultsWithLevel: IVirtualizerResult[] = flatResults.map((r) => buildResultWithLevel(entryById[r.id]!, r.size, r.offset))
    if (stickyGroups.hasChildren()) {
      attachStickyLevelOffsets(resultsWithLevel, completeEntryMapping)
    }
    return resultsWithLevel
  }

  // we will show only 'some' entries. Let's figure out which ones are in the window
  const firstOffsetInWindow = entriesOffsets.find((o) => o.offset <= offset && o.offset + o.size >= offset)
  if (!firstOffsetInWindow) {
    return []
  }
  const firstEntryIdxInWindow = entriesOffsets.indexOf(firstOffsetInWindow)
  const firstEntryIdx = Math.max(0, firstEntryIdxInWindow - overscan)
  const firstOffsetOutOfWindow = entriesOffsets.find((o) => o.offset >= offset + viewportSize)
  const lastEntryIdxInWindow = firstOffsetOutOfWindow ? entriesOffsets.indexOf(firstOffsetOutOfWindow) - 1 : entries.length - 1
  const lastEntryIdx = Math.min(entries.length - 1, lastEntryIdxInWindow + overscan)
  // take the entries corresponding to the viewport and include the overscan
  const selectedEntries = entries.slice(firstEntryIdx, lastEntryIdx + 1)
  let transformedEntries: IVirtualizerResult[] = selectedEntries.map((e) => {
    const size = (e.fixedSize ?? e.minSize)!
    const resultOffset = entryOffsetById[e.id]!.start
    if (e.level == null) {
      return { id: e.id, size, offset: resultOffset }
    }
    // minOffset/maxOffset/levelOffset are placeholders here, overwritten below once every sticky group is known
    return { id: e.id, size, offset: resultOffset, level: e.level, minOffset: resultOffset, maxOffset: resultOffset, levelOffset: 0 }
  })

  // adjust selected entries off the window which have a stickyGroup
  if (stickyGroups.hasChildren()) {
    const firstStickyEntryOutsideTheWindow = entries
      .slice(0, firstEntryIdx)
      .reverse()
      .find((e): e is IVirtualizerEntry & { level: number } => e.level != null)
    if (firstStickyEntryOutsideTheWindow) {
      const stickyAncestors = stickyGroups.findAncestors(stickyGroupNodeById.get(firstStickyEntryOutsideTheWindow.id)!)
      // then, find and transform preceding sticky entries
      const stickyTransformedEntries: IVirtualizerResultLevel[] = stickyAncestors.map((stickyGroupNode) => {
        const entry = entryById[stickyGroupNode.id]!
        const size = (entry.fixedSize ?? entry.minSize)!
        const resultOffset = entryOffsetById[entry.id]!.start
        return {
          id: entry.id,
          size,
          offset: resultOffset,
          level: entry.level!,
          minOffset: resultOffset,
          maxOffset: resultOffset,
          levelOffset: 0,
        }
      })
      const size = (firstStickyEntryOutsideTheWindow.fixedSize ?? firstStickyEntryOutsideTheWindow.minSize)!
      const resultOffset = entryOffsetById[firstStickyEntryOutsideTheWindow.id]!.start
      transformedEntries = [
        ...stickyTransformedEntries,
        {
          id: firstStickyEntryOutsideTheWindow.id,
          size,
          offset: resultOffset,
          level: firstStickyEntryOutsideTheWindow.level,
          minOffset: resultOffset,
          maxOffset: resultOffset,
          levelOffset: 0,
        },
        ...transformedEntries,
      ]
    }

    // then figure out the level of the sticky entries based on the depth of the tree of group nodes
    attachStickyLevelOffsets(transformedEntries, completeEntryMapping)
  }
  return transformedEntries
}

export const virtualize = (config: IVirtualizerConfig, entries: IVirtualizerEntry[]): IVirtualizerResult[] =>
  virtualizeFromMapping(config, entries, buildCompleteEntryMapping(entries))

export const createCachedVirtualizer = () => {
  let completeEntryMapping: ICompleteEntryMapping | null = null
  let previousEntries: IVirtualizerEntry[] | null = null
  return (config: IVirtualizerConfig, entries: IVirtualizerEntry[]): IVirtualizerResult[] => {
    if (entries !== previousEntries) {
      completeEntryMapping = buildCompleteEntryMapping(entries)
      previousEntries = entries
    }
    return virtualizeFromMapping(config, entries, completeEntryMapping!)
  }
}
