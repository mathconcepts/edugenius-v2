// @ts-nocheck
/**
 * Google Meet Channel Adapter
 * Live tutoring sessions via Google Meet
 */

import { ChannelConfig } from './types';

// Configuration
let meetConfig: ChannelConfig['credentials']['meet'] | null = null;

export function configureMeet(config: NonNullable<ChannelConfig['credentials']['meet']>): void {
  meetConfig = config;
}

function getConfig(): NonNullable<ChannelConfig['credentials']['meet']> {
  if (!meetConfig) {
    throw new Error('Google Meet not configured');
  }
  return meetConfig;
}

// OAuth token cache
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const config = getConfig();
  
  if (accessToken && Date.now() < tokenExpiresAt - 60000) {
    return accessToken;
  }
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  });
  
  if (!response.ok) throw new Error('Failed to refresh Google OAuth token');
  
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  
  return accessToken!;
}

export interface MeetingConfig {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  sendNotifications?: boolean;
}

export interface MeetingDetails {
  id: string;
  meetLink: string;
  calendarEventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
}

export async function createMeeting(config: MeetingConfig): Promise<MeetingDetails> {
  const token = await getAccessToken();
  
  const event = {
    summary: config.title,
    description: config.description,
    start: { dateTime: config.startTime.toISOString(), timeZone: 'UTC' },
    end: { dateTime: config.endTime.toISOString(), timeZone: 'UTC' },
    attendees: config.attendees?.map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `edugenius-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };
  
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1' +
    `&sendUpdates=${config.sendNotifications ? 'all' : 'none'}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Calendar API error: ${error}`);
  }
  
  const result = await response.json();
  
  return {
    id: result.id,
    meetLink: result.hangoutLink || result.conferenceData?.entryPoints?.[0]?.uri,
    calendarEventId: result.id,
    title: result.summary,
    startTime: new Date(result.start.dateTime),
    endTime: new Date(result.end.dateTime),
    attendees: result.attendees?.map((a: any) => a.email) || [],
    status: 'scheduled'
  };
}

export async function getMeeting(eventId: string): Promise<MeetingDetails | null> {
  const token = await getAccessToken();
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to get meeting details');
  }
  
  const result = await response.json();
  
  return {
    id: result.id,
    meetLink: result.hangoutLink || result.conferenceData?.entryPoints?.[0]?.uri,
    calendarEventId: result.id,
    title: result.summary,
    startTime: new Date(result.start.dateTime),
    endTime: new Date(result.end.dateTime),
    attendees: result.attendees?.map((a: any) => a.email) || [],
    status: result.status === 'cancelled' ? 'cancelled' : 'scheduled'
  };
}

export async function cancelMeeting(eventId: string, sendNotifications: boolean = true): Promise<void> {
  const token = await getAccessToken();
  
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=${sendNotifications ? 'all' : 'none'}`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
  );
}

export async function addAttendee(eventId: string, email: string): Promise<void> {
  const token = await getAccessToken();
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  const event = await response.json();
  const attendees = event.attendees || [];
  
  if (attendees.some((a: any) => a.email === email)) return;
  attendees.push({ email });
  
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendees })
    }
  );
}

export async function listMeetings(options: {
  maxResults?: number;
  timeMin?: Date;
  timeMax?: Date;
} = {}): Promise<MeetingDetails[]> {
  const token = await getAccessToken();
  
  const params = new URLSearchParams({
    maxResults: String(options.maxResults || 10),
    timeMin: (options.timeMin || new Date()).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime'
  });
  
  if (options.timeMax) params.set('timeMax', options.timeMax.toISOString());
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  if (!response.ok) throw new Error('Failed to list meetings');
  
  const result = await response.json();
  
  return (result.items || [])
    .filter((e: any) => e.hangoutLink || e.conferenceData)
    .map((e: any) => ({
      id: e.id,
      meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri,
      calendarEventId: e.id,
      title: e.summary,
      startTime: new Date(e.start.dateTime || e.start.date),
      endTime: new Date(e.end.dateTime || e.end.date),
      attendees: e.attendees?.map((a: any) => a.email) || [],
      status: e.status === 'cancelled' ? 'cancelled' : 'scheduled'
    }));
}

export async function createInstantMeeting(title: string, durationMinutes: number = 60): Promise<MeetingDetails> {
  const now = new Date();
  const end = new Date(now.getTime() + durationMinutes * 60000);
  
  return createMeeting({ title, startTime: now, endTime: end, sendNotifications: false });
}

export async function scheduleTutoringSession(options: {
  studentEmail: string;
  studentName: string;
  subject: string;
  topic?: string;
  startTime: Date;
  durationMinutes?: number;
}): Promise<MeetingDetails> {
  const duration = options.durationMinutes || 45;
  const endTime = new Date(options.startTime.getTime() + duration * 60000);
  
  return createMeeting({
    title: `EduGenius Tutoring: ${options.subject}${options.topic ? ` - ${options.topic}` : ''}`,
    description: `Tutoring session with ${options.studentName}\nSubject: ${options.subject}\n${options.topic ? `Topic: ${options.topic}` : ''}`,
    startTime: options.startTime,
    endTime,
    attendees: [options.studentEmail],
    sendNotifications: true
  });
}
