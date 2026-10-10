// Generates and shares an aesthetic 1080x1920 Instagram Story / WhatsApp status card.
import { toast } from '../core/util.js';
import * as profile from '../features/profile.js';
import * as stats from '../features/stats.js';

export async function createStoryCardBlob({ letter = 'A+', mins = 22, snoozes = 0, line = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  const p = profile.get();
  const st = stats.get();
  const streak = stats.currentStreak();

  // 1. Background gradient (Midnight to warm sunrise amber)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
  bgGrad.addColorStop(0, '#0B0B14');
  bgGrad.addColorStop(0.45, '#1E1528');
  bgGrad.addColorStop(0.8, '#3A1F2D');
  bgGrad.addColorStop(1, '#6E3224');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // 2. Ambient glowing sun on horizon
  const sunGrad = ctx.createRadialGradient(540, 1380, 20, 540, 1380, 520);
  sunGrad.addColorStop(0, 'rgba(243, 156, 18, 0.45)');
  sunGrad.addColorStop(0.5, 'rgba(230, 126, 34, 0.18)');
  sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(540, 1380, 520, 0, Math.PI * 2);
  ctx.fill();

  // 3. Delicate stars / sparkles in the sky
  ctx.fillStyle = '#FFF8E7';
  const stars = [
    [140, 280, 2.5], [260, 420, 1.8], [880, 310, 2.2], [740, 480, 1.5],
    [180, 680, 2.0], [920, 720, 2.8], [420, 220, 1.8], [640, 260, 2.2]
  ];
  stars.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4. Header branding
  ctx.textAlign = 'center';
  ctx.fillStyle = '#C8A55E';
  ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('FIRST LIGHT 🌅', 540, 190);

  ctx.fillStyle = '#EAE6DF';
  ctx.font = '300 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('MORNING PROVEN REPORT', 540, 245);

  // 5. Hero Card Container
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.strokeStyle = 'rgba(200, 165, 94, 0.35)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 100, 320, 880, 1180, 48);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 6. Tiger Pip illustration badge
  ctx.save();
  ctx.beginPath();
  ctx.arc(540, 560, 140, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(243, 156, 18, 0.12)';
  ctx.fill();
  ctx.strokeStyle = '#C8A55E';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Simple stylized Tiger avatar
  ctx.fillStyle = '#E9893B';
  ctx.beginPath();
  ctx.arc(540, 560, 95, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.beginPath();
  ctx.arc(465, 480, 32, 0, Math.PI * 2);
  ctx.arc(615, 480, 32, 0, Math.PI * 2);
  ctx.fillStyle = '#E9893B';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(465, 480, 16, 0, Math.PI * 2);
  ctx.arc(615, 480, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#2A1A10';
  ctx.fill();
  // Eyes (happy arches)
  ctx.strokeStyle = '#2A1A10';
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.arc(500, 550, 18, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(580, 550, 18, Math.PI, 0);
  ctx.stroke();
  // Muzzle & nose
  ctx.fillStyle = '#FBEFD9';
  ctx.beginPath();
  ctx.ellipse(540, 595, 45, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#C65F55';
  ctx.beginPath();
  ctx.arc(540, 580, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 7. Grade Badge
  ctx.fillStyle = '#F39C12';
  ctx.font = '800 120px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(letter, 540, 840);

  ctx.fillStyle = '#EAE6DF';
  ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(p.name ? `${p.name}’s Morning` : 'Proven Morning', 540, 905);

  // 8. Motivational Quote
  ctx.fillStyle = 'rgba(234, 230, 223, 0.85)';
  ctx.font = 'italic 400 32px Georgia, serif';
  const quote = line || 'Flawless rise. The sun is honestly a little intimidated.';
  wrapText(ctx, `“${quote}”`, 540, 975, 760, 44);

  // 9. Stats tiles inside card
  const statBoxY = 1140;
  drawStatPill(ctx, 160, statBoxY, 220, 160, `${streak} 🔥`, 'Streak Days');
  drawStatPill(ctx, 430, statBoxY, 220, 160, `${mins}m ⏱️`, 'Time to Prove');
  drawStatPill(ctx, 700, statBoxY, 220, 160, `${snoozes} 😴`, 'Snoozes');

  // 10. Footer Call to Action
  ctx.fillStyle = '#C8A55E';
  ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('First Light: Prove You’re Up', 540, 1640);

  ctx.fillStyle = 'rgba(234, 230, 223, 0.6)';
  ctx.font = '400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Anti-Snooze · Morning Rituals · Offline Privacy', 540, 1685);

  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

function drawStatPill(ctx, x, y, w, h, val, label) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.strokeStyle = 'rgba(200, 165, 94, 0.25)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 42px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(val, x + w / 2, y + 68);

  ctx.fillStyle = '#C8A55E';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(label, x + w / 2, y + 115);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

export async function shareStoryCard(opts = {}) {
  try {
    toast('Creating your story card… 🎨', 2000);
    const blob = await createStoryCardBlob(opts);
    if (!blob) throw new Error('Blob creation failed');
    const file = new File([blob], 'first-light-morning.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Morning Proven with First Light 🌅',
        text: 'Morning proven with First Light!',
        files: [file]
      });
      toast('Shared successfully! 🎉');
      return;
    }

    // Fallback: download the image
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `first-light-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
    toast('Story image saved! 📸');
  } catch (e) {
    if (e.name !== 'AbortError') {
      toast('Couldn’t share card directly. Downloaded instead!');
    }
  }
}
