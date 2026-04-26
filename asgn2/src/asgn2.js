'use strict';

// ─── Shaders ────────────────────────────────────────────────────────────────
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotation;
  void main() {
    gl_Position = u_GlobalRotation * u_ModelMatrix * a_Position;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// ─── WebGL globals ───────────────────────────────────────────────────────────
let gl, canvas;
let a_Position, u_FragColor, u_ModelMatrix, u_GlobalRotation;

// ─── Global rotation (slider + mouse) ───────────────────────────────────────
let g_globalAngleX = 20;
let g_globalAngleY = -25;

// ─── Joint angles ────────────────────────────────────────────────────────────
let g_headAngle    = 0;
let g_lEarAngle    = 0;
let g_rEarAngle    = 0;

let g_flUpperAngle = 0;  // front-left upper
let g_flLowerAngle = 0;  // front-left lower
let g_flPawAngle   = 0;  // front-left paw

let g_frUpperAngle = 0;
let g_frLowerAngle = 0;
let g_frPawAngle   = 0;

let g_blUpperAngle = 0;  // back-left upper
let g_blLowerAngle = 0;

let g_brUpperAngle = 0;
let g_brLowerAngle = 0;

// ─── Animation state ─────────────────────────────────────────────────────────
let g_animating        = false;
let g_time             = 0;
let g_lastTimestamp    = 0;

let g_poking           = false;
let g_pokeStartTime    = 0;
let g_pokeWasAnimating = false;
let g_jumpY            = 0;   // vertical offset applied to entire body during jump

// ─── Performance tracking ────────────────────────────────────────────────────
let g_frameCount   = 0;
let g_fpsLastTime  = 0;

// ─── Mouse tracking ──────────────────────────────────────────────────────────
let g_mouseDown  = false;
let g_lastMouseX = 0;
let g_lastMouseY = 0;

// ─── Pre-allocated GPU buffers (uploaded once) ───────────────────────────────
let g_cubeBuffer = null;
let g_cylBuffer  = null;
let g_cylVertCount = 0;

// Unit cube: 36 vertices (6 faces × 2 triangles × 3 verts), centered at origin
const CUBE_VERTS = new Float32Array([
  // Front
  -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5,
  -0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  // Back
   0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,
   0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,
  // Top
  -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5,
  -0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5,
  // Bottom
  -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5,
  -0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5,
  // Right
   0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,
   0.5,-0.5, 0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
  // Left
  -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5,
  -0.5,-0.5,-0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5,
]);

function buildCylinderVerts(segs) {
  const verts = [];
  for (let i = 0; i < segs; i++) {
    const a1 = (i       / segs) * 2 * Math.PI;
    const a2 = ((i + 1) / segs) * 2 * Math.PI;
    const x1 = Math.cos(a1), z1 = Math.sin(a1);
    const x2 = Math.cos(a2), z2 = Math.sin(a2);
    // Side quad
    verts.push(x1,-0.5,z1, x2,-0.5,z2, x2,0.5,z2);
    verts.push(x1,-0.5,z1, x2,0.5,z2, x1,0.5,z1);
    // Top cap
    verts.push(0,0.5,0, x1,0.5,z1, x2,0.5,z2);
    // Bottom cap
    verts.push(0,-0.5,0, x2,-0.5,z2, x1,-0.5,z1);
  }
  return new Float32Array(verts);
}

// ─── Entry point ─────────────────────────────────────────────────────────────
function main() {
  canvas = document.getElementById('webgl');
  gl = getWebGLContext(canvas);
  if (!gl) { alert('WebGL not supported'); return; }

  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    alert('Shader init failed'); return;
  }

  a_Position       = gl.getAttribLocation (gl.program, 'a_Position');
  u_FragColor      = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix    = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_GlobalRotation = gl.getUniformLocation(gl.program, 'u_GlobalRotation');

  // Upload cube vertices once
  g_cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTS, gl.STATIC_DRAW);

  // Upload cylinder vertices once
  const cylVerts = buildCylinderVerts(16);
  g_cylVertCount  = cylVerts.length / 3;
  g_cylBuffer     = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cylBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cylVerts, gl.STATIC_DRAW);

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.82, 0.91, 0.98, 1.0);

  // Mouse input
  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    () => { g_mouseDown = false; });
  canvas.addEventListener('mouseleave', () => { g_mouseDown = false; });
  canvas.addEventListener('click',      onCanvasClick);

  renderScene();
  requestAnimationFrame(tick);
}

