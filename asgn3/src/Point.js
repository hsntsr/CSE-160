
class Point {
  constructor(x, y, color, size) {
    this.type = 'point';
    this.position = [x, y, 0.0];
    this.color = color;
    this.size = size;
  }

  render() {
    gl.disableVertexAttribArray(a_Position);

    // set position
    gl.vertexAttrib3f(a_Position, this.position[0], this.position[1], this.position[2]);

    // set color
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);

    // set size
    gl.uniform1f(u_PointSize, this.size);

    // draw the point
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}
