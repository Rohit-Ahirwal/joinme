import {
  ArrowRight,
  Camera,
  Link2,
  LockKeyhole,
  Mic,
  Shield,
  Sparkles
} from "lucide-react";
import { createRoomPath } from "../lib/room";
import { hasRealtimeConfig } from "../lib/firebase";

interface LandingPageProps {
  onNavigateToRoom: (roomUrl: string) => void;
}

const steps = [
  {
    icon: Link2,
    title: "Create a private link",
    body: "Tap one button and get a room link you can send to anyone."
  },
  {
    icon: Camera,
    title: "Check your camera and mic",
    body: "You see yourself first, so you know everything works before joining."
  },
  {
    icon: Sparkles,
    title: "Talk instantly",
    body: "The app keeps the experience simple so anyone can understand it quickly."
  }
];

const promises = [
  {
    icon: Shield,
    title: "No account needed",
    body: "Nobody needs to sign up or remember a password."
  },
  {
    icon: LockKeyhole,
    title: "Private by default",
    body: "The call uses encrypted browser-to-browser media whenever possible."
  },
  {
    icon: Mic,
    title: "Made for normal people",
    body: "Big buttons, simple words, and a room screen that explains itself."
  }
];

export function LandingPage({ onNavigateToRoom }: LandingPageProps) {
  const createRoom = () => {
    onNavigateToRoom(createRoomPath().replace(/^#/, ""));
  };

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Private audio + video calls</p>
          <h1>Start a call with one link. No account. No confusion.</h1>
          <p className="lede">
            JoinMe is built for people who just want to click a link and talk. Create a room,
            share it, and start your call without technical setup.
          </p>

          <div className="hero-actions">
            <button className="primary-button hero-button" onClick={createRoom}>
              <Camera size={20} />
              Start a private room
            </button>
            <p className="helper-copy">Works best in Chrome, Edge, and Safari on recent devices.</p>
          </div>

          {!hasRealtimeConfig ? (
            <div className="warning-card">
              <strong>Add your Firebase config before deploying.</strong>
              <span>
                This version is prepared for free Vercel hosting and uses Firebase Realtime
                Database for signaling.
              </span>
            </div>
          ) : null}
        </div>

        <div className="step-grid">
          {steps.map(({ icon: Icon, title, body }) => (
            <article key={title} className="step-card">
              <div className="step-icon">
                <Icon size={20} />
              </div>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="promise-grid">
        {promises.map(({ icon: Icon, title, body }) => (
          <article key={title} className="promise-card">
            <Icon size={18} />
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="simple-flow">
        <div>
          <p className="eyebrow">Easy flow</p>
          <h2>Anyone can use it in three small steps.</h2>
        </div>
        <ol>
          <li>Press “Start a private room”.</li>
          <li>Send the link to the other person.</li>
          <li>Press “Join call” when your camera preview looks right.</li>
        </ol>
        <button className="secondary-button inline-button" onClick={createRoom}>
          Create a room now
          <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}