// ─── Animation loop ──────────────────────────────────────────────────────────
function tick(timestamp) {
  const delta = g_lastTimestamp === 0 ? 0 : (timestamp - g_lastTimestamp) / 1000.0;
  g_lastTimestamp = timestamp;

  if (g_animating) {
    g_time += delta;
    updateAnimationAngles();
  }

  // FPS counter (updates once per second)
  g_frameCount++;
  if (timestamp - g_fpsLastTime >= 1000) {
    const fps = Math.round(g_frameCount * 1000 / (timestamp - g_fpsLastTime));
    document.getElementById('perf').textContent = 'FPS: ' + fps;
    g_frameCount  = 0;
    g_fpsLastTime = timestamp;
  }

  renderScene();
  requestAnimationFrame(tick);
}

// ─── Animation angle updater ─────────────────────────────────────────────────
function updateAnimationAngles() {
  const t = g_time;

  // Poke animation: full jump for 2.0s
  if (g_poking) {
    const elapsed = t - g_pokeStartTime;
    const DUR = 2.0;
    if (elapsed < DUR) {
      const p = elapsed / DUR;

      if (p < 0.12) {
        // Crouch – coil the legs
        const cp = p / 0.12;
        g_jumpY        = -0.04 * cp;
        g_headAngle    = -12 * cp;
        g_lEarAngle    = -18 * cp;
        g_rEarAngle    =  18 * cp;
        g_flUpperAngle =  22 * cp;
        g_frUpperAngle =  22 * cp;
        g_flLowerAngle = -32 * cp;
        g_frLowerAngle = -32 * cp;
        g_flPawAngle   =  10 * cp;
        g_frPawAngle   =  10 * cp;
        g_blUpperAngle = -28 * cp;
        g_brUpperAngle = -28 * cp;
        g_blLowerAngle =  28 * cp;
        g_brLowerAngle =  28 * cp;
      } else if (p < 0.50) {
        // Rising – body lifts, legs tuck
        const rp = (p - 0.12) / (0.50 - 0.12);
        const h  = Math.sin(rp * Math.PI / 2);
        g_jumpY        =  0.42 * h;
        g_headAngle    =  12 * h;
        g_lEarAngle    = -38 * h;
        g_rEarAngle    =  38 * h;
        g_flUpperAngle = -38 * h;
        g_frUpperAngle = -38 * h;
        g_flLowerAngle = -48 * h;
        g_frLowerAngle = -48 * h;
        g_flPawAngle   = -15 * h;
        g_frPawAngle   = -15 * h;
        g_blUpperAngle = -42 * h;
        g_brUpperAngle = -42 * h;
        g_blLowerAngle = -32 * h;
        g_brLowerAngle = -32 * h;
      } else if (p < 0.80) {
        // Falling – body drops, legs extend for landing
        const fp = (p - 0.50) / (0.80 - 0.50);
        const h  = Math.cos(fp * Math.PI / 2);
        g_jumpY        =  0.42 * h;
        g_headAngle    = -8 * (1 - h);
        g_lEarAngle    = -38 * h;
        g_rEarAngle    =  38 * h;
        g_flUpperAngle = -38 * h;
        g_frUpperAngle = -38 * h;
        g_flLowerAngle = -48 * h;
        g_frLowerAngle = -48 * h;
        g_flPawAngle   = -15 * h;
        g_frPawAngle   = -15 * h;
        g_blUpperAngle = -42 * h;
        g_brUpperAngle = -42 * h;
        g_blLowerAngle = -32 * h;
        g_brLowerAngle = -32 * h;
      } else {
        // Landing bounce – settle back to rest
        const bp   = (p - 0.80) / (1.0 - 0.80);
        const fade = 1 - bp;
        g_jumpY        = Math.sin(bp * Math.PI * 3) * fade * 0.05;
        g_headAngle    = -8  * fade;
        g_lEarAngle    =  Math.sin(bp * Math.PI * 2) * 12 * fade;
        g_rEarAngle    = -Math.sin(bp * Math.PI * 2) * 12 * fade;
        g_flUpperAngle =  18 * fade;
        g_frUpperAngle =  18 * fade;
        g_flLowerAngle = -22 * fade;
        g_frLowerAngle = -22 * fade;
        g_flPawAngle   =   8 * fade;
        g_frPawAngle   =   8 * fade;
        g_blUpperAngle = -12 * fade;
        g_brUpperAngle = -12 * fade;
        g_blLowerAngle = -18 * fade;
        g_brLowerAngle = -18 * fade;
      }
      return;
    }
    // Poke finished – clean up
    g_poking = false;
    g_jumpY  = 0;
    if (!g_pokeWasAnimating) {
      g_animating = false;
      document.getElementById('animBtn').textContent = 'Start Animation';
      syncSlidersFromAngles();
      return;
    }
  }

  // Hopping animation – all four legs move in sync
  const hop = Math.sin(t * 3.5);

  // Body rises on each hop (only goes up, never dips below rest)
  g_jumpY = Math.max(0, hop) * 0.09;

  g_headAngle = hop * 7.0;

  // Ears stream back as bunny launches, settle forward on landing
  g_lEarAngle = -hop * 15.0;
  g_rEarAngle =  hop * 15.0;

  // Both front legs swing forward together
  g_flUpperAngle = hop * 26.0;
  g_frUpperAngle = hop * 26.0;
  g_flLowerAngle = (hop - 1.0) * 18.0;
  g_frLowerAngle = (hop - 1.0) * 18.0;
  g_flPawAngle   = hop * 10.0;
  g_frPawAngle   = hop * 10.0;

  // Both back legs push off together (opposite phase to front)
  g_blUpperAngle = -hop * 30.0;
  g_brUpperAngle = -hop * 30.0;
  g_blLowerAngle = (hop + 1.0) * (-20.0);
  g_brLowerAngle = (hop + 1.0) * (-20.0);
}

