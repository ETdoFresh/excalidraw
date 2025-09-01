import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import {
  downloadIcon,
  LibraryIcon,
  TrashIcon,
  save,
  CloseIcon,
  FreedrawIcon,
  ArrowIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { fileOpen } from "@excalidraw/excalidraw/data/filesystem";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { restore } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  importUsernameFromLocalStorage,
  saveUsernameToLocalStorage,
} from "../data/localStorage";

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
  const [username, setUsername] = useState<string | null>(
    importUsernameFromLocalStorage(),
  );
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [editUser, setEditUser] = useState<boolean>(false);
  const rootCwd = useMemo(
    () => (username ? `drawings/${username}` : "drawings"),
    [username],
  );
  const [cwd, setCwd] = useState<string>(rootCwd);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [sortKey, setSortKey] = useState<"name" | "date_desc" | "date_asc">(
    "name",
  );

  useEffect(() => {
    if (!isOpen) {
      setMode("root");
      setCwd(rootCwd);
      setItems([]);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, rootCwd]);

  useEffect(() => {
    if (editUser && username && !usernameInput) {
      setUsernameInput(username);
    }
  }, [editUser, username, usernameInput]);

  const ensureUserDir = useCallback(async () => {
    if (!username) {
      return;
    }
    try {
      await fetch("/api/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `drawings/${username}` }),
      });
    } catch {
      // ignore errors, will be created on write if needed
    }
  }, [username]);

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
    if (isOpen && mode === "server" && username) {
      ensureUserDir();
      loadList();
    }
  }, [isOpen, mode, username, ensureUserDir, loadList]);

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
    if (cwd === rootCwd) {
      return;
    }
    const parts = cwd.split("/");
    parts.pop();
    const next = parts.join("/") || rootCwd;
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
              style={{
                padding: "10px 10px",
                color: "#fff",
                borderRadius: 8,
                minWidth: 92,
              }}
            >
              Open from File
            </ToolButton>
          </Card>
          <Card color="primary">
            <div className="Card-icon">{LibraryIcon}</div>
            <h2>Open from Server</h2>
            <div className="Card-details">
              Browse your drawings folder on server.
            </div>
            <ToolButton
              className="Card-button"
              type="button"
              aria-label="Browse server"
              onClick={() => setMode("server")}
              style={{
                padding: "10px 10px",
                color: "#fff",
                borderRadius: 8,
                minWidth: 92,
              }}
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
          {(!username || editUser) && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label htmlFor="open-username" style={{ opacity: 0.8 }}>
                Username
              </label>
              <input
                id="open-username"
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
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Server Browser</strong>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="open-sort" style={{ opacity: 0.7 }}>
                Sort
              </label>
              <select
                id="open-sort"
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
              <button
                className="ToolIcon_type_button"
                onClick={() => setEditUser((v) => !v)}
                type="button"
                aria-label="Change user"
                title="Change user"
              >
                <span style={{ width: 18, height: 18, display: "inline-flex" }}>
                  {usersIcon}
                </span>
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              className="ToolIcon_type_button"
              onClick={navigateUp}
              disabled={cwd === rootCwd}
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
            {!username ? (
              <div style={{ opacity: 0.8 }}>
                Enter a username to browse your folder.
              </div>
            ) : loading ? (
              <div>Loading…</div>
            ) : (
              sortedItems.map((it) => {
                const isDir = it.type === "dir";
                const isExcal =
                  !isDir && it.name.toLowerCase().endsWith(".excalidraw");
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
                      opacity: isDir || isExcal ? 1 : 0.5,
                    }}
                    onClick={() => {
                      if (isRenaming) {
                        return;
                      }
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
                        flex: isRenaming ? 1 : undefined,
                        justifyContent: isRenaming ? "flex-start" : undefined,
                      }}
                    >
                      {!isDir && isRenaming ? (
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
                        <>
                          {!isRenaming && (
                            <span style={{ opacity: 0.6 }}>
                              {isDir ? "dir" : `${it.size ?? 0} B`}
                            </span>
                          )}
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
