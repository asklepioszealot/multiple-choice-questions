// src/core/set-codec.js

import { sanitizeMediaSource } from "./security.js";

const EDITABLE_MEDIA_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;
const OBSIDIAN_MEDIA_PATTERN = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const AUDIO_MEDIA_LABEL_PATTERN = /^(audio|ses)\s*:\s*/i;
const MARKDOWN_LINK_PATTERN = /(?<!!)\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
const MATH_SYMBOLS = new Map([
  ["alpha", "α"],
  ["beta", "β"],
  ["gamma", "γ"],
  ["delta", "δ"],
  ["Delta", "Δ"],
  ["epsilon", "ε"],
  ["theta", "θ"],
  ["lambda", "λ"],
  ["mu", "μ"],
  ["pi", "π"],
  ["rho", "ρ"],
  ["sigma", "σ"],
  ["Sigma", "Σ"],
  ["tau", "τ"],
  ["phi", "φ"],
  ["omega", "ω"],
  ["Omega", "Ω"],
  ["times", "×"],
  ["cdot", "·"],
  ["pm", "±"],
  ["le", "≤"],
  ["leq", "≤"],
  ["ge", "≥"],
  ["geq", "≥"],
  ["neq", "≠"],
  ["approx", "≈"],
  ["to", "→"],
  ["rightarrow", "→"],
  ["leftarrow", "←"],
]);

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function decodeHtmlEntities(value) {
    return String(value ?? "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  function escapeHtmlAttribute(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHtmlText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function stashHtmlToken(tokens, html) {
    const placeholder = `__CONTENT_TOKEN_${tokens.length}__`;
    tokens.push(html);
    return placeholder;
  }

  function restoreHtmlTokens(value, tokens) {
    let rendered = String(value ?? "");
    tokens.forEach((token, index) => {
      rendered = rendered.replace(`__CONTENT_TOKEN_${index}__`, token);
    });
    return rendered;
  }

  function sanitizeExternalLink(source) {
    const normalizedSource = decodeHtmlEntities(source).trim();
    if (!/^https?:\/\//i.test(normalizedSource)) {
      return "";
    }

    try {
      const url = new URL(normalizedSource);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function renderMarkdownLink(rawLabel, rawSource) {
    const label = normalizeEditableMediaLabel(rawLabel, "Kaynak");
    const safeSource = sanitizeExternalLink(rawSource);
    if (!safeSource) {
      return escapeHtmlText(label);
    }

    const safeLabel = escapeHtmlText(label);
    const safeHref = escapeHtmlAttribute(safeSource);
    return `<a class="content-link-card" href="${safeHref}" target="_blank" rel="noopener noreferrer"><span class="content-link-card__label">${safeLabel}</span></a>`;
  }

  function readBalancedMathGroup(source, startIndex) {
    let index = startIndex;
    while (source[index] === " ") {
      index += 1;
    }
    if (source[index] !== "{") {
      return null;
    }

    let depth = 0;
    let value = "";
    for (; index < source.length; index += 1) {
      const character = source[index];
      if (character === "{") {
        depth += 1;
        if (depth > 1) {
          value += character;
        }
        continue;
      }
      if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return { endIndex: index + 1, value };
        }
        value += character;
        continue;
      }
      value += character;
    }

    return null;
  }

  function readMathScriptValue(source, startIndex) {
    const group = readBalancedMathGroup(source, startIndex);
    if (group) {
      return group;
    }

    const value = source[startIndex] || "";
    return {
      endIndex: Math.min(startIndex + 1, source.length),
      value,
    };
  }

  function renderMathExpression(source) {
    const rawSource = String(source ?? "");
    let html = "";
    let index = 0;

    while (index < rawSource.length) {
      if (rawSource.startsWith("\\frac", index)) {
        const numerator = readBalancedMathGroup(rawSource, index + 5);
        const denominator = numerator
          ? readBalancedMathGroup(rawSource, numerator.endIndex)
          : null;
        if (numerator && denominator) {
          html += `<span class="math-frac"><span class="math-num">${renderMathExpression(numerator.value)}</span><span class="math-den">${renderMathExpression(denominator.value)}</span></span>`;
          index = denominator.endIndex;
          continue;
        }
      }

      if (rawSource.startsWith("\\text", index)) {
        const textGroup = readBalancedMathGroup(rawSource, index + 5);
        if (textGroup) {
          html += `<span class="math-text">${escapeHtmlText(textGroup.value)}</span>`;
          index = textGroup.endIndex;
          continue;
        }
      }

      const character = rawSource[index];
      if (character === "\\") {
        const commandMatch = rawSource.slice(index + 1).match(/^[A-Za-z]+/);
        if (commandMatch) {
          const command = commandMatch[0];
          html += escapeHtmlText(MATH_SYMBOLS.get(command) || command);
          index += command.length + 1;
          continue;
        }
        html += escapeHtmlText(rawSource[index + 1] || "");
        index += 2;
        continue;
      }

      if (character === "^" || character === "_") {
        const script = readMathScriptValue(rawSource, index + 1);
        const tagName = character === "^" ? "sup" : "sub";
        html += `<${tagName}>${renderMathExpression(script.value)}</${tagName}>`;
        index = script.endIndex;
        continue;
      }

      const identifierMatch = rawSource.slice(index).match(/^[A-Za-z]+/);
      if (identifierMatch) {
        html += `<var>${escapeHtmlText(identifierMatch[0])}</var>`;
        index += identifierMatch[0].length;
        continue;
      }

      html += character.trim() ? escapeHtmlText(character) : " ";
      index += 1;
    }

    return html.replace(/\s{2,}/g, " ");
  }

  function renderMathToken(rawSource, displayMode = "inline") {
    const source = String(rawSource ?? "").trim();
    if (!source) {
      return "";
    }

    const safeSource = escapeHtmlAttribute(source);
    const renderedExpression = renderMathExpression(source);
    const modeClass = displayMode === "block" ? "math-block" : "math-inline";
    return `<span class="${modeClass}" data-math-source="${safeSource}" aria-label="${safeSource}"><span class="math-render">${renderedExpression}</span></span>`;
  }

  function replaceMathTokens(value, tokens) {
    return String(value ?? "")
      .replace(/\$\$([^$]+)\$\$/g, (_, rawSource) =>
        stashHtmlToken(tokens, renderMathToken(rawSource, "block")),
      )
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, rawSource) =>
        stashHtmlToken(tokens, renderMathToken(rawSource, "block")),
      )
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, rawSource) =>
        stashHtmlToken(tokens, renderMathToken(rawSource, "inline")),
      )
      .replace(/(^|[^\\])\$([^$\n]+)\$/g, (_, prefix, rawSource) =>
        `${prefix}${stashHtmlToken(tokens, renderMathToken(rawSource, "inline"))}`,
      );
  }

  function normalizeEditableMediaLabel(value, fallback = "") {
    return decodeHtmlEntities(value)
      .replace(/\s+/g, " ")
      .trim() || fallback;
  }

  function buildEditableImageToken(source, label = "") {
    const safeSource = sanitizeMediaSource(source, "image");
    if (!safeSource) {
      return "";
    }

    const nextLabel = normalizeEditableMediaLabel(label, "Görsel");
    return `![${nextLabel}](${safeSource})`;
  }

  function buildEditableAudioToken(source, label = "") {
    const safeSource = sanitizeMediaSource(source, "audio");
    if (!safeSource) {
      return "";
    }

    const nextLabel = normalizeEditableMediaLabel(label, "Ses kaydı");
    return `![audio: ${nextLabel}](${safeSource})`;
  }

  function renderEditableMediaToken(rawAltText, rawSource) {
    const normalizedAltText = normalizeEditableMediaLabel(rawAltText);
    const normalizedSource = decodeHtmlEntities(rawSource).trim();
    const isAudio = AUDIO_MEDIA_LABEL_PATTERN.test(normalizedAltText);
    const mediaLabel = normalizedAltText.replace(AUDIO_MEDIA_LABEL_PATTERN, "").trim();

    if (isAudio) {
      const safeSource = sanitizeMediaSource(normalizedSource, "audio");
      if (!safeSource) {
        return "";
      }

      const ariaLabel = normalizeEditableMediaLabel(mediaLabel, "Ses kaydı");
      return `<audio controls preload="metadata" src="${escapeHtmlAttribute(safeSource)}" aria-label="${escapeHtmlAttribute(ariaLabel)}"></audio>`;
    }

    const safeSource = sanitizeMediaSource(normalizedSource, "image");
    if (!safeSource) {
      return "";
    }

    const altLabel = normalizeEditableMediaLabel(normalizedAltText);
    return `<img src="${escapeHtmlAttribute(safeSource)}" alt="${escapeHtmlAttribute(altLabel)}" loading="lazy" />`;
  }

  function normalizeObsidianMediaLabel(rawSource, rawLabel = "") {
    const explicitLabel = normalizeEditableMediaLabel(rawLabel);
    if (explicitLabel) {
      return explicitLabel;
    }

    const fileName = decodeHtmlEntities(rawSource)
      .split(/[\\/]/)
      .pop()
      .replace(/\.[^.]+$/, "");
    return normalizeEditableMediaLabel(fileName, "Görsel");
  }

  function readAudioElementSource(audioElement) {
    if (!audioElement) {
      return "";
    }

    const directSource = audioElement.getAttribute("src");
    if (directSource) {
      return directSource;
    }

    const nestedSource = audioElement.querySelector("source");
    return nestedSource?.getAttribute("src") || "";
  }

  function replaceHtmlMediaWithEditableTokens(html) {
    const rawHtml = String(html ?? "");
    if (!rawHtml.trim() || typeof DOMParser !== "function") {
      return rawHtml;
    }

    try {
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(`<div>${rawHtml}</div>`, "text/html");
      const root = documentNode.body.firstElementChild;
      if (!root) {
        return rawHtml;
      }

      root.querySelectorAll(".math-block, .math-inline").forEach((mathElement) => {
        const source =
          mathElement.getAttribute("data-math-source") ||
          mathElement.getAttribute("aria-label") ||
          "";
        const delimiter = mathElement.classList.contains("math-block") ? "$$" : "$";
        mathElement.replaceWith(
          documentNode.createTextNode(
            source ? `${delimiter}${source}${delimiter}` : mathElement.textContent || "",
          ),
        );
      });

      root.querySelectorAll("a[href]").forEach((anchor) => {
        const safeSource = sanitizeExternalLink(anchor.getAttribute("href"));
        const label = normalizeEditableMediaLabel(anchor.textContent, "Kaynak");
        anchor.replaceWith(
          documentNode.createTextNode(
            safeSource ? `[${label}](${safeSource})` : label,
          ),
        );
      });

      root.querySelectorAll("figure").forEach((figure) => {
        const image = figure.querySelector("img");
        if (!image) {
          return;
        }

        const figureToken = buildEditableImageToken(
          image.getAttribute("src"),
          image.getAttribute("alt") || figure.querySelector("figcaption")?.textContent || "",
        );
        figure.replaceWith(documentNode.createTextNode(figureToken));
      });

      root.querySelectorAll("img").forEach((image) => {
        const imageToken = buildEditableImageToken(
          image.getAttribute("src"),
          image.getAttribute("alt") || image.getAttribute("title") || "",
        );
        image.replaceWith(documentNode.createTextNode(imageToken));
      });

      root.querySelectorAll("audio").forEach((audio) => {
        const audioToken = buildEditableAudioToken(
          readAudioElementSource(audio),
          audio.getAttribute("aria-label") || audio.getAttribute("title") || "",
        );
        audio.replaceWith(documentNode.createTextNode(audioToken));
      });

      root.querySelectorAll("blockquote").forEach((blockquote) => {
        const quoteLines = (blockquote.textContent || "")
          .replace(/\r/g, "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const quoteText = quoteLines.map((line) => `> ${line}`).join("\n");
        blockquote.replaceWith(documentNode.createTextNode(quoteText));
      });

      return root.innerHTML;
    } catch {
      return rawHtml;
    }
  }

  function normalizeEditableText(value) {
    return String(value ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeMediaLookupKey(value) {
    const decoded = (() => {
      try {
        return decodeURIComponent(String(value ?? ""));
      } catch {
        return String(value ?? "");
      }
    })();
    return decoded
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      .trim()
      .toLowerCase();
  }

  function isRelativeMediaSource(source, mediaType = "image") {
    const safeSource = sanitizeMediaSource(source, mediaType);
    return Boolean(
      safeSource &&
        !/^(?:https?:|data:|blob:)/i.test(safeSource) &&
        !safeSource.startsWith("//"),
    );
  }

  function getMediaLookupValue(mediaLookup, source) {
    if (!mediaLookup || !source) {
      return "";
    }

    const rawKey = String(source).trim();
    const normalizedKey = normalizeMediaLookupKey(rawKey);
    if (typeof mediaLookup.get === "function") {
      return mediaLookup.get(rawKey) || mediaLookup.get(normalizedKey) || "";
    }

    if (typeof mediaLookup === "object") {
      return mediaLookup[rawKey] || mediaLookup[normalizedKey] || "";
    }

    return "";
  }

  function collectRelativeMediaReferencesFromHtml(html) {
    const rawHtml = String(html ?? "");
    if (!rawHtml.trim() || typeof DOMParser !== "function") {
      return [];
    }

    try {
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(`<div>${rawHtml}</div>`, "text/html");
      const root = documentNode.body.firstElementChild;
      if (!root) {
        return [];
      }

      const references = [];
      root.querySelectorAll("img").forEach((image) => {
        const source = image.getAttribute("src") || "";
        if (isRelativeMediaSource(source, "image")) {
          references.push(source);
        }
      });
      root.querySelectorAll("audio, source").forEach((media) => {
        const source = media.getAttribute("src") || "";
        if (isRelativeMediaSource(source, "audio")) {
          references.push(source);
        }
      });
      return references;
    } catch {
      return [];
    }
  }

  function hydrateMediaReferencesInHtml(html, mediaLookup) {
    const rawHtml = String(html ?? "");
    if (!rawHtml.trim() || typeof DOMParser !== "function") {
      return { html: rawHtml, changed: false };
    }

    try {
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(`<div>${rawHtml}</div>`, "text/html");
      const root = documentNode.body.firstElementChild;
      if (!root) {
        return { html: rawHtml, changed: false };
      }

      let changed = false;
      root.querySelectorAll("img").forEach((image) => {
        const source = image.getAttribute("src") || "";
        if (!isRelativeMediaSource(source, "image")) {
          return;
        }

        const hydratedSource = sanitizeMediaSource(
          getMediaLookupValue(mediaLookup, source),
          "image",
        );
        if (!hydratedSource) {
          return;
        }

        image.setAttribute("src", hydratedSource);
        changed = true;
      });
      root.querySelectorAll("audio, source").forEach((media) => {
        const source = media.getAttribute("src") || "";
        if (!isRelativeMediaSource(source, "audio")) {
          return;
        }

        const hydratedSource = sanitizeMediaSource(
          getMediaLookupValue(mediaLookup, source),
          "audio",
        );
        if (!hydratedSource) {
          return;
        }

        media.setAttribute("src", hydratedSource);
        changed = true;
      });

      return { html: root.innerHTML, changed };
    } catch {
      return { html: rawHtml, changed: false };
    }
  }

  function collectRelativeMediaReferences(setRecord = {}) {
    const references = [];
    toSafeArray(setRecord.questions).forEach((question) => {
      references.push(...collectRelativeMediaReferencesFromHtml(question?.q));
      references.push(...collectRelativeMediaReferencesFromHtml(question?.explanation));
      toSafeArray(question?.options).forEach((option) => {
        references.push(...collectRelativeMediaReferencesFromHtml(option));
      });
    });

    return [...new Set(references)];
  }

  function hydrateSetRecordMedia(setRecord = {}, mediaLookup) {
    let changed = false;
    const questions = toSafeArray(setRecord.questions).map((question) => {
      const nextQuestion = { ...question };
      const questionResult = hydrateMediaReferencesInHtml(nextQuestion.q, mediaLookup);
      nextQuestion.q = questionResult.html;
      changed = changed || questionResult.changed;

      const explanationResult = hydrateMediaReferencesInHtml(
        nextQuestion.explanation,
        mediaLookup,
      );
      nextQuestion.explanation = explanationResult.html;
      changed = changed || explanationResult.changed;

      nextQuestion.options = toSafeArray(nextQuestion.options).map((option) => {
        const optionResult = hydrateMediaReferencesInHtml(option, mediaLookup);
        changed = changed || optionResult.changed;
        return optionResult.html;
      });
      return nextQuestion;
    });

    return {
      record: changed
        ? {
            ...setRecord,
            questions,
            updatedAt: new Date().toISOString(),
          }
        : setRecord,
      changed,
    };
  }

  function processFormatting(text) {
    const contentTokens = [];
    let rendered = String(text ?? "").replace(
      EDITABLE_MEDIA_PATTERN,
      (_, rawAltText, rawSource) => {
        const mediaToken = renderEditableMediaToken(rawAltText, rawSource);
        if (!mediaToken) {
          return "";
        }

        return stashHtmlToken(contentTokens, mediaToken);
      },
    );

    rendered = rendered.replace(
      OBSIDIAN_MEDIA_PATTERN,
      (_, rawSource, rawLabel) => {
        const mediaToken = renderEditableMediaToken(
          normalizeObsidianMediaLabel(rawSource, rawLabel),
          rawSource,
        );
        if (!mediaToken) {
          return "";
        }

        return stashHtmlToken(contentTokens, mediaToken);
      },
    );

    rendered = replaceMathTokens(rendered, contentTokens);

    rendered = rendered.replace(MARKDOWN_LINK_PATTERN, (_, rawLabel, rawSource) =>
      stashHtmlToken(contentTokens, renderMarkdownLink(rawLabel, rawSource)),
    );

    rendered = rendered
      .replace(/==([^=]+)==/g, '<strong class="highlight-critical">$1</strong>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/^(?:> )?⚠️(.*)$/gm, '<span class="highlight-important">⚠️$1</span>');

    return restoreHtmlTokens(rendered, contentTokens);
  }

  function parseMarkdownTableCells(line) {
    return String(line ?? "")
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  function isMarkdownTableSeparator(line) {
    return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(
      String(line ?? ""),
    );
  }

  function renderMarkdownTable(lines) {
    const headerCells = parseMarkdownTableCells(lines[0]);
    const bodyRows = lines
      .slice(2)
      .map(parseMarkdownTableCells)
      .filter((row) => row.some((cell) => cell.length > 0));

    const headerHtml = headerCells
      .map((cell) => `<th>${processFormatting(cell)}</th>`)
      .join("");
    const bodyHtml = bodyRows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${processFormatting(cell)}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    return `<div class="markdown-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
  }

  function renderMarkdownList(lines, ordered = false) {
    const itemPattern = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
    const items = lines
      .map((line) => line.replace(itemPattern, ""))
      .map((line) => `<li>${processFormatting(line.trim())}</li>`)
      .join("");
    return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
  }

  function expandInlineCalloutMarkers(line) {
    const normalizedLine = String(line ?? "").trim();
    const inlineWarningMatch = normalizedLine.match(/^(.*?)\s+(>\s*⚠️[\s\S]*)$/);
    if (!inlineWarningMatch || !inlineWarningMatch[1].trim()) {
      return [normalizedLine];
    }

    return [inlineWarningMatch[1].trim(), inlineWarningMatch[2].trim()];
  }

  function normalizeMarkdownBlockLines(lines) {
    return toSafeArray(lines).flatMap(expandInlineCalloutMarkers);
  }

  function isMarkdownBlockquoteLine(line) {
    return /^>\s?/.test(String(line ?? ""));
  }

  function renderMarkdownBlockquote(lines) {
    const quoteLines = toSafeArray(lines)
      .map((line) => String(line ?? "").replace(/^>\s?/, "").trim())
      .filter(Boolean);
    const quoteHtml = quoteLines.map((line) => processFormatting(line)).join("<br>");
    const warningClass = quoteLines.some((line) => /^⚠️/.test(line))
      ? " markdown-callout-warning"
      : "";

    return `<blockquote class="markdown-callout${warningClass}">${quoteHtml}</blockquote>`;
  }

  function renderMarkdownLines(lines) {
    const rendered = [];
    const sourceLines = normalizeMarkdownBlockLines(lines);

    for (let index = 0; index < sourceLines.length; index += 1) {
      const line = sourceLines[index];
      if (!line) continue;

      if (isMarkdownBlockquoteLine(line)) {
        const quoteLines = [line];
        while (
          index + 1 < sourceLines.length &&
          isMarkdownBlockquoteLine(sourceLines[index + 1])
        ) {
          index += 1;
          quoteLines.push(sourceLines[index]);
        }
        rendered.push(renderMarkdownBlockquote(quoteLines));
        continue;
      }

      if (
        index + 1 < sourceLines.length &&
        line.includes("|") &&
        isMarkdownTableSeparator(sourceLines[index + 1])
      ) {
        const tableLines = [line, sourceLines[index + 1]];
        index += 2;
        while (index < sourceLines.length && sourceLines[index].includes("|")) {
          tableLines.push(sourceLines[index]);
          index += 1;
        }
        index -= 1;
        rendered.push(renderMarkdownTable(tableLines));
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const listLines = [line];
        while (
          index + 1 < sourceLines.length &&
          /^\s*[-*+]\s+/.test(sourceLines[index + 1])
        ) {
          index += 1;
          listLines.push(sourceLines[index]);
        }
        rendered.push(renderMarkdownList(listLines));
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const listLines = [line];
        while (
          index + 1 < sourceLines.length &&
          /^\s*\d+[.)]\s+/.test(sourceLines[index + 1])
        ) {
          index += 1;
          listLines.push(sourceLines[index]);
        }
        rendered.push(renderMarkdownList(listLines, true));
        continue;
      }

      rendered.push(processFormatting(line));
    }

    return rendered.join("<br>");
  }

  function unwrapMarkedLine(value) {
    const rawValue = String(value ?? "").trim();
    const markMatch = rawValue.match(/^<mark\b[^>]*>([\s\S]*?)<\/mark>$/i);
    return {
      text: markMatch ? markMatch[1].trim() : rawValue,
      isMarked: Boolean(markMatch),
    };
  }

  function formatEditableText(value) {
    const normalized = normalizeEditableText(value);
    if (!normalized) {
      return "";
    }

    return renderMarkdownLines(normalized.split("\n"));
  }

  function htmlToEditableText(value) {
    const mediaAwareValue = replaceHtmlMediaWithEditableTokens(value);
    return decodeHtmlEntities(
      String(mediaAwareValue ?? "")
        .replace(
          /<strong\s+class=['"]highlight-critical['"]>(.*?)<\/strong>/gi,
          "==$1==",
        )
        .replace(
          /<span\s+class=['"]highlight-important['"]>\s*⚠️(.*?)<\/span>/gi,
          "> ⚠️$1",
        )
        .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<em>(.*?)<\/em>/gi, "*$1*")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<p>/gi, "")
        .replace(/<[^>]+>/g, ""),
    )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function slugify(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "set";
  }

  function detectSourceFormat(fileName = "", override = "") {
    if (typeof override === "string" && override.trim()) {
      return override.trim().toLowerCase() === "markdown" ? "markdown" : "json";
    }

    return /\.(md|txt)$/i.test(String(fileName || "").trim()) ? "markdown" : "json";
  }

  function buildDefaultFileName(setName, sourceFormat) {
    return `${slugify(setName || "set")}.${sourceFormat === "markdown" ? "md" : "json"}`;
  }

  function resolveQuestionId(question, previousQuestions, index) {
    if (
      question &&
      (typeof question.id === "string" || typeof question.id === "number") &&
      String(question.id).trim()
    ) {
      return question.id;
    }

    const previousQuestion = previousQuestions[index];
    if (
      previousQuestion &&
      (typeof previousQuestion.id === "string" || typeof previousQuestion.id === "number") &&
      String(previousQuestion.id).trim()
    ) {
      return previousQuestion.id;
    }

    return null;
  }

  function normalizeQuestion(question, previousQuestions = [], index = 0) {
    const normalized = question && typeof question === "object" ? question : {};
    const options = toSafeArray(normalized.options).map((option) =>
      typeof option === "string" ? option : String(option ?? ""),
    );

    return {
      q: typeof normalized.q === "string" ? normalized.q : "",
      options,
      correct: Number.isInteger(normalized.correct) ? normalized.correct : -1,
      explanation:
        typeof normalized.explanation === "string" ? normalized.explanation : "",
      subject:
        typeof normalized.subject === "string" && normalized.subject.trim()
          ? normalized.subject.trim()
          : "Genel",
      id: resolveQuestionId(normalized, previousQuestions, index),
    };
  }

  function normalizeQuestions(data, previousQuestions = []) {
    return toSafeArray(data?.questions)
      .filter(
        (question) =>
          question && typeof question === "object" && !Array.isArray(question),
      )
      .map((question, index) => normalizeQuestion(question, previousQuestions, index));
  }

  function normalizeSetRecord(record, options = {}) {
    const previousRecord =
      options.previousRecord && typeof options.previousRecord === "object"
        ? options.previousRecord
        : {};
    const normalizedRecord = record && typeof record === "object" ? record : {};
    const setName =
      typeof normalizedRecord.setName === "string" && normalizedRecord.setName.trim()
        ? normalizedRecord.setName.trim()
        : typeof previousRecord.setName === "string" && previousRecord.setName.trim()
          ? previousRecord.setName.trim()
          : "Set";
    const sourceFormat = detectSourceFormat(
      normalizedRecord.fileName || previousRecord.fileName || "",
      normalizedRecord.sourceFormat || previousRecord.sourceFormat || "",
    );
    const fileName =
      typeof normalizedRecord.fileName === "string" && normalizedRecord.fileName.trim()
        ? normalizedRecord.fileName.trim()
        : typeof previousRecord.fileName === "string" && previousRecord.fileName.trim()
          ? previousRecord.fileName.trim()
          : buildDefaultFileName(setName, sourceFormat);
    const setId =
      typeof normalizedRecord.id === "string" && normalizedRecord.id.trim()
        ? normalizedRecord.id.trim()
        : typeof previousRecord.id === "string" && previousRecord.id.trim()
          ? previousRecord.id.trim()
          : fileName.replace(/\.[^/.]+$/, "");
    const hasExplicitSourcePath = Object.prototype.hasOwnProperty.call(
      normalizedRecord,
      "sourcePath",
    );
    const sourcePath = hasExplicitSourcePath
      ? String(normalizedRecord.sourcePath || "").trim()
      : typeof previousRecord.sourcePath === "string" && previousRecord.sourcePath.trim()
        ? previousRecord.sourcePath.trim()
        : "";

    return {
      id: setId,
      slug:
        typeof normalizedRecord.slug === "string" && normalizedRecord.slug.trim()
          ? normalizedRecord.slug.trim()
          : typeof previousRecord.slug === "string" && previousRecord.slug.trim()
            ? previousRecord.slug.trim()
            : slugify(setName),
      setName,
      fileName,
      sourceFormat,
      rawSource:
        typeof normalizedRecord.rawSource === "string"
          ? normalizedRecord.rawSource
          : typeof previousRecord.rawSource === "string"
            ? previousRecord.rawSource
            : "",
      sourcePath,
      updatedAt:
        typeof normalizedRecord.updatedAt === "string" &&
        normalizedRecord.updatedAt.trim()
          ? normalizedRecord.updatedAt.trim()
          : typeof previousRecord.updatedAt === "string" &&
              previousRecord.updatedAt.trim()
            ? previousRecord.updatedAt.trim()
            : new Date().toISOString(),
      questions: normalizeQuestions(
        { questions: normalizedRecord.questions },
        toSafeArray(previousRecord.questions),
      ),
    };
  }

  function finalizeMarkdownQuestion(currentQuestion, explanationLines) {
    if (!currentQuestion) {
      return null;
    }

    if (explanationLines.length > 0) {
      currentQuestion.explanation = renderMarkdownLines(explanationLines).trim();
    }

    return currentQuestion;
  }

  function appendMarkdownQuestionLine(currentQuestion, line) {
    if (!currentQuestion) {
      return;
    }

    const renderedLine = processFormatting(line);
    if (!renderedLine) {
      return;
    }

    currentQuestion.q = currentQuestion.q
      ? `${currentQuestion.q}<br>${renderedLine}`
      : renderedLine;
  }

  function parseMarkdownToJSON(content, fileName, options = {}) {
    const lines = String(content ?? "").replace(/\r/g, "").split("\n");
    const fileStem = (fileName || "set").replace(/\.[^/.]+$/, "");
    const previousQuestions = toSafeArray(options.previousRecord?.questions);
    const result = {
      setName: fileStem,
      questions: [],
    };

    let currentQuestion = null;
    let currentQuestionIndex = -1;
    let canonicalSubject = fileStem;
    let capturingExplanation = false;
    let explanationLines = [];
    let awaitingQuestionText = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;

      const normalizedLine = line.replace(/^\*\*(.*?)\*\*$/, "$1").trim();
      const h1Match = normalizedLine.match(/^#\s+(.+)$/);
      if (h1Match) {
        const h1Title = h1Match[1].trim();
        if (canonicalSubject === fileStem) {
          result.setName = h1Title;
          canonicalSubject = h1Title;
        }
        continue;
      }

      const h2Match = normalizedLine.match(/^##\s+(.+)$/);
      if (h2Match) {
        const finalizedQuestion = finalizeMarkdownQuestion(
          currentQuestion,
          explanationLines,
        );
        if (finalizedQuestion) {
          result.questions.push(
            normalizeQuestion(
              finalizedQuestion,
              previousQuestions,
              currentQuestionIndex,
            ),
          );
        }

        currentQuestion = null;
        capturingExplanation = false;
        explanationLines = [];
        awaitingQuestionText = false;
        canonicalSubject = h2Match[1].trim() || canonicalSubject;
        continue;
      }

      if (/^[-*_]{3,}$/.test(normalizedLine)) {
        continue;
      }

      const konuMatch = normalizedLine.match(/^#{0,3}\s*Konu:\s*(.+)$/i);
      if (konuMatch) {
        if (currentQuestion) currentQuestion.subject = konuMatch[1].trim();
        continue;
      }

      const h3QuestionMatch = normalizedLine.match(/^###(?:\s+(.+))?$/);
      const bracketNumberMatch = normalizedLine.match(/^\[(\d+)\]\s*(.*)$/);
      const soruInlineMatch = normalizedLine.match(/^Soru:\s*(.+)$/i);
      const soruNumberedMatch = normalizedLine.match(
        /^Soru\s+\d+[.)]?\s*(?::\s*(.*))?$/i,
      );
      if (h3QuestionMatch || bracketNumberMatch || soruInlineMatch || soruNumberedMatch) {
        const finalizedQuestion = finalizeMarkdownQuestion(
          currentQuestion,
          explanationLines,
        );
        if (finalizedQuestion) {
          result.questions.push(
            normalizeQuestion(
              finalizedQuestion,
              previousQuestions,
              currentQuestionIndex,
            ),
          );
        }

        currentQuestionIndex += 1;
        const qText = (
          h3QuestionMatch
            ? h3QuestionMatch[1] || ""
            : bracketNumberMatch
              ? bracketNumberMatch[2] || ""
              : soruInlineMatch
                ? soruInlineMatch[1]
                : soruNumberedMatch[1] || ""
        ).trim();
        currentQuestion = {
          q: processFormatting(qText),
          options: [],
          correct: -1,
          explanation: "",
          subject: canonicalSubject,
          id: resolveQuestionId({}, previousQuestions, currentQuestionIndex),
        };
        capturingExplanation = false;
        explanationLines = [];
        awaitingQuestionText = qText.length === 0;
        continue;
      }

      if (awaitingQuestionText && currentQuestion) {
        currentQuestion.q = processFormatting(normalizedLine);
        awaitingQuestionText = false;
        continue;
      }

      const optionLine = unwrapMarkedLine(normalizedLine);
      const optionMatch = optionLine.text.match(/^([A-Ea-e])(\+)?[).]\s+(.+)$/);
      if (optionMatch && currentQuestion && !capturingExplanation) {
        currentQuestion.options.push(processFormatting(optionMatch[3].trim()));
        if (optionMatch[2] || optionLine.isMarked) {
          currentQuestion.correct = optionMatch[1].toUpperCase().charCodeAt(0) - 65;
        }
        continue;
      }

      const correctMatch = normalizedLine.match(/^Do(?:ğ|g)ru\s*Cevap:\s*([A-Ea-e])\b/i);
      if (correctMatch) {
        const correctChar = correctMatch[1].toUpperCase();
        if (currentQuestion) {
          currentQuestion.correct = correctChar.charCodeAt(0) - 65;
        }
        continue;
      }

      const explanationStartMatch = normalizedLine.match(
        /^(?:Açıklama|Aciklama):\s*(.*)$/i,
      );
      if (explanationStartMatch) {
        capturingExplanation = true;
        explanationLines.push(explanationStartMatch[1].trim());
        continue;
      }

      const blockquoteMatch = line.match(/^>\s?(.*)$/);
      if (blockquoteMatch && currentQuestion) {
        capturingExplanation = true;
        explanationLines.push(line.trim());
        continue;
      }

      if (capturingExplanation) {
        explanationLines.push(normalizedLine);
      } else if (currentQuestion && currentQuestion.options.length === 0) {
        appendMarkdownQuestionLine(currentQuestion, normalizedLine);
      } else if (currentQuestion && currentQuestion.options.length > 0) {
        capturingExplanation = true;
        explanationLines.push(normalizedLine);
      }
    }

    const finalizedQuestion = finalizeMarkdownQuestion(currentQuestion, explanationLines);
    if (finalizedQuestion) {
      result.questions.push(
        normalizeQuestion(finalizedQuestion, previousQuestions, currentQuestionIndex),
      );
    }

    return result;
  }

  function parseJsonToPayload(content) {
    const cleanText = String(content || "").replace(/,\s*([\]}])/g, "$1");
    const parsed = JSON.parse(cleanText);
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function parseSetText(text, fileName, existingRecord = null, sourceFormatOverride = null) {
    const sourceFormat = detectSourceFormat(
      fileName || existingRecord?.fileName || "",
      sourceFormatOverride || existingRecord?.sourceFormat || "",
    );
    const parsedPayload =
      sourceFormat === "markdown"
        ? parseMarkdownToJSON(text, fileName, { previousRecord: existingRecord })
        : parseJsonToPayload(text);

    const normalized = normalizeSetRecord(
      {
        ...existingRecord,
        ...parsedPayload,
        fileName:
          typeof fileName === "string" && fileName.trim()
            ? fileName.trim()
            : existingRecord?.fileName,
        sourceFormat,
        rawSource: String(text ?? ""),
        updatedAt: new Date().toISOString(),
      },
      { previousRecord: existingRecord },
    );

    return normalized;
  }

  function serializeQuestionToJson(question) {
    const serialized = {
      q: question.q,
      options: question.options,
      correct: question.correct,
      explanation: question.explanation,
      subject: question.subject,
    };

    if (
      question.id !== null &&
      question.id !== undefined &&
      String(question.id).trim()
    ) {
      serialized.id = question.id;
    }

    return serialized;
  }

  function serializeSetToJson(setRecord) {
    const normalized = normalizeSetRecord(setRecord, { previousRecord: setRecord });
    return JSON.stringify(
      {
        setName: normalized.setName,
        questions: normalized.questions.map(serializeQuestionToJson),
      },
      null,
      2,
    );
  }

  function serializeSetToMarkdown(setRecord) {
    const normalized = normalizeSetRecord(setRecord, { previousRecord: setRecord });
    const lines = [`# ${normalizeEditableText(normalized.setName) || "Set"}`, ""];

    normalized.questions.forEach((question, index) => {
      const questionText = htmlToEditableText(question.q);
      lines.push(`Soru ${index + 1}: ${questionText}`);
      if (question.subject) {
        lines.push(`Konu: ${question.subject}`);
      }

      question.options.forEach((option, optionIndex) => {
        lines.push(
          `${String.fromCharCode(65 + optionIndex)}) ${htmlToEditableText(option)}`,
        );
      });

      if (question.correct >= 0 && question.correct < question.options.length) {
        lines.push(`Doğru Cevap: ${String.fromCharCode(65 + question.correct)}`);
      }

      const explanation = htmlToEditableText(question.explanation);
      if (explanation) {
        const explanationLines = explanation.split("\n");
        lines.push(`Açıklama: ${explanationLines[0] || ""}`);
        explanationLines.slice(1).forEach((line) => {
          lines.push(line);
        });
      }

      if (index < normalized.questions.length - 1) {
        lines.push("");
      }
    });

    return lines.join("\n").trim();
  }

  function serializeSetRecord(setRecord, sourceFormatOverride = null) {
    const normalized = normalizeSetRecord(setRecord, { previousRecord: setRecord });
    const sourceFormat = detectSourceFormat(
      normalized.fileName,
      sourceFormatOverride || normalized.sourceFormat,
    );

    return sourceFormat === "markdown"
      ? serializeSetToMarkdown(normalized)
      : serializeSetToJson(normalized);
  }

  function buildSetRecord(record, options = {}) {
    const normalized = normalizeSetRecord(record, {
      previousRecord: options.previousRecord || null,
    });
    return {
      ...normalized,
      rawSource: serializeSetRecord(normalized, normalized.sourceFormat),
      updatedAt: new Date().toISOString(),
    };
  }

  const AppSetCodec = Object.freeze({
    buildSetRecord,
    collectRelativeMediaReferences,
    detectSourceFormat,
    formatEditableText,
    hydrateSetRecordMedia,
    htmlToEditableText,
    normalizeQuestions,
    normalizeSetRecord,
    parseMarkdownToJSON,
    parseSetText,
    serializeSetRecord,
    serializeSetToJson,
    serializeSetToMarkdown,
  });

  export {
    buildSetRecord,
    collectRelativeMediaReferences,
    detectSourceFormat,
    formatEditableText,
    hydrateSetRecordMedia,
    htmlToEditableText,
    normalizeQuestions,
    normalizeSetRecord,
    parseMarkdownToJSON,
    parseSetText,
    serializeSetRecord,
    serializeSetToJson,
    serializeSetToMarkdown,
  };