// ─── Scene renderer ──────────────────────────────────────────────────────────
function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Build and upload global rotation matrix
  const globalRot = new Matrix4();
  globalRot.rotate(g_globalAngleX, 1, 0, 0);
  globalRot.rotate(g_globalAngleY, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotation, false, globalRot.elements);

  // ── Body ──────────────────────────────────────────────────────────────────
  // bodyM is the "root" of the entire hierarchy
  const bodyM = new Matrix4();
  bodyM.translate(0, g_jumpY, 0);
  drawCube(new Matrix4(bodyM).scale(0.50, 0.35, 0.50),
           [0.58, 0.36, 0.13, 1]);

  // ── Head ──────────────────────────────────────────────────────────────────
  // Pivot at base of head (top-front of body)
  const headM = new Matrix4(bodyM);
  headM.translate(0, 0.26, 0.17);
  headM.rotate(g_headAngle, 1, 0, 0);
  drawCube(new Matrix4(headM).scale(0.32, 0.30, 0.32),
           [0.58, 0.36, 0.13, 1]);

  // Eyes
  drawCube(new Matrix4(headM).translate(-0.10, 0.06, 0.20).scale(0.055, 0.055, 0.03),
           [0.10, 0.05, 0.05, 1]);
  drawCube(new Matrix4(headM).translate( 0.10, 0.06, 0.20).scale(0.055, 0.055, 0.03),
           [0.10, 0.05, 0.05, 1]);

  // Nose – cylinder (non-cube primitive), pivot into head
  drawCylinder(
    new Matrix4(headM).translate(0, -0.04, 0.17).rotate(90, 1, 0, 0).scale(0.055, 0.04, 0.055),
    [1.00, 0.50, 0.55, 1]
  );

  // ── Left ear ──────────────────────────────────────────────────────────────
  // Pivot at bottom of ear (top of head, left side)
  const lEarUpM = new Matrix4(headM);
  lEarUpM.translate(-0.10, 0.15, 0.0);
  lEarUpM.rotate(g_lEarAngle, 0, 0, 1);
  // Outer ear
  drawCube(new Matrix4(lEarUpM).translate(0, 0.14, 0).scale(0.08, 0.28, 0.05),
           [0.58, 0.36, 0.13, 1]);
  // Inner pink
  drawCube(new Matrix4(lEarUpM).translate(0, 0.14, 0.018).scale(0.052, 0.22, 0.02),
           [1.00, 0.76, 0.78, 1]);

  // Lower ear section – pivot at top of upper ear
  const lEarLoM = new Matrix4(lEarUpM);
  lEarLoM.translate(0, 0.28, 0);
  lEarLoM.rotate(g_lEarAngle * 0.35, 0, 0, 1);
  drawCube(new Matrix4(lEarLoM).translate(0, 0.09, 0).scale(0.065, 0.18, 0.045),
           [0.58, 0.36, 0.13, 1]);

  // ── Right ear ─────────────────────────────────────────────────────────────
  const rEarUpM = new Matrix4(headM);
  rEarUpM.translate(0.10, 0.15, 0.0);
  rEarUpM.rotate(g_rEarAngle, 0, 0, 1);
  drawCube(new Matrix4(rEarUpM).translate(0, 0.14, 0).scale(0.08, 0.28, 0.05),
           [0.58, 0.36, 0.13, 1]);
  drawCube(new Matrix4(rEarUpM).translate(0, 0.14, 0.018).scale(0.052, 0.22, 0.02),
           [1.00, 0.76, 0.78, 1]);

  const rEarLoM = new Matrix4(rEarUpM);
  rEarLoM.translate(0, 0.28, 0);
  rEarLoM.rotate(g_rEarAngle * 0.35, 0, 0, 1);
  drawCube(new Matrix4(rEarLoM).translate(0, 0.09, 0).scale(0.065, 0.18, 0.045),
           [0.58, 0.36, 0.13, 1]);

  // ── Tail – cylinder ───────────────────────────────────────────────────────
  drawCylinder(
    new Matrix4(bodyM).translate(0, 0.17, -0.20).scale(0.14, 0.14, 0.14),
    [1.00, 1.00, 1.00, 1]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Leg helper: pivot is at TOP of upper leg (attachment on body bottom)
  //   drawCube shifts the cube DOWN so its top is at the pivot.
  // ─────────────────────────────────────────────────────────────────────────

  // ── Front-left leg ────────────────────────────────────────────────────────
  const flUpM = new Matrix4(bodyM);
  flUpM.translate(-0.185, -0.175, 0.17);
  flUpM.rotate(g_flUpperAngle, 1, 0, 0);
  drawCube(new Matrix4(flUpM).translate(0, -0.10, 0).scale(0.110, 0.20, 0.110),
           [0.52, 0.32, 0.11, 1]);

  const flLoM = new Matrix4(flUpM);
  flLoM.translate(0, -0.20, 0);
  flLoM.rotate(g_flLowerAngle, 1, 0, 0);
  drawCube(new Matrix4(flLoM).translate(0, -0.085, 0).scale(0.095, 0.17, 0.095),
           [0.52, 0.32, 0.11, 1]);

  const flPawM = new Matrix4(flLoM);
  flPawM.translate(0, -0.17, 0);
  flPawM.rotate(g_flPawAngle, 1, 0, 0);
  drawCube(new Matrix4(flPawM).translate(0, -0.028, 0.04).scale(0.115, 0.055, 0.165),
           [0.48, 0.28, 0.09, 1]);

  // ── Front-right leg ───────────────────────────────────────────────────────
  const frUpM = new Matrix4(bodyM);
  frUpM.translate(0.185, -0.175, 0.17);
  frUpM.rotate(g_frUpperAngle, 1, 0, 0);
  drawCube(new Matrix4(frUpM).translate(0, -0.10, 0).scale(0.110, 0.20, 0.110),
           [0.52, 0.32, 0.11, 1]);

  const frLoM = new Matrix4(frUpM);
  frLoM.translate(0, -0.20, 0);
  frLoM.rotate(g_frLowerAngle, 1, 0, 0);
  drawCube(new Matrix4(frLoM).translate(0, -0.085, 0).scale(0.095, 0.17, 0.095),
           [0.52, 0.32, 0.11, 1]);

  const frPawM = new Matrix4(frLoM);
  frPawM.translate(0, -0.17, 0);
  frPawM.rotate(g_frPawAngle, 1, 0, 0);
  drawCube(new Matrix4(frPawM).translate(0, -0.028, 0.04).scale(0.115, 0.055, 0.165),
           [0.48, 0.28, 0.09, 1]);

  // ── Back-left leg ─────────────────────────────────────────────────────────
  const blUpM = new Matrix4(bodyM);
  blUpM.translate(-0.185, -0.175, -0.17);
  blUpM.rotate(g_blUpperAngle, 1, 0, 0);
  drawCube(new Matrix4(blUpM).translate(0, -0.11, 0).scale(0.120, 0.22, 0.120),
           [0.52, 0.32, 0.11, 1]);

  const blLoM = new Matrix4(blUpM);
  blLoM.translate(0, -0.22, 0);
  blLoM.rotate(g_blLowerAngle, 1, 0, 0);
  drawCube(new Matrix4(blLoM).translate(0, -0.09, 0).scale(0.100, 0.18, 0.100),
           [0.52, 0.32, 0.11, 1]);
  // Back paw (no independent slider, follows lower leg)
  drawCube(new Matrix4(blLoM).translate(0, -0.18, 0.07).scale(0.115, 0.055, 0.175),
           [0.48, 0.28, 0.09, 1]);

  // ── Back-right leg ────────────────────────────────────────────────────────
  const brUpM = new Matrix4(bodyM);
  brUpM.translate(0.185, -0.175, -0.17);
  brUpM.rotate(g_brUpperAngle, 1, 0, 0);
  drawCube(new Matrix4(brUpM).translate(0, -0.11, 0).scale(0.120, 0.22, 0.120),
           [0.52, 0.32, 0.11, 1]);

  const brLoM = new Matrix4(brUpM);
  brLoM.translate(0, -0.22, 0);
  brLoM.rotate(g_brLowerAngle, 1, 0, 0);
  drawCube(new Matrix4(brLoM).translate(0, -0.09, 0).scale(0.100, 0.18, 0.100),
           [0.52, 0.32, 0.11, 1]);
  drawCube(new Matrix4(brLoM).translate(0, -0.18, 0.07).scale(0.115, 0.055, 0.175),
           [0.48, 0.28, 0.09, 1]);
}

