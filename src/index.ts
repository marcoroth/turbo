import "./polyfills"
import "./elements"
import "./script_warning"

import * as Turbo from "./core"

window.Turbo = Turbo
Turbo.start()

console.log("Local Turbo")

export * from "./core"
