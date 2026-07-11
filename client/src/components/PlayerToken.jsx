import { ICONS } from "../data/icons";

export default function PlayerToken({ player, stackIndex, stackTotal, leftPct, topPct, glideMs, glideEase, isMoving, isLanding, justBought, isActiveTurn, isBusRiding }) {
  const wrapStyle = {
    "--c": player.color,
    "--i": stackIndex,
    "--n": stackTotal,
    "--glide-ms": `${glideMs || 220}ms`,
    "--glide-ease": glideEase || "ease",
    // Grows the whole token (not just the icon inside it) while riding the
    // bus -- reads as a bigger visual event than swapping the face alone,
    // and scaling the outer .cv2-token wrapper (rather than the inner face)
    // means the bus glyph inside grows proportionally with it for free.
    "--bus-scale": isBusRiding ? 1.4 : 1,
    left: `${leftPct}%`,
    top: `${topPct}%`,
  };
  const innerCls = [
    "cv2-token-inner",
    isActiveTurn && "cv2-token--active",
    isMoving && "cv2-token--floating",
    !isMoving && isLanding && "cv2-token--landing",
    justBought && "cv2-token--celebrate",
  ].filter(Boolean).join(" ");
  const innerStyle = { "--delay": `${(stackIndex * 0.3).toFixed(2)}s` };

  const icon = player.icon ? ICONS.find((i) => i.id === player.icon) : null;

  return (
    <span className="cv2-token" style={wrapStyle} title={player.name}>
      <span className={innerCls} style={innerStyle}>
        {isBusRiding ? (
          // Wrecking Tour: swap out whatever the rider's own icon/face is
          // for the same bus glyph the station tiles use, for the duration
          // of the glide -- reverts on its own once the ride ends (see
          // BoardClassic's busRidingId).
          <span
            className="cv2-token-face cv2-token-face--icon cv2-token-face--bus"
            style={{ backgroundImage: "url(/bus.svg)" }}
          />
        ) : icon ? (
          <span
            className="cv2-token-face cv2-token-face--icon"
            style={{ backgroundImage: `url(${icon.img})` }}
          />
        ) : (
          <span className="cv2-token-face">
            <span className="cv2-token-eye cv2-token-eye--l" />
            <span className="cv2-token-eye cv2-token-eye--r" />
            <span className="cv2-token-mouth" />
          </span>
        )}
      </span>
    </span>
  );
}