// ─── Draw primitives ─────────────────────────────────────────────────────────

function drawCube(M, color) {
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function drawCylinder(M, color) {
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cylBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, g_cylVertCount);
}

// ─── UI callbacks ────────────────────────────────────────────────────────────

function updateSliders() {
  // Global rotation always applies
  g_globalAngleX = parseFloat(document.getElementById('gRotX').value);
  g_globalAngleY = parseFloat(document.getElementById('gRotY').value);
  document.getElementById('gRotXVal').textContent = g_globalAngleX;
  document.getElementById('gRotYVal').textContent = g_globalAngleY;

  // Joint angles only take effect when not animating
  if (!g_animating) {
    g_headAngle    = parseFloat(document.getElementById('headSlider').value);
    g_lEarAngle    = parseFloat(document.getElementById('lEarSlider').value);
    g_rEarAngle    = parseFloat(document.getElementById('rEarSlider').value);
    g_flUpperAngle = parseFloat(document.getElementById('flUpperSlider').value);
    g_flLowerAngle = parseFloat(document.getElementById('flLowerSlider').value);
    g_flPawAngle   = parseFloat(document.getElementById('flPawSlider').value);
    g_frUpperAngle = parseFloat(document.getElementById('frUpperSlider').value);
    g_frLowerAngle = parseFloat(document.getElementById('frLowerSlider').value);
    g_frPawAngle   = parseFloat(document.getElementById('frPawSlider').value);
    g_blUpperAngle = parseFloat(document.getElementById('blUpperSlider').value);
    g_blLowerAngle = parseFloat(document.getElementById('blLowerSlider').value);
    g_brUpperAngle = parseFloat(document.getElementById('brUpperSlider').value);
    g_brLowerAngle = parseFloat(document.getElementById('brLowerSlider').value);
  }

  // Always update display labels
  document.getElementById('headVal').textContent    = document.getElementById('headSlider').value;
  document.getElementById('lEarVal').textContent    = document.getElementById('lEarSlider').value;
  document.getElementById('rEarVal').textContent    = document.getElementById('rEarSlider').value;
  document.getElementById('flUpperVal').textContent = document.getElementById('flUpperSlider').value;
  document.getElementById('flLowerVal').textContent = document.getElementById('flLowerSlider').value;
  document.getElementById('flPawVal').textContent   = document.getElementById('flPawSlider').value;
  document.getElementById('frUpperVal').textContent = document.getElementById('frUpperSlider').value;
  document.getElementById('frLowerVal').textContent = document.getElementById('frLowerSlider').value;
  document.getElementById('frPawVal').textContent   = document.getElementById('frPawSlider').value;
  document.getElementById('blUpperVal').textContent = document.getElementById('blUpperSlider').value;
  document.getElementById('blLowerVal').textContent = document.getElementById('blLowerSlider').value;
  document.getElementById('brUpperVal').textContent = document.getElementById('brUpperSlider').value;
  document.getElementById('brLowerVal').textContent = document.getElementById('brLowerSlider').value;
}

