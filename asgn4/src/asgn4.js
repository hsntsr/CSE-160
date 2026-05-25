'use strict';

// ─── Shaders ────────────────────────────────────────────────────────────────
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_TexCoord;
  attribute vec3 a_Normal;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;

  varying vec2  v_TexCoord;
  varying vec3  v_Normal;
  varying vec3  v_WorldPos;

  void main() {
    vec4 wp = u_ModelMatrix * a_Position;
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * wp;
    v_TexCoord  = a_TexCoord;
    v_Normal    = normalize(mat3(u_ModelMatrix) * a_Normal);
    v_WorldPos  = wp.xyz;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;

  uniform sampler2D u_Sampler0;
  uniform int       u_whichTexture;
  uniform float     u_texColorWeight;
  uniform vec4      u_baseColor;

  uniform int   u_NormalViz;
  uniform int   u_LightOn;
  uniform vec3  u_LightPos;
  uniform vec3  u_LightColor;
  uniform vec3  u_EyePos;

  uniform int   u_SpotOn;
  uniform vec3  u_SpotPos;
  uniform vec3  u_SpotDir;
  uniform float u_SpotCutoff;

  varying vec2  v_TexCoord;
  varying vec3  v_Normal;
  varying vec3  v_WorldPos;

  void main() {
    if (u_NormalViz == 1) {
      gl_FragColor = vec4(abs(v_Normal), 1.0);
      return;
    }

    vec4 surf;
    if (u_whichTexture == 0) {
      surf = texture2D(u_Sampler0, v_TexCoord);
      surf = mix(u_baseColor, surf, u_texColorWeight);
    } else {
      surf = u_baseColor;
    }

    if (u_LightOn == 0) {
      gl_FragColor = surf;
      return;
    }

    vec3 N = normalize(v_Normal);
    vec3 V = normalize(u_EyePos - v_WorldPos);

    // Point light
    vec3  L    = normalize(u_LightPos - v_WorldPos);
    float diff = max(dot(N, L), 0.0);
    vec3  R    = reflect(-L, N);
    float spec = pow(max(dot(V, R), 0.0), 32.0);

    vec3 ambient  = 0.15 * u_LightColor * surf.rgb;
    vec3 diffuse  = diff * u_LightColor * surf.rgb;
    vec3 specular = 0.4  * spec * u_LightColor;

    vec3 result = ambient + diffuse + specular;

    // Spot light
    if (u_SpotOn == 1) {
      vec3  sL    = normalize(u_SpotPos - v_WorldPos);
      float theta = dot(sL, normalize(-u_SpotDir));
      if (theta > u_SpotCutoff) {
        float intensity = clamp((theta - u_SpotCutoff) / (1.0 - u_SpotCutoff), 0.0, 1.0);
        float sDiff = max(dot(N, sL), 0.0);
        vec3  sR    = reflect(-sL, N);
        float sSpec = pow(max(dot(V, sR), 0.0), 16.0);
        vec3  sCol  = vec3(1.0, 0.95, 0.6);
        result += intensity * (sDiff * sCol * surf.rgb + 0.3 * sSpec * sCol);
      }
    }

    gl_FragColor = vec4(result, surf.a);
  }
`;

// ─── WebGL globals ────────────────────────────────────────────────────────────
let gl, canvas;
let a_Position, a_TexCoord, a_Normal;
let u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_Sampler0, u_whichTexture, u_texColorWeight, u_baseColor;
let u_NormalViz, u_LightOn, u_LightPos, u_LightColor, u_EyePos;
let u_SpotOn, u_SpotPos, u_SpotDir, u_SpotCutoff;

// ─── Geometry buffers ─────────────────────────────────────────────────────────
let g_cubeBuf   = null;   // unit cube, stride-8
let g_sphereBuf = null;   // UV sphere
let g_sphereCount = 0;
let g_groundBuf = null;
let g_groundCount = 0;
let g_objBuf    = null;   // loaded OBJ
let g_objCount  = 0;

// ─── Light state ──────────────────────────────────────────────────────────────
let g_lightOn       = true;
let g_pointLightOn  = true;
let g_normalViz     = false;
let g_spotOn        = false;
let g_lightPos      = [2.5, 3.0, 0.0];
let g_lightColor    = [1, 1, 1];
let g_lightAngle    = 0;
const LIGHT_RADIUS  = 2.5;

// ─── Lightning mode ───────────────────────────────────────────────────────────
let g_lightningMode   = false;
let g_strikeTimer     = 0;
let g_strikeDur       = 0.7;
let g_nextStrikeTimer = 0;
let g_strikeIntensity = 0;
let g_boltPoints      = [];

// Spotlight: overhead, aimed down-left at the bunny
const SPOT_POS = [1.2, 4.0, 0.8];
const SPOT_DIR = [-0.4, -1.0, -0.3]; // unnormalized – shader normalizes

// ─── Bunny anim state (from asgn2) ───────────────────────────────────────────
let g_animating     = true;
let g_time          = 0;
let g_lastTimestamp = 0;
let g_globalAngleX  = 20;
let g_globalAngleY  = -25;

let g_headAngle    = 0;
let g_lEarAngle    = 0;
let g_rEarAngle    = 0;
let g_flUpperAngle = 0;
let g_flLowerAngle = 0;
let g_flPawAngle   = 0;
let g_frUpperAngle = 0;
let g_frLowerAngle = 0;
let g_frPawAngle   = 0;
let g_blUpperAngle = 0;
let g_blLowerAngle = 0;
let g_brUpperAngle = 0;
let g_brLowerAngle = 0;
let g_jumpY        = 0;

// Free camera
let g_camPos   = [0, 1.4, 3.2];
let g_camYaw   = 0;    // degrees, horizontal
let g_camPitch = -10;  // degrees, vertical (negative = slightly down)

// Key state
const g_keys = {};

// Frame counter
let g_frameCount = 0, g_fpsLastTime = 0;

// Mouse drag (camera look)
let g_mouseDown = false, g_lastMouseX = 0, g_lastMouseY = 0;

// ─── Entry point ─────────────────────────────────────────────────────────────
function main() {
  canvas = document.getElementById('webgl');
  gl = WebGLUtils.setupWebGL(canvas, { alpha: false, depth: true, antialias: true });
  if (!gl) { alert('WebGL not supported'); return; }
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) { alert('Shader error'); return; }

  // Attribute locations
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord');
  a_Normal   = gl.getAttribLocation(gl.program, 'a_Normal');

  // Uniform locations
  u_ModelMatrix      = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix       = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_Sampler0         = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_whichTexture     = gl.getUniformLocation(gl.program, 'u_whichTexture');
  u_texColorWeight   = gl.getUniformLocation(gl.program, 'u_texColorWeight');
  u_baseColor        = gl.getUniformLocation(gl.program, 'u_baseColor');
  u_NormalViz        = gl.getUniformLocation(gl.program, 'u_NormalViz');
  u_LightOn          = gl.getUniformLocation(gl.program, 'u_LightOn');
  u_LightPos         = gl.getUniformLocation(gl.program, 'u_LightPos');
  u_LightColor       = gl.getUniformLocation(gl.program, 'u_LightColor');
  u_EyePos           = gl.getUniformLocation(gl.program, 'u_EyePos');
  u_SpotOn           = gl.getUniformLocation(gl.program, 'u_SpotOn');
  u_SpotPos          = gl.getUniformLocation(gl.program, 'u_SpotPos');
  u_SpotDir          = gl.getUniformLocation(gl.program, 'u_SpotDir');
  u_SpotCutoff       = gl.getUniformLocation(gl.program, 'u_SpotCutoff');

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.10, 0.10, 0.18, 1.0);

  gl.uniform1i(u_Sampler0, 0);
  gl.uniform1f(u_SpotCutoff, Math.cos(18 * Math.PI / 180)); // 18° half-angle

  buildCubeBuffer();
  buildSphereBuffer(20, 12);
  buildGroundBuffer();

  // Load OBJ asynchronously
  fetch('../models/gem.obj')
    .then(r => r.text())
    .then(text => {
      const data = parseOBJ(text);
      if (data.length > 0) {
        g_objBuf   = uploadBuffer(data);
        g_objCount = data.length / 8;
      }
    })
    .catch(() => { /* OBJ optional */ });

  // Mouse drag → camera look
  canvas.addEventListener('mousedown', e => {
    g_mouseDown = true; g_lastMouseX = e.clientX; g_lastMouseY = e.clientY;
  });
  canvas.addEventListener('mousemove', e => {
    if (!g_mouseDown) return;
    g_camYaw   += (e.clientX - g_lastMouseX) * 0.3;
    g_camPitch -= (e.clientY - g_lastMouseY) * 0.3;
    g_camPitch  = Math.max(-89, Math.min(89, g_camPitch));
    g_lastMouseX = e.clientX; g_lastMouseY = e.clientY;
  });
  document.addEventListener('mouseup',  () => { g_mouseDown = false; });
  canvas.addEventListener('mouseleave', () => { g_mouseDown = false; });

  document.addEventListener('keydown', e => { g_keys[e.code] = true; });
  document.addEventListener('keyup',   e => { g_keys[e.code] = false; });

  requestAnimationFrame(tick);
}

// ─── Camera movement ──────────────────────────────────────────────────────────
function processKeys(dt) {
  const speed    = 3.0 * dt;
  const turnRate = 60.0 * dt;
  const yRad = g_camYaw * Math.PI / 180;
  // forward direction (horizontal only)
  const fx =  Math.sin(yRad);
  const fz = -Math.cos(yRad);
  // right direction
  const rx =  Math.cos(yRad);
  const rz =  Math.sin(yRad);

  if (g_keys['KeyW']) { g_camPos[0] += fx * speed; g_camPos[2] += fz * speed; }
  if (g_keys['KeyS']) { g_camPos[0] -= fx * speed; g_camPos[2] -= fz * speed; }
  if (g_keys['KeyA']) { g_camPos[0] -= rx * speed; g_camPos[2] -= rz * speed; }
  if (g_keys['KeyD']) { g_camPos[0] += rx * speed; g_camPos[2] += rz * speed; }
  if (g_keys['KeyQ']) { g_camYaw -= turnRate; }
  if (g_keys['KeyE']) { g_camYaw += turnRate; }
}

// ─── Animation loop ───────────────────────────────────────────────────────────
function tick(timestamp) {
  const delta = g_lastTimestamp ? Math.min((timestamp - g_lastTimestamp) / 1000, 0.1) : 0;
  g_lastTimestamp = timestamp;

  processKeys(delta);

  if (g_animating) {
    g_time += delta;
    updateAnimationAngles();
  }

  // Auto-spin the light when checkbox checked
  const animChk = document.getElementById('chk-anim');
  if (animChk && animChk.checked) {
    g_lightAngle = (g_lightAngle + 30 * delta) % 360;
    const lRad = g_lightAngle * Math.PI / 180;
    g_lightPos[0] = LIGHT_RADIUS * Math.cos(lRad);
    g_lightPos[2] = LIGHT_RADIUS * Math.sin(lRad);
    document.getElementById('sl-lx').value = g_lightPos[0].toFixed(2);
    document.getElementById('sl-lz').value = g_lightPos[2].toFixed(2);
  }

  // Lightning mode
  if (g_lightningMode) {
    g_nextStrikeTimer -= delta;
    if (g_strikeTimer > 0) {
      g_strikeTimer -= delta;
      const p = 1 - g_strikeTimer / g_strikeDur;
      if      (p < 0.12) g_strikeIntensity = (p / 0.12) * 4.5;                              // ramp up
      else if (p < 0.32) g_strikeIntensity = 4.5;                                             // peak
      else if (p < 0.46) g_strikeIntensity = 0.4;                                             // mid dip (double-flash)
      else if (p < 0.60) g_strikeIntensity = 3.8;                                             // second flash
      else               g_strikeIntensity = 3.8 * Math.pow(1 - (p - 0.60) / 0.40, 1.8);   // linger + fade
    } else {
      g_strikeIntensity = 0;
    }
    if (g_nextStrikeTimer <= 0) {
      generateBolt();
      g_strikeDur       = 0.65 + Math.random() * 0.35;  // 650–1000 ms
      g_strikeTimer     = g_strikeDur;
      g_nextStrikeTimer = 0.7  + Math.random() * 2.2;   // 0.7–2.9 s gap
    }
  } else {
    g_strikeIntensity = 0;
    g_boltPoints = [];
  }

  // FPS
  g_frameCount++;
  if (timestamp - g_fpsLastTime >= 1000) {
    document.getElementById('perf').textContent =
      'FPS: ' + Math.round(g_frameCount * 1000 / (timestamp - g_fpsLastTime)) + '.0';
    g_frameCount = 0; g_fpsLastTime = timestamp;
  }

  renderScene();
  requestAnimationFrame(tick);
}

// ─── Lightning bolt path ──────────────────────────────────────────────────────
function generateBolt() {
  const lx = g_lightPos[0], ly = g_lightPos[1], lz = g_lightPos[2];
  const groundY = -0.48;
  g_boltPoints = [[lx, ly, lz]];
  const steps = 7 + Math.floor(Math.random() * 5); // 7–11 zigzag segments
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const y = ly + (groundY - ly) * t;
    const spread = 0.36 * (1 - t * 0.4); // taper slightly near ground
    const x = lx + (Math.random() - 0.5) * spread;
    const z = lz + (Math.random() - 0.5) * spread;
    g_boltPoints.push([x, y, z]);
  }
}

// ─── Animation angles (from asgn2) ───────────────────────────────────────────
function updateAnimationAngles() {
  const t   = g_time;
  const hop = Math.sin(t * 3.5);
  g_jumpY        = Math.max(0, hop) * 0.09;
  g_headAngle    = hop * 7.0;
  g_lEarAngle    = -hop * 15.0;
  g_rEarAngle    =  hop * 15.0;
  g_flUpperAngle = hop * 26.0;
  g_frUpperAngle = hop * 26.0;
  g_flLowerAngle = (hop - 1.0) * 18.0;
  g_frLowerAngle = (hop - 1.0) * 18.0;
  g_flPawAngle   = hop * 10.0;
  g_frPawAngle   = hop * 10.0;
  g_blUpperAngle = -hop * 30.0;
  g_brUpperAngle = -hop * 30.0;
  g_blLowerAngle = (hop + 1.0) * (-20.0);
  g_brLowerAngle = (hop + 1.0) * (-20.0);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderScene() {
  // Flash the sky during lightning strikes
  if (g_lightningMode && g_strikeIntensity > 2.0) {
    gl.clearColor(0.38, 0.42, 0.58, 1.0);
  } else {
    gl.clearColor(0.10, 0.10, 0.18, 1.0);
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Camera
  const yRad = g_camYaw   * Math.PI / 180;
  const pRad = g_camPitch * Math.PI / 180;
  const eyeX = g_camPos[0], eyeY = g_camPos[1], eyeZ = g_camPos[2];
  const atX  = eyeX + Math.cos(pRad) * Math.sin(yRad);
  const atY  = eyeY + Math.sin(pRad);
  const atZ  = eyeZ - Math.cos(pRad) * Math.cos(yRad);

  const proj = new Matrix4();
  proj.setPerspective(45, canvas.width / canvas.height, 0.1, 100);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, proj.elements);

  const view = new Matrix4();
  view.setLookAt(eyeX, eyeY, eyeZ,  atX, atY, atZ,  0, 1, 0);
  gl.uniformMatrix4fv(u_ViewMatrix, false, view.elements);

  gl.uniform3f(u_EyePos, eyeX, eyeY, eyeZ);

  // Light position (from sliders / animation)
  const lx = g_lightPos[0], ly = g_lightPos[1], lz = g_lightPos[2];
  // When point light is individually off, push it far away so it has no effect
  if (g_pointLightOn) {
    gl.uniform3f(u_LightPos, lx, ly, lz);
  } else {
    gl.uniform3f(u_LightPos, 0, 1000, 0);
  }
  // Lightning overrides the light color
  let lc;
  if (g_lightningMode && g_strikeIntensity > 0) {
    const s = g_strikeIntensity;
    lc = [0.82 * s, 0.88 * s, 1.0 * s]; // blue-white scaled by flash intensity
  } else if (g_lightningMode) {
    lc = [0.01, 0.01, 0.02]; // near-dark between flashes for drama
  } else {
    lc = g_lightColor;
  }
  gl.uniform3f(u_LightColor, lc[0], lc[1], lc[2]);

  // Spotlight
  gl.uniform1i(u_SpotOn, g_spotOn ? 1 : 0);
  gl.uniform3f(u_SpotPos, SPOT_POS[0], SPOT_POS[1], SPOT_POS[2]);
  gl.uniform3f(u_SpotDir, SPOT_DIR[0], SPOT_DIR[1], SPOT_DIR[2]);

  // Global flags
  gl.uniform1i(u_NormalViz, g_normalViz ? 1 : 0);
  gl.uniform1i(u_LightOn,   g_lightOn   ? 1 : 0);

  // Ground
  drawGround();

  // Lightning bolt — drawn before other geometry so it composites naturally
  if (g_lightningMode && g_strikeIntensity > 0) {
    drawLightningBolt(g_strikeIntensity);
  }

  // Bunny (global rotation applied via model matrix root)
  const globalRot = new Matrix4();
  globalRot.rotate(g_globalAngleX, 1, 0, 0);
  globalRot.rotate(g_globalAngleY, 0, 1, 0);
  drawBunny(globalRot);

  // Two spheres
  const sm1 = new Matrix4(); sm1.setTranslate(-1.0, 0.3,  0.4); sm1.scale(0.3,  0.3,  0.3);
  const sm2 = new Matrix4(); sm2.setTranslate( 0.9, 0.5, -0.5); sm2.scale(0.22, 0.22, 0.22);
  drawSphere([1.0, 0.6, 0.1, 1], sm1);
  drawSphere([0.1, 0.5, 0.9, 1], sm2);

  // OBJ gem
  if (g_objBuf) {
    drawObj([-0.9, 0.0, -0.9], [0.2, 0.9, 0.6, 1], 0.28);
  }

  // Light marker cube – always unlit so it glows
  if (g_pointLightOn) {
    gl.uniform1i(u_LightOn, 0);
    const lm = new Matrix4();
    lm.setTranslate(lx, ly, lz);
    lm.scale(0.08, 0.08, 0.08);
    setColor(1.0, 1.0, 0.3, 1.0);
    gl.uniform1i(u_whichTexture, -1);
    gl.uniform1f(u_texColorWeight, 0.0);
    drawCubeM(lm);
    gl.uniform1i(u_LightOn, g_lightOn ? 1 : 0);
  }
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function setColor(r, g, b, a) {
  gl.uniform4f(u_baseColor, r, g, b, a);
}

function bindStrideBuffer(buf) {
  const F = 4;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, F * 8, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, F * 8, F * 3);
  gl.enableVertexAttribArray(a_TexCoord);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, F * 8, F * 5);
  gl.enableVertexAttribArray(a_Normal);
}

function drawCubeM(M) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  bindStrideBuffer(g_cubeBuf);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

// Draws a colored box (like asgn2 drawCube), applying global rotation on top.
function drawBox(parentM, tx, ty, tz, sx, sy, sz, r, g, b) {
  const M = new Matrix4(parentM);
  M.translate(tx, ty, tz);
  M.scale(sx, sy, sz);
  setColor(r, g, b, 1.0);
  gl.uniform1i(u_whichTexture, -1);
  gl.uniform1f(u_texColorWeight, 0.0);
  drawCubeM(M);
}

function drawSphere(color, M) {
  setColor(color[0], color[1], color[2], color[3]);
  gl.uniform1i(u_whichTexture, -1);
  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  bindStrideBuffer(g_sphereBuf);
  gl.drawArrays(gl.TRIANGLES, 0, g_sphereCount);
}

function drawObj(pos, color, scale) {
  const M = new Matrix4();
  M.setTranslate(pos[0], pos[1], pos[2]);
  M.scale(scale, scale, scale);
  setColor(color[0], color[1], color[2], color[3]);
  gl.uniform1i(u_whichTexture, -1);
  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  bindStrideBuffer(g_objBuf);
  gl.drawArrays(gl.TRIANGLES, 0, g_objCount);
}

function drawGround() {
  const M = new Matrix4();
  M.setTranslate(0, -0.52, 0);
  M.scale(4, 0.04, 4);
  setColor(0.28, 0.56, 0.22, 1.0);
  gl.uniform1i(u_whichTexture, -1);
  gl.uniform1f(u_texColorWeight, 0.0);
  drawCubeM(M);
}

// ─── Bunny (asgn2 hierarchy) ──────────────────────────────────────────────────
function drawBunny(globalRot) {
  // Root: global rotation + vertical jump offset
  const bodyM = new Matrix4(globalRot);
  bodyM.translate(0, g_jumpY - 0.18, 0);

  // Body
  drawBox(bodyM, 0, 0, 0,  0.50, 0.35, 0.50,  0.58, 0.36, 0.13);

  // Head
  const headM = new Matrix4(bodyM);
  headM.translate(0, 0.26, 0.17);
  headM.rotate(g_headAngle, 1, 0, 0);
  drawBox(headM, 0, 0, 0,  0.32, 0.30, 0.32,  0.58, 0.36, 0.13);

  // Eyes
  drawBox(headM, -0.10, 0.06, 0.225,  0.055, 0.055, 0.035,  0.10, 0.05, 0.05);
  drawBox(headM,  0.10, 0.06, 0.225,  0.055, 0.055, 0.035,  0.10, 0.05, 0.05);

  // Left ear
  const lEarM = new Matrix4(headM);
  lEarM.translate(-0.10, 0.15, 0.0);
  lEarM.rotate(g_lEarAngle, 0, 0, 1);
  drawBox(lEarM,  0, 0.14, 0,     0.08,  0.28, 0.05,  0.58, 0.36, 0.13);
  drawBox(lEarM,  0, 0.14, 0.018, 0.052, 0.22, 0.02,  1.00, 0.76, 0.78);
  const lEarLoM = new Matrix4(lEarM);
  lEarLoM.translate(0, 0.28, 0);
  lEarLoM.rotate(g_lEarAngle * 0.35, 0, 0, 1);
  drawBox(lEarLoM, 0, 0.09, 0,  0.065, 0.18, 0.045,  0.58, 0.36, 0.13);

  // Right ear
  const rEarM = new Matrix4(headM);
  rEarM.translate(0.10, 0.15, 0.0);
  rEarM.rotate(g_rEarAngle, 0, 0, 1);
  drawBox(rEarM,  0, 0.14, 0,     0.08,  0.28, 0.05,  0.58, 0.36, 0.13);
  drawBox(rEarM,  0, 0.14, 0.018, 0.052, 0.22, 0.02,  1.00, 0.76, 0.78);
  const rEarLoM = new Matrix4(rEarM);
  rEarLoM.translate(0, 0.28, 0);
  rEarLoM.rotate(g_rEarAngle * 0.35, 0, 0, 1);
  drawBox(rEarLoM, 0, 0.09, 0,  0.065, 0.18, 0.045,  0.58, 0.36, 0.13);

  // Tail
  drawBox(bodyM, 0, 0.15, -0.32,  0.14, 0.14, 0.14,  1.0, 1.0, 1.0);

  // Front-left leg
  const flUpM = new Matrix4(bodyM);
  flUpM.translate(-0.29, -0.11, 0.16);
  flUpM.rotate(-8, 0, 0, 1);
  flUpM.rotate(g_flUpperAngle, 1, 0, 0);
  drawBox(flUpM, 0, -0.035, 0,  0.12, 0.10, 0.13,  0.52, 0.32, 0.11);
  const flLoM = new Matrix4(flUpM);
  flLoM.translate(0, -0.075, 0.02);
  flLoM.rotate(g_flLowerAngle * 0.35 + g_flPawAngle, 1, 0, 0);
  drawBox(flLoM, 0, -0.015, 0.045,  0.13, 0.055, 0.20,  0.48, 0.28, 0.09);

  // Front-right leg
  const frUpM = new Matrix4(bodyM);
  frUpM.translate(0.29, -0.11, 0.16);
  frUpM.rotate(8, 0, 0, 1);
  frUpM.rotate(g_frUpperAngle, 1, 0, 0);
  drawBox(frUpM, 0, -0.035, 0,  0.12, 0.10, 0.13,  0.52, 0.32, 0.11);
  const frLoM = new Matrix4(frUpM);
  frLoM.translate(0, -0.075, 0.02);
  frLoM.rotate(g_frLowerAngle * 0.35 + g_frPawAngle, 1, 0, 0);
  drawBox(frLoM, 0, -0.015, 0.045,  0.13, 0.055, 0.20,  0.48, 0.28, 0.09);

  // Back-left leg
  const blUpM = new Matrix4(bodyM);
  blUpM.translate(-0.19, -0.15, -0.14);
  blUpM.rotate(-4, 0, 0, 1);
  blUpM.rotate(g_blUpperAngle, 1, 0, 0);
  drawBox(blUpM, -0.035, 0.015, -0.02,  0.20, 0.20, 0.22,  0.52, 0.32, 0.11);
  const blLoM = new Matrix4(blUpM);
  blLoM.translate(-0.035, -0.09, 0.06);
  blLoM.rotate(g_blLowerAngle, 1, 0, 0);
  drawBox(blLoM, 0, -0.045, 0.09,  0.19, 0.08, 0.32,  0.48, 0.28, 0.09);

  // Back-right leg
  const brUpM = new Matrix4(bodyM);
  brUpM.translate(0.19, -0.15, -0.14);
  brUpM.rotate(4, 0, 0, 1);
  brUpM.rotate(g_brUpperAngle, 1, 0, 0);
  drawBox(brUpM, 0.035, 0.015, -0.02,  0.20, 0.20, 0.22,  0.52, 0.32, 0.11);
  const brLoM = new Matrix4(brUpM);
  brLoM.translate(0.035, -0.09, 0.06);
  brLoM.rotate(g_brLowerAngle, 1, 0, 0);
  drawBox(brLoM, 0, -0.045, 0.09,  0.19, 0.08, 0.32,  0.48, 0.28, 0.09);
}

// ─── Buffer builders ──────────────────────────────────────────────────────────
// All use stride-8: [x, y, z, u, v, nx, ny, nz]

function uploadBuffer(data) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  return buf;
}

function buildCubeBuffer() {
  // Unit cube centered at origin, 36 vertices, stride 8
  const v = [];
  function face(verts, nx, ny, nz) {
    // verts: 4 corners [x0,y0,z0, x1,y1,z1, x2,y2,z2, x3,y3,z3], two triangles
    const [x0,y0,z0, x1,y1,z1, x2,y2,z2, x3,y3,z3] = verts;
    const push6 = (x,y,z,u,vv) => v.push(x,y,z,u,vv,nx,ny,nz);
    push6(x0,y0,z0,0,0); push6(x1,y1,z1,1,0); push6(x2,y2,z2,1,1);
    push6(x0,y0,z0,0,0); push6(x2,y2,z2,1,1); push6(x3,y3,z3,0,1);
  }
  const h = 0.5;
  face([-h,-h, h,  h,-h, h,  h, h, h, -h, h, h],  0, 0, 1);  // front
  face([ h,-h,-h, -h,-h,-h, -h, h,-h,  h, h,-h],  0, 0,-1);  // back
  face([ h,-h, h,  h,-h,-h,  h, h,-h,  h, h, h],  1, 0, 0);  // right
  face([-h,-h,-h, -h,-h, h, -h, h, h, -h, h,-h], -1, 0, 0);  // left
  face([-h, h, h,  h, h, h,  h, h,-h, -h, h,-h],  0, 1, 0);  // top
  face([-h,-h,-h,  h,-h,-h,  h,-h, h, -h,-h, h],  0,-1, 0);  // bottom
  g_cubeBuf = uploadBuffer(v);
}

function buildSphereBuffer(sectors, stacks) {
  const verts = [];
  for (let i = 0; i <= stacks; i++) {
    const phi = Math.PI / 2 - i * Math.PI / stacks;
    const y   = Math.sin(phi);
    const r   = Math.cos(phi);
    for (let j = 0; j <= sectors; j++) {
      const theta = j * 2 * Math.PI / sectors;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      verts.push(x, y, z,  j / sectors, i / stacks,  x, y, z);
    }
  }
  const flat = [];
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < sectors; j++) {
      const a = i * (sectors + 1) + j;
      const b = a + (sectors + 1);
      const stride = 8;
      for (const idx of [a, b, a+1, b, b+1, a+1]) {
        for (let k = 0; k < stride; k++) flat.push(verts[idx * stride + k]);
      }
    }
  }
  g_sphereBuf   = uploadBuffer(flat);
  g_sphereCount = flat.length / 8;
}

function buildGroundBuffer() {
  // Not separately used — ground uses g_cubeBuf via drawBox
}

function drawLightningBolt(intensity) {
  if (!g_boltPoints.length) return;
  gl.uniform1i(u_LightOn, 0); // self-luminous — ignore scene lighting

  const fade = Math.min(1.0, intensity / 4.5);
  setColor(0.70 + 0.30 * fade, 0.84 + 0.16 * fade, 1.0, 1.0);
  gl.uniform1i(u_whichTexture, -1);
  gl.uniform1f(u_texColorWeight, 0.0);

  const w = 0.012 + 0.016 * fade; // thicker at peak, thinner as it lingers

  for (let i = 0; i < g_boltPoints.length - 1; i++) {
    const p1 = g_boltPoints[i], p2 = g_boltPoints[i + 1];
    const dx = p2[0]-p1[0], dy = p2[1]-p1[1], dz = p2[2]-p1[2];
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 0.001) continue;

    const dnx = dx/len, dny = dy/len, dnz = dz/len;
    const mx = (p1[0]+p2[0])/2, my = (p1[1]+p2[1])/2, mz = (p1[2]+p2[2])/2;

    // Rotate default +Y box to align with segment direction
    const angle = Math.acos(Math.max(-1, Math.min(1, dny))) * 180 / Math.PI;
    const axLen = Math.sqrt(dnz*dnz + dnx*dnx); // length of axis (dnz, 0, -dnx)

    const M = new Matrix4();
    M.setTranslate(mx, my, mz);
    if (axLen > 0.001) {
      M.rotate(angle, dnz / axLen, 0, -dnx / axLen);
    } else if (dny < 0) {
      M.rotate(180, 1, 0, 0); // straight down — flip around X
    }
    M.scale(w, len, w);
    drawCubeM(M);
  }

  gl.uniform1i(u_LightOn, g_lightOn ? 1 : 0);
}

// ─── OBJ parser ───────────────────────────────────────────────────────────────
function parseOBJ(text) {
  const positions = [], texCoords = [], normals = [], flat = [];

  for (const raw of text.split('\n')) {
    const parts = raw.trim().split(/\s+/);
    if (parts[0] === 'v')  positions.push(+parts[1], +parts[2], +parts[3]);
    else if (parts[0] === 'vt') texCoords.push(+parts[1], +parts[2]);
    else if (parts[0] === 'vn') normals.push(+parts[1], +parts[2], +parts[3]);
    else if (parts[0] === 'f') {
      const fv = [];
      for (let i = 1; i < parts.length; i++) fv.push(objVertex(parts[i], positions, texCoords, normals));
      for (let i = 1; i < fv.length - 1; i++) flat.push(...fv[0], ...fv[i], ...fv[i+1]);
    }
  }
  return flat;
}

function objVertex(tok, pos, tc, nrm) {
  const s = tok.split('/');
  const vi = (+s[0] - 1) * 3;
  const ti = s[1] ? (+s[1] - 1) * 2 : -1;
  const ni = s[2] ? (+s[2] - 1) * 3 : -1;
  return [
    pos[vi], pos[vi+1], pos[vi+2],
    ti >= 0 ? tc[ti] : 0,  ti >= 0 ? tc[ti+1] : 0,
    ni >= 0 ? nrm[ni] : 0, ni >= 0 ? nrm[ni+1] : 0, ni >= 0 ? nrm[ni+2] : 1
  ];
}

// ─── UI callbacks ─────────────────────────────────────────────────────────────
function toggleLighting() {
  g_lightOn = !g_lightOn;
  document.getElementById('btn-light').textContent = 'Lighting: ' + (g_lightOn ? 'ON' : 'OFF');
}

function toggleNormals() {
  g_normalViz = !g_normalViz;
  document.getElementById('btn-normals').textContent = 'Normal Viz: ' + (g_normalViz ? 'ON' : 'OFF');
}

function togglePointLight() {
  g_pointLightOn = !g_pointLightOn;
  document.getElementById('btn-ptlight').textContent = 'Point Light: ' + (g_pointLightOn ? 'ON' : 'OFF');
}

function toggleSpotlight() {
  g_spotOn = !g_spotOn;
  document.getElementById('btn-spot').textContent = 'Spot Light: ' + (g_spotOn ? 'ON' : 'OFF');
}

function toggleLightning() {
  g_lightningMode = !g_lightningMode;
  g_nextStrikeTimer = 0; // fire first strike immediately on enable
  document.getElementById('btn-lightning').textContent = 'Lightning: ' + (g_lightningMode ? 'ON' : 'OFF');
}

function toggleAnimation() {
  // driven by checkbox state — nothing extra needed
}

function onLightXYZ() {
  g_lightPos[0] = parseFloat(document.getElementById('sl-lx').value);
  g_lightPos[1] = parseFloat(document.getElementById('sl-ly').value);
  g_lightPos[2] = parseFloat(document.getElementById('sl-lz').value);
  // Manual move breaks animation continuity – reset angle to match current X/Z
  g_lightAngle = Math.atan2(g_lightPos[2], g_lightPos[0]) * 180 / Math.PI;
}

function onCamAngle(el) {
  g_camYaw = parseFloat(el.value);
}

function onLightColor() {
  g_lightColor[0] = parseFloat(document.getElementById('sl-r').value) / 100;
  g_lightColor[1] = parseFloat(document.getElementById('sl-g').value) / 100;
  g_lightColor[2] = parseFloat(document.getElementById('sl-b').value) / 100;
}
