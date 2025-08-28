import { register } from "./register";
import { t } from "../i18n";
import { loadFromServerDrive } from "../data/serverDrive";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "../types";
import { CaptureUpdateAction } from "@excalidraw/element";
import { ServerDriveIcon } from "../components/icons/serverDrive";
import { KEYS } from "@excalidraw/common";

export const actionLoadFromServerDrive = register({
  name: "loadFromServerDrive",
  label: "buttons.loadFromServerDrive",
  icon: ServerDriveIcon,
  trackEvent: { category: "export", action: "loadFromServerDrive" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.loadScene && 
      !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, _, app) => {
    // Open the server drive file browser dialog
    return {
      appState: {
        ...appState,
        openDialog: { name: "serverDriveLoad" },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    event.key === KEYS.O && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
});
