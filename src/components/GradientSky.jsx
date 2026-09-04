import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Two-colour gradient skydome.
 *
 * drei's <Environment> presets stream HDRIs from a CDN, which stalls the scene
 * on a slow or offline connection. This costs one sphere and no network, and
 * because the uniforms hold the caller's own THREE.Color objects, mutating
 * those colours animates the sky without a re-render - which is what the area
 * transitions rely on.
 */
const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
    gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
  }
`

export default function GradientSky({
  topColor,
  bottomColor,
  radius = 60,
  offset = 8,
  exponent = 0.7,
}) {
  const uniforms = useMemo(
    () => ({
      topColor: { value: topColor },
      bottomColor: { value: bottomColor },
      offset: { value: offset },
      exponent: { value: exponent },
    }),
    [topColor, bottomColor, offset, exponent]
  )

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 24, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}
