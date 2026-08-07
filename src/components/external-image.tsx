"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

function directImageLoader({ src }: ImageLoaderProps) {
  return src;
}

type ExternalImageProps = Omit<ImageProps, "loader" | "unoptimized">;

/** User and tenant image URLs are rendered directly instead of being proxied. */
export function ExternalImage({ alt, ...props }: ExternalImageProps) {
  return <Image {...props} alt={alt} loader={directImageLoader} unoptimized />;
}
