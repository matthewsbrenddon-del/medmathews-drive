import { guardRoute } from "@/lib/server/auth";
import { NextRequest, NextResponse } from "next/server";
import ICAL from "ical.js";

/**
 * Leitura do Google Agenda pelo "Endereço secreto no formato iCal" — funciona
 * sem configurar OAuth. O navegador não pode buscar o .ics direto (CORS), então
 * esta rota busca e expande os eventos (inclusive recorrentes) no intervalo
 * pedido. Só aceita endereços do próprio Google Agenda (evita virar proxy aberto).
 */

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_OCCURRENCES = 3000;

interface OutEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
}

function isAllowed(raw: string): URL | null {
  try {
    const url = new URL(raw.replace(/^webcal:/i, "https:"));
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "calendar.google.com") return null;
    if (!url.pathname.startsWith("/calendar/ical/") || !url.pathname.endsWith(".ics")) return null;
    return url;
  } catch {
    return null;
  }
}

function toOut(time: ICAL.Time): { value: string; allDay: boolean } {
  if (time.isDate) {
    return {
      value: `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`,
      allDay: true,
    };
  }
  return { value: time.toJSDate().toISOString(), allDay: false };
}

export async function GET(req: NextRequest) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const url = isAllowed(raw);
  if (!url) {
    return NextResponse.json(
      { error: "Use o “Endereço secreto no formato iCal” do Google Agenda (https://calendar.google.com/calendar/ical/…/basic.ics)." },
      { status: 400 }
    );
  }
  const from = new Date(req.nextUrl.searchParams.get("from") ?? Date.now() - 31 * 864e5);
  const to = new Date(req.nextUrl.searchParams.get("to") ?? Date.now() + 62 * 864e5);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 400 * 864e5) {
    return NextResponse.json({ error: "Intervalo de datas inválido." }, { status: 400 });
  }

  let text: string;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000), redirect: "error" });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 404 ? "Agenda não encontrada — o link secreto pode ter sido redefinido." : `O Google respondeu ${res.status}.` },
        { status: 502 }
      );
    }
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return NextResponse.json({ error: "Agenda grande demais." }, { status: 413 });
    text = await res.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "Agenda grande demais." }, { status: 413 });
  } catch {
    return NextResponse.json({ error: "Não foi possível acessar o Google Agenda agora." }, { status: 502 });
  }

  try {
    const root = new ICAL.Component(ICAL.parse(text));
    for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
    const calendarName = (root.getFirstPropertyValue("x-wr-calname") as string | null) ?? "Google Agenda";

    const vevents = root.getAllSubcomponents("vevent");
    const exceptions = new Map<string, ICAL.Component[]>();
    for (const v of vevents) {
      if (!v.hasProperty("recurrence-id")) continue;
      const uid = String(v.getFirstPropertyValue("uid"));
      exceptions.set(uid, [...(exceptions.get(uid) ?? []), v]);
    }

    const rangeStart = ICAL.Time.fromJSDate(from, true);
    const rangeEnd = ICAL.Time.fromJSDate(to, true);
    const out: OutEvent[] = [];

    const push = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time, key: string) => {
      if (String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") return;
      if (end.compare(rangeStart) <= 0 || start.compare(rangeEnd) >= 0) return;
      const s = toOut(start);
      const e = toOut(end ?? start);
      out.push({
        id: `${item.uid}:${key}`,
        title: item.summary || "(sem título)",
        start: s.value,
        end: e.value,
        allDay: s.allDay,
        location: item.location || undefined,
        description: item.description ? String(item.description).slice(0, 600) : undefined,
      });
    };

    for (const v of vevents) {
      if (v.hasProperty("recurrence-id")) continue;
      const event = new ICAL.Event(v);
      for (const exc of exceptions.get(event.uid) ?? []) event.relateException(exc);
      if (!event.isRecurring()) {
        push(event, event.startDate, event.endDate ?? event.startDate, event.startDate.toString());
        continue;
      }
      const it = event.iterator();
      let next: ICAL.Time | null;
      let guard = 0;
      while ((next = it.next()) && guard++ < 5000) {
        if (next.compare(rangeEnd) >= 0) break;
        const details = event.getOccurrenceDetails(next);
        push(details.item, details.startDate, details.endDate, next.toString());
        if (out.length > MAX_OCCURRENCES) break;
      }
    }

    out.sort((a, b) => a.start.localeCompare(b.start));
    return NextResponse.json({ calendarName, events: out }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ler esse calendário (.ics inválido)." }, { status: 422 });
  }
}
