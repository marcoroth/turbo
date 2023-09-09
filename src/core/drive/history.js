import { nextMicrotask, uuid } from "../../util"

export class History {
  /** @readonly */
  delegate = undefined
  /** */
  location = undefined
  /** @default uuid() */
  restorationIdentifier = uuid()
  /** @default {} */
  restorationData = {}
  /** @default false */
  started = false
  /** @default false */
  pageLoaded = false
  /** */
  previousScrollRestoration = undefined

  constructor(delegate) {
    this.delegate = delegate
  }

  /** @returns {void} */
  start() {
    if (!this.started) {
      addEventListener("popstate", this.onPopState, false)
      addEventListener("load", this.onPageLoad, false)
      this.started = true
      this.replace(new URL(window.location.href))
    }
  }

  /** @returns {void} */
  stop() {
    if (this.started) {
      removeEventListener("popstate", this.onPopState, false)
      removeEventListener("load", this.onPageLoad, false)
      this.started = false
    }
  }

  /** @param {URL} location
   * @param {string} [restorationIdentifier]
   * @returns {void}
   */
  push(location, restorationIdentifier) {
    this.update(history.pushState, location, restorationIdentifier)
  }

  /** @param {URL} location
   * @param {string} [restorationIdentifier]
   * @returns {void}
   */
  replace(location, restorationIdentifier) {
    this.update(history.replaceState, location, restorationIdentifier)
  }

  /** @param {HistoryMethod} method
   * @param {URL} location
   * @returns {void}
   */
  update(method, location, restorationIdentifier = uuid()) {
    const state = { turbo: { restorationIdentifier } }
    method.call(history, state, "", location.href)
    this.location = location
    this.restorationIdentifier = restorationIdentifier
  }

  // Restoration data

  /** @param {string} restorationIdentifier
   * @returns {RestorationData}
   */
  getRestorationDataForIdentifier(restorationIdentifier) {
    return this.restorationData[restorationIdentifier] || {}
  }

  /** @param {Partial<RestorationData>} additionalData
   * @returns {void}
   */
  updateRestorationData(additionalData) {
    const { restorationIdentifier } = this
    const restorationData = this.restorationData[restorationIdentifier]
    this.restorationData[restorationIdentifier] = {
      ...restorationData,
      ...additionalData,
    }
  }

  // Scroll restoration

  /** @returns {void} */
  assumeControlOfScrollRestoration() {
    if (!this.previousScrollRestoration) {
      this.previousScrollRestoration = history.scrollRestoration ?? "auto"
      history.scrollRestoration = "manual"
    }
  }

  /** @returns {void} */
  relinquishControlOfScrollRestoration() {
    if (this.previousScrollRestoration) {
      history.scrollRestoration = this.previousScrollRestoration
      delete this.previousScrollRestoration
    }
  }

  // Event handlers

  /**
   * @default (event: PopStateEvent) => {
   *     if (this.shouldHandlePopState()) {
   *       const { turbo } = event.state || {}
   *       if (turbo) {
   *         this.location = new URL(window.location.href)
   *         const { restorationIdentifier } = turbo
   *         this.restorationIdentifier = restorationIdentifier
   *         this.delegate.historyPoppedToLocationWithRestorationIdentifier(this.location, restorationIdentifier)
   *       }
   *     }
   *   }
   */
  onPopState = (event) => {
    if (this.shouldHandlePopState()) {
      const { turbo } = event.state || {}
      if (turbo) {
        this.location = new URL(window.location.href)
        const { restorationIdentifier } = turbo
        this.restorationIdentifier = restorationIdentifier
        this.delegate.historyPoppedToLocationWithRestorationIdentifier(this.location, restorationIdentifier)
      }
    }
  }

  /**
   * @default async (_event: Event) => {
   *     await nextMicrotask()
   *     this.pageLoaded = true
   *   }
   */
  onPageLoad = async (_event) => {
    await nextMicrotask()
    this.pageLoaded = true
  }

  // Private

  /** @returns {boolean} */
  shouldHandlePopState() {
    // Safari dispatches a popstate event after window's load event, ignore it
    return this.pageIsLoaded()
  }

  /** @returns {boolean} */
  pageIsLoaded() {
    return this.pageLoaded || document.readyState == "complete"
  }
}

/** @typedef {Class<history>} HistoryMethod */
/** @typedef {{ scrollPosition?: Position }} RestorationData */
/**
 * @typedef {{
 *   [restorationIdentifier: string]: RestorationData
 * }} RestorationDataMap
 */

/** @typedef {Object} HistoryDelegate */
