import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.postimg.cc",
        pathname: "/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png",
      },
    ],
  },
};

export default nextConfig;
