// ColoredPoints.js
// Hunter Pettus - CSE 160 Assignment 1
// Main drawing app file

// vertex shader - handles position and size of points
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'uniform float u_PointSize;\n' +
  'void main() {\n' +
  '  gl_Position = a_Position;\n' +
  '  gl_PointSize = u_PointSize;\n' +
  '}\n';

// fragment shader - handles the color
var FSHADER_SOURCE =
  'precision mediump float;\n' +
  'uniform vec4 u_FragColor;\n' +
  'void main() {\n' +
  '  gl_FragColor = u_FragColor;\n' +
  '}\n';

// globals - need these to be accessible everywhere
var gl;
var canvas;
var a_Position;
var u_FragColor;
var u_PointSize;
var shapesList = []; // all the shapes we draw go here
var g_selectedColor = [1.0, 1.0, 1.0, 1.0]; // default white
var g_selectedSize = 10.0;
var g_selectedType = 'point'; // can be point, triangle, or circle
var g_selectedSegments = 20; // for circles
var g_rainbowMode = false;
var g_rainbowHue = 0.0;
var g_gravityMode = false;
var g_gravityDir = -1; // -1 = down, +1 = up
var g_animFrameId = null;
var g_preciseMode = false;
var g_preciseVertices = []; // pending vertices waiting to form a triangle

function main() {
  setupWebGL();
  connectVariablesToGLSL();
  addUIListeners();
  renderAllShapes();
}

// sets up the canvas and gl context
function setupWebGL() {
  canvas = document.getElementById('webgl');

  // preserveDrawingBuffer keeps the drawing on screen
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, alpha: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // black background
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
}

// connect our js variables to the shader variables
function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return;
  }

  // get position attribute
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get a_Position');
    return;
  }

  // get color uniform
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get u_FragColor');
    return;
  }

  // get size uniform
  u_PointSize = gl.getUniformLocation(gl.program, 'u_PointSize');
  if (!u_PointSize) {
    console.log('Failed to get u_PointSize');
    return;
  }
}

// loops through and draws everything
function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);

  for (var i = 0; i < shapesList.length; i++) {
    shapesList[i].render();
  }
}

// handles clicking on the canvas
function handleClicks(ev) {
  var x = ev.clientX;
  var y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();

  // convert from screen coords to webgl coords (-1 to 1)
  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

  // precise mode: collect 3 vertices then form a triangle
  if (g_preciseMode) {
    g_preciseVertices.push([x, y]);
    if (g_preciseVertices.length === 3) {
      var v = g_preciseVertices;
      var t = new Triangle(v[0][0], v[0][1], v[1][0], v[1][1], v[2][0], v[2][1], g_selectedColor.slice());
      shapesList.push(t);
      g_preciseVertices = [];
    }
    renderAllShapes();
    renderPreciseDots();
    return;
  }

  var color = g_rainbowMode ? hslToRgb(g_rainbowHue, 1.0, 0.5) : g_selectedColor.slice();
  if (g_rainbowMode) {
    g_rainbowHue = (g_rainbowHue + 15) % 360;
  }

  var newShape;
  if (g_selectedType === 'point') {
    newShape = new Point(x, y, color, g_selectedSize);
    shapesList.push(newShape);
  } else if (g_selectedType === 'triangle') {
    // size scaled down so triangles arent huge
    var size = g_selectedSize / 200.0;
    newShape = new Triangle(
      x, y + size,           // top
      x - size, y - size,    // bottom left
      x + size, y - size,    // bottom right
      color
    );
    shapesList.push(newShape);
  } else if (g_selectedType === 'circle') {
    newShape = new Circle(x, y, g_selectedSize, color, g_selectedSegments);
    shapesList.push(newShape);
  }

  if (g_gravityMode && newShape) {
    newShape.vy = 0;
    newShape.settled = false;
    if (!g_animFrameId) {
      g_animFrameId = requestAnimationFrame(gravityTick);
    }
  }

  renderAllShapes();
}

// for drawing when dragging mouse
function handleMouseMove(ev) {
  if (ev.buttons === 1) { // left mouse button held
    handleClicks(ev);
  }
}

// hook up mouse events
function addUIListeners() {
  canvas.onmousedown = handleClicks;
  canvas.onmousemove = handleMouseMove;
}

