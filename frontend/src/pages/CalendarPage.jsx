import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../api.js";
import DarkVeil from "../components/DarkVeil.jsx";

const EMOJIS = ["💕", "🌸", "✈️", "🎂", "💍", "🌙", "💌", "🫶", "🏡", "☕"];

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  return cells;
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [emoji, setEmoji] = useState("💕");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const data = await apiJson("/api/calendar");
    setEvents(data.events);
    setReminders(data.reminders);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const byDate = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      map[ev.event_date] = map[ev.event_date] || [];
      map[ev.event_date].push(ev);
    });
    return map;
  }, [events]);

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = { title, event_date: eventDate, emoji, note };
      if (editing) {
        await apiJson(`/api/calendar/${editing}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiJson("/api/calendar", { method: "POST", body: JSON.stringify(payload) });
      }
      setTitle("");
      setEventDate("");
      setNote("");
      setEmoji("💕");
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    await apiJson(`/api/calendar/${id}`, { method: "DELETE" });
    await load();
  }

  function startEdit(ev) {
    setEditing(ev.id);
    setTitle(ev.title);
    setEventDate(ev.event_date);
    setEmoji(ev.emoji);
    setNote(ev.note || "");
  }

  const cells = monthMatrix(year, month);
  const label = new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

  function shift(delta) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <div className="page cal-page">
      <div className="darkveil-bg" aria-hidden="true">
        <DarkVeil hueShift={18} speed={0.45} warpAmount={0.35} noiseIntensity={0.04} />
      </div>
      <div className="page-head">
        <h1>Our dates</h1>
        <p>Anniversaries, visits, birthdays — little stars on the same sky.</p>
      </div>

      {reminders.length > 0 && (
        <div className="reminder-banner in-page">
          {reminders.map((r) => (
            <span key={r.id}>
              {r.emoji} {r.title} is {r.when}
            </span>
          ))}
        </div>
      )}

      <div className="cal-layout">
        <section className="cal-card">
          <div className="cal-nav">
            <button type="button" className="ghost" onClick={() => shift(-1)}>
              ‹
            </button>
            <h2>{label}</h2>
            <button type="button" className="ghost" onClick={() => shift(1)}>
              ›
            </button>
          </div>
          <div className="cal-grid head">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (!d) return <div key={`e-${i}`} className="cal-cell empty" />;
              const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayEvents = byDate[iso] || [];
              return (
                <button
                  type="button"
                  key={iso}
                  className={`cal-cell ${dayEvents.length ? "has" : ""}`}
                  onClick={() => setEventDate(iso)}
                >
                  <span>{d}</span>
                  <div className="cal-emojis">
                    {dayEvents.map((ev) => (
                      <i key={ev.id}>{ev.emoji}</i>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="cal-card">
          <h2>{editing ? "Edit a date" : "Add a date"}</h2>
          <form onSubmit={save}>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              Date
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </label>
            <div className="emoji-row">
              {EMOJIS.map((em) => (
                <button
                  type="button"
                  key={em}
                  className={emoji === em ? "emoji on" : "emoji"}
                  onClick={() => setEmoji(em)}
                >
                  {em}
                </button>
              ))}
            </div>
            <label>
              Note (optional)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit">{editing ? "Update" : "Save date"}</button>
            {editing && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditing(null);
                  setTitle("");
                  setNote("");
                }}
              >
                Cancel
              </button>
            )}
          </form>

          <ul className="event-list">
            {events.map((ev) => (
              <li key={ev.id}>
                <span>
                  {ev.emoji} {ev.title}
                  <small>{ev.event_date}</small>
                </span>
                <div>
                  <button type="button" className="ghost" onClick={() => startEdit(ev)}>
                    Edit
                  </button>
                  <button type="button" className="ghost danger" onClick={() => remove(ev.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