function syncSlidersFromAngles() {
  document.getElementById('headSlider').value    = g_headAngle;
  document.getElementById('lEarSlider').value    = g_lEarAngle;
  document.getElementById('rEarSlider').value    = g_rEarAngle;
  document.getElementById('flUpperSlider').value = g_flUpperAngle;
  document.getElementById('flLowerSlider').value = g_flLowerAngle;
  document.getElementById('flPawSlider').value   = g_flPawAngle;
  document.getElementById('frUpperSlider').value = g_frUpperAngle;
  document.getElementById('frLowerSlider').value = g_frLowerAngle;
  document.getElementById('frPawSlider').value   = g_frPawAngle;
  document.getElementById('blUpperSlider').value = g_blUpperAngle;
  document.getElementById('blLowerSlider').value = g_blLowerAngle;
  document.getElementById('brUpperSlider').value = g_brUpperAngle;
  document.getElementById('brLowerSlider').value = g_brLowerAngle;

  document.getElementById('headVal').textContent    = Math.round(g_headAngle);
  document.getElementById('lEarVal').textContent    = Math.round(g_lEarAngle);
  document.getElementById('rEarVal').textContent    = Math.round(g_rEarAngle);
  document.getElementById('flUpperVal').textContent = Math.round(g_flUpperAngle);
  document.getElementById('flLowerVal').textContent = Math.round(g_flLowerAngle);
  document.getElementById('flPawVal').textContent   = Math.round(g_flPawAngle);
  document.getElementById('frUpperVal').textContent = Math.round(g_frUpperAngle);
  document.getElementById('frLowerVal').textContent = Math.round(g_frLowerAngle);
  document.getElementById('frPawVal').textContent   = Math.round(g_frPawAngle);
  document.getElementById('blUpperVal').textContent = Math.round(g_blUpperAngle);
  document.getElementById('blLowerVal').textContent = Math.round(g_blLowerAngle);
  document.getElementById('brUpperVal').textContent = Math.round(g_brUpperAngle);
  document.getElementById('brLowerVal').textContent = Math.round(g_brLowerAngle);
}

