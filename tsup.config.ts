import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server/index.ts',
    react: 'src/react/index.ts',
    typeorm: 'src/typeorm/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: [
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/typeorm',
    'react',
    'web-push',
    'firebase-admin',
    '@parse/node-apn',
    'typeorm',
    'firebase',
    'firebase/messaging',
  ],
});
