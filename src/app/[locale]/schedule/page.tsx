import { Metadata } from 'next';
import TimetableSchedule from '@/components/schedule/TimetableSchedule';

export const metadata: Metadata = { title: 'Telescope Reservation' };

export default function SchedulePage() {
  return <TimetableSchedule />;
}
