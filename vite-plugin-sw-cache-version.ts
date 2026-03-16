import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Replace all occurrences of `__BUILD_HASH__` in the given template string.
 */
export function replacePlaceholder(template: string, hash: string): string {
  return template.replaceAll('__BUILD_HASH__', hash);
}

/**
 * Replace the `__PRECACHE_ASSETS__` placeholder with a JSON array of asset paths.
 * Each asset filename is prefixed with `/assets/` to form the URL path.
 */
export function injectPrecacheAssets(template: string, assetFileNames: string[]): string {
  const assetPaths = assetFileNames.map((f) => `/assets/${f}`);
  return template.replaceAll('__PRECACHE_ASSETS__', JSON.stringify(assetPaths));
}

/**
 * Compute a build hash from an array of file content buffers.
 * Concatenates all buffers, computes SHA-256, and returns the first 8 hex characters.
 */
export function computeBuildHash(fileContents: Buffer[]): string {
  const concatenated = Buffer.concat(fileContents);
  const hash = crypto.createHash('sha256').update(concatenated).digest('hex');
  return hash.slice(0, 8);
}

export function swCacheVersionPlugin(): Plugin {
  return {
    name: 'sw-cache-version',
    closeBundle() {
      const templatePath = path.resolve('public', 'sw.js');
      const distAssetsDir = path.resolve('dist', 'assets');
      const outputPath = path.resolve('dist', 'sw.js');

      // Read the SW template — missing template is a fatal error
      if (!fs.existsSync(templatePath)) {
        throw new Error(
          `[sw-cache-version] Service worker template not found at ${templatePath}`
        );
      }
      const template = fs.readFileSync(templatePath, 'utf-8');

      // Collect asset filenames and file contents for hashing
      let fileContents: Buffer[] = [];
      let assetFileNames: string[] = [];
      if (!fs.existsSync(distAssetsDir)) {
        console.warn(
          '[sw-cache-version] dist/assets/ directory not found. Hashing empty input.'
        );
      } else {
        assetFileNames = fs.readdirSync(distAssetsDir);
        if (assetFileNames.length === 0) {
          console.warn(
            '[sw-cache-version] dist/assets/ directory is empty. Hashing empty input.'
          );
        }
        fileContents = assetFileNames.map((file) =>
          fs.readFileSync(path.join(distAssetsDir, file))
        );
      }

      const buildHash = computeBuildHash(fileContents);

      // Replace placeholders
      if (!template.includes('__BUILD_HASH__')) {
        console.warn(
          '[sw-cache-version] __BUILD_HASH__ placeholder not found in template. Writing file unchanged.'
        );
        fs.writeFileSync(outputPath, template, 'utf-8');
        return;
      }

      let output = replacePlaceholder(template, buildHash);
      output = injectPrecacheAssets(output, assetFileNames);
      fs.writeFileSync(outputPath, output, 'utf-8');
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || req.url !== '/sw.js') {
          return next();
        }

        const templatePath = path.resolve('public', 'sw.js');
        let template: string;
        try {
          template = fs.readFileSync(templatePath, 'utf-8');
        } catch {
          return next();
        }

        const output = injectPrecacheAssets(replacePlaceholder(template, 'dev'), []);
        res.setHeader('Content-Type', 'application/javascript');
        res.end(output);
      });
    },
  };
}
