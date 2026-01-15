import swaggerUiDist from "swagger-ui-dist";
import { openapi } from "./openapi.js";

const swaggerPath = swaggerUiDist.getAbsoluteFSPath();

function file(path: string) {
  return Bun.file(path);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Donegeon OpenAPI</title>
    <link rel="stylesheet" href="/swagger-ui.css" />
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/swagger-ui-bundle.js"></script>
    <script src="/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui",
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout"
        });
      };
    </script>
  </body>
</html>`;

const port = Number(process.env.PORT ?? 8080);
// eslint-disable-next-line no-console
console.log(`@donegeon/docs OpenAPI docs: http://localhost:${port}`);

Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/" || p === "/index.html") {
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (p === "/openapi.json") {
      return Response.json(openapi);
    }

    // Static assets from swagger-ui-dist
    if (p === "/swagger-ui.css") return new Response(file(`${swaggerPath}/swagger-ui.css`));
    if (p === "/swagger-ui-bundle.js") return new Response(file(`${swaggerPath}/swagger-ui-bundle.js`));
    if (p === "/swagger-ui-standalone-preset.js") {
      return new Response(file(`${swaggerPath}/swagger-ui-standalone-preset.js`));
    }
    if (p === "/swagger-initializer.js") return new Response(file(`${swaggerPath}/swagger-initializer.js`));
    if (p === "/favicon-16x16.png") return new Response(file(`${swaggerPath}/favicon-16x16.png`));
    if (p === "/favicon-32x32.png") return new Response(file(`${swaggerPath}/favicon-32x32.png`));

    return new Response("Not found", { status: 404 });
  }
});

