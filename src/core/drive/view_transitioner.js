export class ViewTransitioner {
  /** @private
   * @default false
   */
  viewTransitionStarted = false
  /** @private
   * @default Promise.resolve()
   */
  lastOperation = Promise.resolve()

  /** @param {boolean} useViewTransition
   * @param {() => Promise<void>} render
   * @returns {Promise<void>}
   */
  renderChange(useViewTransition, render) {
    if (useViewTransition && this.viewTransitionsAvailable && !this.viewTransitionStarted) {
      this.viewTransitionStarted = true
      this.lastOperation = this.lastOperation.then(async () => {
        await document.startViewTransition(render).finished
      })
    } else {
      this.lastOperation = this.lastOperation.then(render)
    }

    return this.lastOperation
  }

  /** @private */
  get viewTransitionsAvailable() {
    return document.startViewTransition
  }
}
