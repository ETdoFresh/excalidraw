import React, { useEffect, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import {
  downloadIcon,
  LibraryIcon,
} from "@excalidraw/excalidraw/components/icons";
import { fileOpen } from "@excalidraw/excalidraw/data/filesystem";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { restore } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

type Item = {
  name: string;
  path: string; // relative
  type: "file" | "dir";
  size: number | null;
  mtimeMs: number;
};

export const OpenDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ isOpen, onClose, excalidrawAPI }) => {
  const [mode, setMode] = useState<"root" | "server">("root");
  const [cwd, setCwd] = useState<string>("drawings");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMode("root");
      setCwd("drawings");
      setItems([]);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

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

  const handleOpenFromFile = async () => {
    try {
      const file = await fileOpen({ description: "Excalidraw files" });
      const data = await loadFromBlob(
        file,
        excalidrawAPI.getAppState(),
        excalidrawAPI.getSceneElements(),
      );
      if (data.files) {
        excalidrawAPI.addFiles(Object.values(data.files));
      }
      excalidrawAPI.updateScene({
        elements: data.elements || [],
        appState: data.appState || null,
      });
      onClose();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return;
      }
      excalidrawAPI.updateScene({
        appState: { errorMessage: err?.message || "Failed to open file" },
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

  const openServerFile = async (relPath: string) => {
    try {
      const res = await fetch(
        `/api/file?path=${encodeURIComponent(relPath)}&encoding=utf8`,
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = await res.json();
      const content = json?.content;
      if (!content) {
        throw new Error("Empty file content");
      }
      const parsed = JSON.parse(content);
      const restored = restore(parsed, null, null, {
        repairBindings: true,
        deleteInvisibleElements: true,
      });
      excalidrawAPI.updateScene({
        elements: restored.elements,
        appState: restored.appState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      onClose();
    } catch (err: any) {
      excalidrawAPI.updateScene({
        appState: {
          errorMessage: err?.message || "Failed to open from server",
        },
      });
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog onCloseRequest={onClose} title={false} size="wide">
      {mode === "root" && (
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Card color="primary">
            <div className="Card-icon">{downloadIcon}</div>
            <h2>Open from File</h2>
            <div className="Card-details">
              Load a .excalidraw file from your device.
            </div>
            <ToolButton
              className="Card-button"
              type="button"
              aria-label="Open from File"
              onClick={handleOpenFromFile}
            >
              Open from File
            </ToolButton>
          </Card>
          <Card color="primary">
            <div className="Card-icon">{LibraryIcon}</div>
            <h2>Open from Server</h2>
            <div className="Card-details">
              Browse the drawings/ folder on the server.
            </div>
            <ToolButton
              className="Card-button"
              type="button"
              aria-label="Browse server"
              onClick={() => setMode("server")}
            >
              Browse
            </ToolButton>
          </Card>
        </div>
      )}

      {mode === "server" && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Server Browser</strong>
            <div>
              <button
                className="ToolIcon_type_button"
                onClick={() => setMode("root")}
              >
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
          {error && (
            <div style={{ color: "var(--color-danger-color)" }}>{error}</div>
          )}
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
                const isExcal =
                  !isDir && it.name.toLowerCase().endsWith(".excalidraw");
                return (
                  <div
                    key={it.path}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 8px",
                      cursor: "pointer",
                      opacity: isDir || isExcal ? 1 : 0.5,
                    }}
                    onClick={() => {
                      if (isDir) {
                        setCwd(it.path);
                      } else if (isExcal) {
                        openServerFile(it.path);
                      }
                    }}
                    title={it.path}
                  >
                    <span>
                      {isDir ? "📁" : "📄"} {it.name}
                    </span>
                    <span style={{ opacity: 0.6 }}>
                      {isDir ? "dir" : `${it.size ?? 0} B`}
                    </span>
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
