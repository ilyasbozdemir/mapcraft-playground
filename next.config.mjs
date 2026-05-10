/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@base-ui/react", "@tmcw/togeojson", "leaflet", "react-leaflet"],
};

export default nextConfig;
