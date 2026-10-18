import { type ChangeEvent } from 'react'

import * as styles from './app.pcss'

export interface IControlsProps {
  elementCount: number
  onElementCountChange: (value: number) => void
  levels: number
  onLevelsChange: (value: number) => void
}

const LEVEL_OPTIONS = [0, 1, 2, 3]

const Controls = ({ elementCount, onElementCountChange, levels, onLevelsChange }: IControlsProps) => {
  const handleElementCountChange = (e: ChangeEvent<HTMLInputElement>) => {
    onElementCountChange(Number(e.target.value))
  }

  const handleLevelsChange = (e: ChangeEvent<HTMLInputElement>) => {
    onLevelsChange(Number(e.target.value))
  }

  return (
    <div className={styles.controls}>
      <label>
        number of elements
        <input type="number" min={0} value={elementCount} onChange={handleElementCountChange} />
      </label>
      <fieldset>
        <legend>number of levels</legend>
        {LEVEL_OPTIONS.map((option) => (
          <label key={option}>
            <input type="radio" name="levels" value={option} checked={levels === option} onChange={handleLevelsChange} />
            {option}
          </label>
        ))}
      </fieldset>
    </div>
  )
}

export default Controls
