import { type PropsWithChildren, type CSSProperties, useMemo } from 'react'

import { IVirtualizerResultFlat, IVirtualizerResultLevel } from '../src'
import * as styles from './app.pcss'

type TileProps = Pick<IVirtualizerResultFlat, 'size' | 'offset'> &
  Partial<Pick<IVirtualizerResultLevel, 'level' | 'minOffset' | 'maxOffset' | 'levelOffset'>>

const Tile = ({ level, size, minOffset, maxOffset, levelOffset: relativeOffset, offset, children }: PropsWithChildren<TileProps>) => {
  const tileStyle = useMemo(() => {
    const style: CSSProperties = {
      zIndex: level,
      width: size,
      left: level ? `calc(var(--current-scroll, 0px) + ${relativeOffset}px)` : `${offset}px`,
      position: 'absolute',
      backgroundColor: level === 3 ? 'blue' : level === 2 ? 'green' : level === 1 ? 'red' : 'white',
    }
    if (minOffset != null) {
      if (maxOffset) {
        style.left = `clamp(${minOffset}px, ${style.left}, ${maxOffset}px)`
      } else {
        style.left = `minmax(${minOffset}px, ${style.left})`
      }
    } else if (maxOffset != null) {
      style.left = `minmax(${style.left}, ${maxOffset}px)`
    }
    return style
  }, [size, level, minOffset, maxOffset, offset, relativeOffset])

  return (
    <div style={tileStyle} className={styles.tile}>
      {children}
    </div>
  )
}

export default Tile
