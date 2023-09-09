export class AppearanceObserver {
  /** @readonly */
  delegate = undefined
  /** @readonly */
  element = undefined
  /** @readonly */
  intersectionObserver = undefined
  /** @default false */
  started = false

  constructor(delegate, element) {
    this.delegate = delegate
    this.element = element
    this.intersectionObserver = new IntersectionObserver(this.intersect)
  }

  /** @returns {void} */
  start() {
    if (!this.started) {
      this.started = true
      this.intersectionObserver.observe(this.element)
    }
  }

  /** @returns {void} */
  stop() {
    if (this.started) {
      this.started = false
      this.intersectionObserver.unobserve(this.element)
    }
  }

  /**
   * @default (entries) => {
   *     const lastEntry = entries.slice(-1)[0]
   *     if (lastEntry?.isIntersecting) {
   *       this.delegate.elementAppearedInViewport(this.element)
   *     }
   *   }
   */
  intersect = (entries) => {
    const lastEntry = entries.slice(-1)[0]
    if (lastEntry?.isIntersecting) {
      this.delegate.elementAppearedInViewport(this.element)
    }
  }
}

/** @typedef {Object} AppearanceObserverDelegate */
