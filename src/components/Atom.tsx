export type AtomSize = "small" | "medium" | "large";

interface AtomProps {
  color?: string;
  size?: AtomSize;
  text?: string;
  textColor?: string;
}

const SIZE_PX: Record<AtomSize, number> = {
  small:  44,
  medium: 64,
  large:  88,
};

const TEXT_SIZE: Record<AtomSize, string> = {
  small:  "10px",
  medium: "12px",
  large:  "14px",
};

const RINGS: { baseRotation: number; duration: number; reverse: boolean }[] = [
  { baseRotation: 0,   duration: 1.4, reverse: false },
  { baseRotation: 60,  duration: 1.9, reverse: true  },
  { baseRotation: 120, duration: 2.4, reverse: false },
];

export function Atom({
  color = "#2cd136",
  size  = "medium",
  text  = "",
  textColor = "",
}: AtomProps) {
  const px   = SIZE_PX[size] ?? SIZE_PX.medium;
  const bw   = Math.max(1, Math.round(px * 0.038));
  const nucR = Math.round(px * 0.18);
  const glow = Math.round(px * 0.14);
  const activeColor = color || "#2cd136";
  const labelColor  = textColor || activeColor;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div
        style={{ width: px, height: px, position: "relative" }}
        className="flex items-center justify-center"
      >
        {/* Nucleus */}
        <div
          style={{
            position:     "absolute",
            width:        nucR,
            height:       nucR,
            borderRadius: "50%",
            background:   activeColor,
            boxShadow:    `0 0 ${glow}px ${activeColor}`,
            animation:    "ds-nucleus-pulse 1.2s ease-in-out infinite",
            zIndex:       2,
          }}
        />

        {/* Three orbit rings */}
        {RINGS.map((ring, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width:    "100%",
              height:   "100%",
              display:  "flex",
              alignItems:     "center",
              justifyContent: "center",
              transform: `rotateZ(${ring.baseRotation}deg)`,
            }}
          >
            <div
              style={{
                width:        px,
                height:       Math.round(px * 0.36),
                border:       `${bw}px solid ${activeColor}`,
                borderRadius: "50%",
                opacity:      0.85,
                animation:    `ds-ring-spin ${ring.duration}s linear infinite${ring.reverse ? " reverse" : ""}`,
              }}
            />
          </div>
        ))}
      </div>

      {text && (
        <p
          style={{
            color:      labelColor,
            fontSize:   TEXT_SIZE[size],
            fontWeight: 500,
            letterSpacing: "0.01em",
            textAlign:  "center",
            maxWidth:   "220px",
            lineHeight: "1.4",
          }}
        >
          {text}
        </p>
      )}
    </div>
  );
}
