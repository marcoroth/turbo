export var PageStage
;(function (PageStage) {
  PageStage[(PageStage["initial"] = 0)] = "initial"
  PageStage[(PageStage["loading"] = 1)] = "loading"
  PageStage[(PageStage["interactive"] = 2)] = "interactive"
  PageStage[(PageStage["complete"] = 3)] = "complete"
})(PageStage || (PageStage = {}))

export class PageObserver {
  /** @readonly */
  delegate = undefined
  /** @default PageStage.initial */
  stage = PageStage.initial
  /** @default false */
  started = false

  constructor(delegate) {
    this.delegate = delegate
  }

  /** @returns {void} */
  start() {
    if (!this.started) {
      if (this.stage == PageStage.initial) {
        this.stage = PageStage.loading
      }
      document.addEventListener("readystatechange", this.interpretReadyState, false)
      addEventListener("pagehide", this.pageWillUnload, false)
      this.started = true
    }
  }

  /** @returns {void} */
  stop() {
    if (this.started) {
      document.removeEventListener("readystatechange", this.interpretReadyState, false)
      removeEventListener("pagehide", this.pageWillUnload, false)
      this.started = false
    }
  }

  /**
   * @default () => {
   *     const { readyState } = this
   *     if (readyState == "interactive") {
   *       this.pageIsInteractive()
   *     } else if (readyState == "complete") {
   *       this.pageIsComplete()
   *     }
   *   }
   */
  interpretReadyState = () => {
    const { readyState } = this
    if (readyState == "interactive") {
      this.pageIsInteractive()
    } else if (readyState == "complete") {
      this.pageIsComplete()
    }
  }

  /** @returns {void} */
  pageIsInteractive() {
    if (this.stage == PageStage.loading) {
      this.stage = PageStage.interactive
      this.delegate.pageBecameInteractive()
    }
  }

  /** @returns {void} */
  pageIsComplete() {
    this.pageIsInteractive()
    if (this.stage == PageStage.interactive) {
      this.stage = PageStage.complete
      this.delegate.pageLoaded()
    }
  }

  /**
   * @default () => {
   *     this.delegate.pageWillUnload()
   *   }
   */
  pageWillUnload = () => {
    this.delegate.pageWillUnload()
  }

  get readyState() {
    return document.readyState
  }
}

/** @typedef {Object} PageObserverDelegate */
