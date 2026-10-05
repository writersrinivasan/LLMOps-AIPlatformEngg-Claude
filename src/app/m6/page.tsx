"use client";
import { ModulePage } from "@/components/shared/ModulePage";
import { AgentRuntime, GoldenPath, HundredTeams, Maturity } from "@/components/labs/m6";

export default function M6() {
  return <ModulePage moduleId="m6" labs={{ "6.1": <HundredTeams />, "6.2": <AgentRuntime />, "6.3": <GoldenPath />, "6.4": <Maturity /> }} />;
}
