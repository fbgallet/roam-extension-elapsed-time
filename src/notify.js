import { Intent, Position, Toaster } from "@blueprintjs/core";
import { ConfirmToast, TimedMessage } from "./components/NotifyToast";

const TIMEOUT_SEC = 8;

let toaster;

function getToaster() {
  if (!toaster) {
    toaster = Toaster.create({ position: Position.BOTTOM, maxToasts: 1 });
  }
  return toaster;
}

export function confirmTimingPopup({ title, message, goodLabel, badLabel, onGood, onBad, intent = Intent.SUCCESS }) {
  const t = getToaster();
  let toastKey;

  const dismiss = () => t.dismiss(toastKey);

  toastKey = t.show({
    message: (
      <ConfirmToast
        title={title}
        message={message}
        timeoutSec={6}
        goodLabel={goodLabel}
        badLabel={badLabel}
        onGood={() => { dismiss(); onGood(); }}
        onBad={() => { dismiss(); onBad(); }}
        onDismiss={dismiss}
      />
    ),
    intent,
    timeout: 0,
  });
}

export function simpleIziMessage(message, color = "blue") {
  const intent = color === "red" ? Intent.DANGER : Intent.PRIMARY;
  const t = getToaster();
  let toastKey;

  const dismiss = () => t.dismiss(toastKey);

  toastKey = t.show({
    message: (
      <TimedMessage
        message={message}
        timeoutSec={TIMEOUT_SEC}
        onDismiss={dismiss}
      />
    ),
    intent,
    timeout: 0,
  });
}
