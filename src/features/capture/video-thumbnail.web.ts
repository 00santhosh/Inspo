import type { VideoFrame } from './video-thumbnail';

/** Draws a frame of the video onto a canvas. Also reports the duration, which the browser picker doesn't. */
export function videoThumbnail(uri: string): Promise<VideoFrame | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let finished = false;
    const done = (frame: VideoFrame | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(frame);
    };
    const timer = setTimeout(() => done(null), 12000);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => done(null);
    video.onloadeddata = () => {
      const length = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = Math.min(1, length / 2);
    };
    video.onseeked = () => {
      const scale = Math.min(1, 480 / (video.videoWidth || 480));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined;
      canvas.toBlob(
        (blob) =>
          done(blob ? { uri: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, durationMs } : null),
        'image/jpeg',
        0.8,
      );
    };
    video.src = uri;
  });
}
