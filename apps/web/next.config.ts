import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@gai-ara/db", "@gai-ara/graph", "@gai-ara/shared"],
};

export default nextConfig;
