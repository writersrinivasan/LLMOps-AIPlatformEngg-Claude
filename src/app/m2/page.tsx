"use client";
import { ModulePage } from "@/components/shared/ModulePage";
import { Gateway, ModelRegistry, RefArch } from "@/components/labs/m2a";
import { HrArchitecture, PromptRegistry, RagPlayground } from "@/components/labs/m2b";

export default function M2() {
  return (
    <ModulePage
      moduleId="m2"
      labs={{ "2.1": <RefArch />, "2.2": <ModelRegistry />, "2.3": <Gateway />, "2.4": <PromptRegistry />, "2.5": <RagPlayground />, "2.6": <HrArchitecture /> }}
    />
  );
}
