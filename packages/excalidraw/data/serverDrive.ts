import { loadFromBlob } from "./blob";
import { restore } from "./restore";
import { serializeAsJSON } from "./json";
import type { ImportedDataState } from "./types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "../types";

// Get the server drive path from environment variable or use default
const getServerDrivePath = () => {
  return import.meta.env.VITE_APP_SERVER_DRIVE_PATH || "/api/saves";
};

const API_BASE_URL = import.meta.env.VITE_APP_API_URL || "";

export interface ServerDriveFile {
  name: string;
  path: string;
  size: number;
  modified: string;
}

/**
 * Save scene to server drive
 */
export async function saveToServerDrive(
  filename: string,
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): Promise<void> {
  const data = serializeAsJSON(elements, appState, files, "database");
  const savePath = getServerDrivePath();
  
  // Ensure filename has .excalidraw extension
  if (!filename.endsWith('.excalidraw')) {
    filename = `${filename}.excalidraw`;
  }
  
  const response = await fetch(`${API_BASE_URL}${savePath}/${filename}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data,
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to save file: ${response.status} ${response.statusText} ${errorText}`);
  }
}

/**
 * Load scene from server drive
 */
export const loadFromServerDrive = async (
  filepath: string,
): Promise<ImportedDataState> => {
  const savePath = getServerDrivePath();
  
  const response = await fetch(`${API_BASE_URL}${savePath}/${filepath}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to load file: ${response.status} ${response.statusText} ${errorText}`);
  }
  
  const data = await response.json();
  
  return restore(data, null, null, {
    repairBindings: true,
    refreshDimensions: false,
  });
};

/**
 * List files from server drive
 */
export async function listServerDriveFiles(): Promise<ServerDriveFile[]> {
  const savePath = getServerDrivePath();
  
  const response = await fetch(`${API_BASE_URL}${savePath}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to list files: ${response.status} ${response.statusText} ${errorText}`);
  }
  
  const files = await response.json();
  
  // Ensure files is an array and has the expected structure
  if (!Array.isArray(files)) {
    throw new Error('Invalid response format from server');
  }
  
  return files.map(file => ({
    name: file.name || '',
    path: file.path || file.name || '',
    size: file.size || 0,
    modified: file.modified || new Date().toISOString(),
  }));
}

/**
 * Delete file from server drive
 */
export const deleteFromServerDrive = async (
  filepath: string,
): Promise<void> => {
  const savePath = getServerDrivePath();
  
  const response = await fetch(`${API_BASE_URL}${savePath}/${filepath}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to delete file: ${response.status} ${response.statusText} ${errorText}`);
  }
};
