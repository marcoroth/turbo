import { FetchResponse } from "../http/fetch_response"
import { Snapshot } from "../core/snapshot"
import { LinkClickObserverDelegate } from "../observers/link_click_observer"
import { FormSubmitObserverDelegate } from "../observers/form_submit_observer"

export enum FrameLoadingStyle {
  eager = "eager",
  lazy = "lazy",
}

export type FrameElementObservedAttribute = keyof FrameElement & ("disabled" | "complete" | "loading" | "src")

export interface FrameElementDelegate extends LinkClickObserverDelegate, FormSubmitObserverDelegate {
  connect(): void
  disconnect(): void
  completeChanged(): void
  loadingStyleChanged(): void
  sourceURLChanged(): void
  disabledChanged(): void
  loadResponse(response: FetchResponse): void
  fetchResponseLoaded: (fetchResponse: FetchResponse) => void
  visitCachedSnapshot: (snapshot: Snapshot) => void
  isLoading: boolean
}

export interface FrameElement extends HTMLElement {
  isTurboFrameElement: boolean
  selector: string
  delegate: FrameElementDelegate
  loaded: Promise<FetchResponse | void>
  src: string | null
  disabled: boolean
  complete: boolean
  loading: string
  isActive: boolean
  autoscroll: boolean
  connectedCallback(): void
  disconnectedCallback(): void
  attributeChangedCallback(name: string): void
}

export namespace FrameElement {
  export let delegateConstructor: new (element: FrameElement) => FrameElementDelegate
}

export function frameElementFactory(Base: new() => HTMLElement) {
  return class extends Base implements FrameElement {
    readonly isTurboFrameElement: boolean = true

    loaded: Promise<void> = Promise.resolve()
    readonly delegate: FrameElementDelegate

    static get observedAttributes(): FrameElementObservedAttribute[] {
      return ["disabled", "complete", "loading", "src"]
    }

    constructor() {
      super()
      if (!this.autonomous) {
        this.setAttribute("is", this.isValue)
      }
      this.delegate = new FrameElement.delegateConstructor(this)
    }

    connectedCallback() {
      this.delegate.connect()
    }

    disconnectedCallback() {
      this.delegate.disconnect()
    }

    reload(): Promise<void> {
      const { src } = this
      this.removeAttribute("complete")
      this.src = null
      this.src = src
      return this.loaded
    }

    attributeChangedCallback(name: string) {
      if (name == "loading") {
        this.delegate.loadingStyleChanged()
      } else if (name == "complete") {
        this.delegate.completeChanged()
      } else if (name == "src") {
        this.delegate.sourceURLChanged()
      } else {
        this.delegate.disabledChanged()
      }
    }

    /**
     * Gets the URL to lazily load source HTML from
     */
    get src() {
      return this.getAttribute("src")
    }

    /**
     * Sets the URL to lazily load source HTML from
     */
    set src(value: string | null) {
      if (value) {
        this.setAttribute("src", value)
      } else {
        this.removeAttribute("src")
      }
    }

    /**
     * Determines if the element is loading
     */
    get loading(): FrameLoadingStyle {
      return frameLoadingStyleFromString(this.getAttribute("loading") || "")
    }

    /**
     * Sets the value of if the element is loading
     */
    set loading(value: FrameLoadingStyle) {
      if (value) {
        this.setAttribute("loading", value)
      } else {
        this.removeAttribute("loading")
      }
    }

    /**
     * Gets the disabled state of the frame.
     *
     * If disabled, no requests will be intercepted by the frame.
     */
    get disabled() {
      return this.hasAttribute("disabled")
    }

    /**
     * Sets the disabled state of the frame.
     *
     * If disabled, no requests will be intercepted by the frame.
     */
    set disabled(value: boolean) {
      if (value) {
        this.setAttribute("disabled", "")
      } else {
        this.removeAttribute("disabled")
      }
    }

    /**
     * Gets the autoscroll state of the frame.
     *
     * If true, the frame will be scrolled into view automatically on update.
     */
    get autoscroll() {
      return this.hasAttribute("autoscroll")
    }

    /**
     * Sets the autoscroll state of the frame.
     *
     * If true, the frame will be scrolled into view automatically on update.
     */
    set autoscroll(value: boolean) {
      if (value) {
        this.setAttribute("autoscroll", "")
      } else {
        this.removeAttribute("autoscroll")
      }
    }

    /**
     * Determines if the element has finished loading
     */
    get complete() {
      return !this.delegate.isLoading
    }

    /**
     * Gets the active state of the frame.
     *
     * If inactive, source changes will not be observed.
     */
    get isActive() {
      return this.ownerDocument === document && !this.isPreview
    }

    /**
     * Sets the active state of the frame.
     *
     * If inactive, source changes will not be observed.
     */
    get isPreview() {
      return this.ownerDocument?.documentElement?.hasAttribute("data-turbo-preview")
    }

    get selector(): string {
      if (this.autonomous) {
        return this.localName
      } else {
        return `${this.localName}[is="${this.isValue}"]`
      }
    }

    get isValue(): string {
      return `turbo-frame-${this.localName}`
    }

    get autonomous(): boolean {
      return Base === HTMLElement
    }
  }
}

function frameLoadingStyleFromString(style: string) {
  switch (style.toLowerCase()) {
    case "lazy":
      return FrameLoadingStyle.lazy
    default:
      return FrameLoadingStyle.eager
  }
}

export function builtinTurboFrameElement(name: string) {
  const baseElementConstructor = Object.getPrototypeOf(document.createElement(name)).constructor
  return frameElementFactory(baseElementConstructor)
}

export function isTurboFrameElement(arg: any): arg is FrameElement {
  return arg && arg.isTurboFrameElement && arg instanceof HTMLElement
}

export const TurboFrameElement = frameElementFactory(HTMLElement)
