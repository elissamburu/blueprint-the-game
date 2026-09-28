// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Vite's `?raw` imports (used by tests to load YAML without fs): the file content as a string.
declare module "*?raw" {
  const content: string;
  export default content;
}
