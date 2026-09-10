import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@gai-ara/db", "@gai-ara/graph", "@gai-ara/ig-parser", "@gai-ara/shared"],
};

export default nextConfig;
