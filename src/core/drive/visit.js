import { FetchMethod, FetchRequest } from "../../http/fetch_request"
import { getAnchor } from "../url"
import { PageSnapshot } from "./page_snapshot"
import { getHistoryMethodForAction, uuid } from "../../util"
import { StreamMessage } from "../streams/stream_message"
import { ViewTransitioner } from "./view_transitioner"

export var TimingMetric
;(function (TimingMetric) {
  TimingMetric["visitStart"] = "visitStart"
  TimingMetric["requestStart"] = "requestStart"
  TimingMetric["requestEnd"] = "requestEnd"
  TimingMetric["visitEnd"] = "visitEnd"
})(TimingMetric || (TimingMetric = {}))

export var VisitState
;(function (VisitState) {
  VisitState["initialized"] = "initialized"
  VisitState["started"] = "started"
  VisitState["canceled"] = "canceled"
  VisitState["failed"] = "failed"
  VisitState["completed"] = "completed"
})(VisitState || (VisitState = {}))

const defaultOptions = {
  action: "advance",
  historyChanged: false,
  visitCachedSnapshot: () => {},
  willRender: true,
  updateHistory: true,
  shouldCacheSnapshot: true,
  acceptsStreamResponse: false,
}

export var SystemStatusCode
;(function (SystemStatusCode) {
  SystemStatusCode[(SystemStatusCode["networkFailure"] = 0)] = "networkFailure"
  SystemStatusCode[(SystemStatusCode["timeoutFailure"] = -1)] = "timeoutFailure"
  SystemStatusCode[(SystemStatusCode["contentTypeMismatch"] = -2)] = "contentTypeMismatch"
})(SystemStatusCode || (SystemStatusCode = {}))

export class Visit {
  /** @readonly */
  delegate = undefined
  /** @readonly
   * @default uuid()
   */
  identifier = uuid() // Required by turbo-ios
  /** @readonly */
  restorationIdentifier = undefined
  /** @readonly */
  action = undefined
  /** @readonly */
  referrer = undefined
  /** @readonly
   * @default {}
   */
  timingMetrics = {}
  /** @readonly */
  visitCachedSnapshot = undefined
  /** @readonly */
  willRender = undefined
  /** @readonly */
  updateHistory = undefined

  /** @default false */
  followedRedirect = false
  /** */
  frame = undefined
  /** @default false */
  historyChanged = false
  /** */
  location = undefined
  /** */
  isSamePage = undefined
  /** */
  redirectedToLocation = undefined
  /** */
  request = undefined
  /** */
  response = undefined
  /** @default false */
  scrolled = false
  /** @default true */
  shouldCacheSnapshot = true
  /** @default false */
  acceptsStreamResponse = false
  /** */
  snapshotHTML = undefined
  /** @default false */
  snapshotCached = false
  /** @default VisitState.initialized */
  state = VisitState.initialized
  /** */
  snapshot = undefined
  /** @default new ViewTransitioner() */
  viewTransitioner = new ViewTransitioner()

  constructor(delegate, location, restorationIdentifier, options = {}) {
    this.delegate = delegate
    this.location = location
    this.restorationIdentifier = restorationIdentifier || uuid()

    const {
      action,
      historyChanged,
      referrer,
      snapshot,
      snapshotHTML,
      response,
      visitCachedSnapshot,
      willRender,
      updateHistory,
      shouldCacheSnapshot,
      acceptsStreamResponse,
    } = {
      ...defaultOptions,
      ...options,
    }
    this.action = action
    this.historyChanged = historyChanged
    this.referrer = referrer
    this.snapshot = snapshot
    this.snapshotHTML = snapshotHTML
    this.response = response
    this.isSamePage = this.delegate.locationWithActionIsSamePage(this.location, this.action)
    this.visitCachedSnapshot = visitCachedSnapshot
    this.willRender = willRender
    this.updateHistory = updateHistory
    this.scrolled = !willRender
    this.shouldCacheSnapshot = shouldCacheSnapshot
    this.acceptsStreamResponse = acceptsStreamResponse
  }

