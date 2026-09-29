// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The real scenarios of content/scenarios, loaded with Vite's ?raw (no fs) and validated.
import { parseScenario, type ParseResult, type Scenario } from "@blueprint/scenario-schema";
import { parse as parseYaml } from "yaml";
import privateVpcRaw from "../../../../content/scenarios/private-vpc-service-access/scenario.yaml?raw";
import pdfRaw from "../../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import staticWebsiteRaw from "../../../../content/scenarios/static-website-https/scenario.yaml?raw";
import type { ServiceLookup } from "../types";

const unwrap = <T>(result: ParseResult<T>): T => {
  if (!result.success) throw new Error(JSON.stringify(result.issues, null, 2));
  return result.data;
};

export const pdfScenario: Scenario = unwrap(parseScenario(parseYaml(pdfRaw)));
export const staticWebsiteScenario: Scenario = unwrap(parseScenario(parseYaml(staticWebsiteRaw)));
export const privateVpcScenario: Scenario = unwrap(parseScenario(parseYaml(privateVpcRaw)));
export const realScenarios: Scenario[] = [staticWebsiteScenario, pdfScenario, privateVpcScenario];

/** Every id resolves to a service named after it, in the "compute" category. */
export const fakeServices: ServiceLookup = (id) => ({
  name: `Servicio ${id}`,
  category: "compute",
});
