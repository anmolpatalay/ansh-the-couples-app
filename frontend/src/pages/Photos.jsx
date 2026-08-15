import { useEffect, useState } from "react";
import { api, apiJson, mediaUrl } from "../api.js";

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

      <div className="photo-grid">
        {photos.map((p) => (
          <figure key={p.id} className="photo-card">
            <button type="button" className="photo-thumb" onClick={() => setOpen(p)}>
              <img src={mediaUrl(p.thumb_url || p.url)} alt={p.note || "Us"} />
            </button>
            {p.note ? <figcaption>{p.note}</figcaption> : null}
            <button type="button" className="ghost danger" onClick={() => remove(p.id)}>
              Delete
            </button>
          </figure>
        ))}
      </div>

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
