'use strict';

// ─── Shaders ─────────────────────────────────────────────────────────────────

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_TexCoord;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  varying vec2 v_TexCoord;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_TexCoord = a_TexCoord;
  }
`;

// u_whichTexture: -2 = solid color, 0 = grass texture, 1 = oak texture
// u_texColorWeight: 0.0 = pure base color, 1.0 = pure texture
const FSHADER_SOURCE = `
  precision mediump float;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform int       u_whichTexture;
  uniform float     u_texColorWeight;
  uniform vec4      u_baseColor;
  varying vec2 v_TexCoord;
  void main() {
    vec4 texColor;
    if (u_whichTexture == 0) {
      texColor = texture2D(u_Sampler0, v_TexCoord);
    } else if (u_whichTexture == 1) {
      texColor = texture2D(u_Sampler1, v_TexCoord);
    } else {
      texColor = u_baseColor;
    }
    gl_FragColor = mix(u_baseColor, texColor, u_texColorWeight);
  }
`;

// ─── WebGL globals ────────────────────────────────────────────────────────────

let gl, canvas;
let a_Position, a_TexCoord;
let u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_Sampler0, u_Sampler1, u_whichTexture, u_texColorWeight, u_baseColor;

// ─── Camera ───────────────────────────────────────────────────────────────────

let g_camera;

// ─── World map ────────────────────────────────────────────────────────────────
// Values: 0=empty, 1-4=grass wall height, 5-8=oak wall height (5=h1..8=h4), -1=water

let g_map = [];

function buildMap() {
  const M = Array.from({length: 32}, () => new Array(32).fill(0));

  // Border walls (grass h2)
  for (let i = 0; i < 32; i++) {
    M[0][i] = 2; M[31][i] = 2;
    M[i][0] = 2; M[i][31] = 2;
  }

  // River z=13..18, dock open at x=15,16
  for (let z = 13; z <= 18; z++) {
    for (let x = 1; x < 31; x++) M[z][x] = -1;
    M[z][15] = 0; M[z][16] = 0;
  }

  // ── Left bank structures ────────────────────────────────────────────────────
  // Farmhouse outline (oak h2): x=2..6, z=4..8, entrance at z=4,x=4
  for (let z = 4; z <= 8; z++) {
    for (let x = 2; x <= 6; x++) {
      if (z === 4 || z === 8 || x === 2 || x === 6) {
        if (!(z === 4 && x === 4)) M[z][x] = 6; // oak h2
      }
    }
  }

  // Animal pen (grass h1 fence): x=9..15, z=6..11, gate at z=6,x=12
  for (let z = 6; z <= 11; z++) {
    for (let x = 9; x <= 15; x++) {
      if (z === 6 || z === 11 || x === 9 || x === 15) {
        if (!(z === 6 && x === 12)) M[z][x] = 1;
      }
    }
  }

  // Trees on left bank
  M[2][25] = 3; M[2][27] = 2;
  M[9][25] = 3; M[5][25] = 4;
  M[10][3] = 3; M[11][6] = 2;

  // Dock wood posts (oak h1) beside the dock opening
  M[13][14] = 5; M[13][17] = 5;
  M[18][14] = 5; M[18][17] = 5;

  // ── Right bank structures ───────────────────────────────────────────────────
  // Barn (oak h3): x=22..28, z=22..27, entrance at z=22,x=25
  for (let z = 22; z <= 27; z++) {
    for (let x = 22; x <= 28; x++) {
      if (z === 22 || z === 27 || x === 22 || x === 28) {
        if (!(z === 22 && x === 25)) M[z][x] = 7; // oak h3
      }
    }
  }

  // Destination pen (grass h1): x=8..14, z=22..27, open at z=22,x=11
  for (let z = 22; z <= 27; z++) {
    for (let x = 8; x <= 14; x++) {
      if (z === 22 || z === 27 || x === 8 || x === 14) {
        if (!(z === 22 && x === 11)) M[z][x] = 1;
      }
    }
  }

  // Trees on right bank
  M[20][3] = 2; M[20][28] = 3;
  M[29][5] = 3; M[29][26] = 2;
  M[25][5] = 3; M[23][18] = 2;

  // Path markers along dock (left and right bank)
  M[12][15] = 1; M[12][16] = 1;
  M[19][15] = 1; M[19][16] = 1;

  return M;
}

// ─── GPU geometry buffers (built once, rebuilt on block change) ───────────────

let g_grassBuf = null, g_grassCount = 0;
let g_oakBuf   = null, g_oakCount   = 0;
let g_waterBuf = null, g_waterCount = 0;

// Generic VBO: one large cube for sky/entities drawn with model matrix
let g_unitCubeBuf = null;

// ─── Textures ─────────────────────────────────────────────────────────────────

let g_texturesLoaded = 0;
const TEXTURES_NEEDED = 2;

// ─── Input state ──────────────────────────────────────────────────────────────

const g_keys = {};
let g_pointerLocked = false;

// ─── FPS ──────────────────────────────────────────────────────────────────────

let g_lastTimestamp = 0;
let g_frameCount = 0, g_fpsTimer = 0;

// ─── Game state ───────────────────────────────────────────────────────────────

const SIDE = { LEFT: 0, RIGHT: 1 };
const ITEM = { WOLF: 0, GOAT: 1, CABBAGE: 2 };

// 3D world positions for each item on each bank
const ITEM_POS_LEFT  = [[10.5,0.5,8.5], [11.5,0.5,8.5], [12.5,0.5,8.5]];
const ITEM_POS_RIGHT = [[9.5,0.5,24.5], [10.5,0.5,24.5],[11.5,0.5,24.5]];
const ITEM_NAMES     = ['Wolf','Goat','Cabbage'];
const ITEM_COLORS    = [
  [0.25, 0.25, 0.25, 1], // wolf: dark gray
  [0.92, 0.88, 0.82, 1], // goat: off-white
  [0.18, 0.60, 0.18, 1], // cabbage: green
];

let g_itemSide     = [SIDE.LEFT, SIDE.LEFT, SIDE.LEFT];
let g_farmerSide   = SIDE.LEFT;
let g_farmerCarrying = null; // null or ITEM.*
let g_gameOver     = false;
let g_gameWon      = false;
let g_prevFarmerSide = SIDE.LEFT;

// ─── Bunny animation ──────────────────────────────────────────────────────────

let g_bunnyTime = 0;

// ─── Entry point ─────────────────────────────────────────────────────────────

function main() {
  canvas = document.getElementById('webgl');
  gl = WebGLUtils.setupWebGL(canvas, { alpha: false, depth: true, antialias: true });
  if (!gl) { alert('WebGL not supported'); return; }

  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) { alert('Shader error'); return; }

  // Uniform/attribute locations
  a_Position         = gl.getAttribLocation (gl.program, 'a_Position');
  a_TexCoord         = gl.getAttribLocation (gl.program, 'a_TexCoord');
  u_ModelMatrix      = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix       = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_Sampler0         = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1         = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_whichTexture     = gl.getUniformLocation(gl.program, 'u_whichTexture');
  u_texColorWeight   = gl.getUniformLocation(gl.program, 'u_texColorWeight');
  u_baseColor        = gl.getUniformLocation(gl.program, 'u_baseColor');

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.53, 0.81, 0.98, 1.0);

  // Bind texture samplers once
  gl.uniform1i(u_Sampler0, 0);
  gl.uniform1i(u_Sampler1, 1);

  // Build map and geometry
  g_map = buildMap();
  buildUnitCubeBuffer();
  rebuildWorldGeometry();

  // Camera: start on left bank, facing +z (toward river)
  g_camera = new Camera(canvas);
  g_camera.eye.elements[0] = 15.5;
  g_camera.eye.elements[1] = 1.6;
  g_camera.eye.elements[2] = 3.0;
  g_camera.at.elements[0]  = 15.5;
  g_camera.at.elements[1]  = 1.6;
  g_camera.at.elements[2]  = 4.0;
  g_camera.updateViewMatrix();

  // Textures (async — world renders as gray until loaded)
  loadTexture('../grass.webp', 0);
  loadTexture('../oak.webp',   1);

  // Input
  document.addEventListener('keydown', e => { g_keys[e.code] = true; });
  document.addEventListener('keyup',   e => { g_keys[e.code] = false; onKeyUp(e); });
  canvas.addEventListener('click', () => {
    if (!g_pointerLocked) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    g_pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Start button
  document.getElementById('click-to-start').addEventListener('click', () => {
    document.getElementById('click-to-start').style.display = 'none';
    canvas.requestPointerLock();
  });

  requestAnimationFrame(tick);
}

// ─── Animation loop ──────────────────────────────────────────────────────────

function tick(timestamp) {
  const delta = g_lastTimestamp ? Math.min((timestamp - g_lastTimestamp) / 1000, 0.1) : 0;
  g_lastTimestamp = timestamp;
  g_bunnyTime += delta;

  // FPS
  g_frameCount++;
  g_fpsTimer += delta;
  if (g_fpsTimer >= 1.0) {
    document.getElementById('fps').textContent = 'FPS: ' + g_frameCount;
    g_frameCount = 0; g_fpsTimer = 0;
  }

  if (!g_gameOver && !g_gameWon) {
    processKeys(delta);
    checkFarmerSide();
  }

  updateHUD();
  renderScene();
  requestAnimationFrame(tick);
}

// ─── Key processing ───────────────────────────────────────────────────────────

function processKeys(dt) {
  const speed = 5.0 * dt;
  const turn  = 60.0 * dt;
  if (g_keys['KeyW']) moveHorizontal( speed);
  if (g_keys['KeyS']) moveHorizontal(-speed);
  if (g_keys['KeyA']) strafeHorizontal(-speed);
  if (g_keys['KeyD']) strafeHorizontal( speed);
  if (g_keys['KeyQ']) g_camera.panLeft(turn);
  if (g_keys['KeyE']) g_camera.panRight(turn);

  // Keep eye on the ground (at.y is free for vertical mouse look)
  g_camera.eye.elements[1] = 1.6;
  g_camera.updateViewMatrix();
}

// Move forward/backward in the horizontal plane only
function moveHorizontal(speed) {
  const f = g_camera.getForward();
  f.elements[1] = 0;
  const len = Math.sqrt(f.elements[0]*f.elements[0] + f.elements[2]*f.elements[2]);
  if (len > 0.0001) { f.elements[0] /= len; f.elements[2] /= len; }
  f.mul(speed);
  g_camera.eye.add(f);
  g_camera.at.add(f);
  g_camera.updateViewMatrix();
}

// Strafe left/right in the horizontal plane only
function strafeHorizontal(speed) {
  const f = g_camera.getForward();
  f.elements[1] = 0;
  const len = Math.sqrt(f.elements[0]*f.elements[0] + f.elements[2]*f.elements[2]);
  if (len > 0.0001) { f.elements[0] /= len; f.elements[2] /= len; }
  const s = Vector3.cross(f, g_camera.up);
  s.normalize();
  s.mul(speed);
  g_camera.eye.add(s);
  g_camera.at.add(s);
  g_camera.updateViewMatrix();
}

function onKeyUp(e) {
  if (e.code === 'KeyF') tryPickup();
}

function onMouseMove(e) {
  if (!g_pointerLocked) return;
  const dx = e.movementX, dy = e.movementY;
  if (dx) g_camera.panLeft(-dx * 0.15);
  if (dy) g_camera.panVertical(-dy * 0.12);
}

function onMouseDown(e) {
  if (!g_pointerLocked) return;
  if (e.button === 0) deleteBlockInFront();
  if (e.button === 2) addBlockInFront();
}

// ─── Block add/delete ─────────────────────────────────────────────────────────

function getBlockInFront() {
  const fwd = g_camera.getForward().elements;
  const ex = g_camera.eye.elements[0], ez = g_camera.eye.elements[2];
  for (let t = 0.8; t <= 5.0; t += 0.1) {
    const mx = Math.floor(ex + fwd[0] * t);
    const mz = Math.floor(ez + fwd[2] * t);
    if (mx >= 0 && mx < 32 && mz >= 0 && mz < 32 && g_map[mz][mx] > 0) {
      return { x: mx, z: mz };
    }
  }
  return null;
}

function getEmptyInFront() {
  const fwd = g_camera.getForward().elements;
  const ex = g_camera.eye.elements[0], ez = g_camera.eye.elements[2];
  let prev = null;
  for (let t = 0.8; t <= 5.0; t += 0.1) {
    const mx = Math.floor(ex + fwd[0] * t);
    const mz = Math.floor(ez + fwd[2] * t);
    if (mx >= 0 && mx < 32 && mz >= 0 && mz < 32) {
      if (g_map[mz][mx] > 0) return prev;
      prev = { x: mx, z: mz };
    }
  }
  return null;
}

function deleteBlockInFront() {
  const b = getBlockInFront();
  if (!b) return;
  const v = g_map[b.z][b.x];
  if (v >= 1 && v <= 4) g_map[b.z][b.x] = v - 1;
  else if (v >= 5 && v <= 8) g_map[b.z][b.x] = v === 5 ? 0 : v - 1;
  rebuildWorldGeometry();
}

function addBlockInFront() {
  const b = getEmptyInFront();
  if (!b) {
    // Try adding on top of front block instead
    const front = getBlockInFront();
    if (!front) return;
    const v = g_map[front.z][front.x];
    if (v >= 1 && v <= 3) { g_map[front.z][front.x]++; rebuildWorldGeometry(); }
    return;
  }
  g_map[b.z][b.x] = 1; // add grass block
  rebuildWorldGeometry();
}

// ─── Game logic ───────────────────────────────────────────────────────────────

function tryPickup() {
  if (g_gameOver || g_gameWon) return;
  const ex = g_camera.eye.elements[0], ez = g_camera.eye.elements[2];
  const side = g_farmerSide;

  for (let i = 0; i < 3; i++) {
    if (g_itemSide[i] !== side) continue;
    const pos = side === SIDE.LEFT ? ITEM_POS_LEFT[i] : ITEM_POS_RIGHT[i];
    const dx = ex - pos[0], dz = ez - pos[2];
    if (Math.sqrt(dx*dx + dz*dz) < 2.2) {
      if (g_farmerCarrying === i) {
        // Put down
        g_farmerCarrying = null;
        showMessage('Put down ' + ITEM_NAMES[i]);
      } else if (g_farmerCarrying === null) {
        g_farmerCarrying = i;
        showMessage('Picked up ' + ITEM_NAMES[i]);
      } else {
        showMessage('Already carrying ' + ITEM_NAMES[g_farmerCarrying]);
      }
      return;
    }
  }
  showMessage('Nothing to pick up nearby');
}

function checkFarmerSide() {
  const z = g_camera.eye.elements[2];
  let newSide;
  if      (z < 13)  newSide = SIDE.LEFT;
  else if (z >= 19) newSide = SIDE.RIGHT;
  else return; // on dock, not committed yet

  if (newSide !== g_farmerSide) {
    g_farmerSide = newSide;
    // Auto-deposit carried item
    if (g_farmerCarrying !== null) {
      g_itemSide[g_farmerCarrying] = newSide;
      showMessage('Brought ' + ITEM_NAMES[g_farmerCarrying] + ' to ' +
                  (newSide === SIDE.LEFT ? 'Left Bank' : 'Right Bank'));
      g_farmerCarrying = null;
    }
    checkPuzzleConstraints();
  }
}

function checkPuzzleConstraints() {
  // Check the bank the farmer just LEFT
  const otherSide = g_farmerSide === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;
  const there = [0,1,2].filter(i => g_itemSide[i] === otherSide);

  const wolfThere   = there.includes(ITEM.WOLF);
  const goatThere   = there.includes(ITEM.GOAT);
  const cabbageThere= there.includes(ITEM.CABBAGE);

  if (wolfThere && goatThere) {
    endGame(false, 'The wolf ate the goat!');
    return;
  }
  if (goatThere && cabbageThere) {
    endGame(false, 'The goat ate the cabbage!');
    return;
  }

  // Win check: all items on RIGHT
  if (g_itemSide.every(s => s === SIDE.RIGHT) && g_farmerSide === SIDE.RIGHT) {
    endGame(true, 'You did it! All across safely!');
  }
}

function endGame(win, msg) {
  if (win) { g_gameWon = true; showMessage('🎉 ' + msg, 5000); }
  else      { g_gameOver = true; showMessage('💀 ' + msg + '  — Press R to restart', 0); }
  document.addEventListener('keydown', e => { if (e.code === 'KeyR') restartGame(); }, {once: true});
}

function restartGame() {
  g_itemSide     = [SIDE.LEFT, SIDE.LEFT, SIDE.LEFT];
  g_farmerSide   = SIDE.LEFT;
  g_farmerCarrying = null;
  g_gameOver     = false;
  g_gameWon      = false;
  g_camera.eye.elements[0] = 15.5;
  g_camera.eye.elements[2] = 3.0;
  g_camera.at.elements[0]  = 15.5;
  g_camera.at.elements[2]  = 4.0;
  g_camera.updateViewMatrix();
  hideMessage();
}

let g_msgTimer = null;
function showMessage(text, duration = 2500) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.style.display = 'block';
  if (g_msgTimer) clearTimeout(g_msgTimer);
  if (duration > 0) g_msgTimer = setTimeout(hideMessage, duration);
}
function hideMessage() {
  document.getElementById('message').style.display = 'none';
}

// ─── HUD update ───────────────────────────────────────────────────────────────

function updateHUD() {
  const e = g_camera.eye.elements;
  document.getElementById('pos').textContent =
    `Pos: (${e[0].toFixed(1)}, ${e[2].toFixed(1)})`;

  const carrying = g_farmerCarrying !== null ? ITEM_NAMES[g_farmerCarrying] : 'nothing';
  document.getElementById('carry').textContent = `Carrying: ${carrying}`;

  const leftItems  = [0,1,2].filter(i => g_itemSide[i] === SIDE.LEFT).map(i => ITEM_NAMES[i]);
  const rightItems = [0,1,2].filter(i => g_itemSide[i] === SIDE.RIGHT).map(i => ITEM_NAMES[i]);
  document.getElementById('left-bank').textContent  = 'Left:  ' + (leftItems.join(', ')  || 'empty');
  document.getElementById('right-bank').textContent = 'Right: ' + (rightItems.join(', ') || 'empty');
  const bankName = g_farmerSide === SIDE.LEFT ? 'Left Bank' : 'Right Bank';
  document.getElementById('farmer-info').textContent = 'Farmer: ' + bankName;
}

// ─── Textures ─────────────────────────────────────────────────────────────────

function loadTexture(src, unit) {
  const tex = gl.createTexture();
  const img = new Image();
  img.onload = () => {
    gl.activeTexture(unit === 0 ? gl.TEXTURE0 : gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    g_texturesLoaded++;
  };
  img.src = src;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

// Push a full unit cube at integer grid position (gx, gy, gz) into a JS array.
// Interleaved format: [x, y, z, u, v] per vertex, 36 vertices per cube.
function pushCube(arr, gx, gy, gz) {
  const x0=gx, x1=gx+1, y0=gy, y1=gy+1, z0=gz, z1=gz+1;
  // Front (+z)
  arr.push(x0,y0,z1,0,0, x1,y0,z1,1,0, x1,y1,z1,1,1,
           x0,y0,z1,0,0, x1,y1,z1,1,1, x0,y1,z1,0,1);
  // Back (-z)
  arr.push(x1,y0,z0,0,0, x0,y0,z0,1,0, x0,y1,z0,1,1,
           x1,y0,z0,0,0, x0,y1,z0,1,1, x1,y1,z0,0,1);
  // Right (+x)
  arr.push(x1,y0,z1,0,0, x1,y0,z0,1,0, x1,y1,z0,1,1,
           x1,y0,z1,0,0, x1,y1,z0,1,1, x1,y1,z1,0,1);
  // Left (-x)
  arr.push(x0,y0,z0,0,0, x0,y0,z1,1,0, x0,y1,z1,1,1,
           x0,y0,z0,0,0, x0,y1,z1,1,1, x0,y1,z0,0,1);
  // Top (+y)
  arr.push(x0,y1,z1,0,0, x1,y1,z1,1,0, x1,y1,z0,1,1,
           x0,y1,z1,0,0, x1,y1,z0,1,1, x0,y1,z0,0,1);
  // Bottom (-y)
  arr.push(x0,y0,z0,0,0, x1,y0,z0,1,0, x1,y0,z1,1,1,
           x0,y0,z0,0,0, x1,y0,z1,1,1, x0,y0,z1,0,1);
}

// Push only the top face of a cell (floor tile)
function pushTopFace(arr, gx, gy, gz) {
  const x0=gx, x1=gx+1, y1=gy+1, z0=gz, z1=gz+1;
  arr.push(x0,y1,z1,0,0, x1,y1,z1,1,0, x1,y1,z0,1,1,
           x0,y1,z1,0,0, x1,y1,z0,1,1, x0,y1,z0,0,1);
}

function uploadBuffer(arr) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
  return buf;
}

function rebuildWorldGeometry() {
  if (g_grassBuf) gl.deleteBuffer(g_grassBuf);
  if (g_oakBuf)   gl.deleteBuffer(g_oakBuf);
  if (g_waterBuf) gl.deleteBuffer(g_waterBuf);

  const grass = [], oak = [], water = [];

  for (let z = 0; z < 32; z++) {
    for (let x = 0; x < 32; x++) {
      const v = g_map[z][x];
      if (v === -1) {
        // water surface
        pushTopFace(water, x, -1, z);
      } else if (v === 0) {
        // grass floor tile
        pushTopFace(grass, x, -1, z);
      } else if (v >= 1 && v <= 4) {
        // grass wall (floor tile under + wall cubes)
        pushTopFace(grass, x, -1, z);
        for (let y = 0; y < v; y++) pushCube(grass, x, y, z);
      } else if (v >= 5 && v <= 8) {
        // oak wall
        pushTopFace(grass, x, -1, z);
        const h = v - 4;
        for (let y = 0; y < h; y++) pushCube(oak, x, y, z);
      }
    }
  }

  g_grassBuf = uploadBuffer(grass); g_grassCount = grass.length / 5;
  g_oakBuf   = uploadBuffer(oak);   g_oakCount   = oak.length / 5;
  g_waterBuf = uploadBuffer(water); g_waterCount = water.length / 5;
}

// A centered unit cube (−0.5..+0.5) for sky/entities
function buildUnitCubeBuffer() {
  const v = [];
  function q(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3) {
    v.push(x0,y0,z0,0,0, x1,y1,z1,1,0, x2,y2,z2,1,1,
           x0,y0,z0,0,0, x2,y2,z2,1,1, x3,y3,z3,0,1);
  }
  q(-0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5); // +z
  q( 0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5); // -z
  q( 0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5); // +x
  q(-0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5); // -x
  q(-0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5); // +y
  q(-0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5); // -y
  g_unitCubeBuf = uploadBuffer(v);
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

const IDENTITY = new Matrix4();

function bindVBO(buf) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const FSIZE = 4;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, FSIZE*5, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, FSIZE*5, FSIZE*3);
  gl.enableVertexAttribArray(a_TexCoord);
}

function setModel(M) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
}

function setColor(r, g2, b, a) {
  gl.uniform4f(u_baseColor, r, g2, b, a);
}

function useTexture(which, weight) {
  gl.uniform1i(u_whichTexture, which);
  gl.uniform1f(u_texColorWeight, weight);
}

function drawBatchedVBO(buf, count, texIndex) {
  if (count === 0) return;
  if (texIndex >= 0) {
    useTexture(texIndex, 1.0);
  } else {
    useTexture(-2, 0.0);
  }
  setModel(IDENTITY);
  bindVBO(buf);
  gl.drawArrays(gl.TRIANGLES, 0, count);
}

// Draw a colored unit cube centered at (cx,cy,cz) scaled by (sx,sy,sz)
function drawColorBox(cx, cy, cz, sx, sy, sz, r, g2, b, a) {
  const M = new Matrix4();
  M.setTranslate(cx, cy, cz);
  M.scale(sx, sy, sz);
  setModel(M);
  setColor(r, g2, b, a);
  useTexture(-2, 0.0);
  bindVBO(g_unitCubeBuf);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

// ─── Sky ──────────────────────────────────────────────────────────────────────

function drawSky() {
  const ey = g_camera.eye.elements;
  const M = new Matrix4();
  M.setTranslate(ey[0], ey[1], ey[2]);
  M.scale(900, 900, 900);
  setModel(M);
  setColor(0.53, 0.81, 0.98, 1.0);
  useTexture(-2, 0.0);
  bindVBO(g_unitCubeBuf);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

// ─── Entities ─────────────────────────────────────────────────────────────────

function drawEntity(i) {
  const side = g_itemSide[i];
  if (g_farmerCarrying === i) return; // carried — don't draw in world

  const pos = side === SIDE.LEFT ? ITEM_POS_LEFT[i] : ITEM_POS_RIGHT[i];
  const c = ITEM_COLORS[i];
  const cx = pos[0], cy = pos[1], cz = pos[2];

  if (i === ITEM.WOLF) {
    // Wolf: body + head
    drawColorBox(cx, cy + 0.3, cz, 0.8, 0.55, 0.7, ...c);
    drawColorBox(cx, cy + 0.75, cz + 0.2, 0.5, 0.45, 0.5, ...c);
    // ears
    drawColorBox(cx - 0.15, cy + 1.0, cz + 0.15, 0.12, 0.25, 0.12, ...c);
    drawColorBox(cx + 0.15, cy + 1.0, cz + 0.15, 0.12, 0.25, 0.12, ...c);
  } else if (i === ITEM.GOAT) {
    // Goat: body + head + horns
    drawColorBox(cx, cy + 0.35, cz, 0.75, 0.6, 0.65, ...c);
    drawColorBox(cx, cy + 0.8,  cz + 0.22, 0.45, 0.42, 0.45, ...c);
    drawColorBox(cx - 0.1, cy + 1.05, cz + 0.15, 0.06, 0.2, 0.06, ...c);
    drawColorBox(cx + 0.1, cy + 1.05, cz + 0.15, 0.06, 0.2, 0.06, ...c);
  } else {
    // Cabbage: green sphere-ish
    drawColorBox(cx, cy + 0.35, cz, 0.65, 0.65, 0.65, ...c);
    drawColorBox(cx, cy + 0.55, cz, 0.5,  0.3,  0.5,  0.22, 0.72, 0.22, 1);
  }
}

// ─── Bunny (from asgn2 adapted, static pose near farmhouse) ──────────────────

function drawBunny() {
  const t = g_bunnyTime;
  // Place bunny inside farmhouse area: x≈4, z≈6
  const bx = 4.5, by = 0.0, bz = 6.5;
  const hop = Math.sin(t * 3.5);
  const jumpY = Math.max(0, hop) * 0.06;

  const bodyColor = [0.58, 0.36, 0.13, 1];
  const innerEar  = [1.00, 0.76, 0.78, 1];
  const eyeColor  = [0.10, 0.05, 0.05, 1];
  const tailColor = [1.00, 1.00, 1.00, 1];

  const headAngle = hop * 7.0;
  const earAngle  = hop * 15.0;

  function bunnyBox(cx, cy, cz, sx, sy, sz, col) {
    drawColorBox(bx + cx, by + cy + jumpY, bz + cz, sx, sy, sz, ...col);
  }

  // Body
  bunnyBox(0, 0.35, 0, 0.50, 0.35, 0.50, bodyColor);
  // Head (simplified — no rotation in shader, just translated)
  const hx = 0, hy = 0.35 + 0.26 + Math.sin(headAngle * Math.PI/180) * 0.05, hz = 0.17;
  bunnyBox(hx, hy, hz, 0.32, 0.30, 0.32, bodyColor);
  // Eyes
  bunnyBox(hx - 0.10, hy + 0.06, hz + 0.225, 0.055, 0.055, 0.035, eyeColor);
  bunnyBox(hx + 0.10, hy + 0.06, hz + 0.225, 0.055, 0.055, 0.035, eyeColor);
  // Left ear
  const lEarY = hy + 0.15 + 0.14;
  bunnyBox(hx - 0.10 - earAngle*0.001, lEarY, hz, 0.08, 0.28, 0.05, bodyColor);
  bunnyBox(hx - 0.10 - earAngle*0.001, lEarY, hz + 0.018, 0.052, 0.22, 0.02, innerEar);
  // Right ear
  bunnyBox(hx + 0.10 + earAngle*0.001, lEarY, hz, 0.08, 0.28, 0.05, bodyColor);
  bunnyBox(hx + 0.10 + earAngle*0.001, lEarY, hz + 0.018, 0.052, 0.22, 0.02, innerEar);
  // Tail
  bunnyBox(0, 0.15 + 0.35, -0.32, 0.14, 0.14, 0.14, tailColor);
  // Front legs
  const legSwing = hop * 0.06;
  bunnyBox(-0.19, 0.08, 0.16 + legSwing, 0.12, 0.10, 0.20, bodyColor);
  bunnyBox( 0.19, 0.08, 0.16 + legSwing, 0.12, 0.10, 0.20, bodyColor);
  // Back legs
  bunnyBox(-0.15, 0.00, -0.14 - legSwing, 0.19, 0.14, 0.28, bodyColor);
  bunnyBox( 0.15, 0.00, -0.14 - legSwing, 0.19, 0.14, 0.28, bodyColor);
}

// ─── Scene render ─────────────────────────────────────────────────────────────

function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Upload camera matrices
  gl.uniformMatrix4fv(u_ViewMatrix,       false, g_camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);

  // Sky (draw first, disable depth write so it's always behind geometry)
  gl.depthMask(false);
  drawSky();
  gl.depthMask(true);

  // Grass world geometry (texture 0)
  if (g_texturesLoaded === TEXTURES_NEEDED) {
    drawBatchedVBO(g_grassBuf, g_grassCount, 0);
    drawBatchedVBO(g_oakBuf,   g_oakCount,   1);
  } else {
    // Before textures load: draw as gray color
    setColor(0.6, 0.6, 0.6, 1.0);
    useTexture(-2, 0.0);
    setModel(IDENTITY);
    bindVBO(g_grassBuf);
    gl.drawArrays(gl.TRIANGLES, 0, g_grassCount);
  }

  // Water (solid blue)
  setColor(0.18, 0.45, 0.85, 1.0);
  useTexture(-2, 0.0);
  setModel(IDENTITY);
  bindVBO(g_waterBuf);
  gl.drawArrays(gl.TRIANGLES, 0, g_waterCount);

  // Entities (wolf, goat, cabbage)
  for (let i = 0; i < 3; i++) drawEntity(i);

  // Bunny in farmhouse area
  drawBunny();
}
