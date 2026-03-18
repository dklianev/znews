/**
 * flappyBird.js — Pure logic / constants for Flappy Bird game.
 * Physics tuned to closely match the original Flappy Bird feel.
 * CEF 103 safe — no modern APIs, all canvas 2D compatible.
 */

/* ---------- Canvas dimensions ---------- */
export const CANVAS_W = 320;
export const CANVAS_H = 480;

/* ---------- Bird ---------- */
export const BIRD_X = 70;
export const BIRD_W = 28;
export const BIRD_H = 22;
export const GRAVITY = 0.45;
export const FLAP_VELOCITY = -7;
export const MAX_FALL_SPEED = 10;

/* ---------- Pipes ---------- */
export const PIPE_W = 48;
export const PIPE_GAP = 125;
export const PIPE_SPEED = 2;
export const PIPE_SPAWN_INTERVAL = 95; // frames between pipe spawns
export const PIPE_MIN_TOP = 55;

/* ---------- Ground ---------- */
export const GROUND_H = 60;
export const PLAYABLE_H = CANVAS_H - GROUND_H;

/* ---------- Colors ---------- */
export const COLORS = {
  sky: '#70c5ce',
  skyBottom: '#d4f1f9',
  ground: '#ded895',
  groundStripe: '#d2c76a',
  groundDark: '#8b7e2e',
  pipe: '#73bf2e',
  pipeEdge: '#558b2f',
  pipeCap: '#8bc34a',
  pipeCapEdge: '#558b2f',
  pipeHighlight: '#a0d468',
  bird: '#f5c842',
  birdWing: '#e6a817',
  birdEye: '#ffffff',
  birdPupil: '#1C1428',
  birdBeak: '#ff6f00',
};

/* ---------- Helper functions ---------- */

export function createBird() {
  return {
    y: PLAYABLE_H / 2 - 20,
    velocity: 0,
    rotation: 0,
    wingPhase: 0,
    alive: true,
  };
}

export function createPipe(_frameCount) {
  const maxTop = PLAYABLE_H - PIPE_GAP - PIPE_MIN_TOP;
  const topHeight = PIPE_MIN_TOP + Math.floor(Math.random() * (maxTop - PIPE_MIN_TOP));
  return {
    x: CANVAS_W + 10,
    topHeight,
    bottomY: topHeight + PIPE_GAP,
    scored: false,
  };
}

export function updateBird(bird) {
  const newVel = Math.min(bird.velocity + GRAVITY, MAX_FALL_SPEED);
  const newY = bird.y + newVel;

  // Rotation — snappy like original:
  // Rising: quickly tilt to -30°
  // Falling: slowly rotate to 90° (nose-dive)
  let rotation;
  if (newVel < -2) {
    // Strong upward — snap to -30°
    rotation = -30;
  } else if (newVel < 0) {
    // Slowing rise — interpolate toward 0
    rotation = bird.rotation + (0 - bird.rotation) * 0.15;
  } else if (newVel > 1.5) {
    // Falling — gradually nose-dive toward 90° (like original)
    rotation = Math.min(bird.rotation + 2.5, 90);
  } else {
    // Hovering at peak — drift toward level
    rotation = bird.rotation + (0 - bird.rotation) * 0.1;
  }

  // Wing flap cycle
  const wingPhase = (bird.wingPhase || 0) + 0.2;
  return { ...bird, y: newY, velocity: newVel, rotation, wingPhase };
}

/** Death fall — bird tumbles down after dying (like original). */
export function updateDeadBird(bird) {
  const newVel = Math.min(bird.velocity + GRAVITY, MAX_FALL_SPEED);
  const newY = bird.y + newVel;
  const rotation = Math.min(bird.rotation + 4, 90);
  // Stop at ground
  if (newY >= PLAYABLE_H - BIRD_H / 2) {
    return { ...bird, y: PLAYABLE_H - BIRD_H / 2, velocity: 0, rotation: 90, alive: false };
  }
  return { ...bird, y: newY, velocity: newVel, rotation, alive: true };
}

export function flapBird(bird) {
  return { ...bird, velocity: FLAP_VELOCITY, rotation: -30 };
}

