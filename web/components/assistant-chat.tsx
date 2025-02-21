"use client";

import React, { useState, useEffect, useRef, KeyboardEvent } from "react";

type Message = {
  sender: "user" | "assistant";
  text: string;
};

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "assistant", text: "Hello! How can I help you today?" },
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Explicitly type the ref as HTMLDivElement or null.
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    
    // Append user's message
    const newMessages: Message[] = [
      ...messages,
      { sender: "user", text: trimmed },
    ];
    setMessages(newMessages);
    setInputText("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: trimmed }),
      });
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      setMessages(prev => [
        ...prev,
        { sender: "assistant", text: data.response || "No response received." },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [
        ...prev,
        { sender: "assistant", text: "Sorry, something went wrong." },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full p-4 border rounded-lg bg-white shadow-md">
      {/* Chat History */}
      <div className="flex-1 overflow-y-auto mb-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 p-2 rounded-lg max-w-[70%] ${
              msg.sender === "user"
                ? "bg-blue-100 self-end text-blue-900"
                : "bg-gray-100 self-start text-gray-900"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div className="text-gray-500 italic">Assistant is typing...</div>
        )}
        <div ref={messageEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="flex gap-2">
        <textarea
          className="flex-1 p-2 border rounded-md resize-none"
          rows={2}
          placeholder="Type your message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
          onClick={sendMessage}
          disabled={loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}
