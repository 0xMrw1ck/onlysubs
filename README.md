# onlysubs

a clipping tool for everyone

Local video editing with a transcript/cuts panel on the left and preview on the right.

## Run

```powershell
npm run web
```

Open http://127.0.0.1:5173. `npm run dev` opens the same editor in Electron.
After building the frontend with `npx vite build`, `npm start` runs the desktop app against its own local server.

## Editing and exporting

- Import a video to preview it immediately, cut custom ranges, or select 10-second pieces without transcription.
- Transcribe for editable speech captions and clip suggestions. New transcripts include word timings.
- Old transcripts remain usable with estimated phrase timing. Re-transcribe for word alignment. Correcting a row's wording also estimates timing inside that row; start/end fields allow manual correction.
- Caption presets, size, bottom spacing and original/vertical framing apply to previews and exports. Cues are short phrases, generally 1–5 words, up to two lines. ASS canvas dimensions match the rendered video.
- **Export full video** exports the entire probed source duration, independent of selected clips and the last spoken word.
- Suggested clips, manual cuts, custom ranges and an 8-second rendered preview have separate export actions.
- **Export checked as one video** is available in Suggested clips and Manual cuts. Checked ranges are sorted by source time; adjacent/overlapping ranges merge so footage is not repeated. Unchecked gaps are skipped. Separate-file exports are still available.
- **Export quality** defaults to High (H.264 CRF 16 / medium). Maximum uses CRF 12 / slow; Balanced uses CRF 20 / fast. Audio uses AAC at 320 kbps. These are high-quality re-encodes, not lossless copies. Original mode retains the source raster and frame timestamps (odd dimensions are padded by one pixel); vertical mode centre-crops to 9:16, at most 1080×1920, without upscaling. HDR requires an SDR copy; the exporter reports this instead of silently washing out its colours.
- Combined exports burn captions separately at each range's source timing, then join video without a second video encode. Temporary PCM audio avoids repeated AAC encoder delay at joins. Only scratch intermediates are removed after success; previous user exports are preserved.
- **Finished videos** contains playable MP4s and direct download links.

## Saved work

**Manage storage** lists all tracked completed exports (not just recent ones), with file sizes and multi-select deletion. Each finished video also has **Delete generated file**. A confirmation explains that deletion is permanent, bypasses the Recycle Bin, and removes the chosen MP4 and its generated ASS helpers. Source imports, transcript edits and other exports are retained. Copies saved separately by a browser in Downloads are not tracked and must be removed manually there.

Deletion uses recorded export IDs and stable file indexes, not client-provided paths. It refuses active jobs, path escapes, symlinks/junctions and non-export targets. Deleted files have durable tombstones so a reload cannot restore old download links. No user files are deleted merely by opening storage management.

`.ass` means Advanced SubStation Alpha: a text subtitle format for timing and styling. onlysubs uses it to burn captions into the video. The exported MP4 does not need its ASS helper for playback. See the [Subtitle Edit format reference](https://github.com/SubtitleEdit/subtitleedit/blob/main/docs/reference/assa.md).

Imports stay under `work/imports`. Jobs and edited projects are saved in `work/jobs`; an additional browser backup is opt-in. Each export gets a new folder under `outputs`; previous exports are not overwritten. In a packaged application these directories live under the application's Windows user-data folder, not beside the executable.

Completed jobs stop polling, so selections and edits stay as you set them. Reloading restores saved edits and reconnects to an active export. Sleep pauses computation while the PC sleeps. If the server/process was terminated, jobs are marked interrupted and require another processing run; this does not claim to resume killed Python/FFmpeg processes.

## Local engines

The public Windows build includes FFmpeg, FFprobe, a private Python runtime, and `faster-whisper`; users do not configure paths or run terminal commands. The selected speech model downloads on first transcription and is then reused locally. Ollama remains optional: without it, suggestions use transcript boundaries and are labelled accordingly.

The browser and desktop now share one processing implementation. No cloud AI service receives video/audio. Speech recognition can still mishear mixed languages, names and noisy speech; review corrections before export. Existing text burned into the source cannot be resized by caption controls.

## Verification

`npm test` checks cue timing, subtitle canvas sizing, range streaming and interrupted job recovery. `node work/verify.cjs` creates an isolated 12-second fixture and checks full-video and vertical-cut durations through FFmpeg/FFprobe.

`node work/verify-exports.cjs` checks real full/separate/combined exports, joining with and without audio, source frame rate, and quality against the previous encoder setting.

Export implementation references: [FFmpeg encoder options](https://www.ffmpeg.org/ffmpeg-codecs.html#libx264_002c-libx264rgb) and [concat demuxer](https://www.ffmpeg.org/ffmpeg-formats.html#concat).

The onlysubs brand mark is in `public/onlysubs-logo.png`. Legacy storage keys and the application ID remain stable so existing work is not reset by the rename.

## Windows and website release

`npm run build` produces an unsigned x64 Windows installer under `work/windows-build`. `npm run build:site` prepares a separate static local preview under `site/dist`, never the local API. `node scripts/build-site.mjs --public-release` prepares `outputs/website` with the real release download link; `node scripts/release.mjs <build-folder>` adds the EXE/checksum/notices. Do not publish an incomplete website download folder.

The Windows app bundles its processing engines but never packages the user's media or downloaded speech-model weights. The generated setup page explains the one-time model download and storage controls. Electron's embedded media libraries and bundled processing dependencies are covered by the included notices; the FFmpeg build is GPLv3 and must be distributed with its required licence and corresponding-source materials.

The packaged API is protected by an ephemeral secret attached only to same-origin Electron requests. Development browser mode remains local-only, with Host/Origin/Fetch-Site checks; it is not a public hosting server. Production Electron blocks external navigation, new windows and permissions, disables renderer Node access, and enables sandboxing. Import validation limits size and resolves the real local media path. Ollama redirects are denied.

Policy text is shared in `shared/policies.mjs`. Publisher country is the Philippines, brand WickWorks, and contact email is hello@wickworks.app. Notices remain drafts pending formal operator/hosting/retention details and legal review. No analytics or third-party embeds are included. First-run terms acknowledgement is not verified parental consent or a blanket privacy consent. The static website demonstration neither processes media nor stores user input.

## Optional support

onlysubs keeps its core local editor free and contains no in-app advertising, ad network, analytics SDK, tracking pixel, or sale of video/transcript data. GitHub Sponsors is under verification; no contribution is accepted until WickWorks enables the profile. After activation, contributions must not unlock core editor features, alter export quality, create an account, or send app media to WickWorks. A future resource page may show clearly labelled creator-tool referrals, and WickWorks may separately offer optional template-design, onboarding, and custom-branding services. Before accepting regular income, WickWorks should confirm Philippine business-registration, tax, consumer, and record-keeping obligations with a qualified Philippine accountant or lawyer.

## Update channel and source access

The public `0xMrw1ck/onlysubs-updates` repository contains only Windows installers, `latest.yml`, checksums, notices, and release notes. Version 0.6.0 migrates installed users to that update channel. The source repository must remain public until existing 0.5.x users have had a reasonable migration period; making it private sooner would prevent their automatic update. Before changing source visibility, complete the FFmpeg licence audit and make the exact corresponding FFmpeg source/build information available with every public binary release.

See `outputs/RELEASE-CHECKLIST.md` for public-launch blockers and verification scope. The optional WebMCP demo tool still requires a supported browser contract check.
