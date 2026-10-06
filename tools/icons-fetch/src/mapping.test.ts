// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { indexIcons, resolveIcons } from "./mapping.js";
import { PACKAGE_ENTRIES } from "./testing/package-zip.js";

const ENTRIES = Object.keys(PACKAGE_ENTRIES);

describe("indexIcons", () => {
  it("keeps service and resource SVGs and ignores categories and __MACOSX copies", () => {
    expect([...indexIcons(ENTRIES).keys()].sort()).toEqual([
      "Arch_AWS-Lambda_48",
      "Arch_AWS-Lambda_64",
      "Arch_Amazon-Simple-Storage-Service_48",
      "Res_Amazon-VPC_NAT-Gateway_48",
      "Res_Server_48_Dark",
    ]);
  });

  it("only accepts each prefix inside its own top-level folder", () => {
    const index = indexIcons([
      "Resource-Icons_07312026/Res_Compute/Arch_AWS-Lambda_48.svg",
      "Architecture-Service-Icons_07312026/Arch_Compute/48/Res_Amazon-VPC_NAT-Gateway_48.svg",
      "Architecture-Service-Icons_07312026/Arch_Compute/48/Arch_AWS-Lambda_48.png",
    ]);
    expect(index.size).toBe(0);
  });
});

describe("resolveIcons", () => {
  it("maps service (Arch_) and resource (Res_) icons to their zip entries", () => {
    const resolution = resolveIcons(
      [
        { id: "lambda", icon: "Arch_AWS-Lambda_48" },
        { id: "nat-gateway", icon: "Res_Amazon-VPC_NAT-Gateway_48" },
      ],
      ENTRIES,
    );
    expect(resolution).toEqual({
      resolved: [
        {
          id: "lambda",
          icon: "Arch_AWS-Lambda_48",
          entry: "Architecture-Service-Icons_07312026/Arch_Compute/48/Arch_AWS-Lambda_48.svg",
        },
        {
          id: "nat-gateway",
          icon: "Res_Amazon-VPC_NAT-Gateway_48",
          entry:
            "Resource-Icons_07312026/Res_Networking-Content-Delivery/Res_Amazon-VPC_NAT-Gateway_48.svg",
        },
      ],
      unmapped: [],
      missing: [],
      ambiguous: [],
    });
  });

  it("reports services without icon and icons missing from the package", () => {
    const resolution = resolveIcons(
      [
        { id: "s3", icon: "Arch_Amazon-Simple-Storage-Service_48" },
        { id: "new-service" },
        { id: "typo", icon: "Arch_AWS-Lamda_48" },
      ],
      ENTRIES,
    );
    expect(resolution.resolved.map((icon) => icon.id)).toEqual(["s3"]);
    expect(resolution.unmapped).toEqual(["new-service"]);
    expect(resolution.missing).toEqual([{ id: "typo", icon: "Arch_AWS-Lamda_48" }]);
  });

  it("skips concepts: they have no official icon and are not reported as unmapped", () => {
    const resolution = resolveIcons(
      [
        { id: "lambda", type: "service", icon: "Arch_AWS-Lambda_48" },
        { id: "region", type: "concept" },
      ],
      ENTRIES,
    );
    expect(resolution.resolved.map((icon) => icon.id)).toEqual(["lambda"]);
    expect(resolution.unmapped).toEqual([]);
    expect(resolution.missing).toEqual([]);
  });

  it("reports icons that match more than one file", () => {
    const duplicated = [
      "Architecture-Service-Icons_07312026/Arch_Compute/48/Arch_AWS-Lambda_48.svg",
      "Architecture-Service-Icons_07312026/Arch_Serverless/48/Arch_AWS-Lambda_48.svg",
    ];
    expect(resolveIcons([{ id: "lambda", icon: "Arch_AWS-Lambda_48" }], duplicated)).toEqual({
      resolved: [],
      unmapped: [],
      missing: [],
      ambiguous: [{ id: "lambda", icon: "Arch_AWS-Lambda_48", entries: duplicated }],
    });
  });
});
