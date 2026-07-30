import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import Module from 'node:module';

const require = createRequire(import.meta.url);
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') {
    return require.resolve('./empty-server-only.cjs');
  }
  return orig.call(this, request, parent, isMain, options);
};

import { createRequire as cr } from 'module';
import { writeFileSync } from 'fs';
writeFileSync(new URL('./empty-server-only.cjs', import.meta.url), 'module.exports = {};');

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// inline minimal migrate using prisma directly for publications
const pubs = await prisma.publication.findMany({ include: { authors: true } });
console.log('publications before', pubs.length);
const profiles = await prisma.academicProfile.findMany({ include: { user: true } });
console.log('profiles', profiles.length);

// Dynamic import of migrate with mocked server-only via NODE_OPTIONS won't work easily.
// Call prisma generate path: use child with tsx and --import