function toggleAnimation() {
  g_animating = !g_animating;
  document.getElementById('animBtn').textContent = g_animating ? 'Stop Animation' : 'Start Animation';
  if (!g_animating) {
    g_jumpY = 0;
    syncSlidersFromAngles();
  }
}

// ─── Mouse handlers ───────────────────────────────────────────────────────────

function onMouseDown(e) {
  if (e.shiftKey) return;
  g_mouseDown  = true;
  g_lastMouseX = e.clientX;
  g_lastMouseY = e.clientY;
}

function onMouseMove(e) {
  if (!g_mouseDown || e.shiftKey) return;
  const dx = e.clientX - g_lastMouseX;
  const dy = e.clientY - g_lastMouseY;
  g_globalAngleY += dx * 0.5;
  g_globalAngleX += dy * 0.5;
  g_lastMouseX = e.clientX;
  g_lastMouseY = e.clientY;
  // Keep sliders in sync
  document.getElementById('gRotY').value = Math.max(-180, Math.min(180, g_globalAngleY));
  document.getElementById('gRotX').value = Math.max(-180, Math.min(180, g_globalAngleX));
  document.getElementById('gRotYVal').textContent = Math.round(g_globalAngleY);
  document.getElementById('gRotXVal').textContent = Math.round(g_globalAngleX);
}

function onCanvasClick(e) {
  if (!e.shiftKey) return;
  g_poking           = true;
  g_pokeStartTime    = g_time;
  g_pokeWasAnimating = g_animating;
  if (!g_animating) {
    g_animating = true;
    document.getElementById('animBtn').textContent = 'Stop Animation';
  }
}
