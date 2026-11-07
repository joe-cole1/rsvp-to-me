"use client";

import { useState } from "react";
import { APP_SHELL_THEME } from "@/lib/theme";
import { LocationFields, type LocationValue } from "./LocationFields";

export default function LocationSelector() {
  const [location, setLocation] = useState<LocationValue>({
    type: "PHYSICAL",
    name: "",
    address: "",
    virtualUrl: "",
  });

  return (
    <LocationFields value={location} onChange={setLocation} theme={APP_SHELL_THEME} submitNames />
  );
}
