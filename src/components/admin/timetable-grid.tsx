"use client";

import { useState } from "react";
import { Pencil, Plus, X, Clock, MapPin, Video, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

export interface TimetableSlot {
  day: string;
  period: number;
  subject: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  room: string;
  meet_link?: string;
}

interface TimetableGridProps {
  slots: TimetableSlot[];
  classLabel: string;
  programme: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const PERIOD_TIMES = [
  "08:00", "08:45", "09:30", "10:15", "11:00", "11:45", "12:30", "13:15",
];

const SUBJECT_TONES: Record<string, string> = {
  "English": "bg-primary/10 border-primary/30 text-primary",
  "Urdu": "bg-gold/10 border-gold/40 text-gold-strong",
  "Islamiat": "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  "Pak Studies": "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  "Computer Science": "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300",
  "Mathematics": "bg-primary/10 border-primary/30 text-primary",
  "Physics": "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300",
  "Chemistry": "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300",
  "Biology": "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  "Library": "bg-secondary border-border text-muted-foreground",
  "Sports": "bg-secondary border-border text-muted-foreground",
  "Test": "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
};

function toneFor(subject: string) {
  return SUBJECT_TONES[subject] ?? "bg-secondary border-border text-foreground";
}

export function TimetableGrid({ slots: initialSlots, classLabel, programme }: TimetableGridProps) {
  const [slots, setSlots] = useState<TimetableSlot[]>(initialSlots);

  const slotMap = new Map<string, TimetableSlot>();
  for (const s of slots) slotMap.set(`${s.day}-${s.period}`, s);

  function updateSlot(day: string, period: number, partial: Partial<TimetableSlot>) {
    setSlots((prev) => {
      const key = `${day}-${period}`;
      const existing = prev.find((s) => `${s.day}-${s.period}` === key);
      if (existing) {
        return prev.map((s) => (`${s.day}-${s.period}` === key ? { ...s, ...partial } : s));
      }
      return [
        ...prev,
        {
          day,
          period,
          subject: "",
          teacher_name: "",
          start_time: PERIOD_TIMES[period - 1] ?? "",
          end_time: "",
          room: "",
          ...partial,
        },
      ];
    });
  }

  function clearSlot(day: string, period: number) {
    setSlots((prev) => prev.filter((s) => `${s.day}-${s.period}` !== `${day}-${period}`));
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-1.5">
            <div className="flex items-center justify-center rounded-md bg-secondary p-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Day
            </div>
            {PERIODS.map((p) => (
              <div
                key={p}
                className="flex flex-col items-center justify-center rounded-md bg-secondary p-2 text-center"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">P{p}</span>
                <span className="font-mono text-[10px] text-muted-foreground/70">{PERIOD_TIMES[p - 1]}</span>
              </div>
            ))}

            {DAYS.map((day) => (
              <DayRow
                key={day}
                day={day}
                slotMap={slotMap}
                onUpdate={updateSlot}
                onClear={clearSlot}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold text-foreground">{classLabel} · {programme.toUpperCase()}</span>
          <span className="ml-2 text-muted-foreground">
            {slots.length} period{slots.length === 1 ? "" : "s"} scheduled
          </span>
        </div>
        <Button className="h-11 rounded-full font-semibold">
          <Save className="mr-1.5 h-4 w-4" aria-hidden /> Save Changes
        </Button>
      </div>
    </div>
  );
}

function DayRow({
  day,
  slotMap,
  onUpdate,
  onClear,
}: {
  day: string;
  slotMap: Map<string, TimetableSlot>;
  onUpdate: (day: string, period: number, partial: Partial<TimetableSlot>) => void;
  onClear: (day: string, period: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-center rounded-md bg-primary/5 p-2 text-xs font-bold uppercase tracking-wide text-primary">
        {day}
      </div>
      {PERIODS.map((p) => {
        const key = `${day}-${p}`;
        const slot = slotMap.get(key);
        const isFilled = Boolean(slot?.subject);
        return (
          <SlotCell
            key={key}
            day={day}
            period={p}
            slot={slot}
            isFilled={isFilled}
            onUpdate={onUpdate}
            onClear={onClear}
          />
        );
      })}
    </>
  );
}

function SlotCell({
  day,
  period,
  slot,
  isFilled,
  onUpdate,
  onClear,
}: {
  day: string;
  period: number;
  slot?: TimetableSlot;
  isFilled: boolean;
  onUpdate: (day: string, period: number, partial: Partial<TimetableSlot>) => void;
  onClear: (day: string, period: number) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleSave(values: Partial<TimetableSlot>) {
    onUpdate(day, period, values);
    setOpen(false);
  }

  function handleClear() {
    onClear(day, period);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`group relative min-h-[80px] cursor-pointer rounded-md border p-2 text-left transition-all hover:border-primary/40 hover:shadow-sm ${
            isFilled ? toneFor(slot?.subject ?? "") : "border-dashed border-border bg-background hover:bg-secondary/40"
          }`}
          aria-label={`Edit ${day} period ${period}`}
        >
          {isFilled ? (
            <div className="flex h-full flex-col">
              <p className="text-xs font-bold leading-tight">{slot?.subject}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {slot?.teacher_name || "—"}
              </p>
              {slot?.room && (
                <p className="mt-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5" aria-hidden /> {slot.room}
                </p>
              )}
              <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100">
                <Pencil className="h-3 w-3" aria-hidden />
              </span>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground/60">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              <span className="text-[10px]">Add</span>
            </div>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit Period — {day} · P{period}
          </DialogTitle>
          <DialogDescription>
            Update the subject, teacher, time and room for this slot. Changes are staged until you press Save Changes.
          </DialogDescription>
        </DialogHeader>
        <TimetableEditForm
          day={day}
          period={period}
          slot={slot}
          onSave={handleSave}
          onClear={slot ? handleClear : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}

function TimetableEditForm({
  day,
  period,
  slot,
  onSave,
  onClear,
}: {
  day: string;
  period: number;
  slot?: TimetableSlot;
  onSave: (values: Partial<TimetableSlot>) => void;
  onClear?: () => void;
}) {
  const [subject, setSubject] = useState(slot?.subject ?? "");
  const [teacher, setTeacher] = useState(slot?.teacher_name ?? "");
  const [startTime, setStartTime] = useState(slot?.start_time ?? PERIOD_TIMES[period - 1] ?? "");
  const [endTime, setEndTime] = useState(slot?.end_time ?? "");
  const [room, setRoom] = useState(slot?.room ?? "");
  const [meetLink, setMeetLink] = useState(slot?.meet_link ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    onSave({
      subject: subject.trim(),
      teacher_name: teacher.trim(),
      start_time: startTime,
      end_time: endTime,
      room: room.trim(),
      meet_link: meetLink.trim() || undefined,
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <Label htmlFor="tt-subject" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Subject
        </Label>
        <Input
          id="tt-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Computer Science"
          className="h-11"
          autoFocus
          required
        />
      </div>
      <div>
        <Label htmlFor="tt-teacher" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Teacher
        </Label>
        <Input
          id="tt-teacher"
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
          placeholder="e.g. Mr. Taj Muhammad"
          className="h-11"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tt-start" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden /> Start
          </Label>
          <Input
            id="tt-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-11"
          />
        </div>
        <div>
          <Label htmlFor="tt-end" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden /> End
          </Label>
          <Input
            id="tt-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="tt-room" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden /> Room
        </Label>
        <Input
          id="tt-room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="e.g. Lab 1, Room 12"
          className="h-11"
        />
      </div>
      <div>
        <Label htmlFor="tt-meet" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Video className="h-3 w-3" aria-hidden /> Meet Link (optional)
        </Label>
        <Input
          id="tt-meet"
          value={meetLink}
          onChange={(e) => setMeetLink(e.target.value)}
          placeholder="https://meet.google.com/…"
          className="h-11"
        />
      </div>

      <DialogFooter>
        {onClear && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onClear}
          >
            <X className="mr-1.5 h-4 w-4" aria-hidden /> Clear slot
          </Button>
        )}
        <DialogClose asChild>
          <Button type="button" variant="outline" className="h-11 rounded-full">Cancel</Button>
        </DialogClose>
        <Button type="submit" className="h-11 rounded-full font-semibold">
          Save Period
        </Button>
      </DialogFooter>
    </form>
  );
}
