/** @param {Locatable} locatable
 * @returns {URL}
 */
export function expandURL(locatable) {
  return new URL(locatable.toString(), document.baseURI)
}

/** @param {URL} url
 * @returns {any}
 */
export function getAnchor(url) {
  let anchorMatch
  if (url.hash) {
    return url.hash.slice(1)
    // eslint-disable-next-line no-cond-assign
  } else if ((anchorMatch = url.href.match(/#(.*)$/))) {
    return anchorMatch[1]
  }
}

/** @param {HTMLFormElement} form
 * @param {HTMLElement} [submitter]
 * @returns {URL}
 */
export function getAction(form, submitter) {
  const action = submitter?.getAttribute("formaction") || form.getAttribute("action") || form.action

  return expandURL(action)
}

/** @param {URL} url
 * @returns {string}
 */
export function getExtension(url) {
  return (getLastPathComponent(url).match(/\.[^.]*$/) || [])[0] || ""
}

/** @param {URL} url
 * @returns {boolean}
 */
export function isHTML(url) {
  return !!getExtension(url).match(/^(?:|\.(?:htm|html|xhtml|php))$/)
}

/** @param {URL} baseURL
 * @param {URL} url
 * @returns {boolean}
 */
export function isPrefixedBy(baseURL, url) {
  const prefix = getPrefix(url)
  return baseURL.href === expandURL(prefix).href || baseURL.href.startsWith(prefix)
}

/** @param {URL} location
 * @param {URL} rootLocation
 * @returns {boolean}
 */
export function locationIsVisitable(location, rootLocation) {
  return isPrefixedBy(location, rootLocation) && isHTML(location)
}

/** @param {URL} url
 * @returns {string}
 */
export function getRequestURL(url) {
  const anchor = getAnchor(url)
  return anchor != null ? url.href.slice(0, -(anchor.length + 1)) : url.href
}

/** @param {URL} url
 * @returns {string}
 */
export function toCacheKey(url) {
  return getRequestURL(url)
}

/** @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
export function urlsAreEqual(left, right) {
  return expandURL(left).href == expandURL(right).href
}

/** @param {URL} url
 * @returns {string[]}
 */
function getPathComponents(url) {
  return url.pathname.split("/").slice(1)
}

/** @param {URL} url
 * @returns {string}
 */
function getLastPathComponent(url) {
  return getPathComponents(url).slice(-1)[0]
}

/** @param {URL} url
 * @returns {string}
 */
function getPrefix(url) {
  return addTrailingSlash(url.origin + url.pathname)
}

/** @param {string} value
 * @returns {string}
 */
function addTrailingSlash(value) {
  return value.endsWith("/") ? value : value + "/"
}

/** @typedef {URL | string} Locatable */
