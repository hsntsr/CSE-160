'use strict';

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

let gl, canvas;
let a_Position, a_TexCoord;
let u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_Sampler0, u_Sampler1, u_whichTexture, u_texColorWeight, u_baseColor;

let g_camera;

const g_map = [
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,2,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,1,1,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,2],
  [2,0,0,3,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,2,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,0,0,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2],
  [2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2],
  [2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2],
  [2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2],
  [2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2],
  [2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,0,0,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,1,1,1,0,1,1,1,0,0,0,0,0,0,0,7,7,7,0,7,7,7,0,0,2],
  [2,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,7,0,0,0,0,0,7,0,0,2],
  [2,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,7,0,0,0,0,0,7,0,0,2],
  [2,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,7,0,0,0,0,0,7,0,0,2],
  [2,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,7,0,0,0,0,0,7,0,0,2],
  [2,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,7,7,7,7,7,7,7,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2]
];

let g_grassSidesBuf = null, g_grassSidesCount = 0;
let g_grassTopsBuf  = null, g_grassTopsCount  = 0;
let g_oakBuf        = null, g_oakCount        = 0;
let g_waterBuf      = null, g_waterCount      = 0;

let g_unitCubeBuf = null;

let g_texturesLoaded = 0;
const TEXTURES_NEEDED = 2;

const g_keys = {};
let g_pointerLocked = false;

let g_lastTimestamp = 0;
let g_frameCount = 0, g_fpsTimer = 0;

const SIDE = { LEFT: 0, RIGHT: 1 };
const ITEM = { WOLF: 0, GOAT: 1, CABBAGE: 2 };

const ITEM_POS_LEFT  = [[10.5,0.5,7.5], [12.5,0.5,9.5], [14.5,0.5,7.5]];
const ITEM_POS_RIGHT = [[ 9.5,0.5,23.5],[11.5,0.5,25.5],[13.5,0.5,23.5]];
const ITEM_NAMES     = ['Wolf','Goat','Cabbage'];
const ITEM_COLORS    = [
  [0.25, 0.25, 0.25, 1],
  [0.92, 0.88, 0.82, 1],
  [0.18, 0.60, 0.18, 1],
];

let g_itemSide       = [SIDE.LEFT, SIDE.LEFT, SIDE.LEFT];
let g_farmerSide     = SIDE.LEFT;
let g_farmerCarrying = null;
let g_gameOver       = false;
let g_gameWon        = false;
let g_prevFarmerSide = SIDE.LEFT;

let g_bunnyTime      = 0;
let g_bunnyX         = 15.5;
let g_bunnyZ         = 14.5;
let g_bunnyAngle     = 0;
let g_bunnyTurnTimer = 0;

