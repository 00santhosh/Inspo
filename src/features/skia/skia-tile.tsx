import {
  BlurMask,
  Group,
  Image,
  Paragraph,
  Path,
  Rect,
  RoundedRect,
  Skia,
  rect,
  rrect,
  useVideo,
  type SkImage,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import type { TileRect } from '@/features/canvas/layout';
import { FONT_FAMILY } from '@/features/skia/resources';
import { formatDuration, hostOf } from '@/lib/format';
import type { Item } from '@/lib/types';
import { colors, radius } from '@/theme/tokens';

type TextOpts = { size: number; color: string; weight?: number; maxLines?: number; lineHeight?: number };

function makeParagraph(fonts: SkTypefaceFontProvider, text: string, o: TextOpts): SkParagraph {
  return Skia.ParagraphBuilder.Make({ maxLines: o.maxLines ?? 1, ellipsis: '…' }, fonts)
    .pushStyle({
      color: Skia.Color(o.color),
      fontFamilies: [FONT_FAMILY],
      fontSize: o.size,
      fontStyle: { weight: o.weight ?? 400 },
      heightMultiplier: o.lineHeight,
    })
    .addText(text)
    .build();
}

/** Stable pseudo-random bar heights (0.25–1) for a placeholder waveform. */
function barHeights(seed: string, count: number): number[] {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(0.25 + ((h >>> 16) % 100) / 133);
  }
  return out;
}

const PLAY_PATH = 'M0 0.6v5.8c0 .45.5.72.88.47l4.6-2.9a.55.55 0 0 0 0-.94L.88.13C.5-.12 0 .15 0 .6z';

type Props = {
  item: Item;
  r: TileRect;
  image: SkImage | null;
  fonts: SkTypefaceFontProvider | null;
  /** Play the video inside the tile (only for the tile under the bulge). */
  playing?: boolean;
};

/** One canvas tile, drawn by Skia in world units. */
export const SkiaTile = memo(function SkiaTile({ item, r, image, fonts, playing }: Props) {
  const box = useMemo(() => rrect(rect(r.x, r.y, r.w, r.h), radius.tile, radius.tile), [r]);
  const shadow = useMemo(() => rrect(rect(r.x, r.y + 4, r.w, r.h), radius.tile, radius.tile), [r]);
  return (
    <Group>
      <RoundedRect rect={shadow} color="rgba(0, 0, 0, 0.5)">
        <BlurMask blur={9} style="normal" />
      </RoundedRect>
      <Group clip={box}>
        <Rect x={r.x} y={r.y} width={r.w} height={r.h} color={item.kind === 'note' || item.kind === 'voice' ? colors.surfaceRaised : colors.surface} />
        <TileBody item={item} r={r} image={image} fonts={fonts} playing={playing} />
      </Group>
      <RoundedRect rect={box} style="stroke" strokeWidth={0.6} color="rgba(255, 255, 255, 0.09)" />
    </Group>
  );
});

function TileBody({ item, r, image, fonts, playing }: Props) {
  switch (item.kind) {
    case 'image':
      return image ? <Image image={image} x={r.x} y={r.y} width={r.w} height={r.h} fit="cover" /> : null;
    case 'video':
      return (
        <>
          {image ? <Image image={image} x={r.x} y={r.y} width={r.w} height={r.h} fit="cover" /> : null}
          {playing && item.mediaUrl ? <TileVideo uri={item.mediaUrl} r={r} /> : null}
          <VideoBadge r={r} durationMs={item.durationMs} fonts={fonts} />
        </>
      );
    case 'link':
      return <LinkBody item={item} r={r} image={image} fonts={fonts} />;
    case 'note':
      return <NoteBody item={item} r={r} fonts={fonts} />;
    case 'voice':
      return <VoiceBody item={item} r={r} fonts={fonts} />;
  }
}

/** Muted, looping playback drawn into the tile. */
function TileVideo({ uri, r }: { uri: string; r: TileRect }) {
  const { currentFrame } = useVideo(uri, { looping: true, volume: 0, paused: false });
  return <Image image={currentFrame} x={r.x} y={r.y} width={r.w} height={r.h} fit="cover" />;
}

