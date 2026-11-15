# OptiTone

OptiTone is an intelligent scientific sonification browser EXTENSION that converts NASA Earth science visualisations, videos and datasets into meaningful, synchronised audio experiences!

## How it works

So... our system uses a browser extension and a standalone Demo Studio to analyse supported scientific sources. It extracts information such as intensity, colour, spatial distribution, motion and temporal changes, organising it into a Scientific Feature Representation (SFR) that preserves scientific context, uncertainty and data provenance. Its semantic mapping engine then translates these features into sound, with an auditory legend explaining what listeners hear.

## How to Download and Install OptiTone

Follow this step by step guide to download and install the OptiTone extension in Google Chrome.

### Step 1: Open GitHub Releases

![GitHub Releases Option](docs/images/01_github_releases.jpg)

Look at the Releases option on the right side of the GitHub repository page as highlighted by the green box and arrow.

### Step 2: Download the Release Archive

![Download Release Archive](docs/images/02_download_zip_asset.jpg)

Under the Assets section of the latest release, click on the optitone zip file to download the compressed extension package directly to your computer.

### Step 3: Extract the Downloaded Folder

![Extract All Zip Folder](docs/images/03_extract_zip_folder.jpg)

Locate the downloaded zip file in your file explorer, right click on it, and select the Extract All option to uncompress all files into a regular folder.

### Step 4: Open Chrome Extensions and Enable Developer Mode

![Chrome Extensions Developer Mode](docs/images/04_chrome_extensions_developer_mode.png)

Visit the site chrome://extensions in the Google Chrome address bar and turn on Developer mode using the switch in the top right corner.

### Step 5: Click Load Unpacked

![Load Unpacked Button](docs/images/05_load_unpacked_button.png)

Click the Load unpacked button located in the top left corner of the extensions management page.

### Step 6: Select the Extracted Folder

![Select Extracted Folder](docs/images/06_select_extracted_folder.png)

From the folder picker dialog that appears, select the unzipped optitone folder that contains the unpacked extension files.

### Step 7: Verify Installation

![Extension Successfully Installed](docs/images/07_optitone_extension_installed.jpg)

OptiTone will now appear in your My extensions section, fully installed and ready to use.

## How to Use OptiTone

After downloading and installing the extension, follow these steps to experience live sonification.

### Step 8: View OptiTone in the Browser Toolbar

![Extension in Toolbar](docs/images/08_extension_in_toolbar.jpg)

Click the extensions icon on your browser toolbar to see OptiTone pinned with confirmed site access on supported video pages.

### Step 9: Open the Extension Popup Toggle

![Extension Toggle Off](docs/images/09_extension_toggle_off.jpg)

Clicking the OptiTone icon opens a clean control popup containing an on and off toggle switch currently in its off position.

### Step 10: Turn On Sonification

![Extension Toggle On](docs/images/10_extension_toggle_on.jpg)

Clicking the toggle switch turns it on with a glowing green indicator, enabling live synchronised sound generation for playing and testing with NASA EIC videos from the link :
https://svs.gsfc.nasa.gov/gallery/earth-information-center/

## Project File Structure

