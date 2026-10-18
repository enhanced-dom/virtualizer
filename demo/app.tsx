import React, { useCallback, useState, useRef, useMemo } from 'react'
import { StylesheetsRepository } from '@enhanced-dom/css'
import { useDebouncedCallback, useObservedDimensions } from '@enhanced-dom/react'

import * as styles from './app.pcss'
import { IVirtualizerEntry, virtualize } from '../src'
import Tile from './tile.component'
import Controls from './controls.component'

const stylesheetsRepository = new StylesheetsRepository(document)

const DEFAULT_ELEMENT_COUNT = 10000
const DEFAULT_LEVELS = 3

// levels is the number of active tiers; numbering always starts at 0 (innermost active tier)
// and goes up to levels - 1 (outermost), regardless of how many tiers are selected
const getLevel = (id: number, levels: number): number | undefined => {
  if (levels >= 1 && id % 31 === 0) {
    return levels
  }
  if (levels >= 2 && (id - 1) % 19 === 0) {
    return levels - 1
  }
  if (levels >= 3 && (id - 2) % 7 === 0) {
    return levels - 2
  }
  return undefined
}

const App = () => {
  const [scroll, setScroll] = useState(0)
  const [elementCount, setElementCount] = useState(DEFAULT_ELEMENT_COUNT)
  const [levels, setLevels] = useState(DEFAULT_LEVELS)

  const entries = useMemo<IVirtualizerEntry[]>(
    () =>
      Array.from({ length: elementCount }, (_, k) => k).map((id) => ({
        id,
        ...(id % 8 === 0 ? { minSize: 20, maxSize: 80 } : { fixedSize: 40 }),
        level: getLevel(id, levels),
      })),
    [elementCount, levels],
  )

  const setScollDebounced = useDebouncedCallback(setScroll, 1, { leading: false, trailing: true })

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollValue = e.currentTarget.scrollLeft
      setScollDebounced(scrollValue)
      stylesheetsRepository.setProperty('demo-styles', `.${styles.scrollWrapper}`, '--current-scroll', `${scrollValue}px`)
    },
    [setScollDebounced],
  )

  const scrollWrapperRef = useRef<HTMLDivElement>(null)

  const minCanvasSize = useMemo(
    () => entries.reduce((canvasSize, entry) => canvasSize + (entry.fixedSize ?? entry.minSize ?? 0), 0),
    [entries],
  )

  const scrollWindowSize = useObservedDimensions(scrollWrapperRef)

  const entriesToShow = useMemo(() => {
    if (!scrollWindowSize.width) {
      return []
    }
    console.log('virtualizing')
    return virtualize({ offset: scroll, overscan: Math.floor(scrollWindowSize.width / 40), viewportSize: scrollWindowSize.width }, entries)
  }, [scroll, scrollWindowSize.width, entries])

  const canvasSize = Math.max(scrollWindowSize.width ?? 0, minCanvasSize)

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div onScroll={handleScroll} className={styles.scrollWrapper} ref={scrollWrapperRef}>
          <div className={styles.scrollCanvas} style={{ width: canvasSize }}>
            {entriesToShow.map(({ id, ...rest }) => (
              <Tile key={id} {...rest}>
                {id}
              </Tile>
            ))}
          </div>
        </div>
      </div>
      <Controls elementCount={elementCount} onElementCountChange={setElementCount} levels={levels} onLevelsChange={setLevels} />
    </div>
  )
}

export default App
