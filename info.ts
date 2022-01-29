import type { Request } from 'https://deno.land/x/oak@v10.2.0/mod.ts';

export const toObject = (original: Headers | URLSearchParams) => {
  if (original instanceof Headers) {
    const ret: { [key: string]: string } = {};

    for (const key of original.keys()) {
      const value = original.get(key);
      if (value) ret[key] = value;
    }

    return ret;
  } else if (original instanceof URLSearchParams) {
    const ret: { [key: string]: string | string[] } = {};

    for (const key of original.keys()) {
      const values = original.getAll(key);

      ret[key] = values.length === 1 ? values[0] : values;
    }

    return ret;
  }
};

export const basicInfo = (req: Request) => {
  return {
    origin: req.ip,
    url: req.url.toString(),
    searchParams: toObject(req.url.searchParams),
    headers: toObject(req.headers),
  };
};

export const bodyInfo = async (req: Request) => {
  try {
    const body = req.body();
    if (body.type === 'json') {
      return {
        body: {
          type: body.type,
          value: await body.value,
        },
      };
    } else if (body.type === 'form-data') {
      const formData = await body.value.read();

      return {
        body: {
          type: body.type,
          value: { fields: formData.fields, files: formData.files ?? null },
        },
      };
    } else if (body.type === 'form') {
      return {
        body: {
          type: body.type,
          value: toObject(await body.value),
        },
      };
    } else if (body.type === 'text') {
      return {
        body: {
          type: body.type,
          value: await body.value,
        },
      };
    } else if (body.type === 'bytes') {
      return {
        body: {
          type: body.type,
          value: (await body.value).toString(),
        },
      };
    } else {
      return {
        body: {
          type: body.type,
          value: null,
        },
      };
    }
  } catch {
    return {
      body: {
        type: 'error',
        value: null,
      },
    };
  }
};
