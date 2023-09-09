import { BrowserAdapter } from "./native/browser_adapter"
import { CacheObserver } from "../observers/cache_observer"
import { FormSubmitObserver } from "../observers/form_submit_observer"
import { FrameRedirector } from "./frames/frame_redirector"
import { History } from "./drive/history"
import { LinkClickObserver } from "../observers/link_click_observer"
import { FormLinkClickObserver } from "../observers/form_link_click_observer"
import { getAction, expandURL, locationIsVisitable } from "./url"
import { Navigator } from "./drive/navigator"
import { PageObserver } from "../observers/page_observer"
import { ScrollObserver } from "../observers/scroll_observer"
import { StreamMessage } from "./streams/stream_message"
import { StreamMessageRenderer } from "./streams/stream_message_renderer"
import { StreamObserver } from "../observers/stream_observer"
import { clearBusyState, dispatch, findClosestRecursively, getVisitAction, markAsBusy } from "../util"
import { PageView } from "./drive/page_view"
import { FrameElement } from "../elements/frame_element"
import { Preloader } from "./drive/preloader"

export class Session {
  /** @readonly
   * @default new Navigator(this)
   */
  navigator = new Navigator(this)
  /** @readonly
   * @default new History(this)
   */
  history = new History(this)
  /** @readonly
   * @default new Preloader(this)
   */
  preloader = new Preloader(this)
  /** @readonly
   * @default new PageView(this, document.documentElement as HTMLBodyElement)
   */
  view = new PageView(this, document.documentElement)
  /** @default new BrowserAdapter(this) */
  adapter = new BrowserAdapter(this)

  /** @readonly
   * @default new PageObserver(this)
   */
  pageObserver = new PageObserver(this)
  /** @readonly
   * @default new CacheObserver()
   */
  cacheObserver = new CacheObserver()
  /** @readonly
   * @default new LinkClickObserver(this, window)
   */
  linkClickObserver = new LinkClickObserver(this, window)
  /** @readonly
   * @default new FormSubmitObserver(this, document)
   */
  formSubmitObserver = new FormSubmitObserver(this, document)
  /** @readonly
   * @default new ScrollObserver(this)
   */
  scrollObserver = new ScrollObserver(this)
  /** @readonly
   * @default new StreamObserver(this)
   */
  streamObserver = new StreamObserver(this)
  /** @readonly
   * @default new FormLinkClickObserver(this, document.documentElement)
   */
  formLinkClickObserver = new FormLinkClickObserver(this, document.documentElement)
  /** @readonly
   * @default new FrameRedirector(this, document.documentElement)
   */
  frameRedirector = new FrameRedirector(this, document.documentElement)
  /** @readonly
   * @default new StreamMessageRenderer()
   */
  streamMessageRenderer = new StreamMessageRenderer()

  /** @default true */
  drive = true
  /** @default true */
  enabled = true
  /** @default 500 */
  progressBarDelay = 500
  /** @default false */
  started = false
  /** @default "on" */
  formMode = "on"

  /** @returns {void} */
  start() {
    if (!this.started) {
      this.pageObserver.start()
      this.cacheObserver.start()
      this.formLinkClickObserver.start()
      this.linkClickObserver.start()
      this.formSubmitObserver.start()
      this.scrollObserver.start()
      this.streamObserver.start()
      this.frameRedirector.start()
      this.history.start()
      this.preloader.start()
      this.started = true
      this.enabled = true
    }
  }

  /** @returns {void} */
  disable() {
    this.enabled = false
  }

  /** @returns {void} */
  stop() {
    if (this.started) {
      this.pageObserver.stop()
      this.cacheObserver.stop()
      this.formLinkClickObserver.stop()
      this.linkClickObserver.stop()
      this.formSubmitObserver.stop()
      this.scrollObserver.stop()
      this.streamObserver.stop()
      this.frameRedirector.stop()
      this.history.stop()
      this.started = false
    }
  }

  /** @param {Adapter} adapter
   * @returns {void}
   */
  registerAdapter(adapter) {
    this.adapter = adapter
  }

  /** @param {Locatable} location
   * @param {Partial<VisitOptions>} [options={}]
   * @returns {void}
   */
  visit(location, options = {}) {
    const frameElement = options.frame ? document.getElementById(options.frame) : null

    if (frameElement instanceof FrameElement) {
      frameElement.src = location.toString()
      frameElement.loaded
    } else {
      this.navigator.proposeVisit(expandURL(location), options)
    }
  }

  /** @param {StreamSource} source
   * @returns {void}
   */
  connectStreamSource(source) {
    this.streamObserver.connectStreamSource(source)
  }

