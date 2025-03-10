"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"; // Replace with your actual calendar component
import { Check } from "lucide-react";

// Types for the profile and events returned by the backend
type Profile = {
  first_name: string;
  last_name: string;
  treatment_streak: number;
  last_login: string;
  medicine: string;
  recommended_activities: string[];
};

type Event = {
  id: number;
  title: string;
  event_date: string; // Format: "YYYY-MM-DD"
  event_time: string;
};

// Define a type for a task (to‑do list item)
type Task = {
  id: string;
  title: string;
  time: string;
  category: "medication" | "diet" | "exercise" | "doctor";
  disclaimer?: string;
  completed: boolean;
  completionTitle: string; // Title expected in the event when the task is completed
};

export default function ProgressPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Fetch profile and events on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      console.warn("No access token found.");
      return;
    }

    // Fetch profile data
    fetch("http://localhost:8002/profile", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched profile:", data);
        if (data.profile) {
          setProfile(data.profile);
        }
      })
      .catch((err) => console.error("Error fetching profile:", err));

    // Fetch events data
    fetch("http://localhost:8002/events", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch((err) => console.error("Error fetching events:", err))
      .finally(() => setLoading(false));
  }, []);

  // Build tasks based on profile and events
  useEffect(() => {
    if (profile) {
      const today = new Date().toISOString().slice(0, 10);

      // Medication task (always included)
      const medicationTask: Task = {
        id: "medication",
        title: `Take ${profile.medicine}`,
        time: "08:00 AM",
        category: "medication",
        completed: events.some(
          (ev) =>
            ev.title === `Medication taken: ${profile.medicine}` &&
            ev.event_date === today
        ),
        completionTitle: `Medication taken: ${profile.medicine}`,
      };

      // Diet tasks (for Healthy Diet)
      const dietTasks: Task[] = [];
      if (profile.recommended_activities.includes("Healthy Diet")) {
        dietTasks.push(
          {
            id: "breakfast",
            title: "Healthy Breakfast",
            time: "08:00 AM",
            category: "diet",
            disclaimer: "Avoid foods high in saturated fats.",
            completed: events.some(
              (ev) =>
                ev.title === "Healthy Breakfast completed" &&
                ev.event_date === today
            ),
            completionTitle: "Healthy Breakfast completed",
          },
          {
            id: "lunch",
            title: "Healthy Lunch",
            time: "12:00 PM",
            category: "diet",
            disclaimer: "Focus on vegetables and lean protein.",
            completed: events.some(
              (ev) =>
                ev.title === "Healthy Lunch completed" &&
                ev.event_date === today
            ),
            completionTitle: "Healthy Lunch completed",
          },
          {
            id: "dinner",
            title: "Healthy Dinner",
            time: "07:00 PM",
            category: "diet",
            disclaimer: "Avoid heavy meals and excessive fats.",
            completed: events.some(
              (ev) =>
                ev.title === "Healthy Dinner completed" &&
                ev.event_date === today
            ),
            completionTitle: "Healthy Dinner completed",
          }
        );
      }

      // Exercise task (for Exercise)
      const exerciseTasks: Task[] = [];
      if (profile.recommended_activities.includes("Exercise")) {
        exerciseTasks.push({
          id: "exercise",
          title: "30 min Walk",
          time: "06:00 PM",
          category: "exercise",
          completed: events.some(
            (ev) =>
              ev.title === "30 min Walk completed" &&
              ev.event_date === today
          ),
          completionTitle: "30 min Walk completed",
        });
      }

      // Doctor checkup task (for Doctor Checkup)
      const doctorTasks: Task[] = [];
      if (profile.recommended_activities.includes("Doctor Checkup")) {
        doctorTasks.push({
          id: "doctor",
          title: "Doctor Checkup",
          time: "As Scheduled",
          category: "doctor",
          completed: events.some(
            (ev) =>
              ev.title === "Doctor Checkup completed" &&
              ev.event_date === today
          ),
          completionTitle: "Doctor Checkup completed",
        });
      }

      // Combine all tasks
      const allTasks: Task[] = [
        medicationTask,
        ...dietTasks,
        ...exerciseTasks,
        ...doctorTasks,
      ];

      setTasks(allTasks);
    }
  }, [profile, events]);

  // Function to mark a task as completed by logging an event in the backend
  const markTaskAsCompleted = async (taskId: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const today = new Date().toISOString().slice(0, 10);

    try {
      const res = await fetch("http://localhost:8002/log_event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: task.completionTitle,
          event_date: today,
          event_time: task.time,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to log event");
      }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, completed: true } : t
        )
      );
    } catch (error: any) {
      console.error("Error logging event:", error);
    }
  };

  // Helper functions to compute progress for each category and overall
  const computeCategoryProgress = (category: string): number => {
    const filtered = tasks.filter((t) => t.category === category);
    if (filtered.length === 0) return 0;
    const completedCount = filtered.filter((t) => t.completed).length;
    return Math.round((completedCount / filtered.length) * 100);
  };

  const overallProgress =
    tasks.length > 0
      ? Math.round(
          tasks.reduce((acc, task) => acc + (task.completed ? 100 : 0), 0) /
            tasks.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Greeting & Motivational */}
      <Card className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
        <CardHeader>
          <CardTitle className="text-xl">
            Good Morning, {profile ? profile.first_name : "User"}!
          </CardTitle>
          <p className="mt-1">
            {profile
              ? `Your treatment streak is ${profile.treatment_streak || 0} days. Keep it up!`
              : "Loading your profile..."}
          </p>
        </CardHeader>
      </Card>


      {/* Middle Row: Calendar & Events */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              {/* Apply fixed or max height & overflow here */}
              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <p>Loading events...</p>
                ) : (
                  <ul className="space-y-2">
                    {(events || []).map((event) => (
                      <li key={event.id} className="p-2 border rounded">
                        <p className="font-semibold">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.event_time} on {event.event_date}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button className="mt-2" onClick={() => alert("Open event creation modal")}>
                Create Event
              </Button>
            </div>
          </CardContent>

        </Card>

        {/* Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Progress Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2">Overall Progress: {overallProgress}%</p>
          <Progress value={overallProgress} className="h-4" />
          <div className="mt-4">
            <p>Healthy Diet: {computeCategoryProgress("diet")}%</p>
            <Progress value={computeCategoryProgress("diet")} className="h-3" />
          </div>
          <div className="mt-4">
            <p>Exercise: {computeCategoryProgress("exercise")}%</p>
            <Progress value={computeCategoryProgress("exercise")} className="h-3" />
          </div>
          <div className="mt-4">
            <p>Doctor Checkup: {computeCategoryProgress("doctor")}%</p>
            <Progress value={computeCategoryProgress("doctor")} className="h-3" />
          </div>
          <div className="mt-4">
            <p>Medication: {computeCategoryProgress("medication")}%</p>
            <Progress value={computeCategoryProgress("medication")} className="h-3" />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Daily To-Do List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today's To-Do List</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="max-h-80 overflow-y-auto">
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${task.completed ? "line-through" : ""}`}>
                      {task.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{task.time}</p>
                    {task.disclaimer && (
                      <p className="text-xs text-red-500">{task.disclaimer}</p>
                    )}
                  </div>
                  <Button
                    variant={task.completed ? "default" : "outline"}
                    onClick={() => markTaskAsCompleted(task.id)}
                    disabled={task.completed}
                  >
                    {task.completed ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-4 h-4" /> Completed
                      </span>
                    ) : (
                      "Mark as Completed"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
