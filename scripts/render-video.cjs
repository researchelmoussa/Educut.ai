// Render a seek(t)-driven HTML film to MP4, frame by frame.
//
//   node scripts/render-video.cjs assets/brand/videos/ai-eligibility.html out.mp4 [seconds=30] [fps=30]
//   node scripts/render-video.cjs page.html stills/ --stills 2,5,9     # PNG stills for review
//   node scripts/render-video.cjs "page.html?fmt=916" out.mp4 43 30 --captions cues.vo.txt
//
// ?fmt=916 renders 1080x1920; --captions feeds a cue sheet ("start | max | text")
// to the page's window.setCaptions.
//
// Needs Playwright (Chromium) and ffmpeg on PATH.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const argv = process.argv.slice(2);
  const flag = name => { const i = argv.indexOf(name); return i < 0 ? null : argv.splice(i, 2)[1]; };
  const stills = flag('--stills');
  const captions = flag('--captions');
  const [src, out, secs, rate] = argv;
  const stillsAt = stills ? stills.split(',').map(Number) : null;
  const seconds = Number(secs || 30);
  const fps = Number(rate || 30);
  const portrait = /[?&]fmt=916/.test(src);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: portrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } });
  await page.goto('file://' + path.resolve(src), { waitUntil: 'networkidle' });
  if (captions) {
    const cues = fs.readFileSync(captions, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
      .map(l => { const [t, , ...text] = l.split('|'); return { t: Number(t), text: text.join('|').trim() }; });
    await page.evaluate(c => window.setCaptions(c), cues);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));

  if (stillsAt) {
    fs.mkdirSync(out, { recursive: true });
    for (const t of stillsAt) {
      await page.evaluate(x => window.seek(x), t);
      await page.screenshot({ path: path.join(out, `t${t}.png`) });
    }
    await browser.close();
    return;
  }

  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(x => window.seek(x), i / fps);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % (fps * 5) === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg exit ' + c)) : res())));
  await browser.close();
  console.log('wrote', out);
})();
