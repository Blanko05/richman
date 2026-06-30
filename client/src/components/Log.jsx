export default function Log({ entries }) {
  return (
    <div className="hud-section log">
      <h3>Log</h3>
      <ul>
        {entries.map((entry, i) => (
          <li key={i}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}
