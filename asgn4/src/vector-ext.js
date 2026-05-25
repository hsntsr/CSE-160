'use strict';

// Extend cuon-matrix Vector3 with methods used by camera.js
Vector3.prototype.set = function(src) {
  var v = src.elements;
  this.elements[0] = v[0]; this.elements[1] = v[1]; this.elements[2] = v[2];
  return this;
};

Vector3.prototype.add = function(other) {
  this.elements[0] += other.elements[0];
  this.elements[1] += other.elements[1];
  this.elements[2] += other.elements[2];
  return this;
};

Vector3.prototype.sub = function(other) {
  this.elements[0] -= other.elements[0];
  this.elements[1] -= other.elements[1];
  this.elements[2] -= other.elements[2];
  return this;
};

Vector3.prototype.mul = function(s) {
  this.elements[0] *= s; this.elements[1] *= s; this.elements[2] *= s;
  return this;
};

Vector3.prototype.magnitude = function() {
  var v = this.elements;
  return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
};

Vector3.cross = function(a, b) {
  var ae = a.elements, be = b.elements;
  return new Vector3([
    ae[1]*be[2] - ae[2]*be[1],
    ae[2]*be[0] - ae[0]*be[2],
    ae[0]*be[1] - ae[1]*be[0]
  ]);
};
