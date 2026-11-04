"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAtmosphere } from "../lib/use-atmosphere";
import { useAudioSession } from "./audio-input-provider";
interface SetupInfo {
  origin: string;
  fingerprint: string;
  expires: string;
  certificateUrl: string;
  name: string;
}
export default function IpadSetup() {
  const model = useAtmosphere(),
    audio = useAudioSession();
  const [info, setInfo] = useState<SetupInfo | null>(null),
    [error, setError] = useState(""),
    [secure, setSecure] = useState(false),
    [code, setCode] = useState(""),
    [pairing, setPairing] = useState(false),
    [level, setLevel] = useState(0),
    [supported, setSupported] = useState(false);
  useEffect(() => {
    setSecure(window.isSecureContext);
    setSupported(!!navigator.mediaDevices?.getUserMedia);
    let alive = true;
    void fetch("/api/ipad/setup", { cache: "no-store" })
      .then(async (result) => {
        const data = await result.json();
        if (!result.ok) throw new Error(data.error);
        if (alive) setInfo(data);
      })
      .catch((reason) => {
        if (alive)
          setError(
            reason instanceof Error
              ? reason.message
              : "Setup details unavailable.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (audio.state.phase !== "microphone") {
      setLevel(0);
      return;
    }
    const timer = setInterval(() => {
      const samples = audio.session.analyzer?.getTimeDomainData();
      let power = 0;
      if (samples)
        for (const sample of samples) power += ((sample - 128) / 128) ** 2;
      setLevel(
        samples?.length
          ? Math.min(1, Math.sqrt(power / samples.length) * 5)
          : 0,
      );
    }, 200);
    return () => clearInterval(timer);
  }, [audio.session, audio.state.phase]);
  const paired = model.room.enabled && model.room.paired;
  return (
    <main className="ipad-setup workspace">
      <p className="eyebrow">ATMOSPHERE / IPAD TEST</p>
      <h1>
        Your room.
        <br />
        <span className="serif accent">On iPad.</span>
      </h1>
      <p className="ipad-intro">
        This iPad is the screen and microphone. Your computer hosts Atmosphere;
        Spotify Connect keeps playing through the WiiM.
      </p>
      <p className="helper">
        Use Safari on iPadOS 16.4 or newer. Keep Safari in the foreground. The
        iPad uses lighter graphics automatically.
      </p>
      {!secure && (
        <section className="ipad-step">
          <h2>1. Set up trusted HTTPS</h2>
          <p>
            Safari requires a trusted secure connection before a website can use
            the microphone. This test uses a dedicated local certificate
            authority.
          </p>
          <p>
            Installing this profile adds that authority to this iPad’s trust
            settings. Its private key stays on your computer. You can remove the
            profile after the test.
          </p>
          {info && (
            <>
              <a className="ipad-action" href={info.certificateUrl}>
                Download iPad test certificate
              </a>
              <ol>
                <li>
                  Open iPad Settings → General → VPN & Device Management, select{" "}
                  <strong>Atmosphere iPad HTTPS Test</strong>, and install it if
                  you choose to trust this local test certificate.
                </li>
                <li>
                  Go to Settings → General → About → Certificate Trust Settings.
                  Enable full trust for <strong>{info.name}</strong>.
                </li>
                <li>Return here and open the secure display setup below.</li>
              </ol>
              <details>
                <summary>Certificate details</summary>
                <p>SHA-256 fingerprint</p>
                <code className="certificate-fingerprint">
                  {info.fingerprint}
                </code>
                <p>Certificate authority expires: {info.expires}</p>
              </details>
              <a className="ipad-action" href={`${info.origin}/ipad`}>
                Open secure iPad setup ↗
              </a>
            </>
          )}
          <p className="helper">
            If Safari shows a certificate warning, finish the trust steps in
            Settings before continuing.{" "}
            <a href="https://support.apple.com/en-us/102390">
              Apple’s certificate instructions ↗
            </a>
          </p>
        </section>
      )}
      {secure && (
        <>
          <section className="ipad-step">
            <h2>1. Pair with your room</h2>
            {paired ? (
              <p className="ipad-success" role="status">
                Connected to your room.
              </p>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setPairing(true);
                  setError("");
                  try {
                    await model.room.pair(code);
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Pairing failed.",
                    );
                  } finally {
                    setPairing(false);
                  }
                }}
              >
                <p>
                  Enter the code shown under Phone controls in Settings on the
                  host computer.
                </p>
                <label className="field">
                  Pairing code
                  <input
                    aria-label="Pairing code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </label>
                <button className="ipad-action" disabled={pairing}>
                  {pairing ? "Pairing…" : "Pair iPad"}
                </button>
              </form>
            )}
          </section>
          <section className="ipad-step">
            <h2>2. Start the iPad microphone</h2>
            <p>
              Tap below and allow Safari’s microphone prompt. Sound is analyzed
              on this iPad. It is not recorded, uploaded or played back.
            </p>
            {!supported && (
              <p className="audio-error">
                Microphone capture is unavailable. Check Safari permissions and
                the trusted HTTPS connection.
              </p>
            )}
            {audio.state.phase === "microphone" ? (
              <>
                <p className="ipad-success" role="status">
                  Microphone connected
                  {level > 0.03 ? " · sound detected" : " · listening"}
                </p>
                <meter
                  aria-label="Microphone input level"
                  min={0}
                  max={1}
                  value={level}
                />
                <button className="ipad-action" onClick={audio.session.stop}>
                  Stop microphone
                </button>
              </>
            ) : (
              <button
                className="ipad-action"
                disabled={
                  !paired || !supported || audio.state.phase === "loading"
                }
                onClick={() => {
                  model.updateSettings({
                    soundLayer: { ...model.settings.soundLayer, enabled: true },
                  });
                  void audio.session.startMicrophone();
                }}
              >
                {audio.state.phase === "loading"
                  ? "Connecting microphone…"
                  : "Start iPad microphone"}
              </button>
            )}
            {audio.state.error && (
              <p className="audio-error" role="alert">
                {audio.state.error}
              </p>
            )}
          </section>
          <section className="ipad-step">
            <h2>3. Enter your display</h2>
            <p>
              The microphone stays connected when you use this link. Reloading
              or reopening the app requires another tap to start it.
            </p>
            <Link className="ipad-action" href="/display">
              Enter display ↗
            </Link>
            <p className="helper">
              For a cleaner screen, Safari → Share → Add to Home Screen. Keep
              the iPad awake during the test. If it locks or Safari is
              suspended, return here to reconnect the microphone.
            </p>
          </section>
        </>
      )}
      {(error || model.room.error) && (
        <p className="audio-error" role="alert">
          {error || model.room.error}
        </p>
      )}
      <p className="helper">
        <Link href="/lab">Visual lab</Link> ·{" "}
        <Link href="/remote">Room controller</Link> · To remove the test
        certificate later: Settings → General → VPN & Device Management →
        Atmosphere iPad HTTPS Test → Remove Profile.
      </p>
    </main>
  );
}
