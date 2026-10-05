"use client";
import { ModulePage } from "@/components/shared/ModulePage";
import { Capstone } from "@/components/labs/m7";

export default function M7() {
  return <ModulePage moduleId="m7" labs={{ "7.1": <Capstone /> }} />;
}
