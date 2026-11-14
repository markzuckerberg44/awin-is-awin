const vertexSource = `
attribute vec2 aPosition;
varying vec2 vPosition;
void main() {
  vPosition = aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uCoast;
uniform vec2 uFrame;
uniform vec2 uGrid;
uniform float uBearing;
uniform float uLens;
varying vec2 vPosition;

void main() {
  float halfView = atan(uLens) / 2.5;
  float center = 0.5 + uBearing * (0.49 - halfView);
  vec2 uv = vec2(center + atan(vPosition.x * uLens) / 2.5, 0.5 - vPosition.y * 0.497);
  gl_FragColor = texture2D(uCoast, (uv + uFrame) / uGrid);
}`

export function createPanorama(canvas: HTMLCanvasElement, image: HTMLImageElement, columns = 1, rows = 1) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
  if (!gl) return

  function compile(type: number, source: string) {
    const shader = gl!.createShader(type)!
    gl!.shaderSource(shader, source)
    gl!.compileShader(shader)
    return shader
  }

  const vertex = compile(gl.VERTEX_SHADER, vertexSource)
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()!
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return
  }

  gl.useProgram(program)
  const vertices = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.uniform1i(gl.getUniformLocation(program, 'uCoast'), 0)
  const bearingUniform = gl.getUniformLocation(program, 'uBearing')
  const lensUniform = gl.getUniformLocation(program, 'uLens')
  const frameUniform = gl.getUniformLocation(program, 'uFrame')
  gl.uniform2f(gl.getUniformLocation(program, 'uGrid'), columns, rows)

  return {
    draw(bearing: number, lens: number, width: number, height: number, frame = 0) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
      gl.uniform1f(bearingUniform, bearing)
      gl.uniform1f(lensUniform, lens)
      gl.uniform2f(frameUniform, frame % columns, Math.floor(frame / columns))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    destroy() {
      gl.deleteTexture(texture)
      gl.deleteBuffer(vertices)
      gl.deleteProgram(program)
    },
  }
}
