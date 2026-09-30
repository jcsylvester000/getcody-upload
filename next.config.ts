import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      // Old routes (login page replaced by the access-code modal; brand page removed).
      { source: "/login", destination: "/", permanent: false },
      { source: "/brand", destination: "/", permanent: false },
      { source: "/favicon.ico", destination: "/icon.png", permanent: true },
    ];
  },
};

export default nextConfig;
