import { nextEventLoopTick } from "../../util"
import { View } from "../view"
import { ErrorRenderer } from "./error_renderer"
import { PageRenderer } from "./page_renderer"
import { PageSnapshot } from "./page_snapshot"
import { SnapshotCache } from "./snapshot_cache"

/** @extends View<HTMLBodyElement, PageSnapshot, PageViewRenderer, PageViewDelegate> */
export class PageView extends View {
  /** @readonly
   * @default new SnapshotCache(10)
   */
  snapshotCache = new SnapshotCache(10)
  /** @default new URL(location.href) */
  lastRenderedLocation = new URL(location.href)
  /** @default false */
  forceReloaded = false

  /** @param {PageSnapshot} newSnapshot
   * @returns {any}
   */
  shouldTransitionTo(newSnapshot) {
    return this.snapshot.prefersViewTransitions && newSnapshot.prefersViewTransitions
  }

  /** @param {PageSnapshot} snapshot
   * @param {Visit} [visit]
   * @returns {any}
   */
  renderPage(snapshot, isPreview = false, willRender = true, visit) {
    const renderer = new PageRenderer(this.snapshot, snapshot, PageRenderer.renderElement, isPreview, willRender)

    if (!renderer.shouldRender) {
      this.forceReloaded = true
    } else {
      visit?.changeHistory()
    }

    return this.render(renderer)
  }

  /** @param {PageSnapshot} snapshot
   * @param {Visit} [visit]
   * @returns {any}
   */
  renderError(snapshot, visit) {
    visit?.changeHistory()
    const renderer = new ErrorRenderer(this.snapshot, snapshot, ErrorRenderer.renderElement, false)
    return this.render(renderer)
  }

  /** @returns {void} */
  clearSnapshotCache() {
    this.snapshotCache.clear()
  }

  /** @param {PageSnapshot} [snapshot=this.snapshot]
   * @returns {Promise<any>}
   */
  async cacheSnapshot(snapshot = this.snapshot) {
    if (snapshot.isCacheable) {
      this.delegate.viewWillCacheSnapshot()
      const { lastRenderedLocation: location } = this
      await nextEventLoopTick()
      const cachedSnapshot = snapshot.clone()
      this.snapshotCache.put(location, cachedSnapshot)
      return cachedSnapshot
    }
  }

  /** @param {URL} location
   * @returns {any}
   */
  getCachedSnapshotForLocation(location) {
    return this.snapshotCache.get(location)
  }

  get snapshot() {
    return PageSnapshot.fromElement(this.element)
  }
}

/** @typedef {ViewRenderOptions<HTMLBodyElement>} PageViewRenderOptions */
/** @typedef {PageRenderer | ErrorRenderer} PageViewRenderer */

/** @typedef {Object} PageViewDelegate */