// changes the current shape type and updates button styling
function setShapeType(type) {
  g_selectedType = type;
  
  // remove active from all buttons first
  document.getElementById('btnPoint').classList.remove('active');
  document.getElementById('btnTriangle').classList.remove('active');
  document.getElementById('btnCircle').classList.remove('active');
  
  // add active to the selected one
  if (type === 'point') {
    document.getElementById('btnPoint').classList.add('active');
  } else if (type === 'triangle') {
    document.getElementById('btnTriangle').classList.add('active');
  } else if (type === 'circle') {
    document.getElementById('btnCircle').classList.add('active');
  }
}

// called when color picker changes - syncs sliders
function updateColorFromPicker() {
  var hex = document.getElementById('colorPicker').value;
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  document.getElementById('redSlider').value = r;
  document.getElementById('greenSlider').value = g;
  document.getElementById('blueSlider').value = b;
  g_selectedColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
}

// called when sliders change - syncs color picker
function updateColorFromSliders() {
  var r = parseInt(document.getElementById('redSlider').value);
  var g = parseInt(document.getElementById('greenSlider').value);
  var b = parseInt(document.getElementById('blueSlider').value);
  var hex = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  document.getElementById('colorPicker').value = hex;
  g_selectedColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
}

function updateSize() {
  g_selectedSize = parseFloat(document.getElementById('sizeSlider').value);
}

function updateSegments() {
  g_selectedSegments = parseInt(document.getElementById('segmentsSlider').value);
}

// clears everything
function clearCanvas() {
  shapesList = [];
  renderAllShapes();
}

// toggles rainbow mode on/off
function toggleRainbowMode() {
  g_rainbowMode = !g_rainbowMode;
  g_rainbowHue = 0.0;
  var btn = document.getElementById('btnRainbow');
  btn.textContent = 'Rainbow Mode: ' + (g_rainbowMode ? 'ON' : 'OFF');
  btn.style.background = g_rainbowMode ? 'linear-gradient(to right, red, orange, yellow, green, blue, violet)' : '';
  btn.style.color = g_rainbowMode ? 'white' : '';
}

// shared helper to start gravity in a given direction
function startGravity(dir) {
  if (g_animFrameId) {
    cancelAnimationFrame(g_animFrameId);
    g_animFrameId = null;
  }
  g_gravityDir = dir;
  g_gravityMode = true;
  for (var i = 0; i < shapesList.length; i++) {
    shapesList[i].vy = 0;
    shapesList[i].settled = false;
  }
  g_animFrameId = requestAnimationFrame(gravityTick);
}

function stopGravity() {
  g_gravityMode = false;
  if (g_animFrameId) {
    cancelAnimationFrame(g_animFrameId);
    g_animFrameId = null;
  }
}

function toggleGravityMode() {
  var wasOn = g_gravityMode && g_gravityDir === -1;
  stopGravity();
  document.getElementById('btnGravityReversed').textContent = 'Gravity Reversed: OFF';
  if (!wasOn) {
    startGravity(-1);
  }
  document.getElementById('btnGravity').textContent = 'Gravity Mode: ' + (g_gravityMode ? 'ON' : 'OFF');
}

function toggleGravityReversed() {
  var wasOn = g_gravityMode && g_gravityDir === 1;
  stopGravity();
  document.getElementById('btnGravity').textContent = 'Gravity Mode: OFF';
  if (!wasOn) {
    startGravity(1);
  }
  document.getElementById('btnGravityReversed').textContent = 'Gravity Reversed: ' + (g_gravityMode ? 'ON' : 'OFF');
}

