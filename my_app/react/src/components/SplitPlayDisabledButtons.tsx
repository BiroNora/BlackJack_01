function SplitPlayDisabledButtons() {
  return (
    <div id="play-buttons" className="button-container">
      <button id="hit-button" disabled={true}>
        Hit
      </button>
      <button id="stand-button" disabled={true}>
        Stand
      </button>
    </div>
  );
}

export default SplitPlayDisabledButtons;
