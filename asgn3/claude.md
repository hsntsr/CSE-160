##Rubric

Objectives:
To create a virtual world using textured cubes and explore it using a perspective camera.  

Introduction:
You will  create a first-person exploration application. Your application should look like the following example:

Assignment4_Animation.gif

A first-person camera (the player) should start in a given position of a 32x32x4 voxel-based 3D world (which is made out of textured cubes). The user should be able to navigate in this world using the keyboard and/or mouse to move and rotate the camera. Your application is required to have the following features:

The world is fully created when the application starts.
Ground is created with a large plane (square), or the top of a flattened (scaled)  cube.
Walls are created with cubes.
Walls can have different heights in units (1 cube, 2 cubes, 3 cubes and 4 cubes).
The faces of the cube should be textured to make it look like a wall.
The sky is created with a very large blue  cube that is placed at the center of the world 
The world layout should be specified using a hardcoded javascript 2D array.
Each element of the array represents the height of the wall (0, 1, 2, 3 or 4) that will be placed at that location.
Camera can be moved using the keyboard.
W moves camera forward.
A moves camera to the left.
S moves camera backwards
D moves camera to the right.
Q turn camera left
E turn camera right
Additional requirements without helper videos:

Camera can be rotated with the mouse. 
Add multiple textures to make your world more interesting.
Simple Minecraft: add and delete blocks in front of you. 
Add your animal(s) to your world
Change your ground plane from a flat plane to a terrain map OR get OBJ loader working
Add some sort of simple story or game to your world
Instructions:
The following will walk you through each point of the basic rubric.  Note that the written suggestions and video suggestions are not exactly the same. One may suggest to build a Class, while one just sticks a global variable. Or one may stick an 'if' statement in the shader while the other suggests an interpolation. Either is fine, or your own method is fine. You should do what you think makes cleaner better code. 

0. Start a local web server.
Before we can load a texture file, we are going to need a web server. You can't just click the HTML file anymore because of security issues. The book gives a way to bypass security and just use the browser, but you shouldn't bypass security. Make sure you can view your webpage through this local server. 

There is no rubric point for this since its not observable in your final output. 

The helper videos (which are a couple years old) talk about setting up a Python HTTP server. You don't need to do this. We instead recommend the Live Preview extension for VS Code (which you should already have installed if you've followed our Local Setup guide for the past few assignments).

- Texture Mapping (Matsuda Chapter 5)
This section will guide you to solve the following rubric points:

Texture working on at least one object.
Texture on some objects and color on some other objects. All working together.
1. Create a new attribute variable to store texture (UV) coordinates.
Read Matsuda pages 137-145.
Decide whether you want to use an extra buffer (textbook pages 137-140) or interleave a single buffer (textbook pages 141-145).
Either works, but make sure you can get this new attribute variable working.
You should be able to give each vertex a different UV coordinate.  
There is no rubric point for this since its not observable in your final output, but you need it working to get the texture working. 

2. Load Texture from the filesystem. 
Read Matsuda pages 146-178.
Use the TexturedQuad example (functions initTextures and loadTexture) to load a texture file (e.g. sky.jpg) from your filesystem.
Your texture must be square and size is a power of 2. e.g. 64x64 or 1024x1024. Resize it with an external program if you need to.
3. Pass the Texture to the fragment shader.
Read Matsuda pages 179-181.
Use the TexturedQuad example (fragment shader) to look up colors from texture.
4. Mix base color with texture color.
Your sky will be a gigantic cube with solid blue color surrounding the world. Your walls would be made of unit boxes that are textured. Thus, you need to use solid base colors in one object and textures in others. 

 Create a new uniform variable (e.g. called u_texColorWeight) to linear interpolate between a given base color and the texture color.
For example, assuming the base color is stored in a uniform baseColor and the texture color in another variable texColor. You can linear between this two colors as follows:
t = u_texColorWeight
gl_FragColor = (1 - t) * baseColor + t * texColor
Note that you can use u_texColorWeight=0 if you want only base color (for the sky box) and u_baseColorWeight=1 if you want only texture colors (for the walls).
- Camera (Matsuda Chapter 7)
This section will guide you to solve the following rubric points:

