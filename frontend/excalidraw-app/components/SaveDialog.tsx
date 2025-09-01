import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import {
  downloadIcon,
  ExportImageIcon,
  ExcalLogo,
  LibraryIcon,
  TrashIcon,
  save,
  CloseIcon,
  FreedrawIcon,
  ArrowIcon,
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
  const [sortKey, setSortKey] = useState<"name" | "date_desc" | "date_asc">(
    "name",
  );

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

  const sortedItems = useMemo(() => {
    const dirs = items.filter((i) => i.type === "dir");
    const files = items.filter((i) => i.type !== "dir");

    const byName = (a: Item, b: Item) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    const byDateAsc = (a: Item, b: Item) => (a.mtimeMs || 0) - (b.mtimeMs || 0);
    const byDateDesc = (a: Item, b: Item) =>
      (b.mtimeMs || 0) - (a.mtimeMs || 0);

    const sortFn =
      sortKey === "name"
        ? byName
        : sortKey === "date_asc"
        ? byDateAsc
        : byDateDesc;

    dirs.sort(sortFn);
    files.sort(sortFn);
    return [...dirs, ...files];
  }, [items, sortKey]);

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
      body: JSON.stringify({
        path: relPath,
        content: serialized,
        encoding: "utf8",
      }),
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
      const finalName = base.endsWith(".excalidraw")
        ? base
        : `${base}.excalidraw`;
      const relPath = `${cwd}/${finalName}`;
      await saveToServerAt(relPath);
      onClose();
    } catch (err: any) {
      excalidrawAPI.updateScene({
        appState: { errorMessage: err?.message || "Failed to save" },
      });
    }
  };

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

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
      setFileName(finalName);
      await loadList();
    } catch (err: any) {
      excalidrawAPI.updateScene({
        appState: { errorMessage: err?.message || "Failed to rename" },
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
            <div className="Card-icon" style={{ width: 24 }}>
              {ExcalLogo}
            </div>
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
            <strong>Save to Server</strong>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="save-sort" style={{ opacity: 0.7 }}>
                Sort
              </label>
              <select
                id="save-sort"
                value={sortKey}
                onChange={(e) =>
                  setSortKey(
                    e.target.value as "name" | "date_desc" | "date_asc",
                  )
                }
                style={{ padding: "4px 6px" }}
              >
                <option value="name">Name</option>
                <option value="date_desc">Date Desc</option>
                <option value="date_asc">Date Asc</option>
              </select>
              <button
                className="ToolIcon_type_button"
                onClick={() => setMode("root")}
                type="button"
                aria-label="Back"
                title="Back"
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    display: "inline-flex",
                    transform: "rotate(180deg)",
                  }}
                >
                  {ArrowIcon}
                </span>
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
              aria-label={
                items.some(
                  (it) =>
                    it.type === "file" &&
                    (it.name === fileName ||
                      it.name ===
                        (fileName.endsWith(".excalidraw")
                          ? fileName
                          : `${fileName}.excalidraw`)),
                )
                  ? "Overwrite"
                  : "Save"
              }
              onClick={handleSaveToServer}
              disabled={!fileName.trim()}
            >
              {items.some(
                (it) =>
                  it.type === "file" &&
                  (it.name === fileName ||
                    it.name ===
                      (fileName.endsWith(".excalidraw")
                        ? fileName
                        : `${fileName}.excalidraw`)),
              ) ? (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    display: "inline-flex",
                    color: "var(--color-danger-color)",
                  }}
                >
                  {save}
                </span>
              ) : (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    display: "inline-flex",
                  }}
                >
                  {save}
                </span>
              )}
            </ToolButton>
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
              sortedItems.map((it) => {
                const isDir = it.type === "dir";
                const isRenaming = !isDir && renaming === it.path;
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
                        flex: isRenaming ? 1 : undefined,
                        justifyContent: isRenaming ? "flex-start" : undefined,
                      }}
                    >
                      {!isDir || !isRenaming ? (
                        <span style={{ opacity: 0.6 }}>
                          {isDir ? "dir" : `${it.size ?? 0} B`}
                        </span>
                      ) : null}
                      {!isDir && isRenaming ? (
                        <>
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            style={{ flex: 1, minWidth: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="New file name"
                          />
                          <button
                            className="ToolIcon_type_button"
                            style={{ flex: "0 0 auto" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              renameServerFile(it.path, renameValue);
                            }}
                            title="Save"
                            aria-label="Save"
                            type="button"
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                display: "inline-flex",
                              }}
                            >
                              {save}
                            </span>
                          </button>
                          <button
                            className="ToolIcon_type_button"
                            style={{ flex: "0 0 auto" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenaming(null);
                            }}
                            title="Cancel"
                            aria-label="Cancel"
                            type="button"
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                display: "inline-flex",
                              }}
                            >
                              {CloseIcon}
                            </span>
                          </button>
                        </>
                      ) : (
                        !isDir && (
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
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  display: "inline-flex",
                                }}
                              >
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
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  display: "inline-flex",
                                }}
                              >
                                {TrashIcon}
                              </span>
                            </button>
                          </>
                        )
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
