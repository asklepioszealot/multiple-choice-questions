import { escapeMarkup } from "../../shared/utils.js";

const TOOLBAR_ACTIONS = Object.freeze([
  { id: "undo", label: "Geri al" },
  { id: "redo", label: "İleri al" },
  { id: "bold", label: "B" },
  { id: "italic", label: "I" },
  { id: "critical", label: "!!" },
  { id: "warning", label: "Uyarı" },
  { id: "quote", label: "Alıntı" },
  { id: "bulletList", label: "Liste" },
  { id: "numberList", label: "1. Liste" },
  { id: "link", label: "Link" },
  { id: "code", label: "Kod" },
  { id: "divider", label: "Ayraç" },
  { id: "table", label: "Tablo" },
  { id: "attachment-image", label: "Görsel" },
  { id: "attachment-audio", label: "Ses" },
]);

function normalizeSelectionRange(textValue, selectionStart, selectionEnd) {
  const textLength = String(textValue || "").length;
  const safeStart = Number.isInteger(selectionStart)
    ? Math.max(0, Math.min(selectionStart, textLength))
    : textLength;
  const safeEnd = Number.isInteger(selectionEnd)
    ? Math.max(safeStart, Math.min(selectionEnd, textLength))
    : safeStart;

  return {
    end: safeEnd,
    start: safeStart,
  };
}

function insertTextAtSelection(textValue, replacement, options = {}) {
  const currentText = String(textValue || "");
  const { start, end } = normalizeSelectionRange(
    currentText,
    options.selectionStart,
    options.selectionEnd,
  );
  const prefix = start > 0 && /\S/.test(currentText[start - 1] || "") ? " " : "";
  const suffix = end < currentText.length && /\S/.test(currentText[end] || "") ? " " : "";
  const insertedText = `${prefix}${String(replacement || "")}${suffix}`;
  const nextValue = `${currentText.slice(0, start)}${insertedText}${currentText.slice(end)}`;
  const selectionOffsetStart = Number.isFinite(options.selectionOffsetStart)
    ? options.selectionOffsetStart
    : insertedText.length;
  const selectionOffsetEnd = Number.isFinite(options.selectionOffsetEnd)
    ? options.selectionOffsetEnd
    : selectionOffsetStart;
  const baseSelectionStart = start + prefix.length;

  return {
    selectionEnd: baseSelectionStart + selectionOffsetEnd,
    selectionStart: baseSelectionStart + selectionOffsetStart,
    value: nextValue,
  };
}

function buildMediaTokenTemplate(action = "attachment-image") {
  if (action === "attachment-audio") {
    const token = "![audio: Ses kaydı](https://example.com/ses.mp3)";
    const urlStart = token.indexOf("https://");
    return {
      token,
      selectionEnd: token.length - 1,
      selectionStart: urlStart,
    };
  }

  const token = "![Görsel açıklaması](https://example.com/gorsel.png)";
  const urlStart = token.indexOf("https://");
  return {
    token,
    selectionEnd: token.length - 1,
    selectionStart: urlStart,
  };
}