Implement camera movement.
Key commands for rotation work. Use Q (rotate left) & E (rotate right).
Perspective camera implemented.
5. Include both View and Projection matrices in your vertex shader.
Read Matsuda pages 179-181.
Use example "PerspectiveView_mvp" (vertex shader) to update your vertex shader to:
glPosition = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_position;

Note that the book has lots of examples that have some matrices, but not others. I believe this project is conceptually easier if you pass all three as uniforms to the vertex shader and multiply them there.  
6. Create a Camera class to store and control both View and Projection matrices.
Create a new file called camera.js and define a class called Camera that has the following attributes:
fov (field of view - float), initialize it to 60.
eye (Vector3), initialize it to (0,0,0).
at (Vector3), initialize it to (0,0,-1).
up (Vector3), initialize it to (0,1, 0).  
viewMatrix (Matrix4), initialize it with viewMatrix.setLookAt(eye.elements[0], ... at.elements[0], ..., up.elements[0], ...). 
projectionMatrix (Matrix4), initialize it with projectionMatrix.setPerspective(fov, canvas.width/canvas.height, 0.1, 1000).
In your camera class, create a function called "moveForward":
Compute forward vector f = at - eye. 
Create a new vector f: let f = new Vector3();
Set f to be equal to at: f.set(at);
Subtract eye from f: f.sub(eye);
Normalize f using f.normalize(); 
Scale f by a desired "speed" value: f.mul(speed)
Add forward vector to both eye and center: eye += f; at += f; 
In your camera class, create a function called "moveBackwards":
Same idea as moveForward, but compute backward  vector b = eye - at instead of forward.
In your camera class, create a function called "moveLeft":
Compute forward vector f = at - eye. 
Compute side vector s = up x f (cross product between up and forward vectors).
 Normalize s using s.normalize();
Scale s by a desired "speed" value:  s.mul(speed)
Add side vector to both eye and center: eye += s; at += s; 
In your camera class, create a function called "moveRight":
Same idea as moveLeft, but compute the opposite side vector s = f x up.
In your camera class, create a function called "panLeft":
Compute the forward vector  f = at - eye;
Rotate the vector f by alpha (decide a value) degrees around the up vector.
Create a rotation matrix: rotationMatrix.setRotate(alpha, up.x, up.y, up.z).
Multiply this matrix by f to compute f_prime = rotationMatrix.multiplyVector3(f);
Update the "at"vector to be at = eye + f_prime;
In your camera class, create a function called "panRight":
Same idea as panLeft, but rotate u by -alpha degrees around the up vector.
7. Set View matrix using keyboard input. 
In your main function, instantiate a global camera object.
camera = new Camera()
When user hits W, call camera.moveForward()
When user hits S, call camera.moveBackwards()
When user hits A, call camera.moveLeft()
When user hits Q call camera.panLeft()
When user hits E call camera.panRight()
- World Creation
Make sure you have your camera working already with keyboard control. If not, go do that section first. You can't debug your world if you cant actually see all of it.

This section will guide you to solve the following rubric points:

Have a ground created with a flattened cube and sky from a big cube.
World is implemented. There is some interesting world (or terrain) to walk around.
8. Add a ground to the world. 
Create a cube using the code you wrote in Assignment 2.
Scale the cube on the y axis to make it a flat plane.
Rotate this cube to put it in the x-z plane.
9. Add a sky box to the world. 
Create a cube using the code you wrote in Assignment 2.
Place this cube in the center of the world and scale it  by a very high number (e.g. 1000).
10. Add walls to the world. 
Placing cubes manually in the world  will genuinely suck  if you need 100s of cubes to specify your world. Instead we will build it programatically.

Define a small 2D array: map = [[ 1 0 0 1] [1 1 0 1] [ 1 0 0 1] [ 1 1 1 1 ]].
Write a double loop to create a wall wherever there is a 1.
   walls = [];
   for x = 1 ... 4:
      for z = 1 .. 4: 
         if map[i][j] == 1 {
              let w = new Cube();
              w.translate(x, 0, z);
              walls.push(w); 
         }
      }
   }. 
