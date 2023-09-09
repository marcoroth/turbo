import { Bardo } from "./bardo"

export class Renderer {
  /** @readonly */
  currentSnapshot = undefined
  /** @readonly */
  newSnapshot = undefined
  /** @readonly */
  isPreview = undefined
  /** @readonly */
  willRender = undefined
  /** @readonly */
  promise = undefined
  /** */
  renderElement = undefined
  /** @private */
  resolvingFunctions = undefined
  /** @private
   * @default null
   */
  activeElement = null

  constructor(currentSnapshot, newSnapshot, renderElement, isPreview, willRender = true) {
    this.currentSnapshot = currentSnapshot
    this.newSnapshot = newSnapshot
    this.isPreview = isPreview
    this.willRender = willRender
    this.renderElement = renderElement
    this.promise = new Promise((resolve, reject) => (this.resolvingFunctions = { resolve, reject }))
  }

  get shouldRender() {
    return true
  }

  get reloadReason() {
    return
  }

  /** @returns {void} */
  prepareToRender() {
    return
  }

  /** @returns {void} */
  finishRendering() {
    if (this.resolvingFunctions) {
      this.resolvingFunctions.resolve()
      delete this.resolvingFunctions
    }
  }

  /** @param {() => void} callback
   * @returns {Promise<void>}
   */
  async preservingPermanentElements(callback) {
    await Bardo.preservingPermanentElements(this, this.permanentElementMap, callback)
  }

  /** @returns {void} */
  focusFirstAutofocusableElement() {
    const element = this.connectedSnapshot.firstAutofocusableElement
    if (elementIsFocusable(element)) {
      element.focus()
    }
  }

  // Bardo delegate

  /** @param {Element} currentPermanentElement
   * @returns {void}
   */
  enteringBardo(currentPermanentElement) {
    if (this.activeElement) return

    if (currentPermanentElement.contains(this.currentSnapshot.activeElement)) {
      this.activeElement = this.currentSnapshot.activeElement
    }
  }

  /** @param {Element} currentPermanentElement
   * @returns {void}
   */
  leavingBardo(currentPermanentElement) {
    if (currentPermanentElement.contains(this.activeElement) && this.activeElement instanceof HTMLElement) {
      this.activeElement.focus()

      this.activeElement = null
    }
  }

  get connectedSnapshot() {
    return this.newSnapshot.isConnected ? this.newSnapshot : this.currentSnapshot
  }

  get currentElement() {
    return this.currentSnapshot.element
  }

  get newElement() {
    return this.newSnapshot.element
  }

  get permanentElementMap() {
    return this.currentSnapshot.getPermanentElementMapForSnapshot(this.newSnapshot)
  }
}

/** @param {any} element
 * @returns {element is { focus: () => void }}
 */
function elementIsFocusable(element) {
  return element && typeof element.focus == "function"
}

/**
 * @typedef {{
 *   resolve(value: T | PromiseLike<T>): void
 *   reject(reason?: any): void
 * }} ResolvingFunctions
 * @template [T=unknown]
 */
/**
 * @typedef {(currentElement: E, newElement: E) => void} Render
 * @template E
 */