function buildFormattingTokenTemplate(action = "bold", selectedText = "") {
  const normalizedSelection = String(selectedText || "").trim();

  if (action === "critical") {
    const innerText = normalizedSelection || "kritik bilgi";
    const token = `==${innerText}==`;
    return {
      token,
      selectionEnd: token.length - 2,
      selectionStart: 2,
    };
  }

  if (action === "warning") {
    const innerText = normalizedSelection || "Dikkat notu";
    const token = `> ⚠️ ${innerText}`;
    return {
      token,
      selectionEnd: token.length,
      selectionStart: 5,
    };
  }

  if (action === "italic") {
    const innerText = normalizedSelection || "italik metin";
    const token = `*${innerText}*`;
    return {
      token,
      selectionEnd: token.length - 1,
      selectionStart: 1,
    };
  }

  if (action === "quote") {
    const innerText = normalizedSelection || "Alıntı veya not";
    const token = `> ${innerText}`;
    return {
      token,
      selectionEnd: token.length,
      selectionStart: 2,
    };
  }

  if (action === "bulletList") {
    const lines = (normalizedSelection || "Liste maddesi")
      .split("\n")
      .map((line) => line.trim() || "Liste maddesi");
    const token = lines.map((line) => `- ${line}`).join("\n");
    return {
      token,
      selectionEnd: token.length,
      selectionStart: 2,
    };
  }

  if (action === "numberList") {
    const lines = (normalizedSelection || "Liste maddesi")
      .split("\n")
      .map((line) => line.trim() || "Liste maddesi");
    const token = lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
    return {
      token,
      selectionEnd: token.length,
      selectionStart: 3,
    };
  }

  if (action === "link") {
    const label = normalizedSelection || "baglanti metni";
    const token = `[${label}](https://example.com)`;
    const urlStart = token.indexOf("https://");
    return {
      token,
      selectionEnd: urlStart + "https://example.com".length,
      selectionStart: urlStart,
    };
  }

  if (action === "code") {
    const codeText = normalizedSelection || "kod";
    if (codeText.includes("\n")) {
      const token = `\`\`\`\n${codeText}\n\`\`\``;
      return {
        token,
        selectionEnd: 4 + codeText.length,
        selectionStart: 4,
      };
    }

    const token = `\`${codeText}\``;
    return {
      token,
      selectionEnd: token.length - 1,
      selectionStart: 1,
    };
  }

  if (action === "divider") {
    const token = "\n\n---\n\n";
    return {
      token,
      selectionEnd: token.length,
      selectionStart: token.length,
    };
  }

  if (action === "table") {
    const token = "| Başlık | Değer |\n| --- | --- |\n| Satır | Açıklama |";
    const selectionStart = token.indexOf("Başlık");
    return {
      token,
      selectionEnd: selectionStart + "Başlık".length,
      selectionStart,
    };
  }

  const innerText = normalizedSelection || "kalin metin";
  const token = `**${innerText}**`;
  return {
    token,
    selectionEnd: token.length - 2,
    selectionStart: 2,
  };
}

export function buildEditorToolbarActions() {
  return TOOLBAR_ACTIONS.map((action) => ({ ...action }));
}

export function renderEditorToolbarMarkup({
  actions = buildEditorToolbarActions(),
  disabled = false,
  disabledActionIds = [],
  field = "question",
} = {}) {
  const fieldName = field === "explanation" ? "explanation" : "question";
  const ariaLabel =
    fieldName === "explanation"
      ? "Açıklama biçimlendirme araçları"
      : "Soru biçimlendirme araçları";
  const disabledIds = new Set(
    Array.isArray(disabledActionIds) ? disabledActionIds : [],
  );

  return `
    <div class="editor-toolbar" role="toolbar" aria-label="${escapeMarkup(ariaLabel)}">
      ${actions
        .map((action) => {
          const buttonDisabled = disabled || disabledIds.has(action.id);
          return `
            <button
              class="btn btn-secondary btn-small"
              type="button"
              data-editor-toolbar-action="${escapeMarkup(action.id)}"
              data-editor-toolbar-field="${escapeMarkup(fieldName)}"
              ${buttonDisabled ? "disabled" : ""}
            >
              ${escapeMarkup(action.label)}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

export function applyEditorToolbarAction(textValue, action, options = {}) {
  if (action === "undo" || action === "redo") {
    const currentText = String(textValue || "");
    const caret = Number.isInteger(options.selectionStart)
      ? options.selectionStart
      : currentText.length;
    return {
      selectionEnd: caret,
      selectionStart: caret,
      value: currentText,
    };
  }

  if (action === "attachment-image" || action === "attachment-audio") {
    const template = buildMediaTokenTemplate(action);
    return insertTextAtSelection(textValue, template.token, {
      ...options,
      selectionOffsetEnd: template.selectionEnd,
      selectionOffsetStart: template.selectionStart,
    });
  }

  const currentText = String(textValue || "");
  const { start, end } = normalizeSelectionRange(
    currentText,
    options.selectionStart,
    options.selectionEnd,
  );
  const selectedText = currentText.slice(start, end);
  const template = buildFormattingTokenTemplate(action, selectedText);

  return insertTextAtSelection(currentText, template.token, {
    ...options,
    selectionOffsetEnd: template.selectionEnd,
    selectionOffsetStart: template.selectionStart,
  });
}
