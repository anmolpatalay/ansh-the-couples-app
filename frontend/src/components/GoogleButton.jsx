import { useEffect, useRef } from "react";
import { apiJson } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

function waitForGoogle() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        resolve();
      }
    }, 40);
  });
}

export default function GoogleButton({ onError }) {
  const { loginWithGoogle } = useAuth();
  const slot = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await apiJson("/api/auth/config");
        if (!cfg.google_client_id || cancelled) return;
        await waitForGoogle();
        if (cancelled || !slot.current) return;
        window.google.accounts.id.initialize({
          client_id: cfg.google_client_id,
          callback: async (response) => {
            try {
              await loginWithGoogle(response.credential);
            } catch (err) {
              onError?.(err.message);
            }
          },
        });
        slot.current.innerHTML = "";
        window.google.accounts.id.renderButton(slot.current, {
          theme: "filled_black",
          size: "large",
          width: 320,
          text: "continue_with",
          shape: "pill",
        });
      } catch {
        /* Google not configured */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, onError]);

  return <div className="google-btn" ref={slot} />;
}
