document.getElementById("app").innerHTML = `
<h1>Hello Vanilla!</h1>
<div>
  We use the same configuration as Parcel to bundle this sandbox, you can find more
  info about Parcel
  <a href="https://parceljs.org" target="_blank" rel="noopener noreferrer">here</a>.
</div>
`;

const fragmentShaderSource = `
precision mediump float;

const int MAX_MARCHING_STEPS = 64;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float EPSILON = 0.001;

uniform float iTime; // We use a uniform for time input
uniform vec2 iResolution; // And another uniform for resolution input

mat3 rotateY(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat3(
    vec3(c, 0, s),
    vec3(0, 1, 0),
    vec3(-s, 0, c)
  );
}

float sphereSDF(vec3 p, float r) {
  return length(p) - r;
}

float smin( float a, float b, float k ) {
  float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
  return mix( b, a, h ) - k*h*(1.0-h);
}

float sceneSDF(vec3 samplePoint) {
  float ballRadius = 1.0;
  float t = iTime / 3.0 + 10500.0;
  float balls = MAX_DIST;
  for (float i = 1.0; i < 4.0; i += 1.3) {
    for (float j = 1.0; j < 4.0; j += 1.3) {
      float cost = cos(t * j);
      balls = smin(balls, sphereSDF(samplePoint + vec3(sin(t * i) * j, cost * i, cost * j), ballRadius), 0.7);
    }
  }

  return balls;
}

float shortestDistanceToSurface(vec3 eye, vec3 marchingDirection, float start, float end) {
  float depth = start;
  for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
    float dist = sceneSDF(eye + depth * marchingDirection);
    if (dist < EPSILON) {
      return depth;
    }
    depth += dist;
    if (depth >= end) {
      return end;
    }
  }
  return end;
}

vec3 rayDirection(float fieldOfView, vec2 size, vec2 fragCoord) {
  vec2 xy = fragCoord - size / 2.0;
  float z = size.y / tan(radians(fieldOfView) / 2.0);
  return normalize(vec3(xy, -z));
}

vec3 estimateNormal(vec3 p) {
  return normalize(vec3(
    sceneSDF(vec3(p.x + EPSILON, p.y, p.z)) - sceneSDF(vec3(p.x - EPSILON, p.y, p.z)),
    sceneSDF(vec3(p.x, p.y + EPSILON, p.z)) - sceneSDF(vec3(p.x, p.y - EPSILON, p.z)),
    sceneSDF(vec3(p.x, p.y, p.z  + EPSILON)) - sceneSDF(vec3(p.x, p.y, p.z - EPSILON))
  ));
}

mat3 viewMatrix(vec3 eye, vec3 center, vec3 up) {
  // Based on gluLookAt man page
  vec3 f = normalize(center - eye);
  vec3 s = normalize(cross(f, up));
  vec3 u = cross(s, f);
  return mat3(s, u, -f);
}

void main() {
  vec3 light0Pos = vec3(10.0, -2.0, -2.0);
  vec3 light0Color = vec3(1.0, 0.895, 0.733);

  vec3 light1Pos = vec3(-10.0, 1.0, -2.0);
  vec3 light1Color = vec3(0.718, 0.92, 0.953);

  vec3 light2Pos = vec3(-0.5, 0.0, 10.0);
  vec3 light2Color = vec3(0.464, 0.632, 0.872);

  vec3 viewDir = rayDirection(90.0, iResolution.xy, gl_FragCoord.xy);
  vec3 eye = /* rotateY(iTime / 3.0) * */ vec3(0.0, 0.0, 10.0);
  mat3 viewToWorld = viewMatrix(eye, vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
  vec3 worldDir = viewToWorld * viewDir;
  float dist = shortestDistanceToSurface(eye, worldDir, MIN_DIST, MAX_DIST);

  if (dist > MAX_DIST - EPSILON) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec3 p = eye + dist * worldDir;
  vec3 normal = estimateNormal(p);

  vec3 ambient = vec3(0.3);

  vec3 lightDir0 = normalize(light0Pos - p);
  vec3 lightDir1 = normalize(light1Pos - p);
  vec3 lightDir2 = normalize(light2Pos - p);

  float diffuse0 = max(dot(lightDir0, normal) * (40.0/pow(length(light0Pos-p), 2.0)), 0.0);
  float diffuse1 = max(dot(lightDir1, normal) * (40.0/pow(length(light1Pos-p), 2.0)), 0.0);
  float diffuse2 = max(dot(lightDir2, normal) * (40.0/pow(length(light2Pos-p), 2.0)), 0.0);

  vec3 diffuse = diffuse0 * light0Color + diffuse1 * light1Color + diffuse2 * light2Color;

  // vec3 diffuse = BlinnPhong(light0Color, lightDir0, normal, -p, vec3(0.5, 0.5, 0.5), 0.9, vec3(0.04)) + BlinnPhong(light1Color, lightDir1, normal, -p, vec3(0.5, 0.5, 0.5), 0.9, vec3(0.04));

  // vec4 tex = texture(iChannel0, reflect(worldDir, normal), 0.0);

  vec3 color = ambient + diffuse;

  gl_FragColor = vec4(color, 1.0);
}
`;

const vertexShaderSource = `
attribute vec3 position;
// You can add other attributes here, if needed

void main() {
  gl_Position = vec4(position, 1.0);
}`;

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initShaders(gl) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
    return null;
  }

  return program;
}

window.onload = function () {
  var canvas = document.getElementById("canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) {
    console.log("WebGL not supported, falling back on experimental-webgl");
    gl = canvas.getContext("experimental-webgl");
  }
  if (!gl) {
    alert("Your browser does not support WebGL");
  }

  // Set clear color to black, fully opaque
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  // Clear the color buffer with specified clear color
  gl.clear(gl.COLOR_BUFFER_BIT);

  const program = initShaders(gl);

  const programInfo = {
    program,
    attribLocations: {
      position: gl.getAttribLocation(program, "position"),
    },
    uniformLocations: {
      time: gl.getUniformLocation(program, "iTime"),
      resolution: gl.getUniformLocation(program, "iResolution"),
    },
  };

  const positions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  var animate = function (time) {
    var currentTime = time * 0.001;

    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.position);

    gl.uniform1f(programInfo.uniformLocations.time, currentTime);
    gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height);

    {
      const offset = 0;
      const vertexCount = 4;
      gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }

    // return;

    requestAnimationFrame(animate);
  };

  animate(0);
};
