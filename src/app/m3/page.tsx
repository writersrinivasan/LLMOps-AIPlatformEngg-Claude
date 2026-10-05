"use client";
import { ModulePage } from "@/components/shared/ModulePage";
import { DeployStrategies, EvalGates, GitWorkflow, Infra, PipelineBuilder, ReleaseBom } from "@/components/labs/m3";

export default function M3() {
  return (
    <ModulePage
      moduleId="m3"
      labs={{ "3.1": <ReleaseBom />, "3.2": <GitWorkflow />, "3.3": <EvalGates />, "3.4": <DeployStrategies />, "3.5": <Infra />, "3.6": <PipelineBuilder /> }}
    />
  );
}
