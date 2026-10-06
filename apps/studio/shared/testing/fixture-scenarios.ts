// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The scenarios of content/ that the behavior tests of the Studio run on: a fixed list, so a new
// scenario (published or still being written in a local copy) does not change what they check.
// The tests that go over the whole of content/ read its folders instead, and use this list only
// to make sure those folders were found.
export const FIXTURE_SCENARIO_IDS: readonly string[] = [
  "gpu-inference-on-eks",
  "insurance-docs-assistant",
  "kubernetes-api-migration",
  "private-eks-least-privilege",
  "private-vpc-service-access",
  "sensitive-claims-assistant",
  "serverless-pdf-processing",
  "static-website-https",
];
