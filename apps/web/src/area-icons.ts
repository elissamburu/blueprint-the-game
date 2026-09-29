// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Icon of each area of content/areas.yaml, for the scenario cards (docs/design, problem 7: the
// icon of the main area, or none). An area without an entry here shows no icon.
import {
  ActivityIcon,
  BrainCircuitIcon,
  ChartColumnIcon,
  ContainerIcon,
  CpuIcon,
  DatabaseIcon,
  HardDriveIcon,
  InfinityIcon,
  NetworkIcon,
  ShieldCheckIcon,
  WorkflowIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

export const AREA_ICONS: Readonly<Partial<Record<string, LucideIcon>>> = {
  serverless: ZapIcon,
  containers: ContainerIcon,
  compute: CpuIcon,
  storage: HardDriveIcon,
  databases: DatabaseIcon,
  networking: NetworkIcon,
  integration: WorkflowIcon,
  security: ShieldCheckIcon,
  data: ChartColumnIcon,
  ml: BrainCircuitIcon,
  observability: ActivityIcon,
  devops: InfinityIcon,
};