export function updatePipes(pipes) {
  return pipes
    .map((p) => ({ ...p, x: p.x - PIPE_SPEED }))
    .filter((p) => p.x + PIPE_W > -10);
}

export function checkCollision(bird, pipes) {
  const birdTop = bird.y - BIRD_H / 2;
  const birdBottom = bird.y + BIRD_H / 2;
  const birdLeft = BIRD_X - BIRD_W / 2;
  const birdRight = BIRD_X + BIRD_W / 2;

  // Ground or ceiling
  if (birdBottom >= PLAYABLE_H || birdTop <= 0) return true;

  // Pipes (slightly forgiving hitbox)
  const margin = 3;
  for (const pipe of pipes) {
    const pipeLeft = pipe.x + margin;
    const pipeRight = pipe.x + PIPE_W - margin;

    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      if (birdTop + margin < pipe.topHeight || birdBottom - margin > pipe.bottomY) {
        return true;
      }
    }
  }

  return false;
}

export function checkScore(bird, pipes) {
  let scored = 0;
  const updated = pipes.map((p) => {
    if (!p.scored && p.x + PIPE_W < BIRD_X) {
      scored += 1;
      return { ...p, scored: true };
    }
    return p;
  });
  return { pipes: updated, scored };
}

/* ---------- Drawing helpers ---------- */

