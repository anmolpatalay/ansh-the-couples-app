import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "../api.js";
import GlobeCanvas from "../components/GlobeCanvas.jsx";

const NTP_EVERY_MS = 15 * 60 * 1000;

function formatInZone(ms, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).formatToParts(new Date(ms));
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${get("timeZoneName")}`.trim();
  } catch {
    return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }
}

export default function Home() {
  const [map, setMap] = useState(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: Math.max(window.innerHeight - 72, 420),
  });

  const applyNtp = useCallback((ntpUtcMs) => {
    setOffset(ntpUtcMs - Date.now());
  }, []);

  const loadMap = useCallback(async () => {
    const data = await apiJson("/api/home/map");
    setMap(data);
    if (data.ntp_utc_ms) applyNtp(data.ntp_utc_ms);
  }, [applyNtp]);

  useEffect(() => {
    loadMap().catch((err) => setError(err.message));

    const tick = setInterval(() => setNow(Date.now()), 1000);
    const ntp = setInterval(() => {
      apiJson("/api/home/clock")
        .then((data) => applyNtp(data.ntp_utc_ms))
        .catch(() => {});
    }, NTP_EVERY_MS);
    const onResize = () =>
      setSize({ w: window.innerWidth, h: Math.max(window.innerHeight - 72, 420) });
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(tick);
      clearInterval(ntp);
      window.removeEventListener("resize", onResize);
    };
  }, [loadMap, applyNtp]);

  const correctedNow = now + offset;
  const timesById = useMemo(() => {
    const times = {};
    (map?.pins || []).forEach((p) => {
      times[p.user_id] = formatInZone(correctedNow, p.timezone);
    });
    return times;
  }, [map, correctedNow]);

  const globePins = useMemo(
    () =>
      (map?.pins || []).map((p) => ({
        user_id: p.user_id,
        name: p.name,
        city: p.city,
        country: p.country,
        lat: p.lat,
        lng: p.lng,
        picture_url: p.picture_url,
      })),
    [map]
  );

  return (
    <div className="globe-page">
      {map?.reminders?.length > 0 && (
        <div className="reminder-banner">
          {map.reminders.map((r) => (
            <span key={r.id}>
              {r.emoji} {r.title} is {r.when}
            </span>
          ))}
        </div>
      )}
      {error && <p className="error floating">{error}</p>}
      {!map && !error && <p className="globe-hint">Finding both of you…</p>}

      <div className="pin-cards">
        {(map?.pins || []).map((p) => (
          <article key={p.user_id} className="pin-card">
            <div className="pin-photo">
              {p.picture_url ? (
                <img src={p.picture_url} alt={p.name} />
              ) : (
                <span>{(p.name || "?").slice(0, 1)}</span>
              )}
            </div>
            <div>
              <strong>{p.name}</strong>
              <em>
                {p.city}, {p.country}
              </em>
              <span>{timesById[p.user_id] || p.local_time}</span>
            </div>
          </article>
        ))}
        {map?.distance_km != null && (
          <article className="pin-card distance-card">
            <strong>{Number(map.distance_km).toLocaleString()} km</strong>
            <em>between you</em>
          </article>
        )}
      </div>

      {globePins.length ? (
        <GlobeCanvas pins={globePins} timesById={timesById} width={size.w} height={size.h} />
      ) : null}
      <p className="globe-hint">Drag to spin. Scroll or pinch to zoom.</p>
    </div>
  );
}
