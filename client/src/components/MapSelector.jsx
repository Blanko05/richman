const MAPS = [
  { id: "default", name: "Fortune City" },
  { id: "jordan", name: "Jordan" },
  { id: "american", name: "American Dream" },
  { id: "corporate", name: "Corporate Ladder" },
];

const GAME_MODES = [{ id: "land67", name: "بلد الستات والسبعات" }];

const selectStyle = {
  font: "inherit",
  padding: "8px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border)",
  background: "var(--panel)",
  color: "var(--text)",
  width: "100%",
};

export default function MapSelector({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
      <optgroup label="Maps">
        {MAPS.map((map) => (
          <option key={map.id} value={map.id}>
            {map.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Game Modes: وضع ٦/٧">
        {GAME_MODES.map((mode) => (
          <option key={mode.id} value={mode.id}>
            {mode.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
