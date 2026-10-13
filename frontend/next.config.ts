import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const apiOrigin = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const nextConfig: NextConfig = {
  // Allow only this computer's LAN addresses to load development assets.
  allowedDevOrigins: Object.values(networkInterfaces()).flatMap(addresses =>
    (addresses ?? []).filter(address => !address.internal && address.family === "IPv4").map(address => address.address)
  ),
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
