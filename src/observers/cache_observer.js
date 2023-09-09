export class CacheObserver {
  /** @readonly
   * @default "[data-turbo-temporary]"
   */
  selector = "[data-turbo-temporary]"
  /** @readonly
   * @default "[data-turbo-cache=false]"
   */
  deprecatedSelector = "[data-turbo-cache=false]"

  /** @default false */
  started = false

  /** @returns {void} */
  start() {
    if (!this.started) {
      this.started = true
      addEventListener("turbo:before-cache", this.removeTemporaryElements, false)
    }
  }

  /** @returns {void} */
  stop() {
    if (this.started) {
      this.started = false
      removeEventListener("turbo:before-cache", this.removeTemporaryElements, false)
    }
  }

  /**
   * @default <EventListener>((_event: TurboBeforeCacheEvent) => {
   *     for (const element of this.temporaryElements) {
   *       element.remove()
   *     }
   *   })
   */
  removeTemporaryElements = (_event) => {
    for (const element of this.temporaryElements) {
      element.remove()
    }
  }

  get temporaryElements() {
    return [...document.querySelectorAll(this.selector), ...this.temporaryElementsWithDeprecation]
  }

  get temporaryElementsWithDeprecation() {
    const elements = document.querySelectorAll(this.deprecatedSelector)

    if (elements.length) {
      console.warn(
        `The ${this.deprecatedSelector} selector is deprecated and will be removed in a future version. Use ${this.selector} instead.`
      )
    }

    return [...elements]
  }
}
