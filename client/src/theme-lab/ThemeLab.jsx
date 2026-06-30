import { useState } from "react";
import { THEMES } from "./themeRegistry";
import { mockBoard, mockOwnership, mockPlayers, mockPendingAction, mockLastRoll, mockRollSeq } from "./mockData";
import "./ThemeLab.css";

export default function ThemeLab() {
  const [activeId, setActiveId] = useState(THEMES[0].id);
  const active = THEMES.find((t) => t.id === activeId) ?? THEMES[0];
  const ActiveBoard = active.Component;

  return (
    <div className="theme-lab">
      <div className="theme-lab-tabs">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-lab-tab ${t.id === activeId ? "theme-lab-tab-active" : ""}`}
            onClick={() => setActiveId(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="theme-lab-stage">
        <ActiveBoard
          board={mockBoard}
          ownership={mockOwnership}
          players={mockPlayers}
          pendingAction={mockPendingAction}
          lastRoll={mockLastRoll}
          rollSeq={mockRollSeq}
        />
      </div>
    </div>
  );
}