  get adapter() {
    return this.delegate.adapter
  }

  get view() {
    return this.delegate.view
  }

  get history() {
    return this.delegate.history
  }

  get restorationData() {
    return this.history.getRestorationDataForIdentifier(this.restorationIdentifier)
  }

  get silent() {
    return this.isSamePage
  }

  /** @returns {void} */
  start() {
    if (this.state == VisitState.initialized) {
      this.recordTimingMetric(TimingMetric.visitStart)
      this.state = VisitState.started
      this.adapter.visitStarted(this)
      this.delegate.visitStarted(this)
    }
  }

  /** @returns {void} */
  cancel() {
    if (this.state == VisitState.started) {
      if (this.request) {
        this.request.cancel()
      }
      this.cancelRender()
      this.state = VisitState.canceled
    }
  }

  /** @returns {void} */
  complete() {
    if (this.state == VisitState.started) {
      this.recordTimingMetric(TimingMetric.visitEnd)
      this.state = VisitState.completed
      this.followRedirect()

      if (!this.followedRedirect) {
        this.adapter.visitCompleted(this)
        this.delegate.visitCompleted(this)
      }
    }
  }

  /** @returns {void} */
  fail() {
    if (this.state == VisitState.started) {
      this.state = VisitState.failed
      this.adapter.visitFailed(this)
      this.delegate.visitCompleted(this)
    }
  }

  /** @returns {void} */
  changeHistory() {
    if (!this.historyChanged && this.updateHistory) {
      const actionForHistory = this.location.href === this.referrer?.href ? "replace" : this.action
      const method = getHistoryMethodForAction(actionForHistory)
      this.history.update(method, this.location, this.restorationIdentifier)
      this.historyChanged = true
    }
  }

  /** @returns {void} */
  issueRequest() {
    if (this.hasPreloadedResponse()) {
      this.simulateRequest()
    } else if (this.shouldIssueRequest() && !this.request) {
      this.request = new FetchRequest(this, FetchMethod.get, this.location)
      this.request.perform()
    }
  }

  /** @returns {void} */
  simulateRequest() {
    if (this.response) {
      this.startRequest()
      this.recordResponse()
      this.finishRequest()
    }
  }

  /** @returns {void} */
  startRequest() {
    this.recordTimingMetric(TimingMetric.requestStart)
    this.adapter.visitRequestStarted(this)
  }

  /** @returns {void} */
  recordResponse(response = this.response) {
    this.response = response
    if (response) {
      const { statusCode } = response
      if (isSuccessful(statusCode)) {
        this.adapter.visitRequestCompleted(this)
      } else {
        this.adapter.visitRequestFailedWithStatusCode(this, statusCode)
      }
    }
  }

  /** @returns {void} */
  finishRequest() {
    this.recordTimingMetric(TimingMetric.requestEnd)
    this.adapter.visitRequestFinished(this)
  }

  /** @returns {void} */
  loadResponse() {
    if (this.response) {
      const { statusCode, responseHTML } = this.response
      this.render(async () => {
        if (this.shouldCacheSnapshot) this.cacheSnapshot()
        if (this.view.renderPromise) await this.view.renderPromise

        if (isSuccessful(statusCode) && responseHTML != null) {
          const snapshot = PageSnapshot.fromHTMLString(responseHTML)
          await this.renderPageSnapshot(snapshot, false)

          this.adapter.visitRendered(this)
          this.complete()
        } else {
          await this.view.renderError(PageSnapshot.fromHTMLString(responseHTML), this)
          this.adapter.visitRendered(this)
          this.fail()
        }
      })
    }
  }

