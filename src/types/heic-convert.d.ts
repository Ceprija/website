declare module "heic-convert" {
  type ConvertOptions = {
    buffer: ArrayBuffer | Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  export default function convert(options: ConvertOptions): Promise<ArrayBuffer>;
}