```text
optitone/
├── docs/
│   ├── images/
│   │   ├── 01_github_releases.jpg
│   │   ├── 02_download_zip_asset.jpg
│   │   ├── 03_extract_zip_folder.jpg
│   │   ├── 04_chrome_extensions_developer_mode.png
│   │   ├── 05_load_unpacked_button.png
│   │   ├── 06_select_extracted_folder.png
│   │   ├── 07_optitone_extension_installed.jpg
│   │   ├── 08_extension_in_toolbar.jpg
│   │   ├── 09_extension_toggle_off.jpg
│   │   └── 10_extension_toggle_on.jpg
│   ├── CONTRACT.md
│   ├── METHODOLOGY.md
│   └── PRIVACY.md
├── extension/
│   ├── public/
│   │   ├── icons/
│   │   │   ├── icon16.png
│   │   │   ├── icon32.png
│   │   │   ├── icon48.png
│   │   │   └── icon128.png
│   │   ├── favicon.ico
│   │   └── favicon.png
│   ├── src/
│   │   ├── analysis/
│   │   │   ├── color.ts
│   │   │   ├── legend.ts
│   │   │   ├── luminance.ts
│   │   │   ├── motion.ts
│   │   │   ├── normalize.ts
│   │   │   └── regions.ts
│   │   ├── audio/
│   │   │   ├── synths/
│   │   │   │   ├── base-voice.ts
│   │   │   │   ├── noise-voice.ts
│   │   │   │   ├── percussion.ts
│   │   │   │   └── pulse-voice.ts
│   │   │   ├── autorange.ts
│   │   │   ├── engine.ts
│   │   │   ├── index.ts
│   │   │   ├── profiles.ts
│   │   │   ├── scales.ts
│   │   │   ├── smoother.ts
│   │   │   ├── spatial.ts
│   │   │   └── types.ts
│   │   ├── background/
│   │   │   └── service-worker.ts
│   │   ├── content/
│   │   │   ├── capture.ts
│   │   │   ├── emitter.ts
│   │   │   ├── index.ts
│   │   │   └── media-finder.ts
│   │   ├── contract/
│   │   │   └── types.ts
│   │   ├── offscreen/
│   │   │   ├── offscreen.html
│   │   │   └── offscreen.ts
│   │   ├── popup/
│   │   │   ├── popup.css
│   │   │   ├── popup.html
│   │   │   └── popup.ts
│   │   └── presets/
│   │       └── visualizations.json
│   ├── manifest.json
│   └── vite.config.ts
├── scripts/
│   ├── build-extension.js
│   ├── generate-icons.js
│   └── package.js
├── test/
│   ├── audio-profiles.test.ts
│   ├── autorange.test.ts
│   ├── color.test.ts
│   ├── contract.test.ts
│   ├── engine.test.ts
│   ├── legend.test.ts
│   ├── luminance.test.ts
│   ├── mock-audio.ts
│   ├── motion.test.ts
│   ├── normalize.test.ts
│   ├── regions.test.ts
│   ├── scales.test.ts
│   ├── smoother.test.ts
│   └── spatial.test.ts
├── LICENSE
├── mock-emitter.ts
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

## Technology Stack

OptiTone is built using the following technologies:

* TypeScript: Static typing across all visual analysis pipelines, audio nodes, and event contracts.
* JavaScript: High performance ES modules executing inside content scripts, background workers, and audio processors.
* React: Component based architecture for interactive user interfaces and dashboard inspectors.
* Vite: Fast frontend tooling and bundler powering extension builds and development workflows.
* Chrome Manifest V3: Modern extension platform utilizing content scripts, service workers, and offscreen canvas documents.
* Web Audio API: Browser native audio synthesis graph featuring oscillators, gain nodes, biquad filters, stereo panners, and dynamics compressors.
* Tone.js: Advanced polyphonic synthesis scheduling, melodic pitch quantization, and musical timing foundations.
* Web Workers: Off thread computational analysis preventing user interface stutter during high frequency frame processing.
* Vitest: Unit and integration test runner validating mathematical algorithms and audio parameter ranges.
* Git and GitHub: Distributed version control, release management, and issue tracking.

## Key innovations

* Scientific Feature Representation: Supports different data types, including scalar values, spatial grids, events, vectors and time series.
* Scientific integrity: Distinguishes actual measurements, published metadata, calibrated visual estimates and visual proxies.
* Semantic mapping: Selects sounds based on the meaning and relationships of scientific features rather than arbitrary frequency assignments.
* Indian musical composition: Our extended direction introduces ragas, talas, melodic structures and suitable instruments to generate original compositions influenced by scientific data.
* Unique musical identities: Different datasets can produce distinct compositions based on their scientific characteristics, with music evolving as the underlying data changes.
* Synchronised audio: Sound responds to changes and significant events in the visualisation.

## Benefits and intended impact

OptiTone improves accessibility to complex scientific information, supports auditory learning and makes NASA's Earth science discoveries more engaging. It aims to help users understand patterns and changes through sound, including those that may be difficult to identify visually.

## Development Considerations

We considered scientific accuracy, data provenance, uncertainty, accessibility, audio quality, synchronisation, browser security and cross origin restrictions. We also prioritised performance on standard hardware, fallback demonstrations when live capture is unavailable, and the use of original, appropriately licensed musical content.
