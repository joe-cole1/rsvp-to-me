import Image, { type ImageProps } from "next/image";
import { safeUploadPath } from "@/lib/upload-path";

export default function UploadedImage(props: ImageProps) {
  const src = safeUploadPath(props.src);
  return src ? <Image {...props} src={src} alt={props.alt} /> : null;
}