  /** @returns {any} */
  getCachedSnapshot() {
    const snapshot = this.view.getCachedSnapshotForLocation(this.location) || this.getPreloadedSnapshot()

    if (snapshot && (!getAnchor(this.location) || snapshot.hasAnchor(getAnchor(this.location)))) {
      if (this.action == "restore" || snapshot.isPreviewable) {
        return snapshot
      }
    }
  }

  /** @returns {any} */
  getPreloadedSnapshot() {
    if (this.snapshotHTML) {
      return PageSnapshot.fromHTMLString(this.snapshotHTML)
    }
  }

  /** @returns {boolean} */
  hasCachedSnapshot() {
    return this.getCachedSnapshot() != null
  }

  /** @returns {void} */
  loadCachedSnapshot() {
    const snapshot = this.getCachedSnapshot()
    if (snapshot) {
      const isPreview = this.shouldIssueRequest()
      this.render(async () => {
        this.cacheSnapshot()
        if (this.isSamePage) {
          this.adapter.visitRendered(this)
        } else {
          if (this.view.renderPromise) await this.view.renderPromise

          await this.renderPageSnapshot(snapshot, isPreview)

          this.adapter.visitRendered(this)
          if (!isPreview) {
            this.complete()
          }
        }
      })
    }
  }

  /** @returns {void} */
  followRedirect() {
    if (this.redirectedToLocation && !this.followedRedirect && this.response?.redirected) {
      this.adapter.visitProposedToLocation(this.redirectedToLocation, {
        action: "replace",
        response: this.response,
        shouldCacheSnapshot: false,
        willRender: false,
      })
      this.followedRedirect = true
    }
  }

  /** @returns {void} */
  goToSamePageAnchor() {
    if (this.isSamePage) {
      this.render(async () => {
        this.cacheSnapshot()
        this.performScroll()
        this.changeHistory()
        this.adapter.visitRendered(this)
      })
    }
  }

  // Fetch request delegate

  /** @param {FetchRequest} request
   * @returns {void}
   */
  prepareRequest(request) {
    if (this.acceptsStreamResponse) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }

  /** @returns {void} */
  requestStarted() {
    this.startRequest()
  }

  /** @param {FetchRequest} _request
   * @param {FetchResponse} _response
   * @returns {void}
   */
  requestPreventedHandlingResponse(_request, _response) {}

  /** @param {FetchRequest} request
   * @param {FetchResponse} response
   * @returns {Promise<void>}
   */
  async requestSucceededWithResponse(request, response) {
    const responseHTML = await response.responseHTML
    const { redirected, statusCode } = response
    if (responseHTML == undefined) {
      this.recordResponse({
        statusCode: SystemStatusCode.contentTypeMismatch,
        redirected,
      })
    } else {
      this.redirectedToLocation = response.redirected ? response.location : undefined
      this.recordResponse({ statusCode: statusCode, responseHTML, redirected })
    }
  }

  /** @param {FetchRequest} request
   * @param {FetchResponse} response
   * @returns {Promise<void>}
   */
  async requestFailedWithResponse(request, response) {
    const responseHTML = await response.responseHTML
    const { redirected, statusCode } = response
    if (responseHTML == undefined) {
      this.recordResponse({
        statusCode: SystemStatusCode.contentTypeMismatch,
        redirected,
      })
    } else {
      this.recordResponse({ statusCode: statusCode, responseHTML, redirected })
    }
  }

  /** @param {FetchRequest} _request
   * @param {Error} _error
   * @returns {void}
   */
  requestErrored(_request, _error) {
    this.recordResponse({
      statusCode: SystemStatusCode.networkFailure,
      redirected: false,
    })
  }

  /** @returns {void} */
  requestFinished() {
    this.finishRequest()
  }

  // Scrolling

