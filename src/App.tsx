import { lazy, Suspense, useEffect, useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  Heart,
  LogOut,
  RefreshCw,
} from "lucide-react";
import Auth from "./Auth";
const Academic = lazy(() => import("./Academic"));
const Journey = lazy(() => import("./Journey"));
import { Brand, Clock, Daily } from "./ui";
import { getProfile, supabase } from "./service";
import { useStudy } from "./useStudy";
import { NAMES, viewMismatch, type Profile, type Role } from "./domain";
const params = new URLSearchParams(location.search);
const demo = params.get("demo") === "1";
function currentPage() {
  const p = location.hash.replace("#/", "").split("?")[0];
  return ["daily", "academic", "journey"].includes(p) ? p : "daily";
}
export default function App() {
  const [profile, setProfile] = useState<Profile | null>(
    demo ? { id: "melan", role: "melan", display_name: "Melan" } : null,
  );
  const [loading, setLoading] = useState(!demo);
  const [authError, setAuthError] = useState("");
  const [page, setPage] = useState(currentPage);
  const study = useStudy(profile, demo);
  const latestReward = study.data?.rewards
    .slice()
    .sort((a, b) => b.unlocked_at.localeCompare(a.unlocked_at))[0];
  const [hint, setHint] = useState(params.get("view"));
  useEffect(() => {
    const onHash = () => {
      setPage(currentPage());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (demo || !supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const p = await getProfile();
        if (alive) {
          setProfile(p);
          setAuthError("");
        }
      } catch (e) {
        if (alive)
          setAuthError(
            e instanceof Error ? e.message : "Could not verify account",
          );
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void load(), 0);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  const signOut = async () => {
    if (demo) {
      location.href = import.meta.env.BASE_URL;
      return;
    }
    const r = await supabase!.auth.signOut();
    if (r.error) {
      setAuthError(r.error.message);
      return;
    }
    setProfile(null);
  };
  if (loading)
    return (
      <main className="loading-screen">
        <Brand />
        <p role="status">Opening your study space…</p>
      </main>
    );
  if (authError)
    return (
      <main className="loading-screen">
        <Brand />
        <h1>Let’s check your access.</h1>
        <p role="alert" className="error">
          {authError}
        </p>
        <button className="secondary-button" onClick={() => void signOut()}>
          Sign out and try again
        </button>
      </main>
    );
  if (!profile) return <Auth />;
  if (!demo && viewMismatch(hint, profile.role))
    return (
      <main className="loading-screen">
        <Brand />
        <h1>This bookmark is for another role.</h1>
        <p>
          You’re verified as {NAMES[profile.role]}. The link cannot change your
          permissions.
        </p>
        <button
          className="primary-button"
          onClick={() => {
            const url = new URL(location.href);
            url.searchParams.set("view", profile.role);
            history.replaceState(null, "", url);
            setHint(profile.role);
          }}
        >
          Continue to {NAMES[profile.role]}’s view
        </button>
        <button className="text-button" onClick={() => void signOut()}>
          Sign in with another account
        </button>
      </main>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {demo && (
        <div className="demo-banner">
          <span>
            DEMO PREVIEW · Sample data. Nothing saves to a live account.
          </span>
          <label>
            Preview as{" "}
            <select
              aria-label="Demo role"
              value={profile.role}
              onChange={(e) => {
                const role = e.target.value as Role;
                setProfile({ id: role, role, display_name: NAMES[role] });
              }}
            >
              <option value="melan">Melan</option>
              <option value="shashi">Shashi</option>
              <option value="host">Host</option>
            </select>
          </label>
          <a href={import.meta.env.BASE_URL}>Leave demo</a>
        </div>
      )}
      <header className="site-header">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {[
            ["daily", "Daily Focus", BookOpen],
            ["academic", "Academic Growth", ChartNoAxesCombined],
            ["journey", "Our Journey", Heart],
          ].map(([id, label, Icon]) => (
            <a
              key={id as string}
              href={"#/" + id}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={17} />
              {label as string}
            </a>
          ))}
        </nav>
        <div className="account">
          <span className={"avatar small " + profile.role}>
            {profile.display_name[0]}
          </span>
          <span className="tiny">{profile.display_name}</span>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={() => void signOut()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <div className="time-row">
        <Clock />
        <span className="connection-status" role="status">
          {study.status}
        </span>
      </div>
      <main id="main-content" className="main-content">
        {page !== "journey" &&
          latestReward &&
          latestReward.id !== sessionStorage.getItem("reward-seen") && (
            <a className="notice reward-notification" href="#/journey">
              A movie date is waiting! Open Our Journey to celebrate your
              achievement. →
            </a>
          )}
        {study.error && (
          <div className="error error-banner" role="alert">
            <span>{study.error}</span>
            <button
              className="secondary-button"
              onClick={() => void study.refresh()}
            >
              <RefreshCw size={16} /> Retry refresh
            </button>
          </div>
        )}
        <Suspense
          fallback={
            <div className="card skeleton" role="status">
              Opening your page…
            </div>
          }
        >
          {study.data ? (
            page === "daily" ? (
              <Daily
                data={study.data}
                profile={profile}
                busy={study.busy}
                onToggle={study.toggle}
              />
            ) : page === "academic" ? (
              <Academic
                data={study.data}
                profile={profile}
                mutate={study.mutate}
                refresh={study.refresh}
                demo={demo}
              />
            ) : (
              <Journey
                data={study.data}
                profile={profile}
                mutate={study.mutate}
              />
            )
          ) : (
            <div className="card skeleton" role="status">
              Bringing your space together…
            </div>
          )}
        </Suspense>
      </main>
      <footer className="site-footer">
        <span>Made for a shared dream.</span>
        <span>
          Melan <Heart size={11} /> Shashi
        </span>
        <span>OUR STUDY SPACE</span>
      </footer>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <a href="#/daily" aria-current={page === "daily" ? "page" : undefined}>
          <BookOpen size={20} />
          Daily Focus
        </a>
        <a
          href="#/academic"
          aria-current={page === "academic" ? "page" : undefined}
        >
          <ChartNoAxesCombined size={20} />
          Academic Growth
        </a>
        <a
          href="#/journey"
          aria-current={page === "journey" ? "page" : undefined}
        >
          <Heart size={20} />
          Our Journey
        </a>
      </nav>
    </div>
  );
}
