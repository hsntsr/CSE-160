// camera.js

class Camera {
    constructor(canvas) {
      this.fov = 60;
      this.eye = new Vector3([0, 1.6, 8]);
      this.at = new Vector3([0, 1.6, 7]);
      this.up = new Vector3([0, 1, 0]);
  
      this.viewMatrix = new Matrix4();
      this.projectionMatrix = new Matrix4();
  
      this.updateViewMatrix();
      this.updateProjectionMatrix(canvas.width / canvas.height);
    }
  
    updateViewMatrix() {
      this.viewMatrix.setLookAt(
        this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
        this.at.elements[0], this.at.elements[1], this.at.elements[2],
        this.up.elements[0], this.up.elements[1], this.up.elements[2]
      );
    }
  
    updateProjectionMatrix(aspect) {
      this.projectionMatrix.setPerspective(this.fov, aspect, 0.1, 1000);
    }
  
    getForward() {
      const f = new Vector3();
      f.set(this.at);
      f.sub(this.eye);
      f.normalize();
      return f;
    }
  
    moveForward(speed) {
      const f = this.getForward();
      f.mul(speed);
      this.eye.add(f);
      this.at.add(f);
      this.updateViewMatrix();
    }
  
    moveBackwards(speed) {
      const b = new Vector3();
      b.set(this.eye);
      b.sub(this.at);
      b.normalize();
      b.mul(speed);
      this.eye.add(b);
      this.at.add(b);
      this.updateViewMatrix();
    }
  
    moveLeft(speed) {
      const f = this.getForward();
      const s = Vector3.cross(this.up, f);
      s.normalize();
      s.mul(speed);
      this.eye.add(s);
      this.at.add(s);
      this.updateViewMatrix();
    }
  
    moveRight(speed) {
      const f = this.getForward();
      const s = Vector3.cross(f, this.up);
      s.normalize();
      s.mul(speed);
      this.eye.add(s);
      this.at.add(s);
      this.updateViewMatrix();
    }
  
    panLeft(alphaDeg) {
      const f = new Vector3();
      f.set(this.at);
      f.sub(this.eye);
  
      const rotationMatrix = new Matrix4();
      rotationMatrix.setRotate(
        alphaDeg,
        this.up.elements[0], this.up.elements[1], this.up.elements[2]
      );
  
      const fPrime = rotationMatrix.multiplyVector3(f);
  
      this.at.set(this.eye);
      this.at.add(fPrime);
      this.updateViewMatrix();
    }
  
    panRight(alphaDeg) {
      this.panLeft(-alphaDeg);
    }
  
    // Mouse-look vertical rotation around the camera right axis.
    panVertical(alphaDeg) {
      const f = new Vector3();
      f.set(this.at);
      f.sub(this.eye);
  
      const right = Vector3.cross(f, this.up);
      right.normalize();
  
      const rotationMatrix = new Matrix4();
      rotationMatrix.setRotate(
        alphaDeg,
        right.elements[0], right.elements[1], right.elements[2]
      );
  
      const fPrime = rotationMatrix.multiplyVector3(f);
      fPrime.normalize();
  
      // Clamp so the camera cannot flip upside-down.
      const dotUp = fPrime.elements[0] * this.up.elements[0] +
        fPrime.elements[1] * this.up.elements[1] +
        fPrime.elements[2] * this.up.elements[2];
      if (Math.abs(dotUp) > 0.97) return;
  
      this.at.set(this.eye);
      fPrime.mul(f.magnitude());
      this.at.add(fPrime);
      this.updateViewMatrix();
    }
  }