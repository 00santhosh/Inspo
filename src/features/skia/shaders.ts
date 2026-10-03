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

half4 main(float2 xy) {
  float2 p = mod(xy - origin + cell * 0.5, cell) - cell * 0.5;
  float a = 1.0 - smoothstep(radius - 0.6, radius + 0.6, length(p));
  return mix(background, dotColor, half(a));
}
`);

/**
 * The balloon: an image filter that bulges the canvas as if pushed up from behind.
 *
 * Inside the radius the content is magnified, most at the centre and easing back to 1x
 * at the rim, so neighbouring tiles curve and stretch around the edge. The centre shows
 * the area around `source` (the held tile) even though the bulge sits at `center`
 * (above the finger), blending back to the real position at the rim. Light falls from
 * the top-left across the dome, and a soft shadow rings the outside.
 */
export const bulgeEffect = lazy(`
uniform shader image;
uniform float2 center;
uniform float2 source;
uniform float radius;
uniform float strength;
uniform float zoom;

half4 main(float2 xy) {
  float2 d = xy - center;
  float r = length(d) / radius;

  if (r >= 1.0) {
    half4 c = image.eval(xy);
    float ring = 1.0 - smoothstep(1.0, 1.35, r);
    c.rgb *= half(1.0 - 0.32 * strength * ring);
    return c;
  }

  // 1 at the centre, 0 at the rim, with zero slope at both ends so there is no seam.
  float w = 1.0 - r * r;
  w = w * w;
  float z = mix(1.0, zoom, strength);
  float s = 1.0 - (1.0 - 1.0 / z) * w;
  float2 p = center + d * s + (source - center) * (w * strength);
  half4 c = image.eval(p);

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
`);
