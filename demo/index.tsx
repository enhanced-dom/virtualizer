import { createRoot } from 'react-dom/client'

import App from './app'

const node = createRoot(document.getElementById('root'))
node.render(<App />)
