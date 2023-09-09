/** @param {Page} page
 * @param {string} selector
 * @param {string} attributeName
 * @returns {Promise<string | null>}
 */
export function attributeForSelector(page, selector, attributeName) {
  return page.locator(selector).getAttribute(attributeName)
}

/** @param {Page} page
 * @param {CancellableEvent} eventName
 * @returns {Promise<void>}
 */
export function cancelNextEvent(page, eventName) {
  return page.evaluate(
    (eventName) => addEventListener(eventName, (event) => event.preventDefault(), { once: true }),
    eventName
  )
}

/** @param {Page} page
 * @param {string} selector
 * @returns {any}
 */
export function clickWithoutScrolling(page, selector, options = {}) {
  const element = page.locator(selector, options)

  return element.evaluate((element) => element instanceof HTMLElement && element.click())
}

/** @param {Page} page
 * @returns {Promise<void>}
 */
export function clearLocalStorage(page) {
  return page.evaluate(() => localStorage.clear())
}

/** @param {...JSHandle} [handles]
 * @returns {Promise<void[]>}
 */
export function disposeAll(...handles) {
  return Promise.all(handles.map((handle) => handle.dispose()))
}

/** @param {Page} page
 * @param {string} key
 * @returns {any}
 */
export function getFromLocalStorage(page, key) {
  return page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
}

/** @param {string} url
 * @param {string} key
 * @returns {string | null}
 */
export function getSearchParam(url, key) {
  return searchParams(url).get(key)
}

/** @param {string} url
 * @returns {string}
 */
export function hash(url) {
  const { hash } = new URL(url)

  return hash
}

/** @param {Page} page
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
export async function hasSelector(page, selector) {
  return !!(await page.locator(selector).count())
}

/** @param {Page} page
 * @param {string} selector
 * @returns {Promise<string>}
 */
export function innerHTMLForSelector(page, selector) {
  return page.locator(selector).innerHTML()
}

/** @param {Page} page
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
export async function isScrolledToSelector(page, selector) {
  const boundingBox = await page
    .locator(selector)
    .evaluate((element) => (element instanceof HTMLElement ? { x: element.offsetLeft, y: element.offsetTop } : null))

  if (boundingBox) {
    const { y: pageY } = await scrollPosition(page)
    const { y: elementY } = boundingBox
    const offset = pageY - elementY
    return Math.abs(offset) <= 2
  } else {
    return false
  }
}

/** @returns {Promise<void>} */
export function nextBeat() {
  return sleep(100)
}

/** @param {Page} _page
 * @returns {Promise<void>}
 */
export function nextBody(_page, timeout = 500) {
  return sleep(timeout)
}

/** @param {Page} page
 * @param {string} eventName
 * @returns {Promise<any>}
 */
export async function nextEventNamed(page, eventName) {
  let record
  while (!record) {
    const records = await readEventLogs(page, 1)
    record = records.find(([name]) => name == eventName)
  }
  return record[1]
}

/** @param {Page} page
 * @param {string} elementId
 * @param {string} eventName
 * @returns {Promise<any>}
 */
export async function nextEventOnTarget(page, elementId, eventName) {
  let record
  while (!record) {
    const records = await readEventLogs(page, 1)
    record = records.find(([name, _, id]) => name == eventName && id == elementId)
  }
  return record[1]
}

/** @param {Page} page
 * @param {string} elementId
 * @param {string} eventName
 * @returns {Promise<void>}
 */
export async function listenForEventOnTarget(page, elementId, eventName) {
  return page.locator("#" + elementId).evaluate((element, eventName) => {
    const eventLogs = window.eventLogs

    element.addEventListener(eventName, ({ target, type }) => {
      if (target instanceof Element) {
        eventLogs.push([type, {}, target.id])
      }
    })
  }, eventName)
}

/** @param {Page} page
 * @returns {Promise<string | null>}
 */
export async function nextBodyMutation(page) {
  let record
  while (!record) {
    ;[record] = await readBodyMutationLogs(page, 1)
  }
  return record[0]
}

