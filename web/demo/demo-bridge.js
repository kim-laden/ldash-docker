/*
 * Ldash browser demo bridge.
 *
 * The desktop app gives the board a host bridge (window.laden.call) from
 * host.py. A web page cannot have that, so this file stands in for it with
 * browser-only versions. Nothing here runs programs, reads the disk or talks
 * to the live Laden cloud:
 *
 *  - account calls for https://laden.no/ldash go to this stack's own API
 *    under <page>/ldash/ instead,
 *  - the vault workspace and vault.conf live in this browser's localStorage,
 *  - programs and the open-path button only open web links in a new tab,
 *  - system metrics return null (board shows "–" / not available in the browser); process and window lists stay empty.
 */
(() => {
  "use strict"

  const LIVE_BASE = "https://laden.no/ldash"
  const PAGE_DIR = location.pathname.replace(/[^/]*$/, "")
  const DEMO_BASE = location.origin + PAGE_DIR + "ldash"
  const PREFIX = "ldash-demo:"
  const DEMO_USER = "demo"
  const DESKTOP_ONLY = "Desktop app only. Get Ldash at laden.no/downloads/dash/"
  const xfer = new Map()
  let seq = 0

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key)
        return raw == null ? fallback : JSON.parse(raw)
      } catch (err) {
        return fallback
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value))
        return true
      } catch (err) {
        return false
      }
    },
  }

  function cleanRel(rel) {
    const raw = String(rel || "").replace(/\\/g, "/")
    if (raw.includes("..") || raw.startsWith("/")) throw new Error("path escapes vault workspace")
    return raw.replace(/[^A-Za-z0-9_./-]+/g, "_").replace(/^\/+|\/+$/g, "").slice(0, 180) || "_root"
  }

  function cleanName(name, fallback) {
    const base = String(name || fallback).split(/[\\/]/).pop()
    return base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+|[._]+$/g, "").slice(0, 80) || fallback
  }

  function putFile(rel, filename, entry) {
    const files = store.get("files", {})
    const dir = cleanRel(rel)
    const key = dir + "/" + filename
    files[key] = Object.assign({ at: new Date().toISOString() }, entry)
    if (!store.set("files", files)) return { ok: false, error: "This browser's storage is full. The demo keeps files in localStorage (a few MB)." }
    return { ok: true, path: "browser:/vault/" + key }
  }

  function ensureDir(rel) {
    const dir = cleanRel(rel)
    const dirs = store.get("dirs", [])
    if (!dirs.includes(dir)) {
      dirs.push(dir)
      store.set("dirs", dirs)
    }
    return { ok: true, path: "browser:/vault/" + dir }
  }

  function firstUrl(text) {
    const match = String(text || "").match(/https?:\/\/[^\s"']+/)
    return match ? match[0] : ""
  }

  function openUrl(url) {
    window.open(url, "_blank", "noopener")
    return { ok: true }
  }

  function demoAccountUrl(url) {
    const target = String(url || "").trim()
    if (target === LIVE_BASE || target.startsWith(LIVE_BASE + "/")) return DEMO_BASE + target.slice(LIVE_BASE.length)
    if (target.startsWith(location.origin + "/")) return target
    return ""
  }

  function newToken(item) {
    const token = (++seq).toString(16) + Math.random().toString(16).slice(2, 10)
    xfer.set(token, Object.assign({ parts: [], size: 0 }, item))
    return token
  }

  function bytesToB64(text) {
    return btoa(unescape(encodeURIComponent(String(text || ""))))
  }

  async function httpFetch(url) {
    const target = String(url || "").trim()
    if (!/^https?:\/\//.test(target)) return { ok: false, error: "only http(s) URLs" }
    try {
      const res = await fetch(target, { headers: { Accept: "application/json, text/plain" } })
      const text = await res.text()
      let body
      try {
        body = JSON.parse(text)
      } catch (err) {
        body = text.slice(0, 4000)
      }
      return { ok: true, status: res.status, body }
    } catch (err) {
      return { ok: false, error: "The browser could not fetch that URL (offline or no CORS)." }
    }
  }

  async function accountFetch(params) {
    const url = demoAccountUrl(params.url)
    if (!url) return { ok: false, error: "The browser demo only talks to its own demo API." }
    const verb = String(params.method || "GET").toUpperCase()
    if (!["GET", "POST", "PUT"].includes(verb)) return { ok: false, error: "method not allowed" }
    const headers = { Accept: "application/json, text/plain" }
    if (params.token) headers.Authorization = "Bearer " + String(params.token)
    const init = { method: verb, headers, cache: "no-store" }
    if (verb !== "GET") {
      headers["Content-Type"] = "text/plain; charset=utf-8"
      init.body = String(params.body || "")
    }
    try {
      const res = await fetch(url, init)
      return { ok: true, status: res.status, body: await res.text() }
    } catch (err) {
      return { ok: false, error: "Could not reach the cloud copy" }
    }
  }

  function download(text, filename) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    setTimeout(() => {
      URL.revokeObjectURL(link.href)
      link.remove()
    }, 1000)
  }

  const methods = {
    shortcut: () => ({ ok: true, shortcut: store.get("shortcut", "Ctrl+`"), backend: "browser", platform: "android" }),
    setShortcut: (p) => {
      store.set("shortcut", String(p.shortcut || "Ctrl+`"))
      return { ok: true, note: "The global shortcut is a desktop feature." }
    },
    pauseMode: () => ({ ok: true, enabled: !!store.get("pauseMode", false) }),
    setPauseMode: (p) => {
      store.set("pauseMode", !!p.enabled)
      return { ok: true, enabled: !!p.enabled }
    },
    localUser: () => ({ ok: true, username: DEMO_USER, homedir: "browser:/", uid: 1000 }),
    // No PAM in a browser. Same rule as the desktop fallback: the username.
    verifyPassword: (p) => ({ ok: String(p.password || "") === DEMO_USER, method: "username-fallback" }),
    // No host bridge in the browser. Return ok with null metrics so the board
    // shows "–" instead of an error banner. Temps stay null; never invent numbers.
    system: () => ({
      ok: true,
      hostname: "browser",
      cpuCount: null,
      cpuPct: null,
      cpuTempC: null,
      memTotal: null,
      memUsed: null,
      memPct: null,
      load1: null,
      load5: null,
      load15: null,
      gpuPct: null,
      gpuTempC: null,
      browser: true,
      note: "Not available in the browser",
    }),
    processes: () => ({ ok: true, groups: [] }),
    windows: () => ({ ok: true, windows: [] }),
    watchApp: () => ({ ok: false, error: DESKTOP_ONLY }),
    launch: (p) => {
      const url = firstUrl(p.command)
      return url ? openUrl(url) : { ok: false, error: DESKTOP_ONLY }
    },
    openPath: (p) => {
      const url = firstUrl(p.path)
      return url ? openUrl(url) : { ok: false, error: DESKTOP_ONLY }
    },
    openTerminal: () => ({ ok: false, error: DESKTOP_ONLY }),
    fetch: (p) => httpFetch(p.url),
    accountFetch: (p) => accountFetch(p),
    aiChat: () => ({ ok: false, error: "AI chat is off in the browser demo. Your key would have to go through the page. Use the desktop app." }),
    exportCasePdf: () => ({ ok: false, error: "PDF export is a desktop feature." }),
    exportBudgetPdf: () => ({ ok: false, error: "PDF export is a desktop feature." }),
    prepareUserFolder: (p) => {
      const mail = String(p.email || "").trim()
      const name = String(p.username || "").trim()
      if (!mail.includes("@") || mail.length > 120) return { ok: false, error: "Need an email address" }
      if (!name || name.length > 32) return { ok: false, error: "Need a username" }
      for (const folder of ["legal", "credentials", "engagements"]) ensureDir(folder)
      store.set("account", { product: "Ldash", version: "1.0.0", email: mail, username: name, createdAt: new Date().toISOString() })
      return { ok: true, path: "browser:/", vault: "browser:/vault" }
    },
    saveKit: (p) => (store.set("kit", String(p.json || "")) ? { ok: true } : { ok: false, error: "Could not write the kit" }),
    saveVaultConf: (p) => (store.set("vault.conf", String(p.text || "")) ? { ok: true, path: "browser:/vault.conf" } : { ok: false, error: "Could not write vault.conf (browser storage full)" }),
    loadVaultConf: () => {
      const text = store.get("vault.conf", "")
      return text ? { ok: true, exists: true, text } : { ok: true, exists: false }
    },
    vaultEnsureDir: (p) => {
      try {
        return ensureDir(p.rel)
      } catch (err) {
        return { ok: false, error: err.message }
      }
    },
    vaultWriteNote: (p) => {
      try {
        const name = String(p.filename || "note.md").replace(/[^\w.-]+/g, "_").slice(0, 80) || "note.md"
        return putFile(p.rel, name, { b64: bytesToB64(p.body) })
      } catch (err) {
        return { ok: false, error: err.message }
      }
    },
    vaultWriteFile: (p) => {
      try {
        const data = String(p.data || "")
        if (data.length > 12000000) return { ok: false, error: "file is over 8 MB" }
        return putFile(p.rel, cleanName(p.filename, "file"), { b64: data })
      } catch (err) {
        return { ok: false, error: err.message }
      }
    },
    vaultReadOpen: (p) => {
      let key
      try {
        key = cleanRel(p.rel) + "/" + cleanName(p.filename, "file")
      } catch (err) {
        return { ok: false, error: err.message }
      }
      const entry = store.get("files", {})[key]
      if (!entry) return { ok: false, error: "file not found" }
      const data = String(entry.b64 || "")
      return { ok: true, token: newToken({ kind: "read", data }), length: data.length }
    },
    vaultReadChunk: (p) => {
      const item = xfer.get(String(p.token || ""))
      if (!item || item.kind !== "read") return { ok: false, error: "transfer expired" }
      const start = Math.max(0, Number(p.offset) || 0)
      const chunk = item.data.slice(start, start + 240000)
      const next = start + chunk.length
      const done = next >= item.data.length
      if (done) xfer.delete(String(p.token))
      return { ok: true, data: chunk, next, done }
    },
    vaultWriteOpen: (p) => ({ ok: true, token: newToken({ kind: "write", rel: String(p.rel || ""), filename: String(p.filename || "file") }) }),
    vaultWriteChunk: (p) => {
      const item = xfer.get(String(p.token || ""))
      if (!item || item.kind !== "write") return { ok: false, error: "transfer expired" }
      const piece = String(p.data || "")
      item.size += piece.length
      if (item.size > 12000000) {
        xfer.delete(String(p.token))
        return { ok: false, error: "file is over 8 MB" }
      }
      item.parts.push(piece)
      return { ok: true }
    },
    vaultWriteFinish: (p) => {
      const item = xfer.get(String(p.token || ""))
      xfer.delete(String(p.token || ""))
      if (!item || item.kind !== "write") return { ok: false, error: "transfer expired" }
      return methods.vaultWriteFile({ rel: item.rel, filename: item.filename, data: item.parts.join("") })
    },
    saveTextOpen: (p) => ({ ok: true, token: newToken({ kind: "text", filename: cleanName(p.filename, "laden.vault.conf") }) }),
    saveTextChunk: (p) => {
      const item = xfer.get(String(p.token || ""))
      if (!item || item.kind !== "text") return { ok: false, error: "transfer expired" }
      item.parts.push(String(p.data || ""))
      return { ok: true }
    },
    saveTextFinish: (p) => {
      const item = xfer.get(String(p.token || ""))
      xfer.delete(String(p.token || ""))
      if (!item || item.kind !== "text") return { ok: false, error: "transfer expired" }
      download(item.parts.join(""), item.filename)
      return { ok: true, path: "Downloads/" + item.filename }
    },
    dragWindow: () => ({ ok: true }),
    hide: () => ({ ok: true }),
    quit: () => ({ ok: true }),
  }

  window.laden = {
    demo: true,
    async call(method, params) {
      const fn = methods[method]
      if (!fn) return { ok: false, error: `unknown method ${method}` }
      try {
        return await fn(params || {})
      } catch (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) }
      }
    },
  }
})()
