# OptiTone — Privacy Policy & Local Processing Guarantee

**NASA Space Apps Challenge 2026 — "The Earth Information Jukebox"**  
**Last Updated:** November 2026

## 1. Zero Remote Data Collection
OptiTone is engineered with a strict **local-first, client-side** privacy architecture:
- **No Remote Servers:** OptiTone does not maintain, communicate with, or transmit data to any external or backend server.
- **No Analytics or Telemetry:** No user tracking, Google Analytics, cookies, telemetry tokens, or usage beacons are present in the code.
- **No Pixel Egress:** Visual frames captured from NASA videos and canvases are processed exclusively in your browser's volatile memory (`Uint8ClampedArray` buffers) and discarded on the next frame tick. At no point are pixels, images, screenshots, or audio streams saved to disk or transmitted across any network boundary.

## 2. Minimal Permissions Scope
OptiTone requests only the specific permissions necessary to execute real-time video sonification on official NASA domains:
- `host_permissions: ["https://*.earth.gov/*", "https://earth.gov/*", "https://svs.gsfc.nasa.gov/*"]`: Restricts content script execution strictly to official NASA Earth Information Center and Scientific Visualization Studio pages. The extension cannot run on or observe any non-NASA websites.
- `activeTab`: Permits the popup to send sonification commands exclusively to the currently focused NASA tab.
- `tabCapture` & `offscreen`: Used solely as an on-device fallback to decode video streams in a sandboxed offscreen document if a NASA video is hosted cross-origin and taints direct canvas access. Audio/video streams captured via `tabCapture` are processed on-device and never saved or transmitted.
- `storage`: Caches user preferences locally (such as preferred visualization preset and volume).

## 3. Open Source Verification
OptiTone is fully open-source under the MIT License. Anyone can inspect, audit, or build the source code from our repository:
[https://github.com/ujwalamar314-cell/optitone](https://github.com/ujwalamar314-cell/optitone)