function main() {
  canvas = document.getElementById('webgl');
  gl = WebGLUtils.setupWebGL(canvas, { alpha: false, depth: true, antialias: true });
  if (!gl) { alert('WebGL not supported'); return; }

  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) { alert('Shader error'); return; }

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

  gl.uniform1i(u_Sampler0, 0);
  gl.uniform1i(u_Sampler1, 1);

  buildUnitCubeBuffer();
  rebuildWorldGeometry();

  g_camera = new Camera(canvas);
  g_camera.eye.elements[0] = 15.5;
  g_camera.eye.elements[1] = 1.6;
  g_camera.eye.elements[2] = 3.0;
  g_camera.at.elements[0]  = 15.5;
  g_camera.at.elements[1]  = 1.6;
  g_camera.at.elements[2]  = 4.0;
  g_camera.updateViewMatrix();

  loadTexture('../grass.png', 0);
  loadTexture('../oak.png',   1);

  document.addEventListener('keydown', e => {
    g_keys[e.code] = true;
    if (e.code === 'KeyR' && (g_gameOver || g_gameWon)) restartGame();
    if (e.code === 'KeyH') toggleHint();
  });
  document.addEventListener('keyup', e => { g_keys[e.code] = false; onKeyUp(e); });
  canvas.addEventListener('click', () => {
    if (!g_pointerLocked) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    g_pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  document.getElementById('click-to-start').addEventListener('click', () => {
    document.getElementById('click-to-start').style.display = 'none';
    canvas.requestPointerLock();
  });

  requestAnimationFrame(tick);
}

function tick(timestamp) {
  const delta = g_lastTimestamp ? Math.min((timestamp - g_lastTimestamp) / 1000, 0.1) : 0;
  g_lastTimestamp = timestamp;
  g_bunnyTime += delta;
  updateBunnyWander(delta);

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

function processKeys(dt) {
  const speed = 5.0 * dt;
  const turn  = 60.0 * dt;
  if (g_keys['KeyW']) moveHorizontal( speed);
  if (g_keys['KeyS']) moveHorizontal(-speed);
  if (g_keys['KeyA']) strafeHorizontal(-speed);
  if (g_keys['KeyD']) strafeHorizontal( speed);
  if (g_keys['KeyQ']) g_camera.panLeft(turn);
  if (g_keys['KeyE']) g_camera.panRight(turn);

  g_camera.eye.elements[1] = 1.6;
  g_camera.updateViewMatrix();
}

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
    const front = getBlockInFront();
    if (!front) return;
    const v = g_map[front.z][front.x];
    if (v >= 1 && v <= 3) { g_map[front.z][front.x]++; rebuildWorldGeometry(); }
    return;
  }
  g_map[b.z][b.x] = 1;
  rebuildWorldGeometry();
}

