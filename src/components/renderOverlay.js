import React from "react";
import ReactDOM from "react-dom";

/**
 * Mount a React component into a temporary div appended to document.body.
 * The component receives an `onClose` prop that unmounts and removes the div.
 * Returns the `onClose` function so the caller can close programmatically.
 */
export function renderOverlay({ Overlay, props = {} }) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);

  const onClose = () => {
    if (typeof props.onClose === "function") props.onClose();
    ReactDOM.unmountComponentAtNode(parent);
    parent.remove();
  };

  ReactDOM.render(
    React.createElement(Overlay, { ...props, isOpen: true, onClose }),
    parent
  );

  return onClose;
}