/** @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function noNextBodyMutation(page) {
  const records = await readBodyMutationLogs(page, 1)
  return !records.some((record) => !!record)
}

/** @param {Page} page
 * @param {string} elementId
 * @param {string} attributeName
 * @returns {Promise<string | null>}
 */
export async function nextAttributeMutationNamed(page, elementId, attributeName) {
  let record
  while (!record) {
    const records = await readMutationLogs(page, 1)
    record = records.find(([name, id]) => name == attributeName && id == elementId)
  }
  const attributeValue = record[2]
  return attributeValue
}

/** @param {Page} page
 * @param {string} elementId
 * @param {string} attributeName
 * @returns {Promise<boolean>}
 */
export async function noNextAttributeMutationNamed(page, elementId, attributeName) {
  const records = await readMutationLogs(page, 1)
  return !records.some(([name, _, target]) => name == attributeName && target == elementId)
}

/** @param {Page} page
 * @param {string} eventName
 * @returns {Promise<boolean>}
 */
export async function noNextEventNamed(page, eventName) {
  const records = await readEventLogs(page, 1)
  return !records.some(([name]) => name == eventName)
}

/** @param {Page} page
 * @param {string} elementId
 * @param {string} eventName
 * @returns {Promise<boolean>}
 */
export async function noNextEventOnTarget(page, elementId, eventName) {
  const records = await readEventLogs(page, 1)
  return !records.some(([name, _, target]) => name == eventName && target == elementId)
}

/** @param {Page} page
 * @param {string} selector
 * @returns {Promise<string>}
 */
export async function outerHTMLForSelector(page, selector) {
  const element = await page.locator(selector)
  return element.evaluate((element) => element.outerHTML)
}

/** @param {string} url
 * @returns {string}
 */
export function pathname(url) {
  const { pathname } = new URL(url)

  return pathname
}

/** @param {Page} page
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function pathnameForIFrame(page, name) {
  const locator = await page.locator(`[name="${name}"]`)
  const location = await locator.evaluate((iframe) => iframe.contentWindow?.location)

  if (location) {
    return pathname(location.href)
  } else {
    return ""
  }
}

/** @param {Page} page
 * @param {string} selector
 * @param {string} propertyName
 * @returns {Promise<any>}
 */
export function propertyForSelector(page, selector, propertyName) {
  return page.locator(selector).evaluate((element, propertyName) => element[propertyName], propertyName)
}

/** @param {Page} page
 * @param {string} identifier
 * @param {number} [length]
 * @returns {Promise<T[]>}
 */
async function readArray(page, identifier, length) {
  return page.evaluate(
    ({ identifier, length }) => {
      const records = window[identifier]
      if (records != null && typeof records.splice == "function") {
        return records.splice(0, typeof length === "undefined" ? records.length : length)
      } else {
        return []
      }
    },
    { identifier, length }
  )
}

/** @param {Page} page
 * @param {number} [length]
 * @returns {Promise<BodyMutationLog[]>}
 */
export function readBodyMutationLogs(page, length) {
  return readArray(page, "bodyMutationLogs", length)
}

/** @param {Page} page
 * @param {number} [length]
 * @returns {Promise<EventLog[]>}
 */
export function readEventLogs(page, length) {
  return readArray(page, "eventLogs", length)
}

/** @param {Page} page
 * @param {number} [length]
 * @returns {Promise<MutationLog[]>}
 */
export function readMutationLogs(page, length) {
  return readArray(page, "mutationLogs", length)
}

/** @param {string} url
 * @returns {string}
 */
export function search(url) {
  const { search } = new URL(url)

  return search
}

/** @param {string} url
 * @returns {URLSearchParams}
 */
export function searchParams(url) {
  const { searchParams } = new URL(url)

  return searchParams
}

/** @param {Page} page
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
export function selectorHasFocus(page, selector) {
  return page.locator(selector).evaluate((element) => element === document.activeElement)
}

/** @param {Page} page
 * @param {string} eventName
 * @param {string} storageKey
 * @param {string} storageValue
 * @returns {any}
 */
