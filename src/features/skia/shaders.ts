import { Skia, type SkRuntimeEffect } from '@shopify/react-native-skia';

// Compiled on first use: on web, Skia's runtime only exists once LoadSkiaWeb() resolves.
function lazy(source: string) {
  let effect: SkRuntimeEffect | null = null;
  return () => {
    if (!effect) {
      effect = Skia.RuntimeEffect.Make(source);
      if (!effect) throw new Error('Shader failed to compile');
    }
    return effect;
  };
}

const DOTS = `
half4 dotsAt(float2 xy, float2 origin, float cell, float radius, half4 dotColor, half4 background) {
  float2 p = mod(xy - origin + cell * 0.5, cell) - cell * 0.5;
  float a = 1.0 - smoothstep(radius - 0.6, radius + 0.6, length(p));
  return mix(background, dotColor, half(a));
}
`;

/**
 * Dot grid in screen space. Dots sit at `origin + n * cell`, so passing the canvas's
 * pan offset and zoomed spacing keeps them fixed to the world.
 */
export const dotGridEffect = lazy(`
uniform float2 origin;
uniform float cell;
uniform float radius;
uniform half4 dotColor;
uniform half4 background;
${DOTS}
half4 main(float2 xy) {
  return dotsAt(xy, origin, cell, radius, dotColor, background);
}
`);

const BULGE_UNIFORMS = `
uniform float2 center;
uniform float2 source;
uniform float radius;
uniform float strength;
uniform float zoom;
`;

/**
 * The balloon, as if the canvas were pushed up from behind. Inside the radius the
 * content is magnified evenly across the middle (so what is under the finger shows
 * large and undistorted) and eases back to 1x towards the rim, where neighbouring tiles
 * are squeezed, curved and stretched. The centre shows the area around `source` (the
 * finger) although the bulge sits at `center` (above it), blending back to the real
 * position at the rim. Light falls from the top-left across the dome and a soft shadow
 * rings the outside.
 *
 * Each variant defines `sampleScene(p)` before this.
 */
const BULGE = `
half4 bulge(float2 xy) {
  float2 d = xy - center;
  float r = length(d) / radius;

  if (r >= 1.0) {
    half4 c = sampleScene(xy);
    float ring = 1.0 - smoothstep(1.0, 1.35, r);
    c.rgb *= half(1.0 - 0.32 * strength * ring);
    return c;
  }

  // Flat (full zoom) across the middle, falling to 0 at the rim with zero slope at both
  // ends of the fall, so there is no visible seam.
  float w = 1.0 - smoothstep(0.45, 1.0, r);
  float z = mix(1.0, zoom, strength);
  float s = 1.0 - (1.0 - 1.0 / z) * w;
  float2 p = center + d * s + (source - center) * (w * strength);
  half4 c = sampleScene(p);

  // Shade the dome: brighter towards the top-left, darker towards the rim.
  float2 n = d / radius;
  float edge = 1.0 - w;
  float light = 1.0 + strength * (0.08 * w - 0.10 * n.y * edge - 0.05 * n.x * edge);
  c.rgb *= half(light);
  c.rgb *= half(1.0 - 0.32 * strength * smoothstep(0.78, 1.0, r));

  // A soft specular highlight near the top-left.
  float2 h = n - float2(-0.34, -0.44);
  c.rgb += half3(0.14 * strength * exp(-dot(h, h) * 10.0));
  return c;
}

half4 main(float2 xy) { return bulge(xy); }
`;

/** Native: an image filter over the live canvas (the filtered content is `image`). */
export const bulgeFilterEffect = lazy(`
uniform shader image;
${BULGE_UNIFORMS}
half4 sampleScene(float2 p) { return image.eval(p); }
${BULGE}
`);

/**
 * Web: CanvasKit has no runtime-shader image filter, so the canvas is recorded as a
 * picture and passed in as `scene` (transparent between tiles), with the dot grid drawn
 * underneath here. The uniforms are passed as a flat array in declaration order.
 */
export const bulgePictureEffect = lazy(`
uniform shader scene;
${BULGE_UNIFORMS}
uniform float2 origin;
uniform float cell;
uniform float dotRadius;
uniform half4 dotColor;
uniform half4 background;
${DOTS}
half4 sampleScene(float2 p) {
  half4 c = scene.eval(p);
  return c + dotsAt(p, origin, cell, dotRadius, dotColor, background) * (1.0 - c.a);
}
${BULGE}
`);
