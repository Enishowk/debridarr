import renderToString from 'preact-render-to-string'
import { App } from './app'

// Compiled styles, inlined in the login page served outside of Vite
export { default as styles } from './index.css?inline'

/**
 * @param {string} _url
 */
export function render(_url) {
  const html = renderToString(<App />)
  return { html }
}
