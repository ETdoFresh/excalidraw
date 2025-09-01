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
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import {
  importUsernameFromLocalStorage,
  saveUsernameToLocalStorage,
} from "../data/localStorage";

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
  const [username, setUsername] = useState<string | null>(
    importUsernameFromLocalStorage(),
  );
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [editUser, setEditUser] = useState<boolean>(false);
  const rootCwd = useMemo(
    () => (username ? `drawings/${username}` : "drawings"),
    [username],
  );
  const defaultName = useMemo(() => {
    return name && name.endsWith(".excalidraw")
      ? name
      : `${name || "excalidraw-drawing"}.excalidraw`;
  }, [name]);
  const [fileName, setFileName] = useState<string>(defaultName);
  const [cwd, setCwd] = useState<string>(rootCwd);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const willOverwrite = useMemo(() => {
    const base = (fileName || "").trim();
    if (!base) {
      return false;
    }
    const final = base.endsWith(".excalidraw") ? base : `${base}.excalidraw`;
    return items.some(
      (it) =>
        it.type === "file" && it.name.toLowerCase() === final.toLowerCase(),
    );
  }, [items, fileName]);

  const ensureUserDir = useCallback(async () => {
    if (!username) return;
    try {
      await fetch("/api/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `drawings/${username}` }),
      });
    } catch {
      // ignore; server will create on write anyway
    }
  }, [username]);

  useEffect(() => {
    if (pickerOpen) {
      setFileName(defaultName);
      setCwd(rootCwd);
      if (username) {
        ensureUserDir();
      }
    }
  }, [pickerOpen, defaultName, rootCwd, username, ensureUserDir]);

  useEffect(() => {
    if (editUser && username && !usernameInput) {
      setUsernameInput(username);
    }
  }, [editUser, username]);

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
    if (pickerOpen && username) {
      loadList();
    }
  }, [pickerOpen, username, loadList]);

  const navigateUp = () => {
    if (cwd === rootCwd) {
      return;
    }
    const parts = cwd.split("/");
    parts.pop();
    setCwd(parts.join("/") || rootCwd);
  };

  const saveAt = async (relPath: string, contentOverride?: string) => {
    const serialized =
      contentOverride ??
      serializeAsJSON(elements, appState as any, files, "local");
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
    if (!resGet.ok) {
      throw new Error(await resGet.text());
    }
    const { content } = await resGet.json();
    const parts = oldRelPath.split("/");
    parts.pop();
    const dir = parts.join("/");
    const final = newBaseName.endsWith(".excalidraw")
      ? newBaseName
      : `${newBaseName}.excalidraw`;
    const newRelPath = `${dir}/${final}`;
    await saveAt(newRelPath, content);
    await deleteServerFile(oldRelPath);
  };

  const handleSave = () => setPickerOpen(true);
  const handleConfirmSave = async () => {
    try {
      if (!username) {
        throw new Error("Please set a username first");
      }
      const base = (fileName || "").trim();
      if (!base) {
        throw new Error("Please enter a file name");
      }
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
      <div className="Card-details">Save into your drawings folder on the server.</div>
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
        <Dialog
          onCloseRequest={() => setPickerOpen(false)}
          title={false}
          size="wide"
        >
          <button
            className="Dialog__close"
            onClick={() => setPickerOpen(false)}
            title="Close"
            aria-label="Close"
            type="button"
          >
            {CloseIcon}
          </button>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <strong>Save to Server</strong>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="ToolIcon_type_button"
                onClick={navigateUp}
                disabled={cwd === rootCwd}
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
              <button
                className="ToolIcon_type_button"
                onClick={() => setEditUser((v) => !v)}
                title="Change user"
                aria-label="Change user"
              >
                <span style={{ width: 18, height: 18, display: "inline-flex" }}>
                  {usersIcon}
                </span>
              </button>
              <span style={{ opacity: 0.7 }}>cwd: {cwd}</span>
            </div>
          </div>
          {(!username || editUser) && (
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                margin: "8px 0",
              }}
            >
              <label htmlFor="server-save-username">Username</label>
              <input
                id="server-save-username"
                type="text"
                placeholder="your-name"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                style={{ flex: 1 }}
              />
              <ToolButton
                className="Card-button"
                type="button"
                aria-label="Set username"
                onClick={async () => {
                  const value = usernameInput.trim();
                  if (!value) {
                    setError("Please enter a username");
                    return;
                  }
                  if (/[\\/]/.test(value)) {
                    setError("Username cannot contain / or \\ characters");
                    return;
                  }
                  saveUsernameToLocalStorage(value);
                  setUsername(value);
                  setCwd(`drawings/${value}`);
                  try {
                    await fetch("/api/directory", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ path: `drawings/${value}` }),
                    });
                  } catch {}
                  setError(null);
                  setEditUser(false);
                }}
                disabled={!usernameInput.trim()}
              >
                Set
              </ToolButton>
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
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
              disabled={!fileName.trim() || !username}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  display: "inline-flex",
                  color: willOverwrite
                    ? "var(--color-danger-color)"
                    : undefined,
                }}
              >
                {save}
              </span>
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
            {!username ? (
              <div style={{ opacity: 0.8 }}>
                Enter a username to browse your folder.
              </div>
            ) : loading ? (
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
                      if (isRenaming) {
                        return;
                      }
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
                                    setError(
                                      err?.message || "Failed to delete",
                                    );
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
