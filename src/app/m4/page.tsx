"use client";
import { ModulePage } from "@/components/shared/ModulePage";
import { DatasetBuilder, EvalLayers, EvalPipeline, JudgeLab, NonDeterminism } from "@/components/labs/m4";

export default function M4() {
  return (
    <ModulePage
      moduleId="m4"
      labs={{ "4.1": <NonDeterminism />, "4.2": <EvalLayers />, "4.3": <JudgeLab />, "4.4": <DatasetBuilder />, "4.5": <EvalPipeline /> }}
    />
  );
}
