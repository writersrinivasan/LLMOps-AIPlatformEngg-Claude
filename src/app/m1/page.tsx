"use client";
import { ModulePage } from "@/components/shared/ModulePage";
import { ComponentBuilder, Evolution, Lifecycle } from "@/components/labs/m1";

export default function M1() {
  return <ModulePage moduleId="m1" labs={{ "1.1": <Evolution />, "1.2": <Lifecycle />, "1.3": <ComponentBuilder /> }} />;
}
