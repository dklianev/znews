/**
 * flappyBird.js — Pure logic / constants for Flappy Bird game.
 * CEF 103 safe — no modern APIs, all canvas 2D compatible.
 */

/* ---------- Canvas dimensions ---------- */
export const CANVAS_W = 320;
export const CANVAS_H = 480;

/* ---------- Bird ---------- */
export const BIRD_X = 80;
export const BIRD_W = 30;
export const BIRD_H = 24;
export const GRAVITY = 0.35;
export const FLAP_VELOCITY = -6.5;
export const MAX_FALL_SPEED = 8;

/* ---------- Pipes ---------- */
export const PIPE_W = 50;
export const PIPE_GAP = 130;
export const PIPE_SPEED = 2.2;
export const PIPE_SPAWN_INTERVAL = 100; // frames between pipe spawns
export const PIPE_MIN_TOP = 50;

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
  bird: '#f5c842',
  birdWing: '#e6a817',
  birdEye: '#ffffff',
  birdPupil: '#1C1428',
  birdBeak: '#ff6f00',
};

/* ---------- Helper functions ---------- */

export function createBird() {
  return {
    y: PLAYABLE_H / 2,
    velocity: 0,
    rotation: 0,
  };
}

export function createPipe(frameCount) {
  const maxTop = PLAYABLE_H - PIPE_GAP - PIPE_MIN_TOP;
  const topHeight = PIPE_MIN_TOP + Math.floor(Math.random() * (maxTop - PIPE_MIN_TOP));
  return {
    x: CANVAS_W + 10,
    topHeight,
    bottomY: topHeight + PIPE_GAP,
    scored: false,
    id: frameCount,
  };
}

export function updateBird(bird) {
  const newVel = Math.min(bird.velocity + GRAVITY, MAX_FALL_SPEED);
  const newY = bird.y + newVel;
  // Rotation: tilt up on flap, tilt down when falling
  const targetRot = newVel < 0 ? -25 : Math.min(newVel * 6, 70);
  const rotation = bird.rotation + (targetRot - bird.rotation) * 0.15;
  return { y: newY, velocity: newVel, rotation };
}

export function flapBird(bird) {
  return { ...bird, velocity: FLAP_VELOCITY, rotation: -25 };
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

  // Pipes (use slightly smaller hitbox for fairness)
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

export function drawBackground(ctx) {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, PLAYABLE_H);
  grad.addColorStop(0, COLORS.sky);
  grad.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, PLAYABLE_H);
}

export function drawGround(ctx, offset) {
  // Ground body
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, PLAYABLE_H, CANVAS_W, GROUND_H);

  // Ground top stripe
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
  const capH = 20;
  const capOverhang = 4;

  // Top pipe body
  ctx.fillStyle = COLORS.pipe;
  ctx.fillRect(pipe.x + 2, 0, PIPE_W - 4, pipe.topHeight - capH);
  // Top pipe edge lines
  ctx.fillStyle = COLORS.pipeEdge;
  ctx.fillRect(pipe.x + 2, 0, 3, pipe.topHeight - capH);
  ctx.fillRect(pipe.x + PIPE_W - 5, 0, 3, pipe.topHeight - capH);
  // Top pipe cap
  ctx.fillStyle = COLORS.pipeCap;
  ctx.fillRect(pipe.x - capOverhang, pipe.topHeight - capH, PIPE_W + capOverhang * 2, capH);
  ctx.fillStyle = COLORS.pipeCapEdge;
  ctx.strokeStyle = COLORS.pipeCapEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(pipe.x - capOverhang, pipe.topHeight - capH, PIPE_W + capOverhang * 2, capH);

  // Bottom pipe body
  ctx.fillStyle = COLORS.pipe;
  ctx.fillRect(pipe.x + 2, pipe.bottomY + capH, PIPE_W - 4, PLAYABLE_H - pipe.bottomY - capH);
  // Bottom pipe edge lines
  ctx.fillStyle = COLORS.pipeEdge;
  ctx.fillRect(pipe.x + 2, pipe.bottomY + capH, 3, PLAYABLE_H - pipe.bottomY - capH);
  ctx.fillRect(pipe.x + PIPE_W - 5, pipe.bottomY + capH, 3, PLAYABLE_H - pipe.bottomY - capH);
  // Bottom pipe cap
  ctx.fillStyle = COLORS.pipeCap;
  ctx.fillRect(pipe.x - capOverhang, pipe.bottomY, PIPE_W + capOverhang * 2, capH);
  ctx.strokeStyle = COLORS.pipeCapEdge;
  ctx.strokeRect(pipe.x - capOverhang, pipe.bottomY, PIPE_W + capOverhang * 2, capH);
}

export function drawBird(ctx, bird) {
  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate((bird.rotation * Math.PI) / 180);

  // Body
  ctx.fillStyle = COLORS.bird;
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing
  ctx.fillStyle = COLORS.birdWing;
  ctx.beginPath();
  ctx.ellipse(-4, 3, 10, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Eye (white)
  ctx.fillStyle = COLORS.birdEye;
  ctx.beginPath();
  ctx.arc(8, -4, 5, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = COLORS.birdPupil;
  ctx.beginPath();
  ctx.arc(10, -4, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = COLORS.birdBeak;
  ctx.beginPath();
  ctx.moveTo(13, -1);
  ctx.lineTo(20, 2);
  ctx.lineTo(13, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function drawScore(ctx, score) {
  ctx.save();
  ctx.font = 'bold 40px "Oswald", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1C1428';
  ctx.lineWidth = 4;
  ctx.strokeText(String(score), CANVAS_W / 2, 55);
  ctx.fillText(String(score), CANVAS_W / 2, 55);
  ctx.restore();
}
