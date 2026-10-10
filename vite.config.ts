import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

const releaseVersion = packageJson.version;
const commit = process.env.GITHUB_SHA?.slice(0, 7) || process.env.APP_COMMIT?.slice(0, 7) || 'local';
const buildVersion = `${releaseVersion}+${commit}`;

export default defineConfig({
  base: './',
  define: {
    __APP_RELEASE__: JSON.stringify(releaseVersion),
    __APP_BUILD__: JSON.stringify(buildVersion),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  plugins: [react()],
});
