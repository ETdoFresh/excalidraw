import React, { useState } from "react";
import { t } from "../i18n";
import { ToolButton } from "./ToolButton";
import { Dialog } from "./Dialog";
import { saveToServerDrive } from "../data/serverDrive";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "../types";
import "./ServerDriveSaveDialog.scss";

interface ServerDriveSaveDialogProps {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  onClose: () => void;
  defaultFilename?: string;
}

export const ServerDriveSaveDialog: React.FC<ServerDriveSaveDialogProps> = ({
  elements,
  appState,
  files,
  onClose,
  defaultFilename = "untitled",
}) => {
  const [filename, setFilename] = useState(defaultFilename);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!filename.trim()) {
      setError(t("serverDrive.filenameRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveToServerDrive(filename, elements, appState, files);
      onClose();
    } catch (err: any) {
      setError(err.message || t("serverDrive.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("serverDrive.saveTitle")}
      size="small"
    >
      <div className="ServerDriveSaveDialog">
        <div className="ServerDriveSaveDialog__field">
          <label htmlFor="filename" className="ServerDriveSaveDialog__label">
            {t("serverDrive.filenameLabel")}
          </label>
          <input
            id="filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !saving) {
                handleSave();
              }
            }}
            className="ServerDriveSaveDialog__input"
            placeholder={t("serverDrive.filenamePlaceholder")}
            autoFocus
          />
          {!filename.endsWith(".excalidraw") && filename.trim() && (
            <div className="ServerDriveSaveDialog__hint">
              {t("serverDrive.extensionHint")}
            </div>
          )}
        </div>

        {error && (
          <div className="ServerDriveSaveDialog__error">
            {error}
          </div>
        )}

        <div className="ServerDriveSaveDialog__actions">
          <ToolButton
            type="button"
            onClick={() => onClose()}
            disabled={saving}
            className="server-drive-save-dialog__button server-drive-save-dialog__button--cancel"
            aria-label="Cancel"
          >
            Cancel
          </ToolButton>
          <ToolButton
            type="button"
            onClick={handleSave}
            disabled={!filename.trim() || saving}
            className="server-drive-save-dialog__button server-drive-save-dialog__button--save"
            aria-label={saving ? t("serverDrive.saving") : t("serverDrive.saveButton")}
          >
            {saving ? t("serverDrive.saving") : t("serverDrive.saveButton")}
          </ToolButton>
        </div>
      </div>
    </Dialog>
  );
};
