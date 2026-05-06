
class Circle {
    constructor(x, y, radius, color, segments) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.color = color;
      this.segments = segments || 20;
    }
  
    render(gl, a_Position, u_FragColor) {
      var vertices = [];
      var angleStep = (2 * Math.PI) / this.segments;
      
      vertices.push(this.x, this.y);
      
      for (var i = 0; i <= this.segments; i++) {
        var angle = i * angleStep;
        var px = this.x + this.radius * Math.cos(angle);
        var py = this.y + this.radius * Math.sin(angle);
        vertices.push(px, py);
      }
  
      var vertexBuffer = gl.createBuffer();
      if (!vertexBuffer) {
        console.log('Failed to create buffer');
        return;
      }
  
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  
      gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(a_Position);
  
      gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
  
      gl.drawArrays(gl.TRIANGLE_FAN, 0, this.segments + 2);
    }
  }