  /** @param {StreamSource} source
   * @returns {void}
   */
  disconnectStreamSource(source) {
    this.streamObserver.disconnectStreamSource(source)
  }

  /** @param {StreamMessage | string} message
   * @returns {void}
   */
  renderStreamMessage(message) {
    this.streamMessageRenderer.render(StreamMessage.wrap(message))
  }

  /** @returns {void} */
  clearCache() {
    this.view.clearSnapshotCache()
  }

  /** @param {number} delay
   * @returns {void}
   */
  setProgressBarDelay(delay) {
    this.progressBarDelay = delay
  }

  /** @param {FormMode} mode
   * @returns {void}
   */
  setFormMode(mode) {
    this.formMode = mode
  }

  get location() {
    return this.history.location
  }

  get restorationIdentifier() {
    return this.history.restorationIdentifier
  }

  // History delegate

  /** @param {URL} location
   * @param {string} restorationIdentifier
   * @returns {void}
   */
  historyPoppedToLocationWithRestorationIdentifier(location, restorationIdentifier) {
    if (this.enabled) {
      this.navigator.startVisit(location, restorationIdentifier, {
        action: "restore",
        historyChanged: true,
      })
    } else {
      this.adapter.pageInvalidated({
        reason: "turbo_disabled",
      })
    }
  }

  // Scroll observer delegate

  /** @param {Position} position
   * @returns {void}
   */
  scrollPositionChanged(position) {
    this.history.updateRestorationData({ scrollPosition: position })
  }

  // Form click observer delegate

  /** @param {Element} link
   * @param {URL} location
   * @returns {boolean}
   */
  willSubmitFormLinkToLocation(link, location) {
    return this.elementIsNavigatable(link) && locationIsVisitable(location, this.snapshot.rootLocation)
  }

  /** @returns {void} */
  submittedFormLinkToLocation() {}

  // Link click observer delegate

  /** @param {Element} link
   * @param {URL} location
   * @param {MouseEvent} event
   * @returns {boolean}
   */
  willFollowLinkToLocation(link, location, event) {
    return (
      this.elementIsNavigatable(link) &&
      locationIsVisitable(location, this.snapshot.rootLocation) &&
      this.applicationAllowsFollowingLinkToLocation(link, location, event)
    )
  }

  /** @param {Element} link
   * @param {URL} location
   * @returns {void}
   */
  followedLinkToLocation(link, location) {
    const action = this.getActionForLink(link)
    const acceptsStreamResponse = link.hasAttribute("data-turbo-stream")

    this.visit(location.href, { action, acceptsStreamResponse })
  }

  // Navigator delegate

  /** @param {URL} location
   * @param {Action} [action]
   * @returns {boolean}
   */
  allowsVisitingLocationWithAction(location, action) {
    return this.locationWithActionIsSamePage(location, action) || this.applicationAllowsVisitingLocation(location)
  }

  /** @param {URL} location
   * @param {Partial<VisitOptions>} options
   * @returns {void}
   */
  visitProposedToLocation(location, options) {
    extendURLWithDeprecatedProperties(location)
    this.adapter.visitProposedToLocation(location, options)
  }

  /** @param {Visit} visit
   * @returns {void}
   */
  visitStarted(visit) {
    if (!visit.acceptsStreamResponse) {
      markAsBusy(document.documentElement)
    }
    extendURLWithDeprecatedProperties(visit.location)
    if (!visit.silent) {
      this.notifyApplicationAfterVisitingLocation(visit.location, visit.action)
    }
  }

  /** @param {Visit} visit
   * @returns {void}
   */
  visitCompleted(visit) {
    clearBusyState(document.documentElement)
    this.notifyApplicationAfterPageLoad(visit.getTimingMetrics())
  }

  /** @param {URL} location
   * @param {Action} [action]
   * @returns {boolean}
   */
  locationWithActionIsSamePage(location, action) {
    return this.navigator.locationWithActionIsSamePage(location, action)
  }

  /** @param {URL} oldURL
   * @param {URL} newURL
   * @returns {void}
   */
  visitScrolledToSamePageLocation(oldURL, newURL) {
    this.notifyApplicationAfterVisitingSamePageLocation(oldURL, newURL)
  }

  // Form submit observer delegate

  /** @param {HTMLFormElement} form
   * @param {HTMLElement} [submitter]
   * @returns {boolean}
   */
  willSubmitForm(form, submitter) {
    const action = getAction(form, submitter)

    return (
      this.submissionIsNavigatable(form, submitter) &&
      locationIsVisitable(expandURL(action), this.snapshot.rootLocation)
    )
  }