Expand your map to 32x32.

Instead of just making a 1 unit wall, make the wall N units high according to what you put in the 2d map array.

Include a third for loop to iterate on the height and translate the y coordinates of the walls.
You don't need to specify your map exactly like this if you want to be more fancy. Making just walls wont allow your world to have ceilings.  You just need to end up with a world that is at least 32x32. You can't just write 100 hardcoded calls to drawCube() in your code. You should be able to 'edit the map'.

- Requirements without helper videos
Rotate camera with mouse. 
- Most games have this control. You need to add an onMove() function and map this to the rotation you previously had on QE keys. Its a little tricky since with keys you can just turn 5degrees, but with mouse you have to keep track of the old mouse location and figure out an appropriate amount to turn based on the new mouse location. 

Multiple textures
The book talks about multiple textures on pg 183. The easiest way to handle multiple textures is to just set up the samplers and texture units for all the textures and then just leave them (you dont need to pass all the textures with each drawArrays(), they will stay there). Just use a uniform variable to specify which texture to use and update this uniform before each call to drawCube(). Now different cubes can have different textures. You'll have to modify your map to say which kind of cube to draw as well. You may want to update your sky to have a different texture and ground as well. You can have up to 8 textures at a time loaded in webGL. 

Simple Minecraft
Add and delete blocks in front of you. You do not need a raytracer, and you dont need full 3D pointing. You know your camera location and you know your map. Just find the map square right in front of you and add or delete a block from the stack of blocks that is there. Its super cool if you can save/load whatever world your create, but not required.

Add some sort of simple story or game to your world
e.g. Your animal takes care of a herd of baby animals, or pacman, or mini-minecraft and the mob wants to get you, or your animal puts on a puppet show as a story plays,. Use your creativity!

Performance
You may have efficiency issues, most people do on this assignment. If this is the case reduce world size until you can debug and interact. However to get this rubric point, you need to run 10fps with a full 32x32 world. 

Wow!
This is intentionally vague. Its meant to leave you some space to do something you want to spend time on. You could make an impressive beautiful world. Past versions of this assignment talked about adding OBJ files or terrain maps to make it unique. But whatever you do, your goal is Wow!

FAQ:
But I want to load my world from a file. Hard coding is stupid! - Yep. Hard coding is stupid. But its much easier. Load from a file if you want to do that. Then you can even load different 'game levels' from different files.
How can I improve performance? - The primary issue is likely that you are rendering only one triangle at a time (since thats how the videos have showed it). That is, calling drawArrays() for each triangle. This is inefficient. It is possible to stack all the triangles you want to draw into a single vertexList and pass the whole thing to a single drawArrays() call. This will be much more efficient. The other big efficiency issue is allocating memory that is then garbage collected. Minimize the number of times new() is called in your code. If its in your rendering loop and happening every frame, then its probably too much.
Resources:

