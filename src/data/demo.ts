import type { Item } from '@/lib/types';

// Placeholder content used until Supabase is configured, so the canvas and lens
// can be exercised on day one. Images come from picsum.photos. Videos are 10s clips
// of the Blender open movies from test-videos.co.uk, with the films' posters from
// Wikimedia Commons (CC BY 3.0, Blender Foundation).

const videos = [
  {
    title: 'Big Buck Bunny',
    mediaUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    thumbUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/330px-Big_buck_bunny_poster_big.jpg',
  },
  {
    title: 'Sintel',
    mediaUrl: 'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Sintel_poster.jpg/330px-Sintel_poster.jpg',
  },
];

const links = [
  { url: 'https://www.are.na/', title: 'Are.na — a platform for connecting ideas', siteName: 'are.na' },
  { url: 'https://www.itsnicethat.com/', title: "It's Nice That — Championing creativity", siteName: 'itsnicethat.com' },
  { url: 'https://www.siteinspire.com/', title: 'siteInspire — web design inspiration', siteName: 'siteinspire.com' },
  { url: 'https://fonts.google.com/', title: 'Browse fonts — Google Fonts', siteName: 'fonts.google.com' },
];

const notes = [
  'Card force idea: the spectator names any card, it’s already written inside the lens cap.',
  'Palette: bone, rust, ink blue. Try it on the next poster.',
  'Hook for reel: start mid-motion, cut on the beat, no intro.',
  'Type pairing — tight grotesk headline, loose mono captions.',
  'Open with silence. Let the room lean in.',
];

const voice = [
  { title: 'Idea on the train', durationMs: 42000 },
  { title: 'Routine walkthrough', durationMs: 128000 },
  { title: 'Melody hum', durationMs: 19000 },
];

// Aspect ratios (height / width) that give a varied, masonry feel.
const ratios = [1.25, 0.8, 1.5, 1, 1.33, 0.75, 1.4, 1.1, 0.9, 1.6];

function daysAgo(n: number) {
  return new Date(Date.UTC(2026, 8, 29) - n * 86_400_000).toISOString();
}

function build(): Item[] {
  const items: Item[] = [];
  const total = 90;
  for (let i = 0; i < total; i++) {
    const createdAt = daysAgo(i);
    if (i % 11 === 3) {
      const v = videos[(i / 11) % videos.length | 0];
      items.push({
        id: `demo-video-${i}`,
        kind: 'video',
        createdAt,
        title: v.title,
        mediaUrl: v.mediaUrl,
        thumbUrl: v.thumbUrl,
        // Poster proportions; the clip itself is cropped to fill the tile.
        width: 640,
        height: 905,
        durationMs: 10000,
      });
    } else if (i % 13 === 6) {
      const l = links[(i / 13) % links.length | 0];
      items.push({
        id: `demo-link-${i}`,
        kind: 'link',
        createdAt,
        link: { ...l, imageUrl: `https://picsum.photos/seed/link${i}/300/180` },
      });
    } else if (i % 9 === 5) {
      items.push({ id: `demo-note-${i}`, kind: 'note', createdAt, body: notes[(i / 9) % notes.length | 0] });
    } else if (i % 17 === 8) {
      const v = voice[(i / 17) % voice.length | 0];
      items.push({ id: `demo-voice-${i}`, kind: 'voice', createdAt, title: v.title, durationMs: v.durationMs });
    } else {
      const ratio = ratios[i % ratios.length];
      const w = 600;
      const h = Math.round(w * ratio);
      items.push({
        id: `demo-image-${i}`,
        kind: 'image',
        createdAt,
        mediaUrl: `https://picsum.photos/seed/inspo${i}/${w * 2}/${h * 2}`,
        // Tile-sized thumbnail; the canvas keeps decoded images in GPU memory.
        thumbUrl: `https://picsum.photos/seed/inspo${i}/${w / 2}/${Math.round(h / 2)}`,
        width: w,
        height: h,
      });
    }
  }
  return items;
}

export const demoItems: Item[] = build();
