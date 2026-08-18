import { useEffect, useMemo, useState } from "react";
import { api, apiJson, mediaUrl } from "../api.js";
import DepthCarousel from "../components/DepthCarousel.jsx";

async function shrinkForUpload(file) {
  if (!file?.type?.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 400000) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return file;
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export default function Photos() {
  const [photos, setPhotos] = useState([]);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const carouselItems = useMemo(
    () =>
      photos.map((p) => ({
        image: mediaUrl(p.thumb_url || p.url),
        alt: p.note || "Us",
      })),
    [photos],
  );

  const focused = photos[activeIndex] || photos[0] || null;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function load() {
    const data = await apiJson("/api/photos");
    setPhotos(data.photos);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const packed = await shrinkForUpload(file);
      const form = new FormData();
      form.append("file", packed);
      form.append("note", note);
      const res = await api("/api/photos", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not add photo");
      setFile(null);
      setNote("");
      e.target.reset();
      setPhotos((prev) => [data, ...prev]);
      setActiveIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    await apiJson(`/api/photos/${id}`, { method: "DELETE" });
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (open?.id === id) setOpen(null);
    setActiveIndex((i) => Math.max(0, Math.min(i, photos.length - 2)));
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Us in photos</h1>
        <p>A shared album. Notes are optional — the picture can speak for itself.</p>
      </div>

      <form className="photo-form" onSubmit={add}>
        <label>
          Photo
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A line about this moment" />
        </label>
        <button type="submit" disabled={busy || !file}>
          {busy ? "Adding…" : "Add photo"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {photos.length === 0 ? (
        <p className="muted">Add a photo to start a stacked album you can swipe through.</p>
      ) : (
        <>
          <div className="photo-carousel-wrap">
            <DepthCarousel
              items={carouselItems}
              depth={220}
              spread={90}
              tilt={22}
              tiltDirection="right"
              perspective={1400}
              visibleCards={4}
              falloff={0.2}
              blur={6}
              autoplay={photos.length > 1}
              loop={photos.length > 1}
              tint="#0b1020"
              onChange={(index) => setActiveIndex(index)}
            />
          </div>
          {focused ? (
            <div className="photo-carousel-meta">
              {focused.note ? <p>{focused.note}</p> : <p className="muted">No note on this one.</p>}
              <div className="photo-carousel-actions">
                <button type="button" className="ghost" onClick={() => setOpen(focused)}>
                  View full size
                </button>
                <button type="button" className="ghost danger" onClick={() => remove(focused.id)}>
                  Delete
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {open && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button type="button" className="lightbox-close" onClick={() => setOpen(null)} aria-label="Close">
            Close
          </button>
          <img
            src={mediaUrl(open.url)}
            alt={open.note || "Us"}
            onClick={(e) => e.stopPropagation()}
          />
          {open.note ? <p className="lightbox-note">{open.note}</p> : null}
        </div>
      )}
    </div>
  );
}
