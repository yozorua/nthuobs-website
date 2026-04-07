export type Role = "MEMBER" | "ADMIN";

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
  createdAt: Date;
}

export interface ScheduleItem {
  id: string;
  title: string;
  description?: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  telescope?: string | null;
  isPublic: boolean;
  userId: string;
  user?: {
    id: string;
    name?: string | null;
    image?: string | null;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  date: Date;
  location?: string | null;
  isPublic: boolean;
  createdAt: Date;
}

export interface CreateScheduleInput {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  telescope?: string;
  isPublic?: boolean;
}
