"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioSession } from "./audio-input-provider";
interface InputDevice {
  id: string;
  label: string;
}
export default function WiredInput() {
  const { session, state } = useAudioSession();
  const [devices, setDevices] = useState<InputDevice[]>([]),
    [selected, setSelected] = useState(
      () => session.getSnapshot().inputDeviceId,
    );
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(false),
    revision = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++revision.current;
    setLoading(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.enumerateDevices)
        throw new Error(
          "Input selection needs localhost or HTTPS and a browser with audio capture.",
        );
      const discovered = await navigator.mediaDevices.enumerateDevices();
      if (!alive.current || ticket !== revision.current) return;
      const inputs = discovered
        .filter(
          (device) =>
            device.kind === "audioinput" &&
            device.deviceId &&
            !["default", "communications"].includes(device.deviceId),
        )
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Audio input ${index + 1} (name hidden)`,
        }));
      setDevices(inputs);
      setSelected((previous) =>
        inputs.some((device) => device.id === previous) ? previous : "",
      );
      const current = session.getSnapshot();
      if (
        current.phase === "line-in" &&
        !inputs.some((device) => device.id === current.inputDeviceId)
      )
        session.stop();
    } catch (reason) {
      if (alive.current && ticket === revision.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not list audio inputs.",
        );
    } finally {
      if (alive.current && ticket === revision.current) setLoading(false);
    }
  }, [session]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const devices = navigator.mediaDevices;
    const changed = () => {
      void refresh();
    };
    devices?.addEventListener("devicechange", changed);
    return () => {
      alive.current = false;
      devices?.removeEventListener("devicechange", changed);
    };
  }, [refresh]);
  return (
    <fieldset className="wired-input">
      <legend>Audio input device</legend>
      <p className="helper">
        Choose a specific virtual audio device or line input already connected
        to this computer.
      </p>
      <label className="field">
        Audio input
        <select
          aria-label="Wired audio input"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Choose a specific input</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label}
            </option>
          ))}
        </select>
      </label>
      <div className="audio-source-actions">
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Finding inputs…" : "Refresh inputs"}
        </button>
        <button
          type="button"
          disabled={!selected || state.phase === "loading" || loading}
          onClick={() => {
            const device = devices.find((device) => device.id === selected);
            if (device) void session.startLineIn(device.id, device.label);
          }}
        >
          Connect wired input
        </button>
      </div>
      {error ? (
        <p className="audio-device-error" role="status">
          {error}
        </p>
      ) : (
        <p className="helper">
          {devices.length
            ? "Select the USB line input, not a built-in microphone."
            : "No specific inputs are visible yet. Connect the interface, then refresh."}{" "}
          Names hidden? Allow audio-input access for this site in browser
          settings and refresh. Listing inputs never starts capture. Browser
          permission may be called “microphone” even for a cable input.
        </p>
      )}
    </fieldset>
  );
}
