"use client";
import { ModulePage } from "@/components/shared/ModulePage";
import { MetricsDashboard, TraceExplorer } from "@/components/labs/m5a";
import { CostOptimizer, RedTeam } from "@/components/labs/m5b";

export default function M5() {
  return <ModulePage moduleId="m5" labs={{ "5.1": <TraceExplorer />, "5.2": <MetricsDashboard />, "5.3": <RedTeam />, "5.4": <CostOptimizer /> }} />;
}