  /** @returns {void} */
  performScroll() {
    if (!this.scrolled && !this.view.forceReloaded) {
      if (this.action == "restore") {
        this.scrollToRestoredPosition() || this.scrollToAnchor() || this.view.scrollToTop()
      } else {
        this.scrollToAnchor() || this.view.scrollToTop()
      }
      if (this.isSamePage) {
        this.delegate.visitScrolledToSamePageLocation(this.view.lastRenderedLocation, this.location)
      }

      this.scrolled = true
    }
  }

  /** @returns {boolean} */
  scrollToRestoredPosition() {
    const { scrollPosition } = this.restorationData
    if (scrollPosition) {
      this.view.scrollToPosition(scrollPosition)
      return true
    }
  }

  /** @returns {boolean} */
  scrollToAnchor() {
    const anchor = getAnchor(this.location)
    if (anchor != null) {
      this.view.scrollToAnchor(anchor)
      return true
    }
  }

  // Instrumentation

  /** @param {TimingMetric} metric
   * @returns {void}
   */
  recordTimingMetric(metric) {
    this.timingMetrics[metric] = new Date().getTime()
  }

  /** @returns {TimingMetrics} */
  getTimingMetrics() {
    return { ...this.timingMetrics }
  }

  // Private

  /** @param {Action} action
   * @returns {(data: any, unused: string, url?: string | URL) => void}
   */
  getHistoryMethodForAction(action) {
    switch (action) {
      case "replace":
        return history.replaceState
      case "advance":
      case "restore":
        return history.pushState
    }
  }

  /** @returns {boolean} */
  hasPreloadedResponse() {
    return typeof this.response == "object"
  }

  /** @returns {boolean} */
  shouldIssueRequest() {
    if (this.isSamePage) {
      return false
    } else if (this.action == "restore") {
      return !this.hasCachedSnapshot()
    } else {
      return this.willRender
    }
  }

  /** @returns {void} */
  cacheSnapshot() {
    if (!this.snapshotCached) {
      this.view.cacheSnapshot(this.snapshot).then((snapshot) => snapshot && this.visitCachedSnapshot(snapshot))
      this.snapshotCached = true
    }
  }

  /** @param {() => Promise<void>} callback
   * @returns {Promise<void>}
   */
  async render(callback) {
    this.cancelRender()
    await new Promise((resolve) => {
      this.frame = requestAnimationFrame(() => resolve())
    })
    await callback()
    delete this.frame
  }

  /** @param {PageSnapshot} snapshot
   * @param {boolean} isPreview
   * @returns {Promise<void>}
   */
  async renderPageSnapshot(snapshot, isPreview) {
    await this.viewTransitioner.renderChange(this.view.shouldTransitionTo(snapshot), async () => {
      await this.view.renderPage(snapshot, isPreview, this.willRender, this)
      this.performScroll()
    })
  }

  /** @returns {void} */
  cancelRender() {
    if (this.frame) {
      cancelAnimationFrame(this.frame)
      delete this.frame
    }
  }
}

/** @param {number} statusCode
 * @returns {boolean}
 */
function isSuccessful(statusCode) {
  return statusCode >= 200 && statusCode < 300
}

/** @typedef {Partial<{ [metric in TimingMetric]: any }>} TimingMetrics */
/**
 * @typedef {{
 *   action: Action
 *   historyChanged: boolean
 *   referrer?: URL
 *   snapshot?: PageSnapshot
 *   snapshotHTML?: string
 *   response?: VisitResponse
 *   visitCachedSnapshot(snapshot: Snapshot): void
 *   willRender: boolean
 *   updateHistory: boolean
 *   restorationIdentifier?: string
 *   shouldCacheSnapshot: boolean
 *   frame?: string
 *   acceptsStreamResponse: boolean
 * }} VisitOptions
 */
/**
 * @typedef {{
 *   statusCode: number
 *   redirected: boolean
 *   responseHTML?: string
 * }} VisitResponse
 */

/** @typedef {Object} VisitDelegate
 * @property {Adapter} adapter
 * @property {History} history
 * @property {PageView} view
 */
