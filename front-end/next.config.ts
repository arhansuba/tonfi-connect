/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config: { externals: { 'utf-8-validate': string; bufferutil: string; }[]; }) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    return config;
  },
  // Disable static page generation for pages that need TON Connect
  unstable_runtimeJS: true,
  experimental: {
    // This will help prevent SSR for pages that need browser APIs
    runtime: 'edge'
  }
};

module.exports = nextConfig;