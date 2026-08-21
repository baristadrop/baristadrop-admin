import { requireAdmin } from '@/lib/adminAuth';

const POSTHOG_PROJECT_ID = '514557';

async function hogql(query: string) {
  const res = await fetch(`https://us.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

export async function GET(request: Request) {
  const caller = await requireAdmin(request);
  if (!caller) return Response.json({ error: 'unauthorized' }, { status: 403 });

  const [visitors, opens, installs] = await Promise.all([
    hogql("SELECT count(DISTINCT person_id) FROM events WHERE timestamp > now() - INTERVAL 30 DAY"),
    hogql("SELECT count() FROM events WHERE event = 'Application Opened' AND timestamp > now() - INTERVAL 30 DAY"),
    hogql("SELECT count() FROM events WHERE event = 'Application Installed' AND timestamp > now() - INTERVAL 30 DAY"),
  ]);

  return Response.json({
    connected: visitors !== null,
    uniqueVisitors30d: visitors?.[0] ?? 0,
    appOpens30d: opens?.[0] ?? 0,
    newInstalls30d: installs?.[0] ?? 0,
  });
}
