import React from "react";
import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";
import { t } from "../i18n";
import { loadFromJSON } from "../data";
import { ServerDriveIcon } from "./icons/serverDrive";
import { LoadIcon } from "./icons";
import "./LoadOptionsDialog.scss";

interface LoadOptionsDialogProps {
  onClose: () => void;
  onLoadFromFile: () => void;
  onLoadFromServer: () => void;
}

export const LoadOptionsDialog: React.FC<LoadOptionsDialogProps> = ({
  onClose,
  onLoadFromFile,
  onLoadFromServer,
}) => {
  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("buttons.load")}
      size="small"
    >
      <div className="LoadOptionsDialog">
        <div className="LoadOptionsDialog__options">
          <button
            className="LoadOptionsDialog__option"
            onClick={() => {
              onLoadFromFile();
              onClose();
            }}
          >
            <div className="LoadOptionsDialog__option-icon">
              {LoadIcon}
            </div>
            <div className="LoadOptionsDialog__option-content">
              <div className="LoadOptionsDialog__option-title">
                {t("buttons.loadFromFile")}
              </div>
              <div className="LoadOptionsDialog__option-description">
                {t("buttons.loadFromFileDescription")}
              </div>
            </div>
          </button>

          <button
            className="LoadOptionsDialog__option"
            onClick={() => {
              onLoadFromServer();
              // Don't close here - let the parent handle it
            }}
          >
            <div className="LoadOptionsDialog__option-icon">
              {ServerDriveIcon}
            </div>
            <div className="LoadOptionsDialog__option-content">
              <div className="LoadOptionsDialog__option-title">
                {t("buttons.loadFromServerDrive")}
              </div>
              <div className="LoadOptionsDialog__option-description">
                {t("buttons.loadFromServerDescription")}
              </div>
            </div>
          </button>
        </div>
      </div>
    </Dialog>
  );
};