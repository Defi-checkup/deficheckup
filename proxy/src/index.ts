import { createApp, type ProxyEnv } from './app';

// Built once per isolate: the app keeps no request state.
const app = createApp({ fetchFn: (input, init) => fetch(input, init), cache: caches.default });

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<ProxyEnv>;
