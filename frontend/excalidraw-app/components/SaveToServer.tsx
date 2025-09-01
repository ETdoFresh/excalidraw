import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import {
  CloseIcon,
  ArrowIcon,
  FreedrawIcon,
  TrashIcon,
  save,
} from "@excalidraw/excalidraw/components/icons";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

type Item = {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number | null;
  mtimeMs: number;
};

export const SaveToServer: React.FC<{
  elements: readonly NonDeletedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  name: string;
  onError: (error: Error) => void;
  onSuccess: () => void;
}> = ({ elements, appState, files, name, onError, onSuccess }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const defaultName = useMemo(() => {
    return name && name.endsWith(".excalidraw")
      ? name
      : `${name || "excalidraw-drawing"}.excalidraw`;
  }, [name]);
  const [fileName, setFileName] = useState<string>(defaultName);
  const [cwd, setCwd] = useState<string>("drawings");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const willOverwrite = useMemo(() => {
    const base = (fileName || "").trim();
    if (!base) return false;
    const final = base.endsWith(".excalidraw") ? base : `${base}.excalidraw`;
    return items.some(
      (it) => it.type === "file" && it.name.toLowerCase() === final.toLowerCase(),
    );
  }, [items, fileName]);

  useEffect(() => {
    if (pickerOpen) {
      setFileName(defaultName);
      setCwd("drawings");
    }
  }, [pickerOpen, defaultName]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/list?path=${encodeURIComponent(cwd)}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setItems(json.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to list directory");
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    if (pickerOpen) {
      loadList();
    }
  }, [pickerOpen, loadList]);

  const navigateUp = () => {
    if (cwd === "drawings") return;
    const parts = cwd.split("/");
    parts.pop();
    setCwd(parts.join("/") || "drawings");
  };

  const saveAt = async (relPath: string) => {
    const serialized = serializeAsJSON(
      elements,
      appState as any,
      files,
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
  };

  const deleteServerFile = async (relPath: string) => {
    const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
  };

  const renameServerFile = async (oldRelPath: string, newBaseName: string) => {
    const resGet = await fetch(
      `/api/file?path=${encodeURIComponent(oldRelPath)}&encoding=utf8`,
    );
    if (!resGet.ok) throw new Error(await resGet.text());
    const { content } = await resGet.json();
    const parts = oldRelPath.split("/");
    parts.pop();
    const dir = parts.join("/");
    const final = newBaseName.endsWith(".excalidraw")
      ? newBaseName
      : `${newBaseName}.excalidraw`;
    const newRelPath = `${dir}/${final}`;
    await saveAt(newRelPath);
    await deleteServerFile(oldRelPath);
  };

  const handleSave = () => setPickerOpen(true);
  const handleConfirmSave = async () => {
    try {
      const base = (fileName || "").trim();
      if (!base) throw new Error("Please enter a file name");
      const final = base.endsWith(".excalidraw") ? base : `${base}.excalidraw`;
      await saveAt(`${cwd}/${final}`);
      setPickerOpen(false);
      onSuccess();
    } catch (err: any) {
      onError(new Error(err?.message || "Failed to save"));
    }
  };

  return (
    <Card color="primary">
      <div className="Card-icon">💾</div>
      <h2>Save to Server</h2>
      <div className="Card-details">
        Save into the drawings/ folder on the server.
      </div>
      <ToolButton
        className="Card-button"
        type="button"
        aria-label="Save to Server"
        onClick={handleSave}
        style={{
          padding: "10px 10px",
          color: "#fff",
          borderRadius: 8,
          minWidth: 92,
        }}
      >
        Save
      </ToolButton>
      {pickerOpen && (
        <Dialog onCloseRequest={() => setPickerOpen(false)} title={false} size="wide">
          <button
            className="Dialog__close"
            onClick={() => setPickerOpen(false)}
            title="Close"
            aria-label="Close"
            type="button"
          >
            {CloseIcon}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong>Save to Server</strong>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="ToolIcon_type_button" onClick={navigateUp} disabled={cwd === "drawings"}>
                <span style={{ width: 18, height: 18, display: "inline-flex", transform: "rotate(180deg)" }}>{ArrowIcon}</span>
              </button>
              <span style={{ opacity: 0.7 }}>cwd: {cwd}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <label htmlFor="server-save-filename">File name</label>
            <input
              id="server-save-filename"
              type="text"
              placeholder="drawing.excalidraw"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              style={{ flex: 1 }}
            />
            <ToolButton
              className="Card-button"
              type="button"
              aria-label={willOverwrite ? "Overwrite" : "Save"}
              onClick={handleConfirmSave}
              disabled={!fileName.trim()}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  display: "inline-flex",
                  color: willOverwrite ? "var(--color-danger-color)" : undefined,
                }}
              >
                {save}
              </span>
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
                      if (isRenaming) return;
                      if (isDir) setCwd(it.path);
                      else setFileName(it.name);
                    }}
                    title={it.path}
                  >
                    <span
                      style={{
                        display: isRenaming ? "none" : undefined,
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
                        minWidth: 0,
                      }}
                    >
                      {!isRenaming && (
                        <span style={{ opacity: 0.6 }}>
                          {isDir ? "dir" : `${it.size ?? 0} B`}
                        </span>
                      )}
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
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await renameServerFile(it.path, renameValue);
                                setRenaming(null);
                                loadList();
                              } catch (err: any) {
                                setError(err?.message || "Failed to rename");
                              }
                            }}
                            title="Save name"
                            aria-label="Save name"
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
                            title="Cancel rename"
                            aria-label="Cancel rename"
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
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    `Delete file "${it.name}"? This cannot be undone.`,
                                  )
                                ) {
                                  try {
                                    await deleteServerFile(it.path);
                                    loadList();
                                  } catch (err: any) {
                                    setError(err?.message || "Failed to delete");
                                  }
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
        </Dialog>
      )}
    </Card>
  );
};
