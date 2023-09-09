export class LinkInterceptor {
  /** @readonly */
  delegate = undefined
  /** @readonly */
  element = undefined
  /** @private */
  clickEvent = undefined

  constructor(delegate, element) {
    this.delegate = delegate
    this.element = element
  }

  /** @returns {void} */
  start() {
    this.element.addEventListener("click", this.clickBubbled)
    document.addEventListener("turbo:click", this.linkClicked)
    document.addEventListener("turbo:before-visit", this.willVisit)
  }

  /** @returns {void} */
  stop() {
    this.element.removeEventListener("click", this.clickBubbled)
    document.removeEventListener("turbo:click", this.linkClicked)
    document.removeEventListener("turbo:before-visit", this.willVisit)
  }

  /**
   * @default (event: Event) => {
   *     if (this.respondsToEventTarget(event.target)) {
   *       this.clickEvent = event
   *     } else {
   *       delete this.clickEvent
   *     }
   *   }
   */
  clickBubbled = (event) => {
    if (this.respondsToEventTarget(event.target)) {
      this.clickEvent = event
    } else {
      delete this.clickEvent
    }
  }

  /**
   * @default <EventListener>((event: TurboClickEvent) => {
   *     if (this.clickEvent && this.respondsToEventTarget(event.target) && event.target instanceof Element) {
   *       if (this.delegate.shouldInterceptLinkClick(event.target, event.detail.url, event.detail.originalEvent)) {
   *         this.clickEvent.preventDefault()
   *         event.preventDefault()
   *         this.delegate.linkClickIntercepted(event.target, event.detail.url, event.detail.originalEvent)
   *       }
   *     }
   *     delete this.clickEvent
   *   })
   */
  linkClicked = (event) => {
    if (this.clickEvent && this.respondsToEventTarget(event.target) && event.target instanceof Element) {
      if (this.delegate.shouldInterceptLinkClick(event.target, event.detail.url, event.detail.originalEvent)) {
        this.clickEvent.preventDefault()
        event.preventDefault()
        this.delegate.linkClickIntercepted(event.target, event.detail.url, event.detail.originalEvent)
      }
    }
    delete this.clickEvent
  }

  /**
   * @default <EventListener>((_event: TurboBeforeVisitEvent) => {
   *     delete this.clickEvent
   *   })
   */
  willVisit = (_event) => {
    delete this.clickEvent
  }

  /** @param {EventTarget | null} target
   * @returns {boolean}
   */
  respondsToEventTarget(target) {
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null
    return element && element.closest("turbo-frame, html") == this.element
  }
}

/** @typedef {Object} LinkInterceptorDelegate */