(WebGL) Matsuda/Lea Ch5 (About texture)
(WebGL) Matsuda/Lea Ch7 (About cameras and keyboard events (you dont need pg 276-289 about drawElements())
(WebGL) Camera Movement Tutorial: http://learnwebgl.brown37.net/07_cameras/camera_movement.htmlLinks to an external site.
(HTML/Javascript) How to handle keyboard events: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEventLinks to an external site.
What to Turn in:

Canvas Submission
Zip your entire project and submit it to Canvas under the appropriate assignment. Name your zip file "[FirstName]_[LastName]_Assignment_0.zip" (e.g. "Lucas_Ferreira_Assignment_0.zip").

Live Hosted Submission
You will upload your submission to GitHub Pages (or any other service of your choosing). If you use GitHub Pages, click here to learn how to set it up.

WHEN SUBMITTING YOUR PROJECT ON CANVAS, PLACE YOUR SITE LINK AS A COMMENT OF THE SUBMISSION.

Read the Submission Guide for further explanation on how to submit your assignment. 

Assignment 3 Rubric (2)
Assignment 3 Rubric (2)
Criteria	Ratings	Points
Have a ground created with a flattened cube and sky from a big cube.

Full Marks
0.5 pts

No Marks
0 pts
/0.5 pts
Texture working on at least one object.

Full Marks
1 pts

No Marks
0 pts
/1 pts
Texture on some objects and color on some other objects. All working together.

Full Marks
0.5 pts

No Marks
0 pts
/0.5 pts
Implement camera movement.
view longer description

Full Marks
1 pts

No Marks
0 pts
/1 pts
Key commands for rotation work. Use Q (rotate left) & E (rotate right).

Full Marks
1 pts

No Marks
0 pts
/1 pts
Perspective camera implemented.

Full Marks
0.5 pts

No Marks
0 pts
/0.5 pts
World is implemented. There is some interesting world to walk around.

Full Marks
1.5 pts

No Marks
0 pts
/1.5 pts
Rotate camera with the mouse
view longer description

Full Marks
0.5 pts

No Marks
0 pts
/0.5 pts
Multiple textures
view longer description

Full Marks
1 pts

No Marks
0 pts
/1 pts
Add/delete blocks

Full Marks
0.5 pts

No Marks
0 pts
/0.5 pts
Add simple story or game to world

Full Marks
1 pts

No Marks
0 pts
/1 pts
Performance
view longer description

Full Marks
0.5 pts

No Marks
0 pts
/0.5 pts
Wow!
view longer description

Full Marks
0.5 pts

No Marks
0 pts
/0.5 pts


## Reading

WebGL Implementation Guide: Camera and Textures
This document outlines the core WebGL concepts from Matsuda and Lea's WebGL Programming Guide required to implement perspective camera movement, keyboard events, and mixed texture/color mapping.
1. Camera Implementation (Matsuda Chapter 7)
To satisfy the camera movement, perspective, and rotation rubric points, you will use WebGL's matrix transformation techniques combined with JavaScript's event listeners.
Perspective Camera Setup
To implement a perspective camera rather than a default orthographic view, you must calculate a perspective projection matrix
. This creates a viewing volume shaped like a quadrangular pyramid, giving the scene a realistic sense of depth where objects further away appear smaller
.
Use the Matrix4.setPerspective(fov, aspect, near, far) method to define this volume
.
This projection matrix must be multiplied by your view matrix and model matrix (often combined into a single u_MvpMatrix) to properly transform your vertices in the vertex shader
.
Camera Movement & View Matrix
The camera's position and orientation in the 3D world are controlled by the view matrix
.
Use Matrix4.setLookAt(eyeX, eyeY, eyeZ, atX, atY, atZ, upX, upY, upZ) to define the eye point (where you are looking from), the look-at point (where you are looking), and the up direction
,
.
To implement camera movement, you simply update the variables driving the eye or look-at coordinates and recalculate the view matrix before redrawing the scene
.
Key Commands for Rotation (Q & E)
To implement camera rotation using the Q and E keys, you must register a JavaScript event handler for keyboard inputs
,
.
Map the document.onkeydown event to a custom handler function (e.g., keydown(ev, ...)). Inside this function, check the ev.keyCode to determine which key was pressed
,
.
When the Q (rotate left) or E (rotate right) keys are pressed, modify the global variables representing your camera's angle or look-at point, then call your draw() function to re-render the scene with the updated matrices
,
.
2. Texture Mapping & Color (Matsuda Chapter 5)
To meet the rubric points for rendering textures on at least one object while rendering colors on others, you must combine WebGL's rasterization processes for varying colors and texture images.
Implementing Textures
Texture mapping involves pasting an image onto a geometric shape by associating texture coordinates (s, t) with vertex coordinates (x, y, z)
,
.
Buffer Setup: Create a buffer to pass texture coordinates to the vertex shader using an attribute variable (e.g., a_TexCoord), and then pass it to the fragment shader via a varying variable (v_TexCoord)
.
Loading Images: Create a JavaScript Image object and specify an onload asynchronous event handler to trigger the WebGL texture setup only after the image finishes loading
,
.
Configuring WebGL: In your load function, flip the image's Y-axis using gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1) to match WebGL's coordinate system
. Activate a texture unit with gl.activeTexture(gl.TEXTURE0), bind the texture object with gl.bindTexture(), and allocate the image to the texture using gl.texImage2D()
,
,
.
Fragment Shader: Use the texture2D(u_Sampler, v_TexCoord) function to extract the texel color and assign it to gl_FragColor
,
.
Textures and Colors Working Together
By default, you can pass standard colors to the fragment shader via a v_Color varying variable
,
. To have textures on some objects and colors on others, you need a mechanism to switch between v_Color and texture2D() in your fragment shader:
Option 1 (Unified Shader with a Flag): You can pass a uniform int or bool flag into your fragment shader. When drawing your colored objects, set the flag so the shader assigns gl_FragColor = v_Color;
. When drawing your textured objects, change the uniform flag so the shader assigns gl_FragColor = texture2D(u_Sampler, v_TexCoord);
.
Option 2 (Switching Shader Programs): Alternatively, you can create two distinct program objects (one initialized with color shaders, one with texture shaders) and switch between them during your draw cycle using gl.useProgram()
,
.

Here are the specific code examples from the Matsuda textbook (TexturedQuad.js and MultiAttributeSize_Interleaved.js) that correspond to your texture mapping instructions.
1. Create a new attribute variable to store texture (UV) coordinates
First, prepare the vertex shader to receive the texture coordinates (a_TexCoord) and pass them to the fragment shader via a varying variable (v_TexCoord)
:
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec2 a_TexCoord;\n' +
  'varying vec2 v_TexCoord;\n' +
  'void main() {\n' +
  '  gl_Position = a_Position;\n' +
  '  v_TexCoord = a_TexCoord;\n' +
  '}\n';
If you use an interleaved buffer (combining vertex coordinates and texture coordinates into a single array), your buffer setup will look similar to this
:
var verticesTexCoords = new Float32Array([
  // Vertex coordinates and texture coordinates (s, t)
  -0.5,  0.5,   0.0, 1.0,
  -0.5, -0.5,   0.0, 0.0,
   0.5,  0.5,   1.0, 1.0,
   0.5, -0.5,   1.0, 0.0
]);

var FSIZE = verticesTexCoords.BYTES_PER_ELEMENT;

// Assign the vertex coordinates
gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 4, 0);
gl.enableVertexAttribArray(a_Position);