function tryPickup() {
  if (g_gameOver || g_gameWon) return;
  const ex = g_camera.eye.elements[0], ez = g_camera.eye.elements[2];
  const side = g_farmerSide;

  for (let i = 0; i < 3; i++) {
    if (g_itemSide[i] !== side) continue;
    const pos = side === SIDE.LEFT ? ITEM_POS_LEFT[i] : ITEM_POS_RIGHT[i];
    const dx = ex - pos[0], dz = ez - pos[2];
    if (Math.sqrt(dx*dx + dz*dz) < 1.5) {
      if (g_farmerCarrying === i) {
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
  else return;

  if (newSide !== g_farmerSide) {
    g_farmerSide = newSide;
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
  const otherSide = g_farmerSide === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;
  const there = [0,1,2].filter(i => g_itemSide[i] === otherSide);

  const wolfThere    = there.includes(ITEM.WOLF);
  const goatThere    = there.includes(ITEM.GOAT);
  const cabbageThere = there.includes(ITEM.CABBAGE);

  if (wolfThere && goatThere) { endGame(false, 'The wolf ate the goat!'); return; }
  if (goatThere && cabbageThere) { endGame(false, 'The goat ate the cabbage!'); return; }

  if (g_itemSide.every(s => s === SIDE.RIGHT) && g_farmerSide === SIDE.RIGHT) {
    endGame(true, 'You did it! All across safely!');
  }
}

function endGame(win, msg) {
  if (win) { g_gameWon  = true; showMessage('You did it! All across safely! Press R to restart', 5000); }
  else     { g_gameOver = true; showMessage(msg + '  Press R to restart', 0); }
}

function restartGame() {
  g_itemSide       = [SIDE.LEFT, SIDE.LEFT, SIDE.LEFT];
  g_farmerSide     = SIDE.LEFT;
  g_farmerCarrying = null;
  g_gameOver       = false;
  g_gameWon        = false;
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
  document.getElementById('farmer-info').textContent =
    'Farmer: ' + (g_farmerSide === SIDE.LEFT ? 'Left Bank' : 'Right Bank');
}

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

function toggleHint() {
  const p = document.getElementById('hint-panel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function pushCube(arr, gx, gy, gz) {
  const x0=gx, x1=gx+1, y0=gy, y1=gy+1, z0=gz, z1=gz+1;
  arr.push(x0,y0,z1,0,0, x1,y0,z1,1,0, x1,y1,z1,1,1,
           x0,y0,z1,0,0, x1,y1,z1,1,1, x0,y1,z1,0,1);
  arr.push(x1,y0,z0,0,0, x0,y0,z0,1,0, x0,y1,z0,1,1,
           x1,y0,z0,0,0, x0,y1,z0,1,1, x1,y1,z0,0,1);
  arr.push(x1,y0,z1,0,0, x1,y0,z0,1,0, x1,y1,z0,1,1,
           x1,y0,z1,0,0, x1,y1,z0,1,1, x1,y1,z1,0,1);
  arr.push(x0,y0,z0,0,0, x0,y0,z1,1,0, x0,y1,z1,1,1,
           x0,y0,z0,0,0, x0,y1,z1,1,1, x0,y1,z0,0,1);
  arr.push(x0,y1,z1,0,0, x1,y1,z1,1,0, x1,y1,z0,1,1,
           x0,y1,z1,0,0, x1,y1,z0,1,1, x0,y1,z0,0,1);
  arr.push(x0,y0,z0,0,0, x1,y0,z0,1,0, x1,y0,z1,1,1,
           x0,y0,z0,0,0, x1,y0,z1,1,1, x0,y0,z1,0,1);
}

function pushCubeSides(arr, gx, gy, gz) {
  const x0=gx, x1=gx+1, y0=gy, y1=gy+1, z0=gz, z1=gz+1;
  arr.push(x0,y0,z1,0,0, x1,y0,z1,1,0, x1,y1,z1,1,1,
           x0,y0,z1,0,0, x1,y1,z1,1,1, x0,y1,z1,0,1);
  arr.push(x1,y0,z0,0,0, x0,y0,z0,1,0, x0,y1,z0,1,1,
           x1,y0,z0,0,0, x0,y1,z0,1,1, x1,y1,z0,0,1);
  arr.push(x1,y0,z1,0,0, x1,y0,z0,1,0, x1,y1,z0,1,1,
           x1,y0,z1,0,0, x1,y1,z0,1,1, x1,y1,z1,0,1);
  arr.push(x0,y0,z0,0,0, x0,y0,z1,1,0, x0,y1,z1,1,1,
           x0,y0,z0,0,0, x0,y1,z1,1,1, x0,y1,z0,0,1);
  arr.push(x0,y0,z0,0,0, x1,y0,z0,1,0, x1,y0,z1,1,1,
           x0,y0,z0,0,0, x1,y0,z1,1,1, x0,y0,z1,0,1);
}

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
  if (g_grassSidesBuf) gl.deleteBuffer(g_grassSidesBuf);
  if (g_grassTopsBuf)  gl.deleteBuffer(g_grassTopsBuf);
  if (g_oakBuf)        gl.deleteBuffer(g_oakBuf);
  if (g_waterBuf)      gl.deleteBuffer(g_waterBuf);

  const grassSides = [], grassTops = [], oak = [], water = [];

  for (let z = 0; z < 32; z++) {
    for (let x = 0; x < 32; x++) {
      const v = g_map[z][x];
      if (v === -1) {
        pushTopFace(water, x, -1, z);
      } else if (v === 0) {
        pushTopFace(grassTops, x, -1, z);
      } else if (v >= 1 && v <= 4) {
        for (let y = 0; y < v; y++) pushCubeSides(grassSides, x, y, z);
        pushTopFace(grassTops, x, v - 1, z);
      } else if (v >= 5 && v <= 8) {
        const h = v - 4;
        for (let y = 0; y < h; y++) pushCube(oak, x, y, z);
      }
    }
  }

  g_grassSidesBuf = uploadBuffer(grassSides); g_grassSidesCount = grassSides.length / 5;
  g_grassTopsBuf  = uploadBuffer(grassTops);  g_grassTopsCount  = grassTops.length  / 5;
  g_oakBuf        = uploadBuffer(oak);        g_oakCount        = oak.length        / 5;
  g_waterBuf      = uploadBuffer(water);      g_waterCount      = water.length      / 5;
}

function snapshotMap() {
  let out = 'const g_map = [\n';
  for (let z = 0; z < 32; z++) {
    out += '  [' + g_map[z].join(',') + ']' + (z < 31 ? ',' : '') + '\n';
  }
  out += '];';
  console.log(out);
  const ta = document.getElementById('snapshot-output');
  ta.value = out;
  ta.style.display = ta.style.display === 'none' ? 'block' : 'none';
}

function buildUnitCubeBuffer() {
  const v = [];
  function q(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3) {
    v.push(x0,y0,z0,0,0, x1,y1,z1,1,0, x2,y2,z2,1,1,
           x0,y0,z0,0,0, x2,y2,z2,1,1, x3,y3,z3,0,1);
  }
  q(-0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5);
  q( 0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5);
  q( 0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5);
  q(-0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5);
  q(-0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5);
  q(-0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5);
  g_unitCubeBuf = uploadBuffer(v);
}

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

function drawEntity(i) {
  if (g_farmerCarrying === i) return;

  const side = g_itemSide[i];
  const pos = side === SIDE.LEFT ? ITEM_POS_LEFT[i] : ITEM_POS_RIGHT[i];
  const c = ITEM_COLORS[i];
  const cx = pos[0], cy = pos[1], cz = pos[2];

  if (i === ITEM.WOLF) {
    drawColorBox(cx, cy + 0.3,  cz,        0.8,  0.55, 0.7,  ...c);
    drawColorBox(cx, cy + 0.75, cz + 0.2,  0.5,  0.45, 0.5,  ...c);
    drawColorBox(cx - 0.15, cy + 1.0, cz + 0.15, 0.12, 0.25, 0.12, ...c);
    drawColorBox(cx + 0.15, cy + 1.0, cz + 0.15, 0.12, 0.25, 0.12, ...c);
  } else if (i === ITEM.GOAT) {
    drawColorBox(cx, cy + 0.35, cz,         0.75, 0.6,  0.65, ...c);
    drawColorBox(cx, cy + 0.8,  cz + 0.22,  0.45, 0.42, 0.45, ...c);
    drawColorBox(cx - 0.1, cy + 1.05, cz + 0.15, 0.06, 0.2, 0.06, ...c);
    drawColorBox(cx + 0.1, cy + 1.05, cz + 0.15, 0.06, 0.2, 0.06, ...c);
  } else {
    drawColorBox(cx, cy + 0.35, cz, 0.65, 0.65, 0.65, ...c);
    drawColorBox(cx, cy + 0.55, cz, 0.5,  0.3,  0.5,  0.22, 0.72, 0.22, 1);
  }
}

function updateBunnyWander(dt) {
  g_bunnyTurnTimer -= dt;
  if (g_bunnyTurnTimer <= 0) {
    g_bunnyAngle = Math.random() * Math.PI * 2;
    g_bunnyTurnTimer = 1.5 + Math.random() * 2.5;
  }

  const nx = g_bunnyX + Math.sin(g_bunnyAngle) * 1.2 * dt;
  const nz = g_bunnyZ + Math.cos(g_bunnyAngle) * 1.2 * dt;
  const mx = Math.floor(nx), mz = Math.floor(nz);

  const inBounds = nx >= 1.3 && nx < 30.7 && nz >= 1.3 && nz < 30.7;
  const cellFree = mx >= 0 && mx < 32 && mz >= 0 && mz < 32 && g_map[mz][mx] === 0;

  if (inBounds && cellFree) {
    g_bunnyX = nx;
    g_bunnyZ = nz;
  } else {
    g_bunnyAngle += Math.PI + (Math.random() - 0.5) * Math.PI;
    g_bunnyTurnTimer = 1.0 + Math.random() * 1.0;
  }
}

function drawBunny() {
  const t = g_bunnyTime;
  const bx = g_bunnyX, by = 0.0, bz = g_bunnyZ;
  const cosA = Math.cos(g_bunnyAngle), sinA = Math.sin(g_bunnyAngle);

  const hop    = Math.sin(t * 3.5);
  const jumpY  = Math.max(0, hop) * 0.06;

  const bodyColor = [0.58, 0.36, 0.13, 1];
  const innerEar  = [1.00, 0.76, 0.78, 1];
  const eyeColor  = [0.10, 0.05, 0.05, 1];
  const tailColor = [1.00, 1.00, 1.00, 1];

  const headAngle = hop * 7.0;
  const earAngle  = hop * 15.0;

  function bunnyBox(cx, cy, cz, sx, sy, sz, col) {
    const rx = cx * cosA - cz * sinA;
    const rz = cx * sinA + cz * cosA;
    drawColorBox(bx + rx, by + cy + jumpY, bz + rz, sx, sy, sz, ...col);
  }

  bunnyBox(0, 0.35, 0, 0.50, 0.35, 0.50, bodyColor);
  const hx = 0, hy = 0.35 + 0.26 + Math.sin(headAngle * Math.PI/180) * 0.05, hz = 0.17;
  bunnyBox(hx, hy, hz, 0.32, 0.30, 0.32, bodyColor);
  bunnyBox(hx - 0.10, hy + 0.06, hz + 0.225, 0.055, 0.055, 0.035, eyeColor);
  bunnyBox(hx + 0.10, hy + 0.06, hz + 0.225, 0.055, 0.055, 0.035, eyeColor);
  const lEarY = hy + 0.15 + 0.14;
  bunnyBox(hx - 0.10 - earAngle*0.001, lEarY, hz,       0.08,  0.28, 0.05, bodyColor);
  bunnyBox(hx - 0.10 - earAngle*0.001, lEarY, hz+0.018, 0.052, 0.22, 0.02, innerEar);
  bunnyBox(hx + 0.10 + earAngle*0.001, lEarY, hz,       0.08,  0.28, 0.05, bodyColor);
  bunnyBox(hx + 0.10 + earAngle*0.001, lEarY, hz+0.018, 0.052, 0.22, 0.02, innerEar);
  bunnyBox(0, 0.50, -0.32, 0.14, 0.14, 0.14, tailColor);
  const legSwing = hop * 0.06;
  bunnyBox(-0.19, 0.08,  0.16 + legSwing,  0.12, 0.10, 0.20, bodyColor);
  bunnyBox( 0.19, 0.08,  0.16 + legSwing,  0.12, 0.10, 0.20, bodyColor);
  bunnyBox(-0.15, 0.00, -0.14 - legSwing,  0.19, 0.14, 0.28, bodyColor);
  bunnyBox( 0.15, 0.00, -0.14 - legSwing,  0.19, 0.14, 0.28, bodyColor);
}

function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_ViewMatrix,       false, g_camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);

  gl.depthMask(false);
  drawSky();
  gl.depthMask(true);

  if (g_texturesLoaded === TEXTURES_NEEDED) {
    drawBatchedVBO(g_grassSidesBuf, g_grassSidesCount, 0);
    drawBatchedVBO(g_oakBuf,        g_oakCount,        1);
  } else {
    setColor(0.6, 0.6, 0.6, 1.0);
    useTexture(-2, 0.0);
    setModel(IDENTITY);
    bindVBO(g_grassSidesBuf);
    gl.drawArrays(gl.TRIANGLES, 0, g_grassSidesCount);
  }

  setColor(0.28, 0.68, 0.14, 1.0);
  useTexture(-2, 0.0);
  setModel(IDENTITY);
  bindVBO(g_grassTopsBuf);
  gl.drawArrays(gl.TRIANGLES, 0, g_grassTopsCount);

  setColor(0.18, 0.45, 0.85, 1.0);
  useTexture(-2, 0.0);
  setModel(IDENTITY);
  bindVBO(g_waterBuf);
  gl.drawArrays(gl.TRIANGLES, 0, g_waterCount);

  for (let i = 0; i < 3; i++) drawEntity(i);

  drawBunny();
}
