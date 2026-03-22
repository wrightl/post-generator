import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://user:pass@localhost:5432/postgenerator?sslmode=require",
  },
};

export default nextConfig;
