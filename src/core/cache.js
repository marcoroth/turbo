import { setMetaContent } from "../util"

export class Cache {
  /** @readonly */
  session = undefined

  constructor(session) {
    this.session = session
  }

  /** @returns {void} */
  clear() {
    this.session.clearCache()
  }

  /** @returns {void} */
  resetCacheControl() {
    this.setCacheControl("")
  }

  /** @returns {void} */
  exemptPageFromCache() {
    this.setCacheControl("no-cache")
  }

  /** @returns {void} */
  exemptPageFromPreview() {
    this.setCacheControl("no-preview")
  }

  /** @private
   * @param {string} value
   * @returns {void}
   */
  setCacheControl(value) {
    setMetaContent("turbo-cache-control", value)
  }
}
