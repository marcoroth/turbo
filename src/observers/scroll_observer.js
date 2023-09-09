export class ScrollObserver {
  /** @readonly */
  delegate = undefined
  /** @default false */
  started = false

  constructor(delegate) {
    this.delegate = delegate
  }

  /** @returns {void} */
  start() {
    if (!this.started) {
      addEventListener("scroll", this.onScroll, false)
      this.onScroll()
      this.started = true
    }
  }

  /** @returns {void} */
  stop() {
    if (this.started) {
      removeEventListener("scroll", this.onScroll, false)
      this.started = false
    }
  }

  /**
   * @default () => {
   *     this.updatePosition({ x: window.pageXOffset, y: window.pageYOffset })
   *   }
   */
  onScroll = () => {
    this.updatePosition({ x: window.pageXOffset, y: window.pageYOffset })
  }

  // Private

  /** @param {Position} position
   * @returns {void}
   */
  updatePosition(position) {
    this.delegate.scrollPositionChanged(position)
  }
}

/** @typedef {Object} ScrollObserverDelegate */
