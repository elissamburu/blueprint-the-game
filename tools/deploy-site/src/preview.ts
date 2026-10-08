// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// pnpm preview:site: serves the assembled site the way CloudFront and the private bucket do, to
// check a build before uploading it. Each request goes through the same CloudFront Function
// (cloudfront/spa-rewrite.js) and each file is answered with the headers the deploy uploads it
// with. A missing file is a 403, as the bucket answers without s3:ListBucket.
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { headersFor, UnknownContentTypeError } from "./headers.js";
import { loadSpaRewrite } from "./spa-rewrite.js";

export interface PreviewOptions {
  siteDir: string;
  port: number;
  host?: string;
}

const ACCESS_DENIED = "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>";

export const startPreview = async (options: PreviewOptions): Promise<Server> => {
  const siteDir = path.resolve(options.siteDir);
  const rewrite = await loadSpaRewrite();

  const server = createServer((req, res) => {
    const deny = (status = 403) => {
      res.writeHead(status, { "Content-Type": "application/xml" });
      res.end(req.method === "HEAD" ? undefined : ACCESS_DENIED);
    };
    if (req.method !== "GET" && req.method !== "HEAD") return deny(405);

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      return deny(400);
    }
    const { uri } = rewrite({ request: { uri: pathname } });
    const key = uri.replace(/^\/+/, "");
    const file = path.resolve(siteDir, key);
    // Never outside the site (a request with "..").
    if (file !== siteDir && !file.startsWith(siteDir + path.sep)) return deny();

    let headers;
    try {
      headers = headersFor(key);
    } catch (error) {
      if (error instanceof UnknownContentTypeError) return deny();
      throw error;
    }
    readFile(file).then(
      (body) => {
        res.writeHead(200, {
          "Content-Type": headers.contentType,
          "Cache-Control": headers.cacheControl,
          "Content-Length": body.length,
        });
        res.end(req.method === "HEAD" ? undefined : body);
      },
      () => deny(),
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host ?? "127.0.0.1", resolve);
  });
  return server;
};
