/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  reactStrictMode: true,
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
