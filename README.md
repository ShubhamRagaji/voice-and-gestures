# React Hand Gesture Control

A powerful and intuitive React library that transforms web navigation through hand gesture recognition. Effortlessly scroll, swipe between pages, and take screenshots using simple hand movements, eliminating the need for a mouse or keyboard. Enhance your web applications with smooth, hands-free control and modern gesture-driven interaction.

---

## ✅ Installation

```bash
npm install react-hand-gesture-control
```

## ✅ Supported Gestures

☝️ **Index finger only** → Move cursor + scroll  
✌️ **Two fingers - Index and middle** → Scroll down  
🖐 **Four fingers pointing at the screen** → Swipe (Next / Previous)  
✊ **Fist (hold 2.5s)** → Screenshot  


## ✅ Usage Example

```js

import { HandGestureController } from "react-hand-gesture-control";

function App() {
  const handleNextPage = () => {
    console.log("Next page triggered");
    // Your next page logic here
  };

  const handlePrevPage = () => {
    console.log("Previous page triggered");
    // Your previous page logic here
  };

  return (
    <div className="app">
      <HandGestureController
        scrollUpAmount={100}
        scrollDownAmount={150}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        customCursor={true}
        showHandGestures={true}
      />
      
      {/* Your app content */}
      <div className="content">
        <h1>Gesture-Controlled Interface</h1>
        <p>Use hand gestures to navigate!</p>
      </div>
    </div>
  );
}

export default App;

```

## ✅ Props

| Prop              | Type          | Default                    | Optional | Description |
|-------------------|---------------|----------------------------|----------|-------------|
| `scrollUpAmount`  | `number`      | `400`                      | Yes      | Amount of pixels to scroll up per gesture. |
| `scrollDownAmount`| `number`      | `-400`                     | Yes      | Amount of pixels to scroll down per gesture. |
| `onNextPage`      | `() => void`  | `window.history.forward()` | Yes      | Triggered on next page gesture. Defaults to navigating forward in browser history. |
| `onPrevPage`      | `() => void`  | `window.history.back()`    | Yes      | Triggered on previous page gesture. Defaults to navigating backward in browser history. |
| `showCursor`      | `boolean`     | `true`                     | Yes      | Show or hide the custom cursor. |
| `customCursor`    | `ReactNode`   | `null`                     | Yes      | A custom React element (e.g., `<div>` or icon) to render as the gesture cursor. |
| `showHandGestures`| `boolean`     | `true`                     | Yes      | Show or hide the gesture guide overlay. |

## ✅ Requirements

- **React 18+**  
- **Modern browser with camera/webcam support**