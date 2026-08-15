import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../api.js";
import GlobeCanvas from "../components/GlobeCanvas.jsx";

export default function Home() {
  const [map, setMap] = useState(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: Math.max(window.innerHeight - 72, 420),
  });

  const load = useCallback(async () => {
    try {
      const data = await apiJson("/api/home/map");
      setMap(data);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const onResize = () =>
      setSize({ w: window.innerWidth, h: Math.max(window.innerHeight - 72, 420) });
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", onResize);
    };
  }, [load]);

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
              <span>{p.local_time}</span>
            </div>
          </article>
        ))}
      </div>

      {map?.pins?.length ? <GlobeCanvas pins={map.pins} width={size.w} height={size.h} /> : null}
      <p className="globe-hint">Drag to spin. Scroll or pinch to zoom.</p>
    </div>
  );
}
