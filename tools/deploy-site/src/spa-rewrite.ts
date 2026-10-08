// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Loads the CloudFront Function of the site (cloudfront/spa-rewrite.js) to run it locally:
// in its test and in the preview server, which applies the very code CloudFront runs.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const SPA_REWRITE_FILE = fileURLToPath(
  new URL("../cloudfront/spa-rewrite.js", import.meta.url),
);

/** The part of the viewer request event the function reads and returns. */
export interface ViewerRequest {
  uri: string;
}

export type ViewerRequestHandler = (event: { request: ViewerRequest }) => ViewerRequest;

/**
 * CloudFront Functions are not modules: the file declares a global `handler`. It is evaluated in
 * an empty context, as the runtime has no Node globals either.
 */
export const loadSpaRewrite = async (file = SPA_REWRITE_FILE): Promise<ViewerRequestHandler> => {
  const source = await readFile(file, "utf8");
  const handler: unknown = vm.runInNewContext(`${source}\n;handler;`, {}, { filename: file });
  if (typeof handler !== "function") {
    throw new Error(`${file} no define la función handler.`);
  }
  return handler as ViewerRequestHandler;
};