// runs one frame of gravity simulation
function gravityTick() {
  var allSettled = true;
  var GRAVITY = 0.003;

  for (var i = 0; i < shapesList.length; i++) {
    var shape = shapesList[i];
    if (shape.settled) continue;

    allSettled = false;
    shape.vy += GRAVITY * g_gravityDir;

    if (shape instanceof Point) {
      var boundary = g_gravityDir === -1 ? -1.0 + shape.size / 400 : 1.0 - shape.size / 400;
      shape.position[1] += shape.vy;
      if ((g_gravityDir === -1 && shape.position[1] <= boundary) || (g_gravityDir === 1 && shape.position[1] >= boundary)) {
        shape.position[1] = boundary;
        shape.vy = 0;
        shape.settled = true;
      }
    } else if (shape instanceof Circle) {
      var boundary = g_gravityDir === -1 ? -1.0 + shape.size / 200.0 : 1.0 - shape.size / 200.0;
      shape.position[1] += shape.vy;
      if ((g_gravityDir === -1 && shape.position[1] <= boundary) || (g_gravityDir === 1 && shape.position[1] >= boundary)) {
        shape.position[1] = boundary;
        shape.vy = 0;
        shape.settled = true;
      }
    } else if (shape instanceof Triangle) {
      shape.vertices[1] += shape.vy;
      shape.vertices[3] += shape.vy;
      shape.vertices[5] += shape.vy;
      if (g_gravityDir === -1) {
        var minY = Math.min(shape.vertices[1], shape.vertices[3], shape.vertices[5]);
        if (minY <= -1.0) {
          var correction = minY + 1.0;
          shape.vertices[1] -= correction;
          shape.vertices[3] -= correction;
          shape.vertices[5] -= correction;
          shape.vy = 0;
          shape.settled = true;
        }
      } else {
        var maxY = Math.max(shape.vertices[1], shape.vertices[3], shape.vertices[5]);
        if (maxY >= 1.0) {
          var correction = maxY - 1.0;
          shape.vertices[1] -= correction;
          shape.vertices[3] -= correction;
          shape.vertices[5] -= correction;
          shape.vy = 0;
          shape.settled = true;
        }
      }
    }
  }

  renderAllShapes();

  if (!allSettled && g_gravityMode) {
    g_animFrameId = requestAnimationFrame(gravityTick);
  } else {
    g_animFrameId = null;
  }
}

// toggles precise drawing mode
function togglePreciseMode() {
  g_preciseMode = !g_preciseMode;
  g_preciseVertices = [];
  document.getElementById('btnPrecise').textContent = 'Precise Mode: ' + (g_preciseMode ? 'ON' : 'OFF');
  if (g_preciseMode) {
    gl.clearColor(0.0, 0.0, 0.0, 0.0); // transparent so reference image shows through
    document.getElementById('refImage').style.display = 'block';
  } else {
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // back to black
    document.getElementById('refImage').style.display = 'none';
  }
  renderAllShapes();
}

