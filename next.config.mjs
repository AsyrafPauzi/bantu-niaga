/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  // Note: `experimental.typedRoutes` is intentionally OFF at v0.
  // Re-enable once Link hrefs across the app are typed as Route<>.
};

export default nextConfig;