export function drawBackground(ctx, groundOffset) {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, PLAYABLE_H);
  grad.addColorStop(0, COLORS.sky);
  grad.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, PLAYABLE_H);

  // Clouds (parallax — move slower than pipes)
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const cloudOffset = (groundOffset || 0) * 0.25;
  const clouds = [
    { x: 40, y: 55, w: 60, h: 20 },
    { x: 180, y: 30, w: 50, h: 16 },
    { x: 280, y: 75, w: 45, h: 14 },
    { x: 120, y: 105, w: 55, h: 18 },
    { x: 350, y: 50, w: 42, h: 15 },
  ];
  for (const c of clouds) {
    const cx = ((c.x - cloudOffset % 450) + 450) % 450 - 50;
    ctx.beginPath();
    ctx.ellipse(cx, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - c.w * 0.25, c.y + 3, c.w * 0.3, c.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + c.w * 0.25, c.y + 2, c.w * 0.35, c.h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGround(ctx, offset) {
  // Ground body
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, PLAYABLE_H, CANVAS_W, GROUND_H);

  // Ground top edge
  ctx.fillStyle = COLORS.groundDark;
  ctx.fillRect(0, PLAYABLE_H, CANVAS_W, 3);

  // Scrolling stripes
  ctx.fillStyle = COLORS.groundStripe;
  const stripeW = 24;
  const startX = -(offset % stripeW);
  for (let x = startX; x < CANVAS_W; x += stripeW) {
    ctx.fillRect(x, PLAYABLE_H + 6, stripeW / 2, 4);
  }
}

export function drawPipe(ctx, pipe) {
  const capH = 22;
  const capOverhang = 4;

  // --- Top pipe ---
  // Body
  ctx.fillStyle = COLORS.pipe;
  ctx.fillRect(pipe.x + 2, 0, PIPE_W - 4, pipe.topHeight - capH);
  // Highlight stripe (3D effect like original)
  ctx.fillStyle = COLORS.pipeHighlight;
  ctx.fillRect(pipe.x + 5, 0, 6, pipe.topHeight - capH);
  // Edge lines
  ctx.fillStyle = COLORS.pipeEdge;
  ctx.fillRect(pipe.x + 2, 0, 2, pipe.topHeight - capH);
  ctx.fillRect(pipe.x + PIPE_W - 4, 0, 2, pipe.topHeight - capH);
  // Cap
  ctx.fillStyle = COLORS.pipeCap;
  ctx.fillRect(pipe.x - capOverhang, pipe.topHeight - capH, PIPE_W + capOverhang * 2, capH);
  ctx.fillStyle = COLORS.pipeHighlight;
  ctx.fillRect(pipe.x - capOverhang + 3, pipe.topHeight - capH + 2, 6, capH - 4);
  ctx.strokeStyle = COLORS.pipeCapEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(pipe.x - capOverhang, pipe.topHeight - capH, PIPE_W + capOverhang * 2, capH);

  // --- Bottom pipe ---
  // Body
  ctx.fillStyle = COLORS.pipe;
  ctx.fillRect(pipe.x + 2, pipe.bottomY + capH, PIPE_W - 4, PLAYABLE_H - pipe.bottomY - capH);
  // Highlight stripe
  ctx.fillStyle = COLORS.pipeHighlight;
  ctx.fillRect(pipe.x + 5, pipe.bottomY + capH, 6, PLAYABLE_H - pipe.bottomY - capH);
  // Edge lines
  ctx.fillStyle = COLORS.pipeEdge;
  ctx.fillRect(pipe.x + 2, pipe.bottomY + capH, 2, PLAYABLE_H - pipe.bottomY - capH);
  ctx.fillRect(pipe.x + PIPE_W - 4, pipe.bottomY + capH, 2, PLAYABLE_H - pipe.bottomY - capH);
  // Cap
  ctx.fillStyle = COLORS.pipeCap;
  ctx.fillRect(pipe.x - capOverhang, pipe.bottomY, PIPE_W + capOverhang * 2, capH);
  ctx.fillStyle = COLORS.pipeHighlight;
  ctx.fillRect(pipe.x - capOverhang + 3, pipe.bottomY + 2, 6, capH - 4);
  ctx.strokeStyle = COLORS.pipeCapEdge;
  ctx.strokeRect(pipe.x - capOverhang, pipe.bottomY, PIPE_W + capOverhang * 2, capH);
}

export function drawBird(ctx, bird) {
  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate((bird.rotation * Math.PI) / 180);

  // Body shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(1, 2, BIRD_W / 2 + 1, BIRD_H / 2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = COLORS.bird;
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body outline
  ctx.strokeStyle = '#c8a030';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Body highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(-2, -4, BIRD_W / 3, BIRD_H / 4, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Wing (animated flap)
  const wingY = Math.sin(bird.wingPhase || 0) * 5;
  ctx.fillStyle = COLORS.birdWing;
  ctx.beginPath();
  ctx.ellipse(-3, 3 + wingY, 10, 6, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c08a10';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(-3, 3 + wingY, 10, 6, -0.15, 0, Math.PI * 2);
  ctx.stroke();

  // Eye (white)
  ctx.fillStyle = COLORS.birdEye;
  ctx.beginPath();
  ctx.arc(7, -4, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(7, -4, 5.5, 0, Math.PI * 2);
  ctx.stroke();

  // Pupil
  ctx.fillStyle = COLORS.birdPupil;
  ctx.beginPath();
  ctx.arc(9, -3.5, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Eye glint
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(8, -5.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Beak (two-tone)
  ctx.fillStyle = '#ff8f00';
  ctx.beginPath();
  ctx.moveTo(12, -2);
  ctx.lineTo(21, 1);
  ctx.lineTo(12, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.birdBeak;
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(21, 1);
  ctx.lineTo(12, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function drawScore(ctx, score) {
  ctx.save();
  ctx.font = 'bold 42px "Oswald", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1C1428';
  ctx.lineWidth = 5;
  ctx.strokeText(String(score), CANVAS_W / 2, 55);
  ctx.fillText(String(score), CANVAS_W / 2, 55);
  ctx.restore();
}

/** Draw "Get Ready" idle screen elements. */
export function drawGetReady(ctx, frameCount) {
  ctx.save();
  // Title
  ctx.font = 'bold 28px "Oswald", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1C1428';
  ctx.lineWidth = 4;
  const titleY = 130;
  ctx.strokeText('ПРИГОТВИ СЕ!', CANVAS_W / 2, titleY);
  ctx.fillText('ПРИГОТВИ СЕ!', CANVAS_W / 2, titleY);

  // Tap instruction (pulsing)
  const alpha = 0.5 + Math.sin(frameCount * 0.08) * 0.3;
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 16px "Oswald", sans-serif';
  ctx.strokeStyle = '#1C1428';
  ctx.lineWidth = 3;
  ctx.strokeText('Натисни SPACE или кликни', CANVAS_W / 2, CANVAS_H / 2 + 70);
  ctx.fillText('Натисни SPACE или кликни', CANVAS_W / 2, CANVAS_H / 2 + 70);
  ctx.restore();
}
