// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CloudFront Function, viewer request, runtime cloudfront-js-2.0 (docs/guias/deploy-manual-beta.md).
// The game is a single page app: its routes (/escenarios, /escenarios/<id>/resumen, ...) are not
// files in the bucket. Every path whose last segment has no file extension is served with
// /index.html, so reloading a route works. Paths with an extension (/assets/*.js, /content/*.json,
// /icons/*.svg) go to the bucket untouched: a missing file stays an error, never the app shell.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- CloudFront calls it.
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.substring(request.uri.lastIndexOf("/") + 1);
  if (lastSegment.indexOf(".") === -1) {
    request.uri = "/index.html";
  }
  return request;
}
