import { unindent, getMetaContent } from "../../util"

export class ProgressBar {
  /** @static
   * @default 300
   */
  static animationDuration = 300 /*ms*/

  /** @static */
  static get defaultCSS() {
    return unindent`
      .turbo-progress-bar {
        position: fixed;
        display: block;
        top: 0;
        left: 0;
        height: 3px;
        background: #0076ff;
        z-index: 2147483647;
        transition:
          width ${ProgressBar.animationDuration}ms ease-out,
          opacity ${ProgressBar.animationDuration / 2}ms ${ProgressBar.animationDuration / 2}ms ease-in;
        transform: translate3d(0, 0, 0);
      }
    `
  }

  /** @readonly */
  stylesheetElement = undefined
  /** @readonly */
  progressElement = undefined

  /** @default false */
  hiding = false
  /** */
  trickleInterval = undefined
  /** @default 0 */
  value = 0
  /** @default false */
  visible = false

  constructor() {
    this.stylesheetElement = this.createStylesheetElement()
    this.progressElement = this.createProgressElement()
    this.installStylesheetElement()
    this.setValue(0)
  }

  /** @returns {void} */
  show() {
    if (!this.visible) {
      this.visible = true
      this.installProgressElement()
      this.startTrickling()
    }
  }

  /** @returns {void} */
  hide() {
    if (this.visible && !this.hiding) {
      this.hiding = true
      this.fadeProgressElement(() => {
        this.uninstallProgressElement()
        this.stopTrickling()
        this.visible = false
        this.hiding = false
      })
    }
  }

  /** @param {number} value
   * @returns {void}
   */
  setValue(value) {
    this.value = value
    this.refresh()
  }

  // Private

  /** @returns {void} */
  installStylesheetElement() {
    document.head.insertBefore(this.stylesheetElement, document.head.firstChild)
  }

  /** @returns {void} */
  installProgressElement() {
    this.progressElement.style.width = "0"
    this.progressElement.style.opacity = "1"
    document.documentElement.insertBefore(this.progressElement, document.body)
    this.refresh()
  }

  /** @param {() => void} callback
   * @returns {void}
   */
  fadeProgressElement(callback) {
    this.progressElement.style.opacity = "0"
    setTimeout(callback, ProgressBar.animationDuration * 1.5)
  }

  /** @returns {void} */
  uninstallProgressElement() {
    if (this.progressElement.parentNode) {
      document.documentElement.removeChild(this.progressElement)
    }
  }

  /** @returns {void} */
  startTrickling() {
    if (!this.trickleInterval) {
      this.trickleInterval = window.setInterval(this.trickle, ProgressBar.animationDuration)
    }
  }

  /** @returns {void} */
  stopTrickling() {
    window.clearInterval(this.trickleInterval)
    delete this.trickleInterval
  }

  /**
   * @default () => {
   *     this.setValue(this.value + Math.random() / 100)
   *   }
   */
  trickle = () => {
    this.setValue(this.value + Math.random() / 100)
  }

  /** @returns {void} */
  refresh() {
    requestAnimationFrame(() => {
      this.progressElement.style.width = `${10 + this.value * 90}%`
    })
  }

  /** @returns {HTMLStyleElement} */
  createStylesheetElement() {
    const element = document.createElement("style")
    element.type = "text/css"
    element.textContent = ProgressBar.defaultCSS
    if (this.cspNonce) {
      element.nonce = this.cspNonce
    }
    return element
  }

  /** @returns {HTMLDivElement} */
  createProgressElement() {
    const element = document.createElement("div")
    element.className = "turbo-progress-bar"
    return element
  }

  get cspNonce() {
    return getMetaContent("csp-nonce")
  }
}
