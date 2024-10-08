#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');

const {
  STATIC_DIR = 'dist',
  HOST_PORT = process.env.PORT || 80,
  API_URL = 'http://localhost:3005',
  CONTENT_SECURITY_POLICY,
  FRAME_DENY,
  REFERRER_POLICY,
  FORCE_STS_HEADER,
  STS_SECONDS,
  STS_PRELOAD,
  STS_INCLUDE_SUBDOMAINS,
  CONTENT_TYPE_NO_SNIFF
} = process.env;

const metaTags = Object.keys(process.env).reduce((env, name) =>
  name.startsWith('META_TAG_') ? Object.assign(env, {
    [name.replace(/^META_TAG_/, '')]: process.env[name]
  }) : env
, { API_URL });

const metaString = Object.keys(metaTags).map(name =>
  `<meta name="${name}" content="${metaTags[name]}">`
).join('\n  ');

const normalIndex = fs.readFileSync(`${STATIC_DIR}/index.html`, 'utf8');
const metaAmmendedIndex = !normalIndex ? '' :
  normalIndex.split('\n').reduce((full, line) => {
    full += `${line}\n`;
    // NOTE: The logic assumes that the `<head>` tag is on its own line
    // please make sure you don't use one-line minified HTML
    // TODO: improve this code so it would inject the tags inside head tag correctly
    if (line.includes('<head>')) full += `  ${metaString}\n`;
    return full;
  }, '');

const serve = serveStatic(STATIC_DIR);
console.log('Serving your files now!');

const ONE_MONTH = 2628000;
const MD5_HASHED_RESOURCE = /-[a-f0-9]{20,32}\.(js|css|jpg|svg|ico|eot|ttf|woff|woff2)(\?|$)/i;
const setCaching = (req, res) => {
  if (MD5_HASHED_RESOURCE.test(req.url)) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_MONTH}`);
  }
};

const setSecurityHeaders = (res) => {
  if (FRAME_DENY === 'true') {
    res.setHeader('X-Frame-Options', 'DENY');
  }

  if (CONTENT_SECURITY_POLICY) {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  }

  if (REFERRER_POLICY) {
    res.setHeader('Referrer-Policy', REFERRER_POLICY);
  }

  if (FORCE_STS_HEADER === 'true') {
    const stsOptions = [];
    if (STS_SECONDS) {
      stsOptions.push(`max-age=${STS_SECONDS}`);
    }
    if (STS_PRELOAD === 'true') {
      stsOptions.push('preload');
    }
    if (STS_INCLUDE_SUBDOMAINS === 'true') {
      stsOptions.push('includeSubDomains');
    }
    res.setHeader('Strict-Transport-Security', stsOptions.join('; '));
  }

  if (CONTENT_TYPE_NO_SNIFF === 'true') {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
};


const ASSET_PATH_RE = /\.(html|css$|js$|json|webapp|cache|jpg|svg|png|ico|txt|eot|ttf|woff|woff2)/;
const server = http.createServer((req, res) => {
  if (req.url === '/_health/ready' || req.url === '/_health/alive') {
    res.end('OK');
    return;
  }
  setSecurityHeaders(res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!ASSET_PATH_RE.test(req.url)) {
    req.url = '/';
    res.end(metaAmmendedIndex);
  } else {
    setCaching(req, res);
    serve(req, res, finalhandler(req, res));
  }
});

server.listen(HOST_PORT);
