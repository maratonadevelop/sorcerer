# Codex Background Video Optimization

This document summarizes how to keep the Codex background video smooth (higher FPS) while minimizing CPU/GPU and bandwidth usage.

## Frontend Strategy
- Lazy playback: video pauses automatically when off-screen via IntersectionObserver (see `VideoBackground` in `client/src/pages/codex.tsx`).
- `preload="none"` prevents downloading/decoding before the user scrolls to the Codex page.
- Poster image (`nOVOCOVER-poster.jpg`) gives an instant first paint fallback.
- Multiple sources prioritized: VP9 720p60 WebM (quality+size) then H.264 720p60 MP4 (compatibility), then legacy originals.
- Audio removed for background variants to reduce decode overhead.
- Pausing off-screen saves battery on laptops and mobile devices.

## Variant Generation
Use the provided script to generate two optimized files:
```
npm run video:variants
```
Outputs:
- `uploads/nOVOCOVER_720p60.webm` (VP9)
- `uploads/nOVOCOVER_720p60.mp4` (H.264)

### Encoding Parameters
VP9:
- `-c:v libvpx-vp9 -crf 33 -b:v 0 -row-mt 1 -cpu-used 4 -vf scale='min(1280,iw)':-2,fps=60 -g 120`
- Drops audio (`-an`). Keyframe every 2s (g=120 @60fps) for smoother seeking.

H.264:
- `-c:v libx264 -preset veryfast -crf 22 -vf scale='min(1280,iw)':-2,fps=60 -g 120 -keyint_min 120 -sc_threshold 0 -movflags +faststart -an`
- Faststart places the moov atom first for quicker playback start.

### When to Use 60fps
Use 60fps only if:
- Motion in the clip benefits from extra fluidity (camera pans, particle motion).
- Target devices are reasonably modern (desktop or mid/high-tier mobile).
If stutter persists on low-end devices:
- Provide a 30fps fallback variant.
- Reduce resolution to 854x480 (`scale='min(854,iw)':-2,fps=30`).

### Bitrate & Quality Adjustments
- VP9: Raise CRF toward 36 for smaller size; lower toward 30 for sharper details.
- H.264: Adjust CRF: 20 = higher quality, 24 = smaller file. Avoid going below 18 (large files).

## Optional AV1 Variant
If you want even smaller files at similar quality:
```
ffmpeg -i input.mp4 -an -c:v libaom-av1 -crf 38 -b:v 0 -cpu-used 6 -vf scale='min(1280,iw)':-2,fps=60 -g 120 output_av1.mkv
```
Notes:
- Encoding is much slower; often better to run overnight.
- Not all browsers/hardware decode AV1 efficiently yet (Safari lagging; older mobile chips).
Add it as a third `<source>` only when you confirm your audience’s browser share.

## Performance Checklist
1. Confirm playback doesn’t start before user reaches page (Network panel: video request only once visible).
2. Observe dropped frames in Chrome DevTools Performance or Media panel.
3. Ensure CPU usage <~15% during idle background playback on an average laptop.
4. Test reduced motion: if user sets `prefers-reduced-motion`, consider swapping to 30fps variant.

## Future Improvements
- Add automatic selection (use Network Information API to pick 480p30 on slow connections).
- Integrate AV1 fallback once Safari support matures.
- Auto-generate a low-motion variant stripping high-frequency detail if power-saver mode detected.

## Troubleshooting
| Symptom | Fix |
|---------|-----|
| Stutter every few seconds | Lower FPS to 30 or raise CRF to reduce bitrate spike. |
| High CPU on integrated GPU | Remove heavy CSS filters; ensure no transforms animating video itself. |
| Slow start (white flash) | Verify poster path and `faststart` for MP4 present. |
| VP9 not loading on Safari | Safari <16 may struggle: ensure MP4 fallback working. |

## Quick Commands (manual)
Generate poster frame:
```
ffmpeg -y -i nOVOCOVER.mp4 -vf "scale=1280:-2" -frames:v 1 nOVOCOVER-poster.jpg
```
Generate 30fps variant:
```
ffmpeg -y -i nOVOCOVER.mp4 -an -c:v libx264 -preset veryfast -crf 22 -vf "scale='min(1280,iw)':-2,fps=30" -g 60 -keyint_min 60 -sc_threshold 0 -movflags +faststart nOVOCOVER_720p30.mp4
```

---
Maintained by: video/background performance subsystem. Update this doc when adding new codec variants or fallback logic.
