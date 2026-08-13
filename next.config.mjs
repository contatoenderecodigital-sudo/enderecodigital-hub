/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // next build no Next 16 ja usa Turbopack; NAO adicionar config de bundler aqui.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
