import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

function makeRedHeartTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.translate(64, 56);
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.bezierCurveTo(-32, 2, -30, -26, 0, -12);
  ctx.bezierCurveTo(30, -26, 32, 2, 0, 22);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, -24, 8, 24);
  fill.addColorStop(0, "#ff7a88");
  fill.addColorStop(0.45, "#e23d4a");
  fill.addColorStop(1, "#c41e3a");
  ctx.fillStyle = fill;
  ctx.shadowColor = "rgba(196, 30, 58, 0.7)";
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-9, -8, 6, 3.5, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

const ARC_QUOTE = "Two cities. One sky. Still us.";
const EARTH = "https://unpkg.com/three-globe/example/img/earth-night.jpg";

function greatCircleArc(start, end, samples = 96) {
  const a = start.clone().normalize();
  const b = end.clone().normalize();
  let omega = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  if (omega < 0.001) omega = 0.001;
  const sinOmega = Math.sin(omega);
  const pts = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const p = a
      .clone()
      .multiplyScalar(Math.sin((1 - t) * omega) / sinOmega)
      .add(b.clone().multiplyScalar(Math.sin(t * omega) / sinOmega))
      .normalize();
    const radius = 1.018 + 0.22 * Math.sin(Math.PI * t);
    pts.push(p.multiplyScalar(radius));
  }
  return pts;
}

function latLngToVector(lat, lng, radius = 1.02) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export default function GlobeCanvas({ pins, width, height }) {
  const wrapRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 3.1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    wrap.appendChild(renderer.domElement);

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load(EARTH),
        shininess: 8,
      })
    );
    scene.add(earth);
    scene.add(new THREE.AmbientLight(0x8899bb, 1.1));
    const sun = new THREE.DirectionalLight(0xffe6c8, 1.4);
    sun.position.set(5, 2, 3);
    scene.add(sun);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xf4c38a,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
      })
    );
    scene.add(glow);

    let heart = null;
    let lineMat = null;
    if (pins?.length >= 2) {
      const start = latLngToVector(pins[0].lat, pins[0].lng, 1);
      const end = latLngToVector(pins[1].lat, pins[1].lng, 1);
      const arcPts = greatCircleArc(start, end);
      const positions = [];
      arcPts.forEach((p) => positions.push(p.x, p.y, p.z));

      const geom = new LineGeometry();
      geom.setPositions(positions);
      lineMat = new LineMaterial({
        color: 0xf0c56e,
        linewidth: 2.2,
        transparent: true,
        opacity: 0.95,
        worldUnits: false,
        depthTest: true,
      });
      lineMat.resolution.set(width, height);
      const arc = new Line2(geom, lineMat);
      arc.computeLineDistances();
      earth.add(arc);

      const canvasTex = makeRedHeartTexture();
      heart = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: canvasTex,
          transparent: true,
          depthTest: false,
        })
      );
      heart.position.copy(arcPts[Math.floor(arcPts.length / 2)]);
      heart.scale.set(0.09, 0.09, 0.09);
      earth.add(heart);
    }

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const rot = { x: 0.2, y: 0 };

    const onDown = (e) => {
      dragging = true;
      lastX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      lastY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    };
    const onUp = () => {
      dragging = false;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX;
      const y = e.clientY ?? e.touches?.[0]?.clientY;
      if (x == null) return;
      rot.y += (x - lastX) * 0.005;
      rot.x += (y - lastY) * 0.005;
      rot.x = Math.max(-1.1, Math.min(1.1, rot.x));
      lastX = x;
      lastY = y;
    };
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(1.8, Math.min(5, camera.position.z + e.deltaY * 0.002));
    };

    wrap.addEventListener("mousedown", onDown);
    wrap.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    wrap.addEventListener("wheel", onWheel, { passive: false });

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!dragging) rot.y += 0.0015;
      earth.rotation.y = rot.y;
      earth.rotation.x = rot.x;
      glow.rotation.copy(earth.rotation);
      if (heart) {
        const pulse = 0.085 + Math.sin(performance.now() / 320) * 0.012;
        heart.scale.set(pulse, pulse, pulse);
      }
      renderer.render(scene, camera);

      const overlay = overlayRef.current;
      if (!overlay) return;
      overlay.replaceChildren();
      (pins || []).forEach((pin) => {
        const v = latLngToVector(pin.lat, pin.lng, 1.02);
        v.applyEuler(earth.rotation);
        const facing = v.clone().normalize().dot(camera.position.clone().normalize()) > 0.12;
        if (!facing) return;
        const projected = v.clone().project(camera);
        const el = document.createElement("div");
        el.className = "globe-pin";
        el.style.position = "absolute";
        el.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
        el.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
        const photo = document.createElement("div");
        photo.className = "pin-photo";
        if (pin.picture_url) {
          const img = document.createElement("img");
          img.src = pin.picture_url;
          img.alt = pin.name || "";
          photo.appendChild(img);
        } else {
          const s = document.createElement("span");
          s.textContent = (pin.name || "?").slice(0, 1);
          photo.appendChild(s);
        }
        const label = document.createElement("div");
        label.className = "pin-label";
        label.innerHTML = "";
        const strong = document.createElement("strong");
        strong.textContent = pin.name || "";
        const em = document.createElement("em");
        em.textContent = `${pin.city || ""}, ${pin.country || ""}`;
        const time = document.createElement("span");
        time.textContent = pin.local_time || "";
        label.append(strong, em, time);
        el.append(photo, label);
        overlay.appendChild(el);
      });
      if (heart) {
        const mid = heart.position.clone().applyEuler(earth.rotation);
        const facing = mid.clone().normalize().dot(camera.position.clone().normalize()) > 0.05;
        if (facing) {
          const projected = mid.clone().project(camera);
          const quote = document.createElement("div");
          quote.className = "arc-quote";
          quote.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
          quote.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
          quote.textContent = ARC_QUOTE;
          overlay.appendChild(quote);
        }
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      wrap.removeEventListener("mousedown", onDown);
      wrap.removeEventListener("touchstart", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      wrap.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (renderer.domElement.parentNode === wrap) wrap.removeChild(renderer.domElement);
    };
  }, [pins, width, height]);

  return (
    <div ref={wrapRef} className="globe-canvas">
      <div ref={overlayRef} className="globe-overlay" />
    </div>
  );
}
