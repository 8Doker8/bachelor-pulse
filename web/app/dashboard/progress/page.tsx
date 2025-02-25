"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"; // Replace with your calendar or placeholder
import { Check } from "lucide-react";

// Mock Data
const MOCK_USER = {
  name: "Alice Johnson",
  motivationalQuote: "Every step counts. Keep pushing forward!",
};

const MOCK_TREATMENT_STREAK = 7; // days
const MOCK_OVERALL_ADHERENCE = 85; // percent
const MOCK_DAILY_PROGRESS = {
  medication: 90,
  exercise: 75,
  diet: 80,
};

const MOCK_MEDICATIONS = [
  { name: "Med A", time: "08:00 AM", taken: false },
  { name: "Med B", time: "12:00 PM", taken: false },
  { name: "Med C", time: "06:00 PM", taken: false },
];

type Event = {
  id: number;
  title: string;
  time: string;
};

const MOCK_EVENTS: Event[] = [
  { id: 1, title: "Doctor Appointment", time: "10:00 AM" },
  { id: 2, title: "Physical Therapy", time: "02:00 PM" },
  { id: 3, title: "Medication Reminder", time: "08:00 PM" },
];

export default function ProgressPage() {
  const [medications, setMedications] = useState(MOCK_MEDICATIONS);

  const toggleMedication = (index: number) => {
    setMedications((prev) => {
      const newMeds = [...prev];
      newMeds[index].taken = !newMeds[index].taken;
      return newMeds;
    });
  };

  return (
    <div className="space-y-6">
      {/* Greeting & Motivational Quote */}
      <Card className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
        <CardHeader>
          <CardTitle className="text-xl">
            Good Morning, {MOCK_USER.name}!
          </CardTitle>
          <p className="mt-1">{MOCK_USER.motivationalQuote}</p>
        </CardHeader>
      </Card>

      {/* Treatment Streak & Overall Adherence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Treatment Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{MOCK_TREATMENT_STREAK} days</p>
            <p>Keep it up!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overall Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={MOCK_OVERALL_ADHERENCE} className="h-4" />
            <p className="mt-2">
              {MOCK_OVERALL_ADHERENCE}% of your protocol completed this week.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Calendar & Events (2/3) + Daily Progress (1/3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Calendar & Events => 2/3 columns */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Treatment Calendar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <div className="flex">
              <Calendar />
            </div>
            <div className="w-full md:w-2/3">
              <h3 className="text-md font-bold mb-2">Today's Events</h3>
              <ul className="space-y-2">
                {MOCK_EVENTS.map((event) => (
                  <li key={event.id} className="p-2 border rounded">
                    <p className="font-semibold">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.time}</p>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Daily Progress => 1/3 columns */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Daily Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p>Medication</p>
              <Progress value={MOCK_DAILY_PROGRESS.medication} className="h-3" />
            </div>
            <div>
              <p>Exercise</p>
              <Progress value={MOCK_DAILY_PROGRESS.exercise} className="h-3" />
            </div>
            <div>
              <p>Diet</p>
              <Progress value={MOCK_DAILY_PROGRESS.diet} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Medication Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Daily Medication Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {medications.map((med, index) => (
              <li key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{med.name}</p>
                  <p className="text-sm text-muted-foreground">{med.time}</p>
                </div>
                <Button
                  variant={med.taken ? "default" : "outline"}
                  onClick={() => toggleMedication(index)}
                >
                  {med.taken ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-4 h-4" /> Taken
                    </span>
                  ) : (
                    "Mark as Taken"
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