// Assign the texture coordinates (starts after 2 elements, so offset is FSIZE * 2)
gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, FSIZE * 4, FSIZE * 2);
gl.enableVertexAttribArray(a_TexCoord);
2. Load Texture from the filesystem
Use the initTextures and loadTexture functions from the TexturedQuad example to asynchronously load and configure your image
:
function initTextures(gl, n) {
  var texture = gl.createTexture();   // Create a texture object
  
  // Get the storage location of the u_Sampler
  var u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
  
  var image = new Image();  // Create an image object
  
  // Register the event handler to be called on loading an image
  image.onload = function(){ loadTexture(gl, n, texture, u_Sampler, image); };
  
  // Tell the browser to load an image
  image.src = '../resources/sky.jpg';

  return true;
}

function loadTexture(gl, n, texture, u_Sampler, image){
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  
  // Enable the texture unit 0
  gl.activeTexture(gl.TEXTURE0);
  
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler, 0);
  
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, n); // Draw a rectangle
}
3. Pass the Texture to the fragment shader
Finally, use the fragment shader from the TexturedQuad example to look up the colors from the loaded texture using the texture2D built-in function
:
// Fragment shader program
var FSHADER_SOURCE =
  'uniform sampler2D u_Sampler;\n' +
  'varying vec2 v_TexCoord;\n' +
  'void main() {\n' +
  '  gl_FragColor = texture2D(u_Sampler, v_TexCoord);\n' +
  '}\n';