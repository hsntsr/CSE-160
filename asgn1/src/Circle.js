
class Circle {
  constructor(x, y, size, color, segments) {
    this.type = 'circle';
    this.position = [x, y, 0.0];
    this.color = color;
    this.size = size;
    this.segments = segments || 10;
  }

  render() {
    var xy = this.position;
    var rgba = this.color;

    // Pass the color to u_FragColor
    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);

    // Draw
    var d = this.size / 200.0; // delta - radius in WebGL coords
    var angleStep = 360 / this.segments;

    for (var angle = 0; angle < 360; angle = angle + angleStep) {
      var angle1 = angle;
      var angle2 = angle + angleStep;
      var vec1 = [Math.cos(angle1 * Math.PI/180) * d, Math.sin(angle1 * Math.PI/180) * d];
      var vec2 = [Math.cos(angle2 * Math.PI/180) * d, Math.sin(angle2 * Math.PI/180) * d];
      var pt1 = [xy[0] + vec1[0], xy[1] + vec1[1]];
      var pt2 = [xy[0] + vec2[0], xy[1] + vec2[1]];
      drawTriangle([xy[0], xy[1], pt1[0], pt1[1], pt2[0], pt2[1]]);
    }
  }
}
