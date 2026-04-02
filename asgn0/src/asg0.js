function main() {
  handleDrawEvent();
}

function handleDrawEvent() {
  var canvas = document.getElementById('example');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return false;
  }

  var ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var v1x = parseFloat(document.getElementById('v1x').value);
  var v1y = parseFloat(document.getElementById('v1y').value);
  var v1 = new Vector3([v1x, v1y, 0]);

  drawVector(v1, 'red');

  var v2x = parseFloat(document.getElementById('v2x').value);
  var v2y = parseFloat(document.getElementById('v2y').value);
  var v2 = new Vector3([v2x, v2y, 0]);

  drawVector(v2, 'blue');
}

function handleDrawOperationEvent() {
  var canvas = document.getElementById('example');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return false;
  }

  var ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var v1x = parseFloat(document.getElementById('v1x').value);
  var v1y = parseFloat(document.getElementById('v1y').value);
  var v1 = new Vector3([v1x, v1y, 0]);
  drawVector(v1, 'red');

  var v2x = parseFloat(document.getElementById('v2x').value);
  var v2y = parseFloat(document.getElementById('v2y').value);
  var v2 = new Vector3([v2x, v2y, 0]);
  drawVector(v2, 'blue');

  var op = document.getElementById('operation').value;
  var scalar = parseFloat(document.getElementById('scalar').value);

  if (op === 'add') {
    var v3 = new Vector3([v1x, v1y, 0]);
    v3.add(v2);
    drawVector(v3, 'green');
  } else if (op === 'sub') {
    var v3 = new Vector3([v1x, v1y, 0]);
    v3.sub(v2);
    drawVector(v3, 'green');
  } else if (op === 'mul') {
    var v3 = new Vector3([v1x, v1y, 0]);
    v3.mul(scalar);
    drawVector(v3, 'green');
    var v4 = new Vector3([v2x, v2y, 0]);
    v4.mul(scalar);
    drawVector(v4, 'green');
  } else if (op === 'div') {
    var v3 = new Vector3([v1x, v1y, 0]);
    v3.div(scalar);
    drawVector(v3, 'green');
    var v4 = new Vector3([v2x, v2y, 0]);
    v4.div(scalar);
    drawVector(v4, 'green');
  } else if (op === 'magnitude') {
    console.log('Magnitude of v1: ' + v1.magnitude());
    console.log('Magnitude of v2: ' + v2.magnitude());
  } else if (op === 'normalize') {
    var v3 = new Vector3([v1x, v1y, 0]);
    v3.normalize();
    drawVector(v3, 'green');
    var v4 = new Vector3([v2x, v2y, 0]);
    v4.normalize();
    drawVector(v4, 'green');
  } else if (op === 'angleB') {
    console.log('Angle: ' + angleBetween(v1, v2));
  } else if (op === 'area') {
    console.log('Area of the triangle: ' + areaTriangle(v1, v2));
  }
}

function drawVector(v, color) {
  var canvas = document.getElementById('example');
  var ctx = canvas.getContext('2d');

  var centerX = canvas.width / 2;
  var centerY = canvas.height / 2;

  var x = v.elements[0];
  var y = v.elements[1];

  var scale = 20;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + x * scale, centerY - y * scale);
  ctx.stroke();
}

function angleBetween(v1, v2) {
  var dot = Vector3.dot(v1, v2);
  var mag1 = v1.magnitude();
  var mag2 = v2.magnitude();
  var cosAngle = dot / (mag1 * mag2);
  var angleRad = Math.acos(cosAngle);
  return angleRad * (180 / Math.PI);
}

function areaTriangle(v1, v2) {
  var cross = Vector3.cross(v1, v2);
  return cross.magnitude() / 2;
}