  /** @param {HTMLFormElement} form
   * @param {HTMLElement} [submitter]
   * @returns {void}
   */
  formSubmitted(form, submitter) {
    this.navigator.submitForm(form, submitter)
  }

  // Page observer delegate

  /** @returns {void} */
  pageBecameInteractive() {
    this.view.lastRenderedLocation = this.location
    this.notifyApplicationAfterPageLoad()
  }

  /** @returns {void} */
  pageLoaded() {
    this.history.assumeControlOfScrollRestoration()
  }

  /** @returns {void} */
  pageWillUnload() {
    this.history.relinquishControlOfScrollRestoration()
  }

  // Stream observer delegate

  /** @param {StreamMessage} message
   * @returns {void}
   */
  receivedMessageFromStream(message) {
    this.renderStreamMessage(message)
  }

  // Page view delegate

  /** @returns {void} */
  viewWillCacheSnapshot() {
    if (!this.navigator.currentVisit?.silent) {
      this.notifyApplicationBeforeCachingSnapshot()
    }
  }

  /** @param {PageSnapshot}
   * @param {boolean} isPreview
   * @param {PageViewRenderOptions} options
   * @returns {boolean}
   */
  allowsImmediateRender({ element }, isPreview, options) {
    const event = this.notifyApplicationBeforeRender(element, isPreview, options)
    const {
      defaultPrevented,
      detail: { render },
    } = event

    if (this.view.renderer && render) {
      this.view.renderer.renderElement = render
    }

    return !defaultPrevented
  }

  /** @param {PageSnapshot} _snapshot
   * @param {boolean} isPreview
   * @returns {void}
   */
  viewRenderedSnapshot(_snapshot, isPreview) {
    this.view.lastRenderedLocation = this.history.location
    this.notifyApplicationAfterRender(isPreview)
  }

  /** @param {Element} element
   * @returns {void}
   */
  preloadOnLoadLinksForView(element) {
    this.preloader.preloadOnLoadLinksForView(element)
  }

  /** @param {ReloadReason} reason
   * @returns {void}
   */
  viewInvalidated(reason) {
    this.adapter.pageInvalidated(reason)
  }

  // Frame element

  /** @param {FrameElement} frame
   * @returns {void}
   */
  frameLoaded(frame) {
    this.notifyApplicationAfterFrameLoad(frame)
  }

  /** @param {FetchResponse} fetchResponse
   * @param {FrameElement} frame
   * @returns {void}
   */
  frameRendered(fetchResponse, frame) {
    this.notifyApplicationAfterFrameRender(fetchResponse, frame)
  }

  // Application events

  /** @param {Element} link
   * @param {URL} location
   * @param {MouseEvent} ev
   * @returns {boolean}
   */
  applicationAllowsFollowingLinkToLocation(link, location, ev) {
    const event = this.notifyApplicationAfterClickingLinkToLocation(link, location, ev)
    return !event.defaultPrevented
  }

  /** @param {URL} location
   * @returns {boolean}
   */
  applicationAllowsVisitingLocation(location) {
    const event = this.notifyApplicationBeforeVisitingLocation(location)
    return !event.defaultPrevented
  }

  /** @param {Element} link
   * @param {URL} location
   * @param {MouseEvent} event
   * @returns {any}
   */
  notifyApplicationAfterClickingLinkToLocation(link, location, event) {
    return dispatch("turbo:click", {
      target: link,
      detail: { url: location.href, originalEvent: event },
      cancelable: true,
    })
  }

  /** @param {URL} location
   * @returns {any}
   */
  notifyApplicationBeforeVisitingLocation(location) {
    return dispatch("turbo:before-visit", {
      detail: { url: location.href },
      cancelable: true,
    })
  }

  /** @param {URL} location
   * @param {Action} action
   * @returns {any}
   */
  notifyApplicationAfterVisitingLocation(location, action) {
    return dispatch("turbo:visit", { detail: { url: location.href, action } })
  }

  /** @returns {any} */
  notifyApplicationBeforeCachingSnapshot() {
    return dispatch("turbo:before-cache")
  }

  /** @param {HTMLBodyElement} newBody
   * @param {boolean} isPreview
   * @param {PageViewRenderOptions} options
   * @returns {any}
   */
  notifyApplicationBeforeRender(newBody, isPreview, options) {
    return dispatch("turbo:before-render", {
      detail: { newBody, isPreview, ...options },
      cancelable: true,
    })
  }

  /** @param {boolean} isPreview
   * @returns {any}
   */
  notifyApplicationAfterRender(isPreview) {
    return dispatch("turbo:render", { detail: { isPreview } })
  }

