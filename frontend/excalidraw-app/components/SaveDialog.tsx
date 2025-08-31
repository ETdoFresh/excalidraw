import React, { useEffect, useMemo, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import {
  downloadIcon,
  ExportImageIcon,
  ExcalLogo,
  LibraryIcon,
} from "@excalidraw/excalidraw/components/icons";
import { saveAsJSON, serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { exportToExcalidrawPlus } from "./ExportToExcalidrawPlus";

export const SaveDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ isOpen, onClose, excalidrawAPI }) => {
  if (!isOpen) {
    return null;
  }

  type Item = {
    name: string;
    path: string;
    type: "file" | "dir";
    size: number | null;
    mtimeMs: number;
  };

  const [mode, setMode] = useState<"root" | "server">("root");
  const [cwd, setCwd] = useState<string>("drawings");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestedName = useMemo(() => {
    const n = excalidrawAPI.getName() || "excalidraw-drawing";
    return n.endsWith(".excalidraw") ? n : `${n}.excalidraw`;
  }, [excalidrawAPI]);
  const [fileName, setFileName] = useState<string>(suggestedName);

  useEffect(() => {
    if (!isOpen) {
      setMode("root");
      setCwd("drawings");
      setItems([]);
      setError(null);
      setLoading(false);
      setFileName(suggestedName);
    }
  }, [isOpen, suggestedName]);

  useEffect(() => {
    if (isOpen && mode === "server") {
      (async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await fetch(`/api/list?path=${encodeURIComponent(cwd)}`);
          if (!res.ok) {
            throw new Error(await res.text());
          }
          const json = await res.json();
          setItems(json.items || []);
        } catch (e: any) {
          setError(e?.message || "Failed to list directory");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isOpen, mode, cwd]);

  const handleSaveToDisk = async () => {
    try {
      await saveAsJSON(
        excalidrawAPI.getSceneElements(),
        excalidrawAPI.getAppState(),
        excalidrawAPI.getFiles(),
        excalidrawAPI.getName() || "excalidraw-drawing",
      );
      onClose();
    } catch (err: any) {
      excalidrawAPI.updateScene({
        appState: { errorMessage: err?.message || "Failed to save" },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  };

  const navigateUp = () => {
    if (cwd === "drawings") {
      return;
    }
    const parts = cwd.split("/");
    parts.pop();
    const next = parts.join("/") || "drawings";
    setCwd(next);
  };

  const saveToServerAt = async (relPath: string) => {
    const serialized = serializeAsJSON(
      excalidrawAPI.getSceneElements(),
      excalidrawAPI.getAppState(),
      excalidrawAPI.getFiles(),
      "local",
    );

    const res = await fetch("/api/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: relPath, content: serialized, encoding: "utf8" }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Failed to save file");
    }
    excalidrawAPI.setToast({ message: `Saved to server: ${relPath}` });
  };

  const handleSaveToServer = async () => {
    try {
      const base = (fileName || "").trim();
      if (!base) {
        throw new Error("Please enter a file name");
      }
      const finalName = base.endsWith(".excalidraw") ? base : `${base}.excalidraw`;
      const relPath = `${cwd}/${finalName}`;
      await saveToServerAt(relPath);
      onClose();
    } catch (err: any) {
      excalidrawAPI.updateScene({
        appState: { errorMessage: err?.message || "Failed to save" },
      });
    }
  };

  const handleExportImage = () => {
    excalidrawAPI.updateScene({
      appState: { openDialog: { name: "imageExport" } },
    });
    onClose();
  };

  const handleSaveToPlus = async () => {
    try {
      await exportToExcalidrawPlus(
        excalidrawAPI.getSceneElements(),
        excalidrawAPI.getAppState(),
        excalidrawAPI.getFiles(),
        excalidrawAPI.getName(),
      );
      onClose();
    } catch (err: any) {
      excalidrawAPI.updateScene({
        appState: { errorMessage: err?.message || "Failed to export" },
      });
    }
  };

  return (
    <Dialog onCloseRequest={onClose} title={false} size="wide">
      {mode === "root" && (
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Card color="primary">
            <div className="Card-icon">{downloadIcon}</div>
            <h2>Save to Disk</h2>
            <div className="Card-details">Save a .excalidraw file locally.</div>
            <ToolButton
              className="Card-button"
              type="button"
              aria-label="Save to Disk"
              onClick={handleSaveToDisk}
            >
              Save to Disk
            </ToolButton>
          </Card>
          <Card color="primary">
            <div className="Card-icon">{LibraryIcon}</div>
            <h2>Save to Server</h2>
            <div className="Card-details">Save into the drawings/ folder.</div>
            <ToolButton
              className="Card-button"
              type="button"
              aria-label="Save to Server"
              onClick={() => setMode("server")}
            >
              Save to Server
            </ToolButton>
          </Card>
          <Card color="primary">
            <div className="Card-icon">{ExportImageIcon}</div>
            <h2>Export Image</h2>
            <div className="Card-details">Export PNG/SVG/clipboard.</div>
            <ToolButton
              className="Card-button"
              type="button"
              aria-label="Export image"
              onClick={handleExportImage}
            >
              Export Image
            </ToolButton>
          </Card>
          <Card color="primary">
            <div className="Card-icon" style={{ width: 24 }}>{ExcalLogo}</div>
            <h2>Excalidraw+</h2>
            <div className="Card-details">Save to Excalidraw+ cloud.</div>
            <ToolButton
              className="Card-button"
              type="button"
              aria-label="Save to Excalidraw+"
              onClick={handleSaveToPlus}
            >
              Save to Excalidraw+
            </ToolButton>
          </Card>
        </div>
      )}

      {mode === "server" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Save to Server</strong>
            <div>
              <button className="ToolIcon_type_button" onClick={() => setMode("root")}>
                Back
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              className="ToolIcon_type_button"
              onClick={navigateUp}
              disabled={cwd === "drawings"}
            >
              Up
            </button>
            <span style={{ opacity: 0.7 }}>cwd: {cwd}</span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <label htmlFor="save-filename">File name</label>
            <input
              id="save-filename"
              type="text"
              placeholder="drawing.excalidraw"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              style={{ flex: 1 }}
            />
            <ToolButton
              className="Card-button"
              type="button"
              aria-label="Save"
              onClick={handleSaveToServer}
              disabled={!fileName.trim()}
            >
              {items.some((it) => it.type === "file" && (it.name === fileName || it.name === (fileName.endsWith(".excalidraw") ? fileName : `${fileName}.excalidraw`)))
                ? "Overwrite"
                : "Save"}
            </ToolButton>
          </div>
          {error && <div style={{ color: "var(--color-danger-color)" }}>{error}</div>}
          <div
            style={{
              maxHeight: 360,
              overflow: "auto",
              border: "1px solid var(--default-border-color)",
              borderRadius: 4,
              padding: 8,
            }}
          >
            {loading ? (
              <div>Loading…</div>
            ) : (
              items.map((it) => {
                const isDir = it.type === "dir";
                return (
                  <div
                    key={it.path}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 8px",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (isDir) {
                        setCwd(it.path);
                      } else {
                        setFileName(it.name);
                      }
                    }}
                    title={it.path}
                  >
                    <span>{isDir ? "📁" : "📄"} {it.name}</span>
                    <span style={{ opacity: 0.6 }}>{isDir ? "dir" : `${it.size ?? 0} B`}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
};
