import { connectStreamSource, disconnectStreamSource } from "../core/index"

/** @extends HTMLElement */
export class StreamSourceElement extends HTMLElement {
  /** @default null */
  streamSource = null

  /** @returns {void} */
  connectedCallback() {
    this.streamSource = this.src.match(/^ws{1,2}:/) ? new WebSocket(this.src) : new EventSource(this.src)

    connectStreamSource(this.streamSource)
  }

  /** @returns {void} */
  disconnectedCallback() {
    if (this.streamSource) {
      disconnectStreamSource(this.streamSource)
    }
  }

  get src() {
    return this.getAttribute("src") || ""
  }
}
