import React, { useEffect, useRef, useState } from "react";

const btnStyle = (bg, color, border) => ({
  background: bg,
  color,
  border,
  cursor: "pointer",
  padding: "2px 8px",
  borderRadius: 3,
  fontSize: 12,
});

const useCountdown = (timeoutSec, onDone) => {
  const [seconds, setSeconds] = useState(timeoutSec);
  const pausedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!pausedRef.current) {
        setSeconds((s) => {
          if (s <= 1) {
            clearInterval(interval);
            onDone();
            return 0;
          }
          return s - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return { seconds, pausedRef };
};

export const TimedMessage = ({ message, timeoutSec, onDismiss }) => {
  const { seconds, pausedRef } = useCountdown(timeoutSec, onDismiss);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <span>{message}</span>
      <div>
        <button
          onClick={onDismiss}
          style={btnStyle("transparent", "#fff", "1px solid rgba(255,255,255,0.5)")}
        >
          Close ({seconds})
        </button>
      </div>
    </div>
  );
};

export const ConfirmToast = ({
  title,
  message,
  timeoutSec,
  goodLabel,
  badLabel,
  onGood,
  onBad,
  onDismiss,
}) => {
  const { seconds, pausedRef } = useCountdown(timeoutSec, onDismiss);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <strong>{title}</strong>
      <span>{message}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onGood} style={btnStyle("#fff", "#2d6a00", "2px solid #2d6a00")}>
          {goodLabel}
        </button>
        <button onClick={onBad} style={btnStyle("#fff", "#c75000", "2px solid #c75000")}>
          {badLabel}
        </button>
        <button onClick={onDismiss} style={btnStyle("transparent", "#fff", "1px solid rgba(255,255,255,0.5)")}>
          Close ({seconds})
        </button>
      </div>
    </div>
  );
};