function VideoBadge({ r, durationMs, fonts }: { r: TileRect; durationMs?: number | null; fonts: SkTypefaceFontProvider | null }) {
  const label = useMemo(
    () => (fonts && durationMs ? makeParagraph(fonts, formatDuration(durationMs), { size: 8, color: '#FFFFFF', weight: 600 }) : null),
    [fonts, durationMs],
  );
  const w = label ? 30 : 16;
  const h = 16;
  const x = r.x + r.w - 5 - w;
  const y = r.y + 5;
  const pill = useMemo(() => rrect(rect(x, y, w, h), h / 2, h / 2), [x, y, w]);
  // Built here rather than at import: on web, Skia only exists once its runtime has loaded.
  const play = useMemo(() => Skia.Path.MakeFromSVGString(PLAY_PATH), []);
  return (
    <Group>
      <RoundedRect rect={pill} color={colors.glassOnMedia} />
      <RoundedRect rect={pill} style="stroke" strokeWidth={0.5} color="rgba(255, 255, 255, 0.22)" />
      {play ? (
        <Group transform={[{ translateX: x + 6 }, { translateY: y + 4.5 }]}>
          <Path path={play} color="#FFFFFF" />
        </Group>
      ) : null}
      {label ? <Paragraph paragraph={label} x={x + 14} y={y + 3} width={w - 14} /> : null}
    </Group>
  );
}

function LinkBody({ item, r, image, fonts }: { item: Item; r: TileRect; image: SkImage | null; fonts: SkTypefaceFontProvider | null }) {
  const imageH = image ? r.h * 0.5 : 0;
  const title = useMemo(
    () =>
      fonts
        ? makeParagraph(fonts, item.link?.title ?? item.link?.url ?? '', { size: 9.5, color: colors.text, weight: 600, maxLines: 2, lineHeight: 1.25 })
        : null,
    [fonts, item.link?.title, item.link?.url],
  );
  const site = useMemo(
    () =>
      fonts
        ? makeParagraph(fonts, item.link?.siteName ?? (item.link ? hostOf(item.link.url) : ''), { size: 8, color: colors.textSecondary })
        : null,
    [fonts, item.link],
  );
  return (
    <>
      {image ? <Image image={image} x={r.x} y={r.y} width={r.w} height={imageH} fit="cover" /> : null}
      {title ? <Paragraph paragraph={title} x={r.x + 6} y={r.y + imageH + 6} width={r.w - 12} /> : null}
      {site ? <Paragraph paragraph={site} x={r.x + 6} y={r.y + r.h - 16} width={r.w - 12} /> : null}
    </>
  );
}

function NoteBody({ item, r, fonts }: { item: Item; r: TileRect; fonts: SkTypefaceFontProvider | null }) {
  const body = useMemo(
    () =>
      fonts
        ? makeParagraph(fonts, item.body ?? '', { size: 9.5, color: colors.noteText, maxLines: Math.max(1, Math.floor((r.h - 16) / 12.5)), lineHeight: 1.3 })
        : null,
    [fonts, item.body, r.h],
  );
  return body ? <Paragraph paragraph={body} x={r.x + 8} y={r.y + 8} width={r.w - 16} /> : null;
}

function VoiceBody({ item, r, fonts }: { item: Item; r: TileRect; fonts: SkTypefaceFontProvider | null }) {
  const bars = useMemo(() => barHeights(item.id, 14), [item.id]);
  const title = useMemo(
    () => (fonts ? makeParagraph(fonts, item.title ?? 'Voice note', { size: 8.5, color: colors.text, weight: 600 }) : null),
    [fonts, item.title],
  );
  const time = useMemo(
    () => (fonts ? makeParagraph(fonts, formatDuration(item.durationMs), { size: 8, color: colors.textSecondary }) : null),
    [fonts, item.durationMs],
  );
  const barTop = r.y + 10;
  const barH = 22;
  return (
    <>
      {bars.map((v, i) => (
        <RoundedRect
          key={i}
          x={r.x + 8 + i * 4.5}
          y={barTop + (barH * (1 - v)) / 2}
          width={2.5}
          height={barH * v}
          r={1.25}
          color={colors.voiceAccent}
        />
      ))}
      {title ? <Paragraph paragraph={title} x={r.x + 8} y={r.y + r.h - 18} width={r.w - 40} /> : null}
      {time ? <Paragraph paragraph={time} x={r.x + r.w - 30} y={r.y + r.h - 18} width={24} /> : null}
    </>
  );
}
