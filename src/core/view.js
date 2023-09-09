import { getAnchor } from "./url"

export class View {
  /** @readonly */
  delegate = undefined
  /** @readonly */
  element = undefined
  /** */
  renderer = undefined
  /** */
  renderPromise = undefined
  /** @private
   * @default (_value: any) => {}
   */
  resolveRenderPromise = (_value) => {}
  /** @private
   * @default (_value: any) => {}
   */
  resolveInterceptionPromise = (_value) => {}

  constructor(delegate, element) {
    this.delegate = delegate
    this.element = element
  }

  // Scrolling

  /** @param {string | undefined} anchor
   * @returns {void}
   */
  scrollToAnchor(anchor) {
    const element = this.snapshot.getElementForAnchor(anchor)
    if (element) {
      this.scrollToElement(element)
      this.focusElement(element)
    } else {
      this.scrollToPosition({ x: 0, y: 0 })
    }
  }

  /** @param {URL} location
   * @returns {void}
   */
  scrollToAnchorFromLocation(location) {
    this.scrollToAnchor(getAnchor(location))
  }

  /** @param {Element} element
   * @returns {void}
   */
  scrollToElement(element) {
    element.scrollIntoView()
  }

  /** @param {Element} element
   * @returns {void}
   */
  focusElement(element) {
    if (element instanceof HTMLElement) {
      if (element.hasAttribute("tabindex")) {
        element.focus()
      } else {
        element.setAttribute("tabindex", "-1")
        element.focus()
        element.removeAttribute("tabindex")
      }
    }
  }

  /** @param {Position}
   * @returns {void}
   */
  scrollToPosition({ x, y }) {
    this.scrollRoot.scrollTo(x, y)
  }

  /** @returns {void} */
  scrollToTop() {
    this.scrollToPosition({ x: 0, y: 0 })
  }

  get scrollRoot() {
    return window
  }

  // Rendering

  /** @param {R} renderer
   * @returns {Promise<void>}
   */
  async render(renderer) {
    const { isPreview, shouldRender, newSnapshot: snapshot } = renderer
    if (shouldRender) {
      try {
        this.renderPromise = new Promise((resolve) => (this.resolveRenderPromise = resolve))
        this.renderer = renderer
        await this.prepareToRenderSnapshot(renderer)

        const renderInterception = new Promise((resolve) => (this.resolveInterceptionPromise = resolve))
        const options = { resume: this.resolveInterceptionPromise, render: this.renderer.renderElement }
        const immediateRender = this.delegate.allowsImmediateRender(snapshot, isPreview, options)
        if (!immediateRender) await renderInterception

        await this.renderSnapshot(renderer)
        this.delegate.viewRenderedSnapshot(snapshot, isPreview)
        this.delegate.preloadOnLoadLinksForView(this.element)
        this.finishRenderingSnapshot(renderer)
      } finally {
        delete this.renderer
        this.resolveRenderPromise(undefined)
        delete this.renderPromise
      }
    } else {
      this.invalidate(renderer.reloadReason)
    }
  }

  /** @param {ReloadReason} reason
   * @returns {void}
   */
  invalidate(reason) {
    this.delegate.viewInvalidated(reason)
  }

  /** @param {R} renderer
   * @returns {Promise<void>}
   */
  async prepareToRenderSnapshot(renderer) {
    this.markAsPreview(renderer.isPreview)
    await renderer.prepareToRender()
  }

  /** @param {boolean} isPreview
   * @returns {void}
   */
  markAsPreview(isPreview) {
    if (isPreview) {
      this.element.setAttribute("data-turbo-preview", "")
    } else {
      this.element.removeAttribute("data-turbo-preview")
    }
  }

  /** @param {R} renderer
   * @returns {Promise<void>}
   */
  async renderSnapshot(renderer) {
    await renderer.render()
  }

  /** @param {R} renderer
   * @returns {void}
   */
  finishRenderingSnapshot(renderer) {
    renderer.finishRendering()
  }
}

/** @typedef {Object} ViewRenderOptions
 * @property {(value?:any)=>void} resume
 * @property {Render<E>} render
 */
/** @typedef {Object} ViewDelegate */
