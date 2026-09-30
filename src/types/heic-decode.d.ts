declare module "heic-decode" {
  export interface HeicImage {
    width: number;
    height: number;
    /** RGBA pixel data, already rotated per the EXIF orientation tag. */
    data: Uint8ClampedArray;
  }
  export default function decode(options: {
    buffer: Uint8Array | ArrayBuffer;
  }): Promise<HeicImage>;
}
