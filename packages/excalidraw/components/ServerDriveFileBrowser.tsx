import React, { useState, useEffect } from "react";
import { t } from "../i18n";
import { ToolButton } from "./ToolButton";
import { Dialog } from "./Dialog";
import { 
  listServerDriveFiles, 
  loadFromServerDrive, 
  deleteFromServerDrive,
  type ServerDriveFile 
} from "../data/serverDrive";
import { TrashIcon } from "./icons";
import "./ServerDriveFileBrowser.scss";

interface ServerDriveFileBrowserProps {
  onFileSelect: (file: ServerDriveFile) => Promise<void>;
  onClose: () => void;
}

export const ServerDriveFileBrowser: React.FC<ServerDriveFileBrowserProps> = ({
  onFileSelect,
  onClose,
}) => {
  const [files, setFiles] = useState<ServerDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<ServerDriveFile | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "dateAsc" | "dateDesc">("name");

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const fileList = await listServerDriveFiles();
      const filteredFiles = fileList.filter(f => f.name.endsWith(".excalidraw"));
      setFiles(sortFiles(filteredFiles, sortBy));
    } catch (err: any) {
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  };
  
  const sortFiles = (filesToSort: ServerDriveFile[], sortType: "name" | "dateAsc" | "dateDesc") => {
    const sorted = [...filesToSort];
    switch (sortType) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "dateAsc":
        sorted.sort((a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime());
        break;
      case "dateDesc":
        sorted.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
        break;
    }
    return sorted;
  };
  
  useEffect(() => {
    setFiles(currentFiles => sortFiles(currentFiles, sortBy));
  }, [sortBy]);

  useEffect(() => {
    loadFiles();
  }, []);

  const handleDelete = async (file: ServerDriveFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${file.name}?`)) {
      try {
        await deleteFromServerDrive(file.path);
        await loadFiles();
      } catch (err: any) {
        setError(err.message || "Failed to delete file");
      }
    }
  };

  const handleFileSelect = async () => {
    if (selectedFile) {
      try {
        await onFileSelect(selectedFile);
        onClose();
      } catch (err: any) {
        setError(err.message || "Failed to load file");
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("serverDrive.browserTitle")}
      size="wide"
    >
      <div className="ServerDriveFileBrowser">
        {!loading && !error && files.length > 0 && (
          <div className="ServerDriveFileBrowser__header">
            <div className="ServerDriveFileBrowser__sort">
              <label htmlFor="sort-select">Sort by:</label>
              <select 
                id="sort-select"
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as "name" | "dateAsc" | "dateDesc")}
                className="ServerDriveFileBrowser__sort-select"
              >
                <option value="name">Name</option>
                <option value="dateDesc">Date (Newest First)</option>
                <option value="dateAsc">Date (Oldest First)</option>
              </select>
            </div>
          </div>
        )}
        
        {loading && (
          <div className="ServerDriveFileBrowser__loading">
            {t("serverDrive.loading")}
          </div>
        )}
        
        {error && (
          <div className="ServerDriveFileBrowser__error">
            {error}
          </div>
        )}
        
        {!loading && !error && files.length === 0 && (
          <div className="ServerDriveFileBrowser__empty">
            {t("serverDrive.noFiles")}
          </div>
        )}
        
        {!loading && !error && files.length > 0 && (
          <>
            <div className="ServerDriveFileBrowser__list">
              {files.map((file) => (
                <div
                  key={file.path}
                  className={`ServerDriveFileBrowser__item ${
                    selectedFile?.path === file.path ? "selected" : ""
                  }`}
                  onClick={() => setSelectedFile(file)}
                >
                  <div className="ServerDriveFileBrowser__item-info">
                    <div className="ServerDriveFileBrowser__item-name">
                      {file.name}
                    </div>
                    <div className="ServerDriveFileBrowser__item-details">
                      {formatFileSize(file.size)} • {formatDate(file.modified)}
                    </div>
                  </div>
                  <button
                    className="ServerDriveFileBrowser__item-delete"
                    onClick={(e) => handleDelete(file, e)}
                    aria-label={t("serverDrive.delete")}
                  >
                    {TrashIcon}
                  </button>
                </div>
              ))}
            </div>
            
            <div className="ServerDriveFileBrowser__actions">
              <ToolButton
                type="button"
                onClick={() => onClose()}
                className="server-drive-browser__button server-drive-browser__button--cancel"
                aria-label="Cancel"
              >
                Cancel
              </ToolButton>
              <ToolButton
                type="button"
                onClick={() => selectedFile && onFileSelect(selectedFile)}
                disabled={!selectedFile}
                className="server-drive-browser__button server-drive-browser__button--load"
                aria-label={t("serverDrive.loadButton")}
              >
                {t("serverDrive.loadButton")}
              </ToolButton>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
