"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: Account Setup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  // Step 2: Personal Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState<number | undefined>(undefined);
  const [gender, setGender] = useState("");

  // Step 3: Diagnosis
  const [diagnosis, setDiagnosis] = useState("High cholesterol");

  // Step 4: Treatment Protocol
  const [medicine, setMedicine] = useState("Crestor");
  const [activities, setActivities] = useState<string[]>([]);

  const handleNext = async () => {
    try {
      if (step === 1) {
        // Step 1: Register user (email & password)
        const res = await fetch("http://localhost:8002/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email, password }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Registration failed");
        }
        const data = await res.json();
        setToken(data.access_token);
        setStep(2);
      } else if (step < 4) {
        setStep(step + 1);
      } else {
        // Final step: Complete registration
        const res = await fetch("http://localhost:8002/complete_registration", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Must be "Bearer <token>"
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            age: age,
            gender: gender,
            diagnosis: diagnosis,
            medicine: medicine,
            recommended_activities: activities,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Registration completion failed");
        }
        router.push("/login");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleActivityToggle = (activity: string) => {
    setActivities((prev) =>
      prev.includes(activity)
        ? prev.filter((a) => a !== activity)
        : [...prev, activity]
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Step 1: Account Setup</h1>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Step 2: Personal Information</h1>
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gender">Gender</Label>
              <Input
                id="gender"
                type="text"
                placeholder="Male/Female/Other"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Step 3: Diagnosis</h1>
            <p>
              Your diagnosis is pre-selected as: <strong>{diagnosis}</strong>
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Step 4: Treatment Protocol</h1>
            <p>
              Your medicine is pre-selected as: <strong>{medicine}</strong>
            </p>
            <div className="mt-4">
              <h2 className="text-lg font-semibold">Recommended Activities</h2>
              <div className="flex gap-2 mt-2">
                {["Exercise", "Healthy Diet", "Regular Check-ups"].map((activity) => (
                  <Button
                    key={activity}
                    variant={activities.includes(activity) ? "default" : "outline"}
                    onClick={() => handleActivityToggle(activity)}
                  >
                    {activity}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Button onClick={handleNext} className="w-full">
            {step < 4 ? "Continue" : "Finish Registration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
