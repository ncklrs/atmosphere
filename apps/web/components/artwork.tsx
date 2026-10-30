import { palettes } from "../../../packages/design-system/index";
import Image from "next/image";
import { useState } from "react";
import { safeArtworkUrl } from "../../../packages/playback-core/artwork";
export default function Artwork({
  variant = 0,
  small = false,
  url = null,
}: {
  variant?: number;
  small?: boolean;
  url?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const safeUrl = safeArtworkUrl(url);
  const p = palettes[variant % palettes.length];
  return (
    <div
      className={`artwork ${small ? "small" : ""}`}
      role="img"
      aria-label="Original abstract artwork: a luminous folded ribbon in a dark field"
      style={
        {
          "--art-light": p[0],
          "--art-mid": p[1],
          "--art-dark": p[2],
        } as React.CSSProperties
      }
    >
      <div className="art-halo" />
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <div className="art-orbit orbit-three" />
      <div className="art-core" />
      <div className="art-grain" />
      {safeUrl && failedUrl !== safeUrl && (
        <Image
          src={safeUrl}
          alt="Current album artwork"
          fill
          sizes={small ? "52px" : "(max-width:700px) 70vw, 45vw"}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(safeUrl)}
          style={{ objectFit: "cover", zIndex: 2 }}
        />
      )}
      {!small && (
        <div className="art-edition">
          <span>ATMOSPHERE / VOL. {String(variant + 1).padStart(2, "0")}</span>
          <span>STUDIES IN ATMOSPHERE</span>
        </div>
      )}
    </div>
  );
}
