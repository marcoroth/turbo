import { activateScriptElement, createDocumentFragment } from "../../util"

export class StreamMessage {
  /** @static
   * @readonly
   * @default "text/vnd.turbo-stream.html"
   */
  static contentType = "text/vnd.turbo-stream.html"
  /** @readonly */
  fragment = undefined

  /** @static
   * @param {StreamMessage | string} message
   * @returns {StreamMessage}
   */
  static wrap(message) {
    if (typeof message == "string") {
      return new this(createDocumentFragment(message))
    } else {
      return message
    }
  }

  constructor(fragment) {
    this.fragment = importStreamElements(fragment)
  }
}

/** @param {DocumentFragment} fragment
 * @returns {DocumentFragment}
 */
function importStreamElements(fragment) {
  for (const element of fragment.querySelectorAll("turbo-stream")) {
    const streamElement = document.importNode(element, true)

    for (const inertScriptElement of streamElement.templateElement.content.querySelectorAll("script")) {
      inertScriptElement.replaceWith(activateScriptElement(inertScriptElement))
    }

    element.replaceWith(streamElement)
  }

  return fragment
}
