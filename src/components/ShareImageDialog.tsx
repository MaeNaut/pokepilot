import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faDownload,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toBlob } from "html-to-image";

type ShareImageDialogProps = {
  title: string;
  fileName: string;
  children: ReactNode;
  onClose: () => void;
};

type ShareAction = "copy" | "save" | null;

function normalizePngFileName(value: string) {
  const normalized = value
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${normalized || "pokepilot-image"}.png`;
}

function waitForImage(image: HTMLImageElement) {
  if (image.complete) {
    return image.decode?.().catch(() => undefined) ?? Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let timeoutId = 0;
    const finish = () => {
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };

    timeoutId = window.setTimeout(finish, 4000);
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });
}

export function ShareImageDialog({
  title,
  fileName,
  children,
  onClose,
}: ShareImageDialogProps) {
  const captureRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [activeAction, setActiveAction] = useState<ShareAction>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function createImageBlob() {
    const node = captureRef.current;

    if (!node) {
      throw new Error("The image preview is not ready yet.");
    }

    await document.fonts?.ready;
    await Promise.all(Array.from(node.querySelectorAll("img")).map(waitForImage));

    const blob = await toBlob(node, {
      backgroundColor: "#eef0f2",
      pixelRatio: 2,
    });

    if (!blob) {
      throw new Error("The image could not be rendered.");
    }

    return blob;
  }

  async function copyImage() {
    setActiveAction("copy");
    setMessage(null);

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Image copy is not supported by this browser.");
      }

      const blob = await createImageBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMessage("Image copied to clipboard.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image copy failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function saveImage() {
    setActiveAction("save");
    setMessage(null);

    try {
      const blob = await createImageBlob();
      const imageUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = imageUrl;
      link.download = normalizePngFileName(fileName);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
      setMessage("PNG saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image export failed.");
    } finally {
      setActiveAction(null);
    }
  }

  return createPortal(
    <div
      className="share-image-overlay"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="share-image-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="share-image-dialog-header">
          <div>
            <strong>{title}</strong>
            <span>1080 x 1080 PNG</span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close image preview"
            title="Close"
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        </header>

        <div className="share-image-preview">
          <div className="share-image-capture" ref={captureRef}>
            {children}
          </div>
        </div>

        <footer className="share-image-dialog-footer">
          <span className="share-image-message" role="status" aria-live="polite">
            {message}
          </span>
          <div className="share-image-actions">
            <button
              type="button"
              disabled={activeAction !== null}
              onClick={() => void copyImage()}
            >
              <FontAwesomeIcon
                className={activeAction === "copy" ? "is-spinning" : undefined}
                icon={activeAction === "copy" ? faSpinner : faCopy}
                aria-hidden="true"
              />
              {activeAction === "copy" ? "Copying..." : "Copy Image"}
            </button>
            <button
              className="is-primary"
              type="button"
              disabled={activeAction !== null}
              onClick={() => void saveImage()}
            >
              <FontAwesomeIcon
                className={activeAction === "save" ? "is-spinning" : undefined}
                icon={activeAction === "save" ? faSpinner : faDownload}
                aria-hidden="true"
              />
              {activeAction === "save" ? "Saving..." : "Save PNG"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
