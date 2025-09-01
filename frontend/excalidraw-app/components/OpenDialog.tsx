import React, { useCallback, useEffect, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import {
  downloadIcon,
  LibraryIcon,
  TrashIcon,
  checkIcon,
  CloseIcon,
  FreedrawIcon,
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
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setMode("root");
      setCwd("drawings");
      setItems([]);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const loadList = useCallback(async () => {
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
  }, [cwd]);

  useEffect(() => {
    if (isOpen && mode === "server") {
      loadList();
    }
  }, [isOpen, mode, loadList]);

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

  const deleteServerFile = async (relPath: string) => {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      await loadList();
    } catch (err: any) {
      excalidrawAPI.updateScene({
        appState: { errorMessage: err?.message || "Failed to delete" },
      });
    }
  };

  const renameServerFile = async (oldRelPath: string, newBaseName: string) => {
    try {
      const resGet = await fetch(
        `/api/file?path=${encodeURIComponent(oldRelPath)}&encoding=utf8`,
      );
      if (!resGet.ok) {
        throw new Error(await resGet.text());
      }
      const json = await resGet.json();
      const content = json?.content ?? "";
      const parts = oldRelPath.split("/");
      parts.pop();
      const dir = parts.join("/");
      const finalName = newBaseName.endsWith(".excalidraw")
        ? newBaseName
        : `${newBaseName}.excalidraw`;
      const newRelPath = `${dir}/${finalName}`;
      const put = await fetch(`/api/file`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newRelPath, content, encoding: "utf8" }),
      });
      if (!put.ok) {
        throw new Error(await put.text());
      }
      const del = await fetch(
        `/api/file?path=${encodeURIComponent(oldRelPath)}`,
        { method: "DELETE" },
      );
      if (!del.ok) {
        throw new Error(await del.text());
      }
      setRenaming(null);
      await loadList();
    } catch (err: any) {
      excalidrawAPI.updateScene({
        appState: { errorMessage: err?.message || "Failed to rename" },
      });
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog onCloseRequest={onClose} title={false} size="wide">
      <button
        className="Dialog__close"
        onClick={onClose}
        title="Close"
        aria-label="Close"
        type="button"
        style={{ position: "absolute", right: 8, top: 8 }}
      >
        {CloseIcon}
      </button>
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
                    <span
                      style={{
                        display:
                          !isDir && renaming === it.path ? "none" : undefined,
                      }}
                    >
                      {isDir ? "📁" : "📄"} {it.name}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flex: !isDir && renaming === it.path ? 1 : undefined,
                        justifyContent:
                          !isDir && renaming === it.path
                            ? "flex-start"
                            : undefined,
                      }}
                    >
                      {!isDir && renaming === it.path ? (
                        <>
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            style={{ flex: 1, minWidth: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            className="ToolIcon_type_button"
                            onClick={(e) => {
                              e.stopPropagation();
                              renameServerFile(it.path, renameValue);
                            }}
                            title="Save"
                            aria-label="Save"
                          >
                            {checkIcon}
                          </button>
                          <button
                            className="ToolIcon_type_button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenaming(null);
                            }}
                            title="Cancel"
                            aria-label="Cancel"
                          >
                            {CloseIcon}
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ opacity: 0.6 }}>
                            {isDir ? "dir" : `${it.size ?? 0} B`}
                          </span>
                          {!isDir && (
                            <>
                              <button
                                className="ToolIcon_type_button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenaming(it.path);
                                  setRenameValue(it.name);
                                }}
                                title="Rename"
                                aria-label="Rename"
                              >
                                <span style={{ width: 18, height: 18, display: "inline-flex" }}>
                                  {FreedrawIcon}
                                </span>
                              </button>
                              <button
                                className="ToolIcon_type_button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    window.confirm(
                                      `Delete file "${it.name}"? This cannot be undone.`,
                                    )
                                  ) {
                                    deleteServerFile(it.path);
                                  }
                                }}
                                title="Delete"
                                aria-label="Delete"
                              >
                                <span style={{ width: 18, height: 18, display: "inline-flex" }}>
                                  {TrashIcon}
                                </span>
                              </button>
                            </>
                          )}
                        </>
                      )}
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
