import "../styles/loading.css"; // Fontos, hogy importáld a stílusokat

export function Loading() {
  return (
    <div className="loading-container-centered">
      <h1>
        LOADING<span className="dot dot-1">.</span>
        <span className="dot dot-2">.</span>
        <span className="dot dot-3">.</span>
      </h1>
    </div>
  );
}
