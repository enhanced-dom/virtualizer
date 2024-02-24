export type IVirtualizerEntry = { level?: number; id: string | number; maxSize?: number; weight?: number } & (
  | { minSize: number; fixedSize?: number }
  | { minSize?: number; fixedSize: number }
)

export interface IVirtualizerConfig {
  viewportSize: number
  offset?: number
  overscan?: number
}

export interface IVirtualizerResult extends Pick<IVirtualizerEntry, 'id'> {
  size: number
  offset?: number
  relativeOffset?: number
  minOffset?: number
  maxOffset?: number
  level?: number
}

enum TreePartType {
  NODE = 'node',
  FOREST = 'forest',
}

interface ITreePart {
  type: TreePartType
}

class StickyGroupNode implements ITreePart {
  public id: string | number
  public level: number
  public parent?: StickyGroupNode | StickyGroupForest = null
  public children: StickyGroupNode[] = []
  public type = TreePartType.NODE
  static isInstance(treePart?: ITreePart): treePart is StickyGroupNode {
    return treePart?.type === TreePartType.NODE
  }
  constructor(id: string | number, level: number) {
    this.id = id
    this.level = level
  }

  public addChild(child: StickyGroupNode) {
    child.parent = this
    this.children.push(child)
    return child
  }

  public getAncestor(level: number) {
    if (this.level > level) {
      return this
    }
    return this.parent?.getAncestor(level)
  }

  public findNode(id: string | number) {
    if (this.id == id) {
      return this
    }
    return this.children.map((c) => c.findNode(id)).find((n) => !!n)
  }

  public findNextSibling(): StickyGroupNode | null {
    const currentNodeIndex = this.parent.children.indexOf(this)
    return this.parent.children[currentNodeIndex + 1] ?? this.parent.findNextSibling()
  }

  public findPreviousSibling(): StickyGroupNode | null {
    const currentNodeIndex = this.parent.children.indexOf(this)
    return this.parent.children[currentNodeIndex - 1] ?? (StickyGroupNode.isInstance(this.parent) ? this.parent : null)
  }

  public hasChildren() {
    return !!this.children.length
  }

  private _size?: number = null
  public get size(): number {
    if (this._size == null) {
      this._size = this.hasChildren() ? Math.max(...this.children.map((c) => c.size)) + 1 : 0
    }

    return this._size
  }

  private _depth?: number = null
  public get depth(): number {
    if (this._depth == null) {
      this._depth = this.parent.depth + 1
    }

    return this._depth
  }
}

class StickyGroupForest implements ITreePart {
  public children: StickyGroupNode[] = []
  public type = TreePartType.FOREST
  public addChild(child: StickyGroupNode) {
    child.parent = this
    this.children.push(child)
  }

  public hasChildren() {
    return !!this.children.length
  }

  public getAncestor() {
    return null
  }

  private _size?: number = null
  public size(id?: string | number): number {
    if (id != null) {
      return this.findNode(id)?.size
    }
    if (this._size == null) {
      this._size = this.hasChildren() ? Math.max(...this.children.map((c) => c.size)) + 1 : 0
    }

    return this._size
  }

  public get depth() {
    return 0
  }

  public findNode(id: string | number): StickyGroupNode | null {
    return this.children.map((c) => c.findNode(id)).find((n) => !!n)
  }

  public findAncestors(id: string | number) {
    let node = this.findNode(id)
    if (!node) {
      return []
    }
    const ancestors = []
    while (node.parent !== this) {
      node = node.parent as StickyGroupNode
      ancestors.unshift(node)
    }
    return ancestors
  }

  public findNextSibling() {
    return null
  }

  public findPreviousSibling() {
    return null
  }
}

