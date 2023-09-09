/** @param {HTMLScriptElement} element
 * @returns {HTMLScriptElement}
 */
export function activateScriptElement(element) {
  if (element.getAttribute("data-turbo-eval") == "false") {
    return element
  } else {
    const createdScriptElement = document.createElement("script")
    const cspNonce = getMetaContent("csp-nonce")
    if (cspNonce) {
      createdScriptElement.nonce = cspNonce
    }
    createdScriptElement.textContent = element.textContent
    createdScriptElement.async = false
    copyElementAttributes(createdScriptElement, element)
    return createdScriptElement
  }
}

/** @param {Element} destinationElement
 * @param {Element} sourceElement
 * @returns {void}
 */
function copyElementAttributes(destinationElement, sourceElement) {
  for (const { name, value } of sourceElement.attributes) {
    destinationElement.setAttribute(name, value)
  }
}

/** @param {string} html
 * @returns {DocumentFragment}
 */
export function createDocumentFragment(html) {
  const template = document.createElement("template")
  template.innerHTML = html
  return template.content
}

/** @param {string} eventName
 * @param {Partial<DispatchOptions<T>>}
 * @returns {CustomEvent<T["detail"]>}
 */
export function dispatch(eventName, { target, cancelable, detail } = {}) {
  const event = new CustomEvent(eventName, {
    cancelable,
    bubbles: true,
    composed: true,
    detail,
  })

  if (target && target.isConnected) {
    target.dispatchEvent(event)
  } else {
    document.documentElement.dispatchEvent(event)
  }

  return event
}

/** @returns {Promise<void>} */
export function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** @returns {Promise<void>} */
export function nextEventLoopTick() {
  return new Promise((resolve) => setTimeout(() => resolve(), 0))
}

/** @returns {Promise<void>} */
export function nextMicrotask() {
  return Promise.resolve()
}

/** @returns {Document} */
export function parseHTMLDocument(html = "") {
  return new DOMParser().parseFromString(html, "text/html")
}

/** @param {TemplateStringsArray} strings
 * @param {...any} [values]
 * @returns {string}
 */
export function unindent(strings, ...values) {
  const lines = interpolate(strings, values).replace(/^\n/, "").split("\n")
  const match = lines[0].match(/^\s+/)
  const indent = match ? match[0].length : 0
  return lines.map((line) => line.slice(indent)).join("\n")
}

/** @param {TemplateStringsArray} strings
 * @param {any[]} values
 * @returns {string}
 */
function interpolate(strings, values) {
  return strings.reduce((result, string, i) => {
    const value = values[i] == undefined ? "" : values[i]
    return result + string + value
  }, "")
}

/** @returns {string} */
export function uuid() {
  return Array.from({ length: 36 })
    .map((_, i) => {
      if (i == 8 || i == 13 || i == 18 || i == 23) {
        return "-"
      } else if (i == 14) {
        return "4"
      } else if (i == 19) {
        return (Math.floor(Math.random() * 4) + 8).toString(16)
      } else {
        return Math.floor(Math.random() * 15).toString(16)
      }
    })
    .join("")
}

/** @param {string} attributeName
 * @param {...(Element | undefined)} [elements]
 * @returns {string | null}
 */
export function getAttribute(attributeName, ...elements) {
  for (const value of elements.map((element) => element?.getAttribute(attributeName))) {
    if (typeof value == "string") return value
  }

  return null
}

/** @param {string} attributeName
 * @param {...(Element | undefined)} [elements]
 * @returns {boolean}
 */
export function hasAttribute(attributeName, ...elements) {
  return elements.some((element) => element && element.hasAttribute(attributeName))
}

/** @param {...Element} [elements]
 * @returns {void}
 */
export function markAsBusy(...elements) {
  for (const element of elements) {
    if (element.localName == "turbo-frame") {
      element.setAttribute("busy", "")
    }
    element.setAttribute("aria-busy", "true")
  }
}

/** @param {...Element} [elements]
 * @returns {void}
 */
export function clearBusyState(...elements) {
  for (const element of elements) {
    if (element.localName == "turbo-frame") {
      element.removeAttribute("busy")
    }

    element.removeAttribute("aria-busy")
  }
}

/** @param {HTMLLinkElement} element
 * @returns {Promise<void>}
 */
export function waitForLoad(element, timeoutInMilliseconds = 2000) {
  return new Promise((resolve) => {
    const onComplete = () => {
      element.removeEventListener("error", onComplete)
      element.removeEventListener("load", onComplete)
      resolve()
    }

    element.addEventListener("load", onComplete, { once: true })
    element.addEventListener("error", onComplete, { once: true })
    setTimeout(resolve, timeoutInMilliseconds)
  })
}

/** @param {Action} action
 * @returns {(data: any, unused: string, url?: string | URL) => void}
 */
export function getHistoryMethodForAction(action) {
  switch (action) {
    case "replace":
      return history.replaceState
    case "advance":
    case "restore":
      return history.pushState
  }
}

/** @param {any} action
 * @returns {action is Action}
 */
export function isAction(action) {
  return action == "advance" || action == "replace" || action == "restore"
}

/** @param {...(Element | undefined)} [elements]
 * @returns {Action | null}
 */
export function getVisitAction(...elements) {
  const action = getAttribute("data-turbo-action", ...elements)

  return isAction(action) ? action : null
}

/** @param {string} name
 * @returns {HTMLMetaElement | null}
 */
export function getMetaElement(name) {
  return document.querySelector(`meta[name="${name}"]`)
}

/** @param {string} name
 * @returns {string}
 */
export function getMetaContent(name) {
  const element = getMetaElement(name)
  return element && element.content
}

/** @param {string} name
 * @param {string} content
 * @returns {HTMLMetaElement}
 */
export function setMetaContent(name, content) {
  let element = getMetaElement(name)

  if (!element) {
    element = document.createElement("meta")
    element.setAttribute("name", name)

    document.head.appendChild(element)
  }

  element.setAttribute("content", content)

  return element
}

/** @param {Element | null} element
 * @param {string} selector
 * @returns {E | undefined}
 */
export function findClosestRecursively(element, selector) {
  if (element instanceof Element) {
    return (
      element.closest(selector) || findClosestRecursively(element.assignedSlot || element.getRootNode()?.host, selector)
    )
  }
}

/**
 * @typedef {{
 *   target: EventTarget
 *   cancelable: boolean
 *   detail: T["detail"]
 * }} DispatchOptions
 * @template {CustomEvent} T
 */
