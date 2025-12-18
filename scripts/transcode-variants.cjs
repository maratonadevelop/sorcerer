#!/usr/bin/env node
/**
 * Create optimized background video variants for Codex:
 * - 720p60 VP9 WebM
 * - 720p60 H.264 MP4 (faststart)
 *
 * Input defaults to sorcerer/uploads/nOVOCOVER.mp4 (or .bak). Override via CLI.
 *
 * Usage:
 *   node scripts/transcode-variants.cjs [inputPath]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const uploads = path.join(repoRoot, 'uploads');
const defaultCandidates = [
  path.join(uploads, 'nOVOCOVER.mp4'),
  path.join(uploads, 'nOVOCOVER.mp4.bak'),
  path.join(uploads, 'nOVOCOVER.webm'), // allow webm source -> re-encode to 720p60 variants
];

const inputArg = process.argv[2];
const input = inputArg && fs.existsSync(inputArg)
  ? path.resolve(inputArg)
  : defaultCandidates.find(f => fs.existsSync(f));

if (!input) {
  console.error('No input found. Tried:', defaultCandidates.join(', '));
  process.exit(1);
}

const outWebm = path.join(uploads, 'nOVOCOVER_720p60.webm');
const outMp4  = path.join(uploads, 'nOVOCOVER_720p60.mp4');

/** Spawn helper that logs succinct progress */
function run(name, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${name}] ffmpeg ${args.join(' ')}`);
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let last = '';
    p.stderr.on('data', d => {
      // Extract speed= and fps= occasionally
      last += d.toString();
      const lines = last.split(/\r?\n/);
      last = lines.pop() || '';
      for (const line of lines) {
        if (line.includes('frame=') || line.includes('speed=')) {
          process.stdout.write(`\r[${name}] ${line.trim().slice(0, 120)}   `);
        }
      }
    });
    p.on('close', code => {
      process.stdout.write('\n');
      if (code === 0) resolve();
      else reject(new Error(`${name} failed with exit code ${code}`));
    });
  });
}

(async () => {
  console.log('Input:', input);
  console.log('Output (webm):', outWebm);
  console.log('Output (mp4): ', outMp4);

  // WebM VP9 720p60. CRF 32-34 is often fine for backgrounds; -cpu-used speeds encode.
  // Keyframe every 2s for smoother seeking: g=120 at 60fps.
  const webmArgs = [
    '-y', '-i', input,
    '-an', // background: drop audio to save decode cost
    '-c:v', 'libvpx-vp9',
    '-crf', '33',
    '-b:v', '0',
    '-row-mt', '1',
    '-deadline', 'good',
    '-cpu-used', '4',
    '-vf', "scale='min(1280,iw)':-2:flags=lanczos,fps=60",
    '-g', '120',
    '-tile-columns', '2',
    '-threads', String(Math.max(2, require('os').cpus().length - 1)),
    outWebm,
  ];

  // MP4 H.264 720p60. Fast decode on all browsers/GPUs. Tune for background; no audio.
  const mp4Args = [
    '-y', '-i', input,
    '-an',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'veryfast',
    '-crf', '22',
    '-vf', "scale='min(1280,iw)':-2:flags=lanczos,fps=60",
    '-g', '120', '-keyint_min', '120', '-sc_threshold', '0',
    '-movflags', '+faststart',
    outMp4,
  ];

  try {
    await run('webm-vp9-720p60', webmArgs);
    const s1 = (fs.statSync(outWebm).size / (1024*1024)).toFixed(2);
    console.log('Created', path.basename(outWebm), s1 + ' MB');
  } catch (e) {
    console.error('WebM transcode error:', e.message);
  }

  try {
    await run('mp4-h264-720p60', mp4Args);
    const s2 = (fs.statSync(outMp4).size / (1024*1024)).toFixed(2);
    console.log('Created', path.basename(outMp4), s2 + ' MB');
  } catch (e) {
    console.error('MP4 transcode error:', e.message);
  }

  console.log('\nDone. Point <video><source> to the _720p60 variants for smoother playback.');
})().catch(e => { console.error(e); process.exit(1); });
