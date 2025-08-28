// Mock implementation for testing without a backend server
import type { ImportedDataState } from "./types";
import type { ServerDriveFile } from "./serverDrive";

// In-memory storage for testing
const mockStorage = new Map<string, any>();

// Initialize with some sample data if needed
const initMockStorage = () => {
  if (mockStorage.size === 0) {
    // Add a sample file for testing
    const sampleData = {
      type: "excalidraw",
      version: 2,
      source: "mock",
      elements: [],
      appState: {
        viewBackgroundColor: "#ffffff",
        gridSize: 20,
      },
      files: {}
    };
    mockStorage.set("sample-drawing.excalidraw", {
      data: sampleData,
      modified: new Date().toISOString()
    });
  }
};

export const mockListFiles = async (): Promise<ServerDriveFile[]> => {
  initMockStorage();
  const files: ServerDriveFile[] = [];
  
  mockStorage.forEach((value, key) => {
    files.push({
      name: key,
      path: `/mock/${key}`,
      size: JSON.stringify(value.data).length,
      modified: value.modified
    });
  });
  
  return files;
};

export const mockSaveFile = async (filename: string, data: ImportedDataState): Promise<void> => {
  const fullName = filename.endsWith('.excalidraw') ? filename : `${filename}.excalidraw`;
  mockStorage.set(fullName, {
    data,
    modified: new Date().toISOString()
  });
  console.log(`[Mock] Saved file: ${fullName}`);
};

export const mockLoadFile = async (path: string): Promise<ImportedDataState> => {
  const filename = path.split('/').pop();
  if (!filename) throw new Error("Invalid file path");
  
  const file = mockStorage.get(filename);
  if (!file) throw new Error("File not found");
  
  console.log(`[Mock] Loaded file: ${filename}`);
  return file.data;
};

export const mockDeleteFile = async (path: string): Promise<void> => {
  const filename = path.split('/').pop();
  if (!filename) throw new Error("Invalid file path");
  
  if (mockStorage.delete(filename)) {
    console.log(`[Mock] Deleted file: ${filename}`);
  } else {
    throw new Error("File not found");
  }
};
