import React from "react";
import { useUIAppState } from "../context/ui-appState";
import "./FileNameDisplay.scss";

export const FileNameDisplay: React.FC = () => {
  const appState = useUIAppState();
  const fileName = appState.name;
  
  // Show "Untitled" if no filename is set
  const displayName = !fileName || fileName === "" 
    ? "Untitled" 
    : fileName.endsWith('.excalidraw') 
      ? fileName 
      : `${fileName}.excalidraw`;
  
  return (
    <div className="FileNameDisplay">
      <span className="FileNameDisplay__name">{displayName}</span>
    </div>
  );
};