  /** @param {TimingData} [timing={}]
   * @returns {any}
   */
  notifyApplicationAfterPageLoad(timing = {}) {
    return dispatch("turbo:load", {
      detail: { url: this.location.href, timing },
    })
  }

  /** @param {URL} oldURL
   * @param {URL} newURL
   * @returns {void}
   */
  notifyApplicationAfterVisitingSamePageLocation(oldURL, newURL) {
    dispatchEvent(
      new HashChangeEvent("hashchange", {
        oldURL: oldURL.toString(),
        newURL: newURL.toString(),
      })
    )
  }

  /** @param {FrameElement} frame
   * @returns {any}
   */
  notifyApplicationAfterFrameLoad(frame) {
    return dispatch("turbo:frame-load", { target: frame })
  }

  /** @param {FetchResponse} fetchResponse
   * @param {FrameElement} frame
   * @returns {any}
   */
  notifyApplicationAfterFrameRender(fetchResponse, frame) {
    return dispatch("turbo:frame-render", {
      detail: { fetchResponse },
      target: frame,
      cancelable: true,
    })
  }

  // Helpers

  /** @param {HTMLFormElement} form
   * @param {HTMLElement} [submitter]
   * @returns {boolean}
   */
  submissionIsNavigatable(form, submitter) {
    if (this.formMode == "off") {
      return false
    } else {
      const submitterIsNavigatable = submitter ? this.elementIsNavigatable(submitter) : true

      if (this.formMode == "optin") {
        return submitterIsNavigatable && form.closest('[data-turbo="true"]') != null
      } else {
        return submitterIsNavigatable && this.elementIsNavigatable(form)
      }
    }
  }

  /** @param {Element} element
   * @returns {boolean}
   */
  elementIsNavigatable(element) {
    const container = findClosestRecursively(element, "[data-turbo]")
    const withinFrame = findClosestRecursively(element, "turbo-frame")

    // Check if Drive is enabled on the session or we're within a Frame.
    if (this.drive || withinFrame) {
      // Element is navigatable by default, unless `data-turbo="false"`.
      if (container) {
        return container.getAttribute("data-turbo") != "false"
      } else {
        return true
      }
    } else {
      // Element isn't navigatable by default, unless `data-turbo="true"`.
      if (container) {
        return container.getAttribute("data-turbo") == "true"
      } else {
        return false
      }
    }
  }

  // Private

  /** @param {Element} link
   * @returns {Action}
   */
  getActionForLink(link) {
    return getVisitAction(link) || "advance"
  }

  get snapshot() {
    return this.view.snapshot
  }
}

// Older versions of the Turbo Native adapters referenced the
// `Location#absoluteURL` property in their implementations of
// the `Adapter#visitProposedToLocation()` and `#visitStarted()`
// methods. The Location class has since been removed in favor
// of the DOM URL API, and accordingly all Adapter methods now
// receive URL objects.
//
// We alias #absoluteURL to #toString() here to avoid crashing
// older adapters which do not expect URL objects. We should
// consider removing this support at some point in the future.

/** @param {URL} url
 * @returns {void}
 */
function extendURLWithDeprecatedProperties(url) {
  Object.defineProperties(url, deprecatedLocationPropertyDescriptors)
}

const deprecatedLocationPropertyDescriptors = {
  absoluteURL: {
    get() {
      return this.toString()
    },
  },
}

/** @typedef {"on" | "off" | "optin"} FormMode */
/** @typedef {unknown} TimingData */
/** @typedef {CustomEvent} TurboBeforeCacheEvent */
/**
 * @typedef {CustomEvent<
 *   { newBody: HTMLBodyElement; isPreview: boolean } & PageViewRenderOptions
 * >} TurboBeforeRenderEvent
 */
/** @typedef {CustomEvent<{ url: string }>} TurboBeforeVisitEvent */
/** @typedef {CustomEvent<{ url: string; originalEvent: MouseEvent }>} TurboClickEvent */
/** @typedef {CustomEvent} TurboFrameLoadEvent */
/** @typedef {CustomEvent<{ newFrame: FrameElement } & FrameViewRenderOptions>} TurboBeforeFrameRenderEvent */
/** @typedef {CustomEvent<{ fetchResponse: FetchResponse }>} TurboFrameRenderEvent */
/** @typedef {CustomEvent<{ url: string; timing: TimingData }>} TurboLoadEvent */
/** @typedef {CustomEvent<{ isPreview: boolean }>} TurboRenderEvent */
/** @typedef {CustomEvent<{ url: string; action: Action }>} TurboVisitEvent */
