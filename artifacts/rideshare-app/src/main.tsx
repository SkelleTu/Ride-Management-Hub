import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => localStorage.getItem("token"));

// Guard against "Failed to execute 'removeChild'/'insertBefore' on 'Node'" crashes.
// These happen when a browser-native UI outside React's control (WebAuthn/passkey
// prompts, password managers, translate extensions) mutates the DOM tree that React
// is also reconciling. It's a benign race, not an app bug — make the native DOM
// methods no-op instead of throwing when the node isn't actually a child, so React
// can keep going instead of crashing the whole page.
const originalRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
  if (child.parentNode !== this) {
    return child;
  }
  return originalRemoveChild.call(this, child) as T;
};

const originalInsertBefore = Node.prototype.insertBefore;
Node.prototype.insertBefore = function <T extends Node>(
  this: Node,
  newNode: T,
  referenceNode: Node | null,
): T {
  if (referenceNode && referenceNode.parentNode !== this) {
    return newNode;
  }
  return originalInsertBefore.call(this, newNode, referenceNode) as T;
};

createRoot(document.getElementById("root")!).render(<App />);
