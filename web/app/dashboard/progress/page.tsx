"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"; // Replace with your actual calendar component
import { Check } from "lucide-react";

// Types for the profile and events
type Profile = {
  first_name: string;
  last_name: string;
  treatment_streak: number;
  last_login: string;
};

type Event = {
  id: number;
  title: string;
  event_date: string;
  event_time: string;
};

export default function ProgressPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // For demonstration, we keep a local daily medication checklist
  const [medications, setMedications] = useState([
    { name: "Med A", time: "08:00 AM", taken: false },
    { name: "Med B", time: "12:00 PM", taken: false },
    { name: "Med C", time: "06:00 PM", taken: false },
  ]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      console.warn("No access token found in localStorage.");
      return;
    }

    // 1) Fetch profile
    fetch("http://localhost:8002/profile", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
        } else {
          console.error("No profile found in response:", data);
        }
      })
      .catch((err) => console.error("Error fetching profile:", err));

    // 2) Fetch events
    fetch("http://localhost:8002/events", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
      })
      .catch((err) => console.error("Error fetching events:", err))
      .finally(() => setLoading(false));
  }, []);

  const toggleMedication = (index: number) => {
    setMedications((prev) => {
      const newMeds = [...prev];
      newMeds[index].taken = !newMeds[index].taken;
      return newMeds;
    });
  };

  return (
    <div className="space-y-6">
      {/* Greeting & Motivational */}
      <Card className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
        <CardHeader>
          <CardTitle className="text-xl">
            {profile ? (
              <>Good Morning, {profile.first_name}!</>
            ) : (
              "Good Morning, User!"
            )}
          </CardTitle>
          <p className="mt-1">
            {profile
              ? `Your treatment streak is ${profile.treatment_streak} days. Keep it up!`
              : "Loading your profile..."}
          </p>
        </CardHeader>
      </Card>

      {/* Treatment Streak & Overall Adherence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Treatment Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {profile ? profile.treatment_streak : "-"} days
            </p>
            <p>Keep it up!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overall Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Placeholder progress for demonstration */}
            <Progress value={85} className="h-4" />
            <p className="mt-2">85% of your protocol completed this week.</p>
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
              {/* Replace with a real calendar component */}
              <Calendar />
            </div>
            <div className="w-full md:w-2/3">
              <h3 className="text-md font-bold mb-2">Today's Events</h3>
              {loading ? (
                <p>Loading events...</p>
              ) : (
                <ul className="space-y-2">
                  {events.map((event) => (
                    <li key={event.id} className="p-2 border rounded">
                      <p className="font-semibold">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.event_time} on {event.event_date}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                className="mt-2"
                onClick={() => alert("Open event creation modal")}
              >
                Create Event
              </Button>
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
              <Progress value={90} className="h-3" />
            </div>
            <div>
              <p>Exercise</p>
              <Progress value={75} className="h-3" />
            </div>
            <div>
              <p>Diet</p>
              <Progress value={80} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Medication Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Medication Checklist</CardTitle>
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
