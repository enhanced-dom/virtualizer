import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react'
import { StylesheetsRepository } from '@enhanced-dom/css'
import { useDebouncedCallback } from 'use-lodash-debounce'

import * as styles from './app.pcss'
import { IVirtualizerEntry, virtualize } from '../src'
import Tile from './tile.component'

const stylesheetsRepository = new StylesheetsRepository(document)

const entries: IVirtualizerEntry[] = Array.from({ length: 10000 }, (_, k) => k).map((id) => ({
  id,
  fixedSize: 40,
  level: id % 31 === 0 ? 3 : (id - 1) % 19 === 0 ? 2 : (id - 2) % 7 === 0 ? 1 : undefined,
}))

const useObservedDimensions = (ref: React.RefObject<HTMLElement>) => {
  const [dimensions, setDimensions] = useState<{ width?: number; height?: number }>({})

  useEffect(() => {
    if (ref.current) {
      const observer = new ResizeObserver((observed) => {
        window.requestAnimationFrame(() => {
          setDimensions({ width: observed[0].contentRect.width, height: observed[0].contentRect.height })
        })
      })
      const observedNode = ref.current
      observer.observe(observedNode)
      return () => {
        observer.unobserve(observedNode)
      }
    }
  }, [ref])

  return dimensions
}

const App = () => {
  const [scroll, setScroll] = useState(0)

  const setScollDebounced = useDebouncedCallback(setScroll, 100, { leading: false, trailing: true })

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollValue = e.currentTarget.scrollLeft
      setScollDebounced(scrollValue)
      stylesheetsRepository.setProperty('demo-styles', `.${styles.scrollWrapper}`, '--current-scroll', `${scrollValue}px`)
    },
    [setScollDebounced],
  )

  const scrollWrapperRef = useRef<HTMLDivElement>(null)

  const minCanvasSize = useMemo(() => entries.reduce((canvasSize, entry) => canvasSize + (entry.fixedSize ?? entry.minSize ?? 0), 0), [])

  const scrollWindowSize = useObservedDimensions(scrollWrapperRef)

  const entriesToShow = useMemo(() => {
    if (!scrollWindowSize.width) {
      return []
    }
    return virtualize({ offset: scroll, overscan: Math.floor(scrollWindowSize.width / 40), viewportSize: scrollWindowSize.width }, entries)
  }, [scroll, scrollWindowSize.width])

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
    </div>
  )
}

export default App
