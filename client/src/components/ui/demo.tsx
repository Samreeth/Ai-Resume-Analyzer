import React from "react";
import AITextLoading from "@/components/ui/ai-text-loading";

export default function Demo() {
  return (
    <div
      className="flex min-h-[300px] w-full items-center justify-center"
      style={{
        display: "flex",
        minHeight: "300px",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AITextLoading />
    </div>
  );
}
