import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface SshTerminalProps {
  sessionId: string;
  deviceId: number;
}

export function SshTerminal({ sessionId, deviceId }: SshTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 13,
      scrollback: 20000,
      convertEol: true,
      smoothScrollDuration: 100,
      theme: {
        background: "#0B0F17",
        foreground: "#E5E9F0",
        cursor: "#3B82F6"
      },
      cursorBlink: true,
      rightClickSelectsWord: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    setTimeout(() => {
      try {
        fitAddon.fit();
        if (term.cols && term.rows) {
          window.electronAPI.ssh.resize(sessionId, term.cols, term.rows);
        }
      } catch {
        // ignore
      }
    }, 100);
    termRef.current = term;

    // Klavye kısayolları (Ctrl+C / Ctrl+V / Ctrl+Shift+C / Ctrl+Shift+V)
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== "keydown") return true;

      // Ctrl+C veya Ctrl+Shift+C
      if ((event.ctrlKey || event.metaKey) && (event.key === "c" || event.key === "C")) {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection());
          return false; // Terminal de sıfırlama sinyali göndermesin
        }
      }

      // Ctrl+V veya Ctrl+Shift+V
      if ((event.ctrlKey || event.metaKey) && (event.key === "v" || event.key === "V")) {
        navigator.clipboard.readText().then((text) => {
          if (text) window.electronAPI.ssh.write(sessionId, text);
        });
        return false;
      }

      return true;
    });

    // Seçim değiştiğinde panoya kopyalama
    term.onSelectionChange(() => {
      const selection = term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

    // Sağ Tık İşleyicisi: Seçim varsa kopyala, yoksa yapıştır
    const el = containerRef.current;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (term.hasSelection()) {
        const text = term.getSelection();
        navigator.clipboard.writeText(text).catch(() => {});
      } else {
        navigator.clipboard.readText().then((text) => {
          if (text) window.electronAPI.ssh.write(sessionId, text);
        }).catch(() => {});
      }
    };
    el.addEventListener("contextmenu", handleContextMenu);

    term.onData((data) => {
      window.electronAPI.ssh.write(sessionId, data);
    });

    const offData = window.electronAPI.ssh.onData((sid, data) => {
      if (sid === sessionId) term.write(data);
    });

    const offError = window.electronAPI.ssh.onError((sid, message) => {
      if (sid === sessionId) term.write(`\r\n\x1b[31m[Bağlantı hatası] ${message}\x1b[0m\r\n`);
    });

    window.electronAPI.ssh.connect(deviceId, sessionId).catch((err: Error) => {
      term.write(`\r\n\x1b[31m[Bağlanılamadı] ${err.message}\x1b[0m\r\n`);
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (term.cols && term.rows) {
          window.electronAPI.ssh.resize(sessionId, term.cols, term.rows);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(handleResize);
    });
    if (el) resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleResize);
      offData();
      offError();
      window.electronAPI.ssh.disconnect(sessionId);
      term.dispose();
    };
  }, [sessionId, deviceId]);

  return <div ref={containerRef} className="h-full w-full p-2 select-text" />;
}
