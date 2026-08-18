import { Link } from "react-router-dom";
import { MdEmail, MdLock, MdArrowForward } from "react-icons/md";
import Logo from "../Logo.jsx";

export function Auth2({
  heading = "Welcome back",
  subheading = "Sign in to find each other on the globe.",
  submitLabel = "Sign in",
  switchText = "New here?",
  switchHref = "/signup",
  switchLinkLabel = "Create an account",
  passwordHint,
  busy = false,
  error = "",
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  return (
    <div className="auth2-page">
      <main className="auth2-main">
        <div className="auth2-well">
          <div className="auth2-card">
            <Logo className="logo-auth2" />
            <div className="auth2-header">
              <h1>{heading}</h1>
              <p>{subheading}</p>
            </div>

            <form
              className="auth2-form"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit?.(e);
              }}
            >
              <div className="auth2-field">
                <label htmlFor="auth2-email">Email</label>
                <div className="auth2-input-wrap">
                  <MdEmail className="auth2-icon" aria-hidden="true" />
                  <input
                    id="auth2-email"
                    type="email"
                    placeholder="you@email.com"
                    autoComplete="email"
                    value={email}
                    onChange={onEmailChange}
                    required
                  />
                </div>
              </div>

              <div className="auth2-field">
                <label htmlFor="auth2-password">Password</label>
                <div className="auth2-input-wrap">
                  <MdLock className="auth2-icon" aria-hidden="true" />
                  <input
                    id="auth2-password"
                    type="password"
                    placeholder="Min. 8 characters"
                    autoComplete={passwordHint ? "new-password" : "current-password"}
                    value={password}
                    onChange={onPasswordChange}
                    required
                    minLength={passwordHint ? 8 : undefined}
                  />
                </div>
                {passwordHint ? <p className="auth2-hint">{passwordHint}</p> : null}
              </div>

              {error ? <p className="error">{error}</p> : null}

              <button type="submit" className="auth2-submit" disabled={busy}>
                {busy ? "Please wait…" : submitLabel}
                <MdArrowForward aria-hidden="true" />
              </button>
            </form>

            <p className="auth2-switch">
              {switchText} <Link to={switchHref}>{switchLinkLabel}</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
