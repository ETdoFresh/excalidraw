import React, { useState } from "react";
import { ServerDriveFileBrowser } from "./ServerDriveFileBrowser";
import { loadFromServerDrive, type ServerDriveFile } from "../data/serverDrive";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "../types";

interface ServerDriveLoadDialogProps {
  onClose: () => void;
  onLoad: (data: {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  }) => void;
}

export const ServerDriveLoadDialog: React.FC<ServerDriveLoadDialogProps> = ({
  onClose,
  onLoad,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: ServerDriveFile) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadFromServerDrive(file.path);
      if (data.elements) {
        // Extract filename without extension for the app name
        const nameWithoutExt = file.name.replace(/\.excalidraw$/, '');
        onLoad({
          elements: data.elements,
          appState: { 
            ...(data.appState || {}),
            name: nameWithoutExt 
          },
          files: data.files || {},
        });
        onClose();
      } else {
        setError("Invalid file data");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load file");
      setLoading(false);
    }
  };

  return (
    <ServerDriveFileBrowser
      onFileSelect={handleFileSelect}
      onClose={onClose}
    />
  );
};