export function setLocalStorageFromEvent(page, eventName, storageKey, storageValue) {
  return page.evaluate(
    ({ eventName, storageKey, storageValue }) => {
      addEventListener(eventName, () => localStorage.setItem(storageKey, storageValue))
    },
    { eventName, storageKey, storageValue }
  )
}

/** @param {Page} page
 * @returns {Promise<{ x: number; y: number }>}
 */
export function scrollPosition(page) {
  return page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
}

/** @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function isScrolledToTop(page) {
  const { y: pageY } = await scrollPosition(page)
  return pageY === 0
}

/** @param {Page} page
 * @param {string} selector
 * @returns {Promise<void>}
 */
export function scrollToSelector(page, selector) {
  return page.locator(selector).scrollIntoViewIfNeeded()
}

/** @returns {Promise<void>} */
export function sleep(timeout = 0) {
  return new Promise((resolve) => setTimeout(() => resolve(undefined), timeout))
}

/** @param {Locator} left
 * @param {Locator} right
 * @returns {Promise<boolean>}
 */
export async function strictElementEquals(left, right) {
  return left.evaluate((left, right) => left === right, await right.elementHandle())
}

/** @param {Page} page
 * @param {string} html
 * @returns {Promise<string | null>}
 */
export function textContent(page, html) {
  return page.evaluate((html) => {
    const parser = new DOMParser()
    const { documentElement } = parser.parseFromString(html, "text/html")

    return documentElement.textContent
  }, html)
}

/** @param {Page} page
 * @returns {Promise<string>}
 */
export function visitAction(page) {
  return page.evaluate(() => {
    try {
      return window.Turbo.navigator.currentVisit.action
    } catch (error) {
      return "load"
    }
  })
}

/** @param {Page} page
 * @param {string} pathname
 * @returns {Promise<void>}
 */
export function waitForPathname(page, pathname) {
  return page.waitForURL((url) => url.pathname == pathname)
}

/** @param {Page} page
 * @param {string} text
 * @param {"visible" | "attached"} [state="visible"]
 * @returns {any}
 */
export function waitUntilText(page, text, state = "visible") {
  return page.waitForSelector(`text='${text}'`, { state })
}

/** @param {Page} page
 * @param {string} selector
 * @param {"visible" | "attached"} [state="visible"]
 * @returns {any}
 */
export function waitUntilSelector(page, selector, state = "visible") {
  return page.waitForSelector(selector, { state })
}

/** @param {Page} page
 * @param {string} selector
 * @param {"hidden" | "detached"} [state="hidden"]
 * @returns {any}
 */
export function waitUntilNoSelector(page, selector, state = "hidden") {
  return page.waitForSelector(selector, { state })
}

/** @param {Page} page
 * @param {() => Promise<void>} callback
 * @returns {Promise<boolean>}
 */
export async function willChangeBody(page, callback) {
  const handles = []

  try {
    const originalBody = await page.evaluateHandle(() => document.body)
    handles.push(originalBody)

    await callback()

    const latestBody = await page.evaluateHandle(() => document.body)
    handles.push(latestBody)

    return page.evaluate(({ originalBody, latestBody }) => originalBody !== latestBody, { originalBody, latestBody })
  } finally {
    disposeAll(...handles)
  }
}

/** @typedef {string | null} Target */
/** @typedef {string} EventType */
/** @typedef {any} EventDetail */
/** @typedef {[EventType, EventDetail, Target]} EventLog */
/** @typedef {string} MutationAttributeName */
/** @typedef {string | null} MutationAttributeValue */
/** @typedef {[MutationAttributeName, Target, MutationAttributeValue]} MutationLog */
/** @typedef {string} BodyHTML */
/** @typedef {[BodyHTML]} BodyMutationLog */
/** @typedef {"turbo:click" | "turbo:before-visit"} CancellableEvent */
