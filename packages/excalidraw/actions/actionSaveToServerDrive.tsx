import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { ExportIcon } from "../components/icons";
import { saveToServerDrive } from "../data/serverDrive";
import { t } from "../i18n";
import { register } from "./register";
import React, { useState } from "react";
import { ServerDriveSaveDialog } from "../components/ServerDriveSaveDialog";

export const actionSaveToServerDrive = register({
  name: "saveToServerDrive",
  label: "buttons.saveToServer",
  icon: ExportIcon,
  trackEvent: { category: "export", action: "saveToServerDrive" },
  predicate: (elements, appState) => {
    return !appState.viewModeEnabled;
  },
  perform: async (elements, appState, value, app) => {
    // Show save dialog
    return {
      appState: {
        ...appState,
        openDialog: {
          name: "serverDriveSave",
          elements,
          appState,
          files: app.files,
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
});

// Quick save action (overwrites current server file if already saved)
export const actionQuickSaveToServer = register({
  name: "quickSaveToServer",
  label: "buttons.save",
  icon: ExportIcon,
  trackEvent: { category: "export", action: "quickSaveToServer" },
  predicate: (elements, appState) => {
    return !appState.viewModeEnabled;
  },
  perform: async (elements, appState, value, app) => {
    let filename = app.getName() || "untitled";
    
    // Ensure filename has .excalidraw extension
    if (!filename.endsWith('.excalidraw')) {
      filename = `${filename}.excalidraw`;
    }
    
    try {
      await saveToServerDrive(filename, elements, appState, app.files);
      
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: {
          ...appState,
          toast: {
            message: t("toast.fileSavedToServer").replace(
              "{filename}",
              `"${filename}"`,
            ),
          },
        },
      };
    } catch (error: any) {
      console.error("Failed to save to server:", error);
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: {
          ...appState,
          toast: {
            message: t("serverDrive.saveFailed"),
            closable: true,
          },
        },
      };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
});