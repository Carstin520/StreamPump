const DEFAULT_REMOTE_IMAGE_HOSTS = ["pub-b0acd300bcec4dc5ba5ea36628dd809f.r2.dev"];

const parseRemoteImageHostEntry = (entry) => {
  const trimmed = entry.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);

    return {
      hostname: url.hostname,
      pathname: url.pathname && url.pathname !== "/" ? url.pathname : "/content/**",
      protocol: url.protocol.replace(":", "") || "https",
    };
  } catch (_error) {
    return {
      hostname: trimmed,
      pathname: "/content/**",
      protocol: "https",
    };
  }
};

const parseRemoteImageHosts = () => {
  const configuredHosts = process.env.NEXT_IMAGE_REMOTE_HOSTS;
  const hosts = configuredHosts
    ? configuredHosts
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : DEFAULT_REMOTE_IMAGE_HOSTS;

  const patterns = hosts.map(parseRemoteImageHostEntry).filter(Boolean);
  const uniquePatterns = new Map(
    patterns.map((pattern) => [
      `${pattern.protocol}:${pattern.hostname}:${pattern.pathname}`,
      pattern,
    ])
  );

  return [...uniquePatterns.values()];
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  images: {
    maximumDiskCacheSize: 256 * 1024 * 1024,
    remotePatterns: parseRemoteImageHosts(),
  },
  async redirects() {
    return [
      {
        destination: "/explore",
        permanent: false,
        source: "/",
      },
      {
        destination: "/explore",
        permanent: false,
        source: "/discover",
      },
      {
        destination: "/explore",
        permanent: false,
        source: "/posts",
      },
    ];
  },
};

module.exports = nextConfig;
