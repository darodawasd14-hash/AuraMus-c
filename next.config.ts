import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // In a future major version of Next.js, you will need to explicitly configure "allowedDevOrigins"
  // to allow cross origin requests to /_next/* resources.
  // Read more: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: [
    'https://*.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
