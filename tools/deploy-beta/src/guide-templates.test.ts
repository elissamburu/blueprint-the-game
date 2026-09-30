// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The JSON files of docs/guias/deploy-manual-beta/ are applied to a real account by hand: they
// must parse, keep the decisions of the guide and never carry an account ID or a real ARN.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./cli.js";

const GUIDE = path.join(REPO_ROOT, "docs", "guias", "deploy-manual-beta.md");
const TEMPLATES = path.join(REPO_ROOT, "docs", "guias", "deploy-manual-beta");

const read = (name: string) => readFile(path.join(TEMPLATES, name), "utf8");
const json = async (name: string) => JSON.parse(await read(name)) as unknown;
const placeholders = (text: string) => [...new Set(text.match(/<[A-Z_]+>/g) ?? [])].sort();

/** Placeholders each file expects the guide to fill in. */
const EXPECTED: Record<string, string[]> = {
  "acm-validation-record.json": ["<RECORD_NAME>", "<RECORD_VALUE>"],
  "bucket-encryption.json": [],
  "bucket-lifecycle.json": [],
  "bucket-policy.json": ["<ACCOUNT_ID>", "<BUCKET_NAME>", "<DISTRIBUTION_ID>"],
  "budget-notifications.json": ["<BUDGET_EMAIL>"],
  "budget.json": ["<BUDGET_USD>"],
  "distribution-config.json": [
    "<BUCKET_NAME>",
    "<CALLER_REFERENCE>",
    "<FUNCTION_ARN>",
    "<OAC_ID>",
    "<REGION>",
  ],
  "function-config.json": [],
  "origin-access-control.json": ["<BUCKET_NAME>"],
  "route53-alias-records.json": ["<DISTRIBUTION_DOMAIN>", "<DOMAIN>"],
};

describe("templates of the manual deploy guide", () => {
  it("are the files the guide uses, valid JSON, with the expected placeholders", async () => {
    const files = (await readdir(TEMPLATES)).sort();
    expect(files).toEqual(Object.keys(EXPECTED).sort());
    const guide = await readFile(GUIDE, "utf8");
    for (const file of files) {
      const text = await read(file);
      expect(() => JSON.parse(text) as unknown, file).not.toThrow();
      expect(placeholders(text), file).toEqual(EXPECTED[file]);
      expect(guide, `la guía no usa ${file}`).toContain(`Use-Template "${file}"`);
      // Every placeholder is filled by the guide (as a key of the hashtable it passes).
      for (const placeholder of EXPECTED[file] ?? []) {
        expect(guide, `${file}: ${placeholder}`).toMatch(
          new RegExp(`\\b${placeholder.slice(1, -1)}\\s*=`),
        );
      }
    }
  });

  it("carry no account ID, access key nor ARN of a real account", async () => {
    const texts = [
      await readFile(GUIDE, "utf8"),
      ...(await Promise.all(Object.keys(EXPECTED).map(read))),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/\b\d{12}\b/);
      expect(text).not.toMatch(/\bAKIA[A-Z0-9]{16}\b/);
      expect(text).not.toMatch(/arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d+:/);
    }
  });

  it("the distribution uses OAC, HTTPS, HTTP/2 and 3, compression, the function and the managed policies", async () => {
    const config = (await json("distribution-config.json")) as {
      HttpVersion: string;
      Origins: {
        Items: {
          DomainName: string;
          S3OriginConfig: { OriginAccessIdentity: string };
          OriginAccessControlId: string;
        }[];
      };
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: string;
        Compress: boolean;
        CachePolicyId: string;
        ResponseHeadersPolicyId: string;
        FunctionAssociations: { Items: { EventType: string; FunctionARN: string }[] };
        ForwardedValues?: unknown;
      };
    };
    const [origin] = config.Origins.Items;
    // Regional bucket endpoint with an OAC and no OAI.
    expect(origin?.DomainName).toBe("<BUCKET_NAME>.s3.<REGION>.amazonaws.com");
    expect(origin?.S3OriginConfig.OriginAccessIdentity).toBe("");
    expect(origin?.OriginAccessControlId).toBe("<OAC_ID>");
    expect(config.HttpVersion).toBe("http2and3");
    const behavior = config.DefaultCacheBehavior;
    expect(behavior.ViewerProtocolPolicy).toBe("redirect-to-https");
    expect(behavior.Compress).toBe(true);
    // Managed policies CachingOptimized and SecurityHeadersPolicy (IDs from the AWS docs the
    // guide cites). A cache policy excludes the legacy ForwardedValues.
    expect(behavior.CachePolicyId).toBe("658327ea-f89d-4fab-a63d-7e88639e58f6");
    expect(behavior.ResponseHeadersPolicyId).toBe("67f7725c-6f97-4210-82d7-5512b31e9d03");
    expect(behavior.ForwardedValues).toBeUndefined();
    expect(behavior.FunctionAssociations.Items).toEqual([
      { FunctionARN: "<FUNCTION_ARN>", EventType: "viewer-request" },
    ]);
  });

  it("the bucket policy lets only that distribution read", async () => {
    const policy = (await json("bucket-policy.json")) as {
      Statement: {
        Effect: string;
        Principal: unknown;
        Action: unknown;
        Resource: string;
        Condition: unknown;
      }[];
    };
    expect(policy.Statement).toEqual([
      {
        Sid: "AllowCloudFrontServicePrincipalReadOnly",
        Effect: "Allow",
        Principal: { Service: "cloudfront.amazonaws.com" },
        Action: "s3:GetObject",
        Resource: "arn:aws:s3:::<BUCKET_NAME>/*",
        Condition: {
          StringEquals: {
            "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>",
          },
        },
      },
    ]);
  });

  it("the function runs on the runtime its code is written for", async () => {
    expect(await json("function-config.json")).toMatchObject({ Runtime: "cloudfront-js-2.0" });
  });
});