// draws red dots at pending precise vertices
function renderPreciseDots() {
  if (g_preciseVertices.length === 0) return;
  gl.disableVertexAttribArray(a_Position);
  gl.uniform4f(u_FragColor, 1.0, 0.0, 0.0, 1.0);
  gl.uniform1f(u_PointSize, 8.0);
  for (var i = 0; i < g_preciseVertices.length; i++) {
    gl.vertexAttrib3f(a_Position, g_preciseVertices[i][0], g_preciseVertices[i][1], 0.0);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}




function drawPicture() {
  var data = [
    {v:[-0.855,-0.185625,-0.86,-0.425625,-0.67,-0.540625],c:[0.839,0.839,0.839,1]},
    {v:[-0.67,-0.535625,-0.66,-0.275625,-0.855,-0.185625],c:[0.839,0.839,0.839,1]},
    {v:[-0.85,-0.185625,-0.675,-0.070625,-0.485,-0.165625],c:[0.945,0.937,0.937,1]},
    {v:[-0.495,-0.175625,-0.655,-0.280625,-0.825,-0.185625],c:[0.945,0.937,0.937,1]},
    {v:[-0.655,-0.530625,-0.485,-0.450625,-0.49,-0.180625],c:[0.945,0.937,0.937,1]},
    {v:[-0.49,-0.180625,-0.665,-0.270625,-0.67,-0.525625],c:[0.945,0.937,0.937,1]},
    {v:[-0.75,-0.100625,-0.75,0.229375,-0.39,0.039375],c:[0.8,0.8,0.8,1]},
    {v:[-0.385,0.039375,-0.385,-0.465625,-0.48,-0.445625],c:[0.8,0.8,0.8,1]},
    {v:[-0.48,-0.440625,-0.485,-0.165625,-0.4,0.034375],c:[0.8,0.8,0.8,1]},
    {v:[-0.67,-0.065625,-0.485,-0.160625,-0.39,0.019375],c:[0.8,0.8,0.8,1]},
    {v:[-0.375,-0.470625,-0.195,-0.400625,-0.205,0.114375],c:[0.8,0.8,0.8,1]},
    {v:[-0.205,0.114375,-0.375,0.049375,-0.37,-0.450625],c:[0.8,0.8,0.8,1]},
    {v:[-0.47,-0.460625,-0.49,-0.795625,-0.365,-0.865625],c:[0.922,0.918,0.918,1]},
    {v:[-0.365,-0.865625,-0.35,-0.480625,-0.44,-0.465625],c:[0.922,0.918,0.918,1]},
    {v:[-0.48,-0.460625,-0.43,-0.465625,-0.365,-0.845625],c:[0.922,0.918,0.918,1]},
    {v:[-0.285,-0.900625,-0.18,-0.970625,-0.175,-0.430625],c:[0.922,0.918,0.918,1]},
    {v:[-0.175,-0.425625,-0.285,-0.445625,-0.295,-0.850625],c:[0.922,0.918,0.918,1]},
    {v:[-0.155,-0.450625,-0.15,-0.935625,-0.045,-0.890625],c:[0.922,0.918,0.918,1]},
    {v:[-0.04,-0.885625,-0.035,-0.425625,-0.045,-0.420625],c:[0.922,0.918,0.918,1]},
    {v:[-0.045,-0.420625,-0.055,-0.855625,-0.15,-0.450625],c:[0.922,0.918,0.918,1]},
    {v:[-0.335,-0.465625,-0.3,-0.450625,-0.295,-0.825625],c:[0.788,0.788,0.788,1]},
    {v:[-0.3,-0.825625,-0.355,-0.865625,-0.34,-0.495625],c:[0.788,0.788,0.788,1]},
    {v:[-0.14,0.144375,0.225,0.339375,0.245,-0.240625],c:[0.863,0.859,0.859,1]},
    {v:[0.245,-0.240625,-0.115,-0.420625,-0.125,0.134375],c:[0.863,0.859,0.859,1]},
    {v:[0.245,0.329375,0.74,0.614375,0.74,0.129375],c:[0.863,0.859,0.859,1]},
    {v:[0.255,-0.150625,0.74,0.119375,0.245,0.329375],c:[0.863,0.859,0.859,1]},
    {v:[0.545,-0.570625,0.65,-0.505625,0.645,0.049375],c:[0.863,0.859,0.859,1]},
    {v:[0.525,-0.550625,0.525,-0.005625,0.63,0.044375],c:[0.863,0.859,0.859,1]},
    {v:[0.51,-0.555625,0.41,-0.500625,0.415,-0.095625],c:[0.863,0.859,0.859,1]},
    {v:[0.415,-0.095625,0.525,-0.035625,0.515,-0.525625],c:[0.863,0.859,0.859,1]},
    {v:[0.24,-0.370625,0.335,-0.440625,0.345,-0.120625],c:[0.863,0.859,0.859,1]},
    {v:[0.335,-0.455625,0.23,-0.405625,0.22,-0.285625],c:[0.863,0.859,0.859,1]},
    {v:[0.225,-0.275625,0.26,-0.325625,0.335,-0.170625],c:[0.863,0.859,0.859,1]},
    {v:[-0.105,0.561875,0.365,0.841875,0.73,0.641875],c:[0.863,0.859,0.859,1]},
    {v:[0.245,0.366875,0.73,0.621875,-0.09,0.556875],c:[0.863,0.859,0.859,1]},
    {v:[-0.195,0.141875,-0.135,0.141875,-0.13,-0.413125],c:[0.678,0.663,0.663,1]},
    {v:[-0.13,-0.418125,-0.205,-0.403125,-0.2,0.116875],c:[0.678,0.663,0.663,1]},
    {v:[-0.185,0.141875,0.23,0.351875,-0.25,0.641875],c:[0.678,0.663,0.663,1]},
    {v:[-0.25,0.646875,-0.515,0.516875,-0.21,0.331875],c:[0.678,0.663,0.663,1]},
    {v:[-0.725,0.241875,-0.63,0.311875,-0.53,0.261875],c:[0.678,0.663,0.663,1]},
    {v:[-0.515,0.261875,-0.39,0.056875,-0.255,0.116875],c:[0.678,0.663,0.663,1]},
    {v:[-0.74,0.236875,-0.52,0.251875,-0.395,0.061875],c:[0.678,0.663,0.663,1]},
    {v:[-0.62,0.336875,-0.615,0.491875,-0.515,0.421875],c:[0.522,0.522,0.522,1]},
    {v:[-0.505,0.291875,-0.64,0.331875,-0.52,0.411875],c:[0.522,0.522,0.522,1]},
    {v:[-0.62,0.496875,-0.57,0.526875,-0.465,0.461875],c:[0.153,0.149,0.149,1]},
    {v:[-0.505,0.421875,-0.46,0.451875,-0.61,0.491875],c:[0.153,0.149,0.149,1]},
    {v:[-0.61,0.491875,-0.365,0.341875,-0.31,0.376875],c:[0.153,0.149,0.149,1]},
    {v:[-0.4,0.191875,-0.26,0.121875,-0.205,0.141875],c:[0.153,0.149,0.149,1]},
    {v:[-0.205,0.306875,-0.195,0.166875,-0.255,0.116875],c:[0.153,0.149,0.149,1]},
    {v:[-0.255,0.276875,-0.2,0.306875,-0.195,0.141875],c:[0.153,0.149,0.149,1]},
    {v:[-0.395,0.206875,-0.39,0.326875,-0.25,0.276875],c:[0.153,0.149,0.149,1]},
    {v:[-0.38,0.186875,-0.27,0.146875,-0.265,0.146875],c:[0.153,0.149,0.149,1]},
    {v:[-0.265,0.146875,-0.26,0.261875,-0.385,0.201875],c:[0.153,0.149,0.149,1]},
    {v:[-0.355,0.321875,-0.32,0.361875,-0.21,0.296875],c:[0.153,0.149,0.149,1]},
    {v:[-0.225,0.151875,-0.285,0.156875,-0.27,0.281875],c:[0.153,0.149,0.149,1]},
    {v:[-0.49,0.256875,-0.365,0.426875,-0.41,0.201875],c:[0.678,0.663,0.663,1]},
    {v:[-0.38,0.446875,-0.42,0.391875,-0.405,0.351875],c:[0.678,0.663,0.663,1]},
    {v:[-0.4,0.351875,-0.335,0.411875,-0.375,0.436875],c:[0.678,0.663,0.663,1]},
    {v:[-0.36,0.401875,-0.375,0.426875,-0.495,0.276875],c:[0.522,0.522,0.522,1]},
    {v:[-0.49,0.291875,-0.46,0.311875,-0.455,0.421875],c:[0.522,0.522,0.522,1]},
    {v:[-0.5,0.411875,-0.455,0.431875,-0.495,0.271875],c:[0.522,0.522,0.522,1]},
    {v:[-0.375,0.291875,-0.275,0.261875,-0.265,0.156875],c:[0.522,0.522,0.522,1]},
    {v:[0.755,0.476875,0.9,0.276875,0.81,0.131875],c:[0.522,0.522,0.522,1]},
    {v:[0.75,0.476875,0.745,0.166875,0.795,0.136875],c:[0.522,0.522,0.522,1]},
    {v:[0.755,0.446875,0.82,0.246875,0.77,0.181875],c:[0.522,0.522,0.522,1]},
    {v:[-0.06,0.036875,0.03,0.111875,0.005,-0.228125],c:[0.851,0.349,0.349,1]},
    {v:[0.025,0.096875,0.09,-0.173125,0.015,-0.203125],c:[0.851,0.349,0.349,1]},
    {v:[0.035,-0.018125,0.12,0.051875,0.14,-0.018125],c:[0.851,0.349,0.349,1]},
    {v:[0.055,-0.073125,0.135,-0.018125,0.055,-0.028125],c:[0.851,0.349,0.349,1]},
    {v:[0.1,0.146875,0.16,0.206875,0.22,-0.033125],c:[0.851,0.349,0.349,1]},
    {v:[0.1,0.136875,0.175,-0.093125,0.21,-0.023125],c:[0.851,0.349,0.349,1]},
    {v:[0.37,0.201875,0.41,0.051875,0.485,0.071875],c:[0.851,0.349,0.349,1]},
    {v:[0.37,0.206875,0.43,0.226875,0.48,0.081875],c:[0.851,0.349,0.349,1]},
    {v:[0.43,0.226875,0.545,0.276875,0.58,0.201875],c:[0.851,0.349,0.349,1]},
    {v:[0.45,0.151875,0.525,0.206875,0.57,0.196875],c:[0.851,0.349,0.349,1]}
  ];

  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    shapesList.push(new Triangle(d.v[0],d.v[1],d.v[2],d.v[3],d.v[4],d.v[5],d.c));
  }
  renderAllShapes();
}

// converts HSL (h: 0-360, s: 0-1, l: 0-1) to an RGBA array
function hslToRgb(h, s, l) {
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs((h / 60) % 2 - 1));
  var m = l - c / 2;
  var r, g, b;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [r + m, g + m, b + m, 1.0];
}
