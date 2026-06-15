/**
 * Shared types + lightweight helpers for the Marketing media uploader.
 *
 * Schemas + validation live in `./media-schemas.ts`. This file is for the
 * pure helpers that the React client needs but don't pull Zod or any
 * server-only imports into the bundle.
 */

export const PHOTO_MIME_PREFIX = "image/";
export const VIDEO_MIME_PREFIX = "video/";

export const MARKETING_MEDIA_MAX_BYTES = 100 * 1024 * 1024;

/** Picker kinds exposed by the four UI buttons. */
export type MediaPickerKind = "photo" | "video" | "carousel" | "upload";

export interface MediaPickerSpec {
  kind: MediaPickerKind;
  label: string;
  accept: string;
  multiple: boolean;
  /** Max files accepted in a single picker event. */
  maxFiles: number;
}

export const MEDIA_PICKERS: Record<MediaPickerKind, MediaPickerSpec> = {
  photo: {
    kind: "photo",
    label: "Photo",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
  },
  video: {
    kind: "video",
    label: "Video",
    accept: "video/*",
    multiple: false,
    maxFiles: 1,
  },
  carousel: {
    kind: "carousel",
    label: "Carousel",
    accept: "image/*",
    multiple: true,
    maxFiles: 10,
  },
  upload: {
    kind: "upload",
    label: "Upload",
    accept: "image/*,video/*",
    multiple: true,
    maxFiles: 10,
  },
};

export function isImageMime(mime: string): boolean {
  return mime.trim().toLowerCase().startsWith(PHOTO_MIME_PREFIX);
}

export function isVideoMime(mime: string): boolean {
  return mime.trim().toLowerCase().startsWith(VIDEO_MIME_PREFIX);
}

/**
 * Client-side guard before any network call. Returns null when the file
 * is accepted; otherwise a human-readable reason that the uploader
 * surfaces on the failed row.
 */
export function validateMediaFile(file: {
  size: number;
  type: string;
}): string | null {
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MARKETING_MEDIA_MAX_BYTES) {
    return "File too large. Maximum upload size is 100 MB.";
  }
  if (!isImageMime(file.type) && !isVideoMime(file.type)) {
    return "Only image and video files are allowed.";
  }
  return null;
}

export function formatMediaBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
