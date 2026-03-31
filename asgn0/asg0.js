// asg0.js
function main() {
  // Initial setup - draw the default vectors
  handleDrawEvent();
}

function handleDrawEvent() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('example');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return false;
  }

  // Get the rendering context for 2DCG
  var ctx = canvas.getContext('2d');

  // Clear the canvas with black background
  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Read v1 values from text boxes
  var v1x = parseFloat(document.getElementById('v1x').value);
  var v1y = parseFloat(document.getElementById('v1y').value);
  var v1 = new Vector3([v1x, v1y, 0]);

  // Draw the red vector
  drawVector(v1, 'red');

  // Read v2 values from text boxes
  var v2x = parseFloat(document.getElementById('v2x').value);
  var v2y = parseFloat(document.getElementById('v2y').value);
  var v2 = new Vector3([v2x, v2y, 0]);

  // Draw the blue vector
  drawVector(v2, 'blue');
}

function drawVector(v, color) {
  var canvas = document.getElementById('example');
  var ctx = canvas.getContext('2d');

  // Get the canvas center (400x400 canvas, so center is at 200, 200)
  var centerX = canvas.width / 2;
  var centerY = canvas.height / 2;

  // Get vector coordinates
  var x = v.elements[0];
  var y = v.elements[1];

  // Scale by 20 to make it easier to visualize
  var scale = 20;

  // Draw the vector from center to (center + v*scale)
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  // Note: In canvas, y increases downward, so we negate y
  ctx.lineTo(centerX + x * scale, centerY - y * scale);
  ctx.stroke();
}
