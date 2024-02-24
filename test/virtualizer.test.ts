import { type IVirtualizerEntry, virtualize } from '../src'

describe('virtualizer', () => {
  test('auto-virtualizes elements to stretch to the view', () => {
    const viewportSize = 100

    // no fixed sizes, no weights, no max sizes, should distribute all remaining space equally
    let entries: IVirtualizerEntry[] = [
      { id: 1, level: 1, minSize: 10 },
      { id: 2, minSize: 20 },
    ]
    let totalFixedSize = entries.reduce((acc, e) => acc + e.minSize, 0)
    let results = virtualize({ viewportSize }, entries)
    expect(results.length).toEqual(entries.length)
    expect(results[0].id).toEqual(entries[0].id)
    expect(results[0].size).toEqual(entries[0].minSize + (viewportSize - totalFixedSize) / 2)
    expect(results[1].id).toEqual(entries[1].id)
    expect(results[1].size).toEqual(entries[1].minSize + (viewportSize - totalFixedSize) / 2)

    // some fixed sizes, no weights, no max sizes, should distribute all remaining space to items without fixed size
    entries = [
      { id: 1, level: 1, minSize: 10, fixedSize: 8 },
      { id: 2, minSize: 20 },
    ]
    totalFixedSize = entries.reduce((acc, e) => acc + (e.fixedSize ?? e.minSize), 0)
    results = virtualize({ viewportSize }, entries)
    expect(results[0].id).toEqual(entries[0].id)
    expect(results[0].size).toEqual(entries[0].fixedSize)
    expect(results[1].id).toEqual(entries[1].id)
    expect(results[1].size).toEqual(entries[1].minSize + viewportSize - totalFixedSize)

    // only fixed sizes, should NOT distribute any remaining space
    entries = [
      { id: 1, minSize: 10, fixedSize: 8 },
      { id: 2, minSize: 20, fixedSize: 42 },
      { id: 3, maxSize: 20, fixedSize: 10 },
    ]
    totalFixedSize = entries.reduce((acc, e) => acc + (e.fixedSize ?? e.minSize), 0)
    results = virtualize({ viewportSize }, entries)
    expect(results[0].id).toEqual(entries[0].id)
    expect(results[0].size).toEqual(entries[0].fixedSize)
    expect(results[1].id).toEqual(entries[1].id)
    expect(results[1].size).toEqual(entries[1].fixedSize)
    expect(results[2].id).toEqual(entries[2].id)
    expect(results[2].size).toEqual(entries[2].fixedSize)

    // some fixed sizes, some maxSizes, some weights, should distribute respecting the weights and maxSize and consider minweight where missing weight
    entries = [
      { id: 1, fixedSize: 10 },
      { id: 2, minSize: 20, weight: 2 },
      { id: 3, maxSize: 20, minSize: 10 },
      { id: 4, weight: 5, minSize: 10 },
    ]
    totalFixedSize = entries.reduce((acc, e) => acc + (e.fixedSize ?? e.minSize), 0)
    results = virtualize({ viewportSize }, entries)
    expect(results[0].id).toEqual(entries[0].id)
    expect(results[0].size).toEqual(entries[0].fixedSize)
    expect(results[1].id).toEqual(entries[1].id)
    expect(results[1].size).toEqual(32)
    expect(results[2].id).toEqual(entries[2].id)
    expect(results[2].size).toEqual(entries[2].maxSize)
    expect(results[3].id).toEqual(entries[3].id)
    expect(results[3].size).toEqual(38)

    // some fixed sizes, some maxSizes, no weights, should distribute respecting the maxSize-minSize, and consider minsizedelta were missing maxSize
    entries = [
      { id: 1, minSize: 10, fixedSize: 8 },
      { id: 2, minSize: 20, maxSize: 25 },
      { id: 3, minSize: 10 },
      { id: 4, minSize: 10, maxSize: 50 },
    ]
    totalFixedSize = entries.reduce((acc, e) => acc + (e.fixedSize ?? e.minSize), 0)
    results = virtualize({ viewportSize }, entries)
    expect(results[0].id).toEqual(entries[0].id)
    expect(results[0].size).toEqual(entries[0].fixedSize)
    expect(results[1].id).toEqual(entries[1].id)
    expect(results[1].size).toEqual(entries[1].maxSize)
    expect(results[2].id).toEqual(entries[2].id)
    expect(results[2].size).toEqual(17)
    expect(results[3].id).toEqual(entries[3].id)
    expect(results[3].size).toEqual(entries[3].maxSize)

    // some fixed sizes, some maxSizes, one weight, should ensure all outstanding space is distributed to unbounded items
    entries = [
      { id: 1, minSize: 5, maxSize: 10 },
      { id: 2, minSize: 5, weight: 2 },
      { id: 3, minSize: 5, maxSize: 15, weight: 1 },
      { id: 4, minSize: 5 },
    ]
    totalFixedSize = entries.reduce((acc, e) => acc + (e.fixedSize ?? e.minSize), 0)
    results = virtualize({ viewportSize }, entries)
    expect(results[0].id).toEqual(entries[0].id)
    expect(results[0].size).toEqual(entries[0].maxSize)
    expect(results[1].id).toEqual(entries[1].id)
    expect(results[1].size).toEqual(46)
    expect(results[2].id).toEqual(entries[2].id)
    expect(results[2].size).toEqual(entries[2].maxSize)
    expect(results[3].id).toEqual(entries[3].id)
    expect(results[3].size).toEqual(29)
    expect(results.reduce((acc, r) => acc + r.size, 0)).toEqual(viewportSize)
  })

  test('virtualizes elements based on offset', () => {
    const viewportSize = 100

    // no fixed sizes, no weights, no max sizes, should distribute all remaining space equally
    let entries: IVirtualizerEntry[] = [
      { id: 1, fixedSize: 10 },
      { id: 2, fixedSize: 10, minSize: 2 },
      { id: 3, fixedSize: 10 },
      { id: 4, fixedSize: 10 },
      { id: 5, fixedSize: 10 },
      { id: 6, fixedSize: 10 },
      { id: 7, fixedSize: 10 },
      { id: 8, fixedSize: 10 },
      { id: 9, fixedSize: 10 },
      { id: 10, fixedSize: 10 },
      { id: 11, fixedSize: 10, maxSize: 30 },
      { id: 12, fixedSize: 10 },
      { id: 13, minSize: 10, maxSize: 30 },
      { id: 14, fixedSize: 10 },
      { id: 15, fixedSize: 10 },
      { id: 16, fixedSize: 10 },
      { id: 17, fixedSize: 10 },
      { id: 18, fixedSize: 10 },
      { id: 19, fixedSize: 10 },
      { id: 20, fixedSize: 10 },
      { id: 21, fixedSize: 10 },
    ]
    // viewport starts in the middle of an item
    let results = virtualize({ viewportSize, offset: 55, overscan: 2 }, entries)
    expect(results.length).toEqual(15)
    expect(results[0].id).toEqual(4)
    expect(results[results.length - 1].id).toEqual(18)

    // not enough items to overscan
    results = virtualize({ viewportSize, offset: 10, overscan: 2 }, entries)
    expect(results.length).toEqual(13)
    expect(results[0].id).toEqual(1)
    expect(results[results.length - 1].id).toEqual(13)

    // offset is somehow larger than the total size of the elements...
    results = virtualize({ viewportSize, offset: 300, overscan: 2 }, entries)
    expect(results.length).toEqual(0)
    // expect(results[0].id).toEqual(20)
    // expect(results[results.length - 1].id).toEqual(21)

    // offset allows only 1 element. barely
    results = virtualize({ viewportSize, offset: 205, overscan: 2 }, entries)
    expect(results.length).toEqual(3)
    expect(results[0].id).toEqual(19)
  })

  test('account for sticky elements during the virtualization', () => {
    // no fixed sizes, no weights, no max sizes, should distribute all remaining space equally
    let entries: IVirtualizerEntry[] = [
      { id: 1, fixedSize: 10, level: 3 },
      { id: 2, fixedSize: 10, minSize: 2, level: 2 },
      { id: 3, fixedSize: 10 },
      { id: 4, fixedSize: 10 },
      { id: 5, fixedSize: 10 },
      { id: 6, fixedSize: 10 },
      { id: 7, fixedSize: 10, level: 2 },
      { id: 8, fixedSize: 10, level: 1 },
      { id: 9, fixedSize: 10 },
      { id: 10, fixedSize: 10 },
      { id: 11, fixedSize: 10, maxSize: 30 },
      { id: 12, fixedSize: 10, level: 1 },
      { id: 13, minSize: 10, maxSize: 30 },
      { id: 14, fixedSize: 10 },
      { id: 15, fixedSize: 10, level: 2 },
      { id: 16, fixedSize: 10 },
      { id: 17, fixedSize: 10 },
      { id: 18, fixedSize: 10, level: 3 },
      { id: 19, fixedSize: 10, level: 2 },
      { id: 20, fixedSize: 10 },
      { id: 21, fixedSize: 10 },
    ]
    // viewport starts in the middle of an item, some sticky elements are outside the window
    let results = virtualize({ viewportSize: 100, offset: 65, overscan: 2 }, entries)
    expect(results.length).toEqual(17)
    expect(results.map((r) => r.id)).toEqual([1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19])

    // viewport aligns with an item, sticky elements outside of window will shift sticky element in widow
    results = virtualize({ viewportSize: 50, offset: 110, overscan: 1 }, entries)
    expect(results.length).toEqual(11)
    expect(results.map((r) => r.id)).toEqual([1, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17])
  })
})
