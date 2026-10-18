import { TreePartType, ITreePart } from './types'

export class StickyGroupNode implements ITreePart {
  public id: string | number
  public level: number
  public parent?: StickyGroupNode | StickyGroupForest | null = null
  public children: StickyGroupNode[] = []
  public type = TreePartType.NODE
  static isInstance(treePart?: ITreePart | null): treePart is StickyGroupNode {
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

  public getAncestor(level: number): StickyGroupNode | null | undefined {
    if (this.level > level) {
      return this
    }
    return this.parent?.getAncestor(level)
  }

  public findNode(id: string | number): ITreePart | null | undefined {
    if (this.id == id) {
      return this
    }
    return this.children.map((c) => c.findNode(id)).find((n) => !!n)
  }

  public findNextSibling(): StickyGroupNode | null {
    const currentNodeIndex = this.parent!.children.indexOf(this)
    return this.parent!.children[currentNodeIndex + 1] ?? this.parent!.findNextSibling()
  }

  public findPreviousSibling(): StickyGroupNode | null {
    const currentNodeIndex = this.parent!.children.indexOf(this)
    return this.parent!.children[currentNodeIndex - 1] ?? (StickyGroupNode.isInstance(this.parent) ? this.parent : null)
  }

  public hasChildren() {
    return !!this.children.length
  }

  private _size?: number = undefined
  public get size(): number | undefined {
    if (this._size == null) {
      this._size = this.hasChildren() ? Math.max(...this.children.map((c) => c.size).filter((v) => v != null)) + 1 : 0
    }

    return this._size
  }

  private _depth?: number | undefined = undefined
  public get depth(): number | undefined {
    if (this._depth == null) {
      this._depth = (this.parent?.depth ?? 0) + 1
    }

    return this._depth
  }
}

export class StickyGroupForest implements ITreePart {
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

  private _size?: number = undefined
  public size(id?: string | number): number | undefined {
    if (id != null) {
      return this.findNode(id)?.size
    }
    if (this._size == null) {
      this._size = this.hasChildren() ? Math.max(...this.children.map((c) => c.size).filter((v) => v != null)) + 1 : 0
    }

    return this._size
  }

  public get depth() {
    return 0
  }

  public findNode(id: string | number): StickyGroupNode | undefined {
    return this.children.map((c) => c.findNode(id)).find((n) => !!n) as StickyGroupNode | undefined
  }

  public findAncestors(startNode: StickyGroupNode) {
    let node: StickyGroupNode = startNode
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

export const findStickyGroupAncestor = (node: StickyGroupNode | null, level: number): StickyGroupNode | null => {
  if (!node) {
    return null
  }
  if (node.level > level) {
    return node
  }
  return node.getAncestor(level) ?? null
}
