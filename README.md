# Tube Joint Visualizer

An interactive desktop application for visualizing, manipulating, and joining rectangular 3D tubes. Built with **React**, **Three.js**, and packaged with **Electron**.

## Features

*   **3D Workspace:** Interactive canvas with zoom, pan, and rotate controls (OrbitControls).
*   **Tube Customization:** Create Rectangular or Square tubes with custom Width, Height, Thickness, and Length.
*   **Smart Joints:** Automatically positions new tubes at the end of previous tubes to form joints.
*   **Angle Control:**
    *   Slider control (0-180°).
    *   Quick-select buttons (30°, 45°, 90°, 135°, 180°).
    *   **Angle Snapping:** Toggle to snap joints to standard engineering angles.
*   **Interaction:**
    *   **Drag & Drop:** Move tubes freely on the floor plane.
    *   **Selection:** Click to select tubes (Yellow highlight).
    *   **View Modes:** Toggle between Solid and Wireframe rendering.
*   **History System:** Full **Undo/Redo** support for all actions.
*   **Export:** Save the assembly data to a JSON file.

## Project Structure

```text
tube-joint-visualizer/
├── electron/           # Electron main process files
│   └── main.js         # Window creation and config
├── src/                # React application source
│   ├── assets/         # Static assets (images, icons)
│   ├── App.tsx         # Main component logic
│   ├── main.tsx        # React entry point
│   └── index.css       # Tailwind/Global styles
├── dist/               # Production build output (React)
├── build/              # Final Electron executables
│   └── win-unpacked/   # Unpacked executable folder
├── package.json        # Dependencies and scripts
└── vite.config.ts      # Vite configuration
```
## Setup & Installation

1.  **Prerequisites:** Ensure [Node.js](https://nodejs.org/) (v18 or higher) is installed.

2.  **Clone the repository:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/tube-joint-visualizer.git
    cd tube-joint-visualizer
    ```

3.  **Install Dependencies:**
    ```bash
    npm install
    ```
## 💻 Usage (Development)

To run the application locally with hot-reloading:

```bash
npm run electron:dev

```

### Controls
*   **Left Click:** Select a tube (Yellow highlight).
*   **Left Click + Drag:** Move a selected tube along the floor plane.
*   **Middle Click (or Shift + Click) + Drag:** Rotate the 3D camera.
*   **Scroll Wheel:** Zoom in and out.
*   **UI Controls:** Use the sidebar to add tubes, change angles, undo/redo actions, and export data.

## Packaging (Build Instructions)

To package the project into a standalone executable (Windows .exe):

1.  **Run the build script:**
    ```bash
    npm run electron:build
    ```

2.  **Locate the executable:**
    After the build process finishes, you will find the files in the `build` directory:
    *   **Executable (Run this):** `./build/win-unpacked/Tube Joint Visualizer.exe`
    *   **Installer:** `./build/Tube Joint Visualizer Setup 0.0.0.exe`

 Note: If building on Linux/WSL, you may need to use `npm run electron:build -- --win` and ensure Wine is installed.

 ## Changelog & Progress

*   **v1.0.0 (Final Submission)**
    *   Packaged application with Electron Builder.
    *   Verified standalone executable functionality.
*   **feat: JSON Export**
    *   Added functionality to export assembly position/rotation data to JSON.
*   **feat: Undo/Redo System**
    *   Implemented history stack for adding, removing, and moving tubes.
    *   Added Undo/Redo UI buttons with disabled states.
*   **feat: Interactive Positioning**
    *   Added Raycaster-based drag-and-drop system.
    *   Fixed geometry logic to prevent joints from swiveling inside each other.
*   **feat: Joint Controls**
    *   Implemented angle slider with "Snap to Angle" toggle.
    *   Added quick-select buttons for standard angles (30°, 45°, 90°, etc.).
*   **init: Core Visualization**
    *   Set up React + Three.js + Vite environment.
    *   Implemented basic Tube geometry generation (ExtrudeGeometry).