export const virtualize = (config: IVirtualizerConfig, entries: IVirtualizerEntry[]): IVirtualizerResult[] => {
  const { offset, overscan, viewportSize } = {
    offset: 0,
    overscan: 5,
    ...config,
  }
  // first, let us figure out if the size is smaller than the viewport
  // while we iterate over the entries, we should also find out some 'statisticts' about weights
  let lowerBoundSize = 0
  const entriesWithDynamicSpace: IVirtualizerEntry[] = []
  const unboundedEntries: IVirtualizerEntry['id'][] = []
  const entriesOffsets: { id: string | number; offset: number; size: number }[] = []
  const stickyGroups = new StickyGroupForest()
  const entryById: Record<string, IVirtualizerEntry> = {}
  let currentStickyGroupNode: StickyGroupNode = null
  let minimumExplicitWeight = Infinity
  let minimumDerivedWeight = Infinity
  for (const e of entries) {
    const entryMinSize = e.fixedSize ?? e.minSize
    entriesOffsets.push({ id: e.id, offset: lowerBoundSize, size: entryMinSize })
    lowerBoundSize += entryMinSize
    entryById[e.id] = e
    if (e.level != null) {
      currentStickyGroupNode =
        (currentStickyGroupNode?.level ?? 0) > e.level ? currentStickyGroupNode : currentStickyGroupNode?.getAncestor(e.level)
      if (!currentStickyGroupNode) {
        currentStickyGroupNode = new StickyGroupNode(e.id, e.level)
        stickyGroups.addChild(currentStickyGroupNode)
      } else {
        currentStickyGroupNode = currentStickyGroupNode.addChild(new StickyGroupNode(e.id, e.level))
      }
    }
    if (e.fixedSize == null && (e.weight || e.maxSize == null || e.maxSize > e.minSize)) {
      entriesWithDynamicSpace.push(e)
      if (e.maxSize == null) {
        unboundedEntries.push(e.id)
      }
      if (e.weight && e.weight < minimumExplicitWeight) {
        minimumExplicitWeight = e.weight
      }
      // TODO: we assume that the input is 'sane', and maxSize > minSize if given
      if (e.maxSize && e.maxSize - e.minSize < minimumDerivedWeight) {
        minimumDerivedWeight = e.maxSize - e.minSize
      }
    }
  }
  if (!isFinite(minimumExplicitWeight)) {
    minimumExplicitWeight = 1
  }
  if (!isFinite(minimumDerivedWeight)) {
    minimumDerivedWeight = 1
  }
  if (lowerBoundSize <= viewportSize) {
    // we will show ALL entries
    const totalSpaceToDistribute = viewportSize - lowerBoundSize
    if (entriesWithDynamicSpace.some((e) => e.weight)) {
      // we will attempt distribute the rest of the available space among entries that have not maxSize based on their weights
      const totalExplicitWeights = entriesWithDynamicSpace.reduce((acc, e) => {
        return acc + (e.weight ?? minimumExplicitWeight)
      }, 0)
      const unitOfSpace = totalSpaceToDistribute / totalExplicitWeights
      let remainingSpaceToDistribute = totalSpaceToDistribute
      const transformedEntries = entries.map((e) => {
        const transformedEntry = { id: e.id, floating: false, size: e.fixedSize }
        if (transformedEntry.size == null) {
          let computedSize = e.minSize
          if (remainingSpaceToDistribute > 0) {
            const entryWeight = e.weight ?? minimumExplicitWeight
            let entryExtraSpace = Math.min(remainingSpaceToDistribute, Math.max(Math.round(entryWeight * unitOfSpace), 1))
            computedSize = e.minSize + entryExtraSpace
            if (e.maxSize && computedSize > e.maxSize) {
              computedSize = e.maxSize
              entryExtraSpace = e.maxSize - e.minSize
            }
            remainingSpaceToDistribute -= entryExtraSpace
          }
          transformedEntry.size = computedSize
        }
        return transformedEntry
      })
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
      }
      return transformedEntries
    }

    // we attempt to distribute the remaining space based on the maxSize - minSize
    const totalDerivedWeights = entriesWithDynamicSpace.reduce((acc, e) => {
      return acc + (e.maxSize ? e.maxSize - e.minSize : minimumDerivedWeight)
    }, 0)
    if (minimumDerivedWeight) {
      const unitOfSpace = totalSpaceToDistribute / totalDerivedWeights
      let remainingSpaceToDistribute = totalSpaceToDistribute
      const transformedEntries = entries.map((e) => {
        const transformedEntry: IVirtualizerResult = { id: e.id, size: e.fixedSize }
        if (transformedEntry.size == null) {
          let computedSize = e.minSize
          if (remainingSpaceToDistribute > 0) {
            const entryWeight = e.maxSize ? e.maxSize - e.minSize : minimumDerivedWeight
            let entryExtraSpace = Math.min(remainingSpaceToDistribute, Math.max(Math.round(entryWeight * unitOfSpace), 1))
            computedSize = e.minSize + entryExtraSpace
            if (e.maxSize && computedSize > e.maxSize) {
              computedSize = e.maxSize
              entryExtraSpace = e.maxSize - e.minSize
            }
            remainingSpaceToDistribute -= entryExtraSpace
          }
          transformedEntry.size = computedSize
        }
        return transformedEntry
      })
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
      }
      return transformedEntries
    }
    // no luck distributing the weights - we will return the entries as they are...
    return entries.map((e) => ({ id: e.id, floating: false, size: e.fixedSize ?? e.minSize }))
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
  const entryOffsetById = entriesOffsets.reduce(
    (acc, eo) => {
      acc[eo.id] = { start: eo.offset, end: eo.offset + eo.size }
      return acc
    },
    {} as Record<string | number, { start: number; end: number }>,
  )
  let transformedEntries: IVirtualizerResult[] = selectedEntries.map((e) => ({
    id: e.id,
    size: e.fixedSize ?? e.minSize,
    offset: entryOffsetById[e.id].start,
    level: e.level,
  }))

  // adjust selected entries off the window which have a stickyGroup
  if (stickyGroups.hasChildren()) {
    // first, we will adjust the maxOffset for the sticky entries within the view:
    transformedEntries.forEach((e) => {
      if (e.level) {
        const entryGroupNode = stickyGroups.findNode(e.id)
        const nextSiblingGroupNode = entryGroupNode.findNextSibling()
        e.maxOffset = nextSiblingGroupNode ? entryOffsetById[nextSiblingGroupNode.id].start - e.size : null
        e.minOffset = e.offset
      }
    })

    const firstStickyEntryOutsideTheWindow = entries
      .slice(0, firstEntryIdx)
      .reverse()
      .find((e) => !!e.level)
    if (firstStickyEntryOutsideTheWindow) {
      const stickyAncestors = stickyGroups.findAncestors(firstStickyEntryOutsideTheWindow.id)
      // then, find and transform preceding sticky entries
      const stickyTransformedEntries = stickyAncestors.map((stickyGroupNode) => {
        const entry = entryById[stickyGroupNode.id]
        const size = entry.fixedSize ?? entry.minSize
        return {
          id: entry.id,
          size,
          offset: entryOffsetById[entry.id].start,
          level: entry.level,
        } as IVirtualizerResult
      })
      transformedEntries = [
        ...stickyTransformedEntries,
        {
          id: firstStickyEntryOutsideTheWindow.id,
          size: firstStickyEntryOutsideTheWindow.fixedSize ?? firstStickyEntryOutsideTheWindow.minSize,
          offset: entryOffsetById[firstStickyEntryOutsideTheWindow.id].start,
          level: firstStickyEntryOutsideTheWindow.level,
        },
        ...transformedEntries,
      ]
    }

    // then figure out the level of the sticky entries based on the depth of the tree of group nodes
    const relativeOffsets: Record<string, number> = {}
    transformedEntries
      .filter((te) => !!te.level)
      .sort((e1, e2) => e2.level - e1.level)
      .forEach((te) => {
        const stickyGroupNode = stickyGroups.findNode(te.id)
        const nextSiblingGroupNode = stickyGroupNode.findNextSibling()
        te.maxOffset = nextSiblingGroupNode ? entryOffsetById[nextSiblingGroupNode.id].start - te.size : lowerBoundSize - te.size
        te.minOffset = te.offset
        const parentGroupNode = StickyGroupNode.isInstance(stickyGroupNode.parent) ? stickyGroupNode.parent : null
        const levelOffset = relativeOffsets[parentGroupNode?.id] ?? 0
        te.relativeOffset = levelOffset
        relativeOffsets[te.id] = levelOffset + te.size
      })
  }
  return transformedEntries
}
