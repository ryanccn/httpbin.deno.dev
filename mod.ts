import { Application, Router } from 'https://deno.land/x/oak@v10.2.0/mod.ts';
import { basicInfo, bodyInfo, toObject } from './info.ts';

const app = new Application();
const router = new Router();

router.get('/get', (ctx) => {
  ctx.response.body = basicInfo(ctx.request);
});

router.post('/post', async (ctx) => {
  ctx.response.body = {
    ...basicInfo(ctx.request),
    ...await bodyInfo(ctx.request),
  };
});

router.put('/put', async (ctx) => {
  ctx.response.body = {
    ...basicInfo(ctx.request),
    ...await bodyInfo(ctx.request),
  };
});

router.patch('/patch', async (ctx) => {
  ctx.response.body = {
    ...basicInfo(ctx.request),
    ...await bodyInfo(ctx.request),
  };
});

router.delete('/delete', async (ctx) => {
  ctx.response.body = {
    ...basicInfo(ctx.request),
    ...await bodyInfo(ctx.request),
  };
});

router.get('/auth/basic/:username/:password', (ctx) => {
  const { username, password } = ctx.params;

  const authHeader = ctx.request.headers.get('authorization');
  if (authHeader && (authHeader.startsWith('Basic'))) {
    const frags = authHeader.split(' ');

    if (frags.length === 2 && frags[0] === 'Basic') {
      const uAndP = atob(frags[1]).split(':');

      if (
        uAndP.length === 2 && uAndP[0] === username && uAndP[1] === password
      ) {
        ctx.response.status = 200;
        ctx.response.body = {
          authorized: true,
          username,
        };

        return;
      }
    }
  }

  ctx.response.headers.set('www-authenticate', 'Basic realm="blah"');
  ctx.response.status = 401;
  ctx.response.body = {
    authorized: false,
    username: null,
  };
});

router.get('/auth/bearer', (ctx) => {
  const authHeader = ctx.request.headers.get('authorization');

  if (authHeader && (authHeader.startsWith('Bearer'))) {
    const frags = authHeader.split(' ');

    if (frags.length === 2 && frags[0] === 'Bearer') {
      ctx.response.status = 200;
      ctx.response.body = {
        authorized: true,
        token: frags[1],
      };

      return;
    }
  }

  ctx.response.headers.set('www-authenticate', 'Bearer');
  ctx.response.status = 401;
  ctx.response.body = {
    authorized: false,
    token: null,
  };
});

router.all('/status/:code(\\d+)', (ctx) => {
  let statusCode: number;
  try {
    statusCode = +(ctx.params.code as string);
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: 'status code is not a number' };
    return;
  }

  if (statusCode < 200 || statusCode > 599) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: `status code ${statusCode} is outside the range [200, 599]`,
    };
    return;
  }

  ctx.response.status = statusCode;
  ctx.response.body = null;
});

router.get('/ip', (ctx) => {
  ctx.response.body = {
    origin: ctx.request.ip,
  };
});
router.get('/user-agent', (ctx) => {
  ctx.response.body = {
    'user-agent': ctx.request.headers.get('user-agent') ?? null,
  };
});
router.get('/headers', (ctx) => {
  ctx.response.body = {
    headers: toObject(ctx.request.headers),
  };
});

router.get('/redirect', (ctx) => {
  const params = ctx.request.url.searchParams;
  const to = params.get('to');
  const permanent = params.get('permanent');

  if (!to) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: 'provide a \`to\` link in the URL',
    };
    return;
  }

  if (permanent === '1' || permanent === 'true') ctx.response.status = 301;
  ctx.response.redirect(to);
});

/** Remove trailing slashes */
app.use(async (ctx, next) => {
  const originalUrl = ctx.request.url.pathname;
  if (originalUrl !== '/' && originalUrl.endsWith('/')) {
    ctx.response.status = 301;
    ctx.response.redirect(originalUrl.substring(0, originalUrl.length - 1));
    return;
  }

  await next();
});

/** Performance timing */
app.use(async (ctx, next) => {
  const start = performance.now();
  await next();
  const ms = performance.now() - start;

  ctx.response.headers.set('X-Response-Time', `${ms.toFixed(2)}ms`);
});

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener('listen', ({ hostname, port, secure }) => {
  console.log(
    `Listening on ${secure ? 'https://' : 'http://'}${
      hostname ?? 'localhost'
    }:${port}`,
  );
});

await app.listen({
  port: 3000,
});
