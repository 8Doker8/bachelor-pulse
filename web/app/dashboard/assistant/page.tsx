// app/dashboard/assistant/page.tsx
import React from "react";
import AssistantChat from "@/components/assistant-chat"; // Ensure this path is correct

export default function AssistantPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Assistant Chat</h1>
      <AssistantChat />
    </div>
  );
}
