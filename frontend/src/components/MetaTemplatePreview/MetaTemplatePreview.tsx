import { type ReactNode, useMemo } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";
import type { MetaTemplateItem } from "../../service/metaService";
import "./MetaTemplatePreview.css";

export type TemplatePreviewParameterKind = "manual" | "contact_field";
export type TemplatePreviewStandardField = "contact_name" | "birthday" | "email";
export type TemplatePreviewNameFormat = "first_name" | "full_name";

export type TemplatePreviewParameterInput = {
  kind?: TemplatePreviewParameterKind;
  text?: string;
  standardField?: TemplatePreviewStandardField | "";
  nameFormat?: TemplatePreviewNameFormat;
};

type MetaTemplatePreviewProps = {
  template: MetaTemplateItem | null | undefined;
  language?: string;
  title?: string;
  className?: string;
  headerParameters?: TemplatePreviewParameterInput[];
  bodyParameters?: TemplatePreviewParameterInput[];
  buttonParameters?: Record<number, TemplatePreviewParameterInput[]>;
  headerImageUrl?: string;
  headerFileName?: string;
  emptyBodyText?: string;
};

type TemplateTextContent = {
  header: string;
  body: string;
  footer: string;
  buttons: Array<Record<string, unknown>>;
};

function getTemplateSavedHeaderMedia(template: MetaTemplateItem | null | undefined) {
  const media = template?.saved_header_media;
  if (!media || typeof media !== "object") return null;
  return media;
}

function getTemplateSavedHeaderImageUrl(template: MetaTemplateItem | null | undefined): string {
  const media = getTemplateSavedHeaderMedia(template);
  if (!media) return "";
  if (String(media.media_type || "").trim().toLowerCase() !== "image") return "";
  return String(media.url || "").trim();
}

function getTemplateHeaderFormat(template: MetaTemplateItem | null | undefined): string {
  const components = template?.components;
  if (Array.isArray(components)) {
    const headerComponent = components.find(
      (component) => String(component?.type || "").trim().toUpperCase() === "HEADER"
    );

    return String(headerComponent?.format || "TEXT")
      .trim()
      .toUpperCase();
  }

  if (components && typeof components === "object") {
    const normalized = components as {
      header?: {
        type?: string;
        format?: string;
      } | null;
    };

    return String(normalized.header?.format || normalized.header?.type || "TEXT")
      .trim()
      .toUpperCase();
  }

  return "TEXT";
}

function getMediaTypeLabel(format: string) {
  switch (format) {
    case "IMAGE":
      return "imagem";
    case "VIDEO":
      return "video";
    case "DOCUMENT":
      return "documento";
    default:
      return "midia";
  }
}

function getPreviewButtonLabel(button: Record<string, unknown>): string {
  const text = String(button.text || "").trim();
  if (text) return text;

  const type = String(button.type || "").trim().toUpperCase();
  if (type === "URL") {
    const url = String(button.url || "").trim();
    return url ? `URL: ${url}` : "Abrir URL";
  }
  if (type === "PHONE_NUMBER") {
    const phoneNumber = String(button.phone_number || "").trim();
    return phoneNumber ? `Ligar: ${phoneNumber}` : "Ligar";
  }
  if (type === "COPY_CODE") return "Copiar codigo";
  if (type === "OTP") return "Codigo OTP";
  return type || "Botao";
}

function extractTemplateTexts(template: MetaTemplateItem): TemplateTextContent {
  const result: TemplateTextContent = {
    header: "",
    body: "",
    footer: "",
    buttons: [],
  };

  if (!Array.isArray(template.components)) {
    const components = template.components;
    if (components && typeof components === "object") {
      const normalized = components as {
        header?: { text?: string } | null;
        body?: { text?: string } | null;
        footer?: { text?: string } | null;
        buttons?: Array<Record<string, unknown>> | null;
      };

      if (typeof normalized.header?.text === "string") {
        result.header = normalized.header.text;
      }
      if (typeof normalized.body?.text === "string") {
        result.body = normalized.body.text;
      }
      if (typeof normalized.footer?.text === "string") {
        result.footer = normalized.footer.text;
      }
      if (Array.isArray(normalized.buttons)) {
        result.buttons = normalized.buttons.filter(
          (button): button is Record<string, unknown> =>
            Boolean(button) && typeof button === "object"
        );
      }
    }

    return result;
  }

  template.components.forEach((component) => {
    const type = String(component?.type || "").trim().toUpperCase();
    if (type === "HEADER" && typeof component.text === "string") {
      result.header = component.text;
    }
    if (type === "BODY" && typeof component.text === "string") {
      result.body = component.text;
    }
    if (type === "FOOTER" && typeof component.text === "string") {
      result.footer = component.text;
    }
    if (type === "BUTTONS" && Array.isArray(component.buttons)) {
      result.buttons = component.buttons.filter(
        (button): button is Record<string, unknown> =>
          Boolean(button) && typeof button === "object"
      );
    }
  });

  return result;
}

function renderWhatsAppFormattedText(text: string): ReactNode[] {
  const chunks: ReactNode[] = [];
  const tokenRegex = /```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;
  let lastIndex = 0;
  let match = tokenRegex.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      chunks.push(text.slice(lastIndex, match.index));
    }

    const [fullMatch, codeText, boldText, italicText, strikeText] = match;
    const key = `fmt-${match.index}-${fullMatch.length}`;

    if (codeText !== undefined) {
      chunks.push(
        <code key={key} className="meta-template-live-preview__inline-code">
          {codeText}
        </code>
      );
    } else if (boldText !== undefined) {
      chunks.push(<strong key={key}>{boldText}</strong>);
    } else if (italicText !== undefined) {
      chunks.push(<em key={key}>{italicText}</em>);
    } else if (strikeText !== undefined) {
      chunks.push(<s key={key}>{strikeText}</s>);
    }

    lastIndex = match.index + fullMatch.length;
    match = tokenRegex.exec(text);
  }

  if (lastIndex < text.length) {
    chunks.push(text.slice(lastIndex));
  }

  return chunks.length ? chunks : [text];
}

function getParameterPreviewValue(
  parameter: TemplatePreviewParameterInput | undefined,
  variableId: string
): string {
  if (!parameter) return `{{${variableId}}}`;

  if (parameter.kind === "contact_field") {
    if (parameter.standardField === "contact_name") {
      return parameter.nameFormat === "first_name"
        ? "[primeiro nome do cliente]"
        : "[nome completo do cliente]";
    }
    if (parameter.standardField === "birthday") {
      return "[data de aniversario do cliente]";
    }
    if (parameter.standardField === "email") {
      return "[email do cliente]";
    }
    return `{{${variableId}}}`;
  }

  const text = String(parameter.text || "").trim();
  return text || `{{${variableId}}}`;
}

function applyParameterPreview(text: string, parameters: TemplatePreviewParameterInput[]): string {
  if (!text) return "";

  return text.replace(/{{\s*(\d+)\s*}}/g, (_, variableId: string) => {
    const parameterIndex = Math.max(Number(variableId) - 1, 0);
    return getParameterPreviewValue(parameters[parameterIndex], variableId);
  });
}

function resolveButtonParameters(
  button: Record<string, unknown>,
  defaultIndex: number,
  buttonParameters: Record<number, TemplatePreviewParameterInput[]>
) {
  const rawIndex = Number(button.index ?? button.button_index ?? defaultIndex + 1);
  if (Number.isInteger(rawIndex) && rawIndex > 0 && Array.isArray(buttonParameters[rawIndex])) {
    return buttonParameters[rawIndex];
  }

  const fallbackIndex = defaultIndex + 1;
  return Array.isArray(buttonParameters[fallbackIndex]) ? buttonParameters[fallbackIndex] : [];
}

export function MetaTemplatePreview({
  template,
  language = "pt_BR",
  title = "Preview do template",
  className = "",
  headerParameters = [],
  bodyParameters = [],
  buttonParameters = {},
  headerImageUrl = "",
  headerFileName = "",
  emptyBodyText = "Seu texto principal aparecera aqui.",
}: MetaTemplatePreviewProps) {
  const templateContent = useMemo(
    () => (template ? extractTemplateTexts(template) : null),
    [template]
  );

  const headerFormat = useMemo(() => getTemplateHeaderFormat(template), [template]);
  const resolvedHeaderImageUrl = headerImageUrl || getTemplateSavedHeaderImageUrl(template);
  const mediaLabel = getMediaTypeLabel(headerFormat);
  const savedHeaderMedia = getTemplateSavedHeaderMedia(template);
  const resolvedHeaderFileName =
    String(headerFileName || savedHeaderMedia?.nome_arquivo || "").trim();

  const previewHeader = useMemo(
    () =>
      templateContent?.header
        ? applyParameterPreview(templateContent.header, headerParameters)
        : "",
    [headerParameters, templateContent]
  );

  const previewBody = useMemo(
    () =>
      templateContent?.body ? applyParameterPreview(templateContent.body, bodyParameters) : "",
    [bodyParameters, templateContent]
  );

  const previewFooter = useMemo(
    () => (templateContent?.footer ? templateContent.footer : ""),
    [templateContent]
  );

  const previewButtons = useMemo(() => {
    if (!templateContent) return [];

    return templateContent.buttons
      .map((button, index) => {
        const parameters = resolveButtonParameters(button, index, buttonParameters);
        const normalizedButton: Record<string, unknown> = {
          ...button,
          text:
            typeof button.text === "string"
              ? applyParameterPreview(button.text, parameters)
              : button.text,
          url:
            typeof button.url === "string"
              ? applyParameterPreview(button.url, parameters)
              : button.url,
          phone_number:
            typeof button.phone_number === "string"
              ? applyParameterPreview(button.phone_number, parameters)
              : button.phone_number,
        };

        return {
          key:
            String(normalizedButton.text || "").trim() ||
            String(normalizedButton.url || "").trim() ||
            String(normalizedButton.phone_number || "").trim() ||
            `${String(normalizedButton.type || "BUTTON")}-${index}`,
          label: getPreviewButtonLabel(normalizedButton),
        };
      })
      .filter((button) => button.label.trim().length > 0);
  }, [buttonParameters, templateContent]);

  if (!template || !templateContent) {
    return null;
  }

  const showMediaPlaceholder =
    headerFormat !== "TEXT" && headerFormat !== "IMAGE" && !resolvedHeaderImageUrl;
  const showImagePlaceholder = headerFormat === "IMAGE" && !resolvedHeaderImageUrl;

  return (
    <aside className={`meta-template-live-preview ${className}`.trim()}>
      <h4>{title}</h4>
      <article className="meta-template-live-preview__card">
        <div className="meta-template-live-preview__chat-header">
          <span>Conversa no WhatsApp</span>
          <small>{language || "pt_BR"}</small>
        </div>

        <div className="meta-template-live-preview__chat-body">
          <div className="meta-template-live-preview__message">
            <div className="meta-template-live-preview__bubble">
              {resolvedHeaderImageUrl ? (
                <div className="meta-template-live-preview__media">
                  <img
                    src={resolvedHeaderImageUrl}
                    alt="Preview do header do template"
                    className="meta-template-live-preview__media-image"
                  />
                </div>
              ) : null}

              {showImagePlaceholder ? (
                <div className="meta-template-live-preview__media-placeholder">
                  <strong>Header com imagem</strong>
                  <span>
                    {resolvedHeaderFileName
                      ? `Arquivo selecionado: ${resolvedHeaderFileName}`
                      : "Selecione uma imagem para visualizar o header."}
                  </span>
                </div>
              ) : null}

              {showMediaPlaceholder ? (
                <div className="meta-template-live-preview__media-placeholder">
                  <strong>{`Header com ${mediaLabel}`}</strong>
                  <span>
                    {resolvedHeaderFileName
                      ? `Arquivo selecionado: ${resolvedHeaderFileName}`
                      : `O WhatsApp exibira este ${mediaLabel} no envio.`}
                  </span>
                </div>
              ) : null}

              {headerFormat === "TEXT" && previewHeader ? (
                <p className="meta-template-live-preview__bubble-header">
                  {renderWhatsAppFormattedText(previewHeader)}
                </p>
              ) : null}

              <p className="meta-template-live-preview__bubble-body">
                {previewBody ? renderWhatsAppFormattedText(previewBody) : emptyBodyText}
              </p>

              {previewFooter ? (
                <p className="meta-template-live-preview__bubble-footer">
                  {renderWhatsAppFormattedText(previewFooter)}
                </p>
              ) : null}
            </div>

            {previewButtons.length > 0 ? (
              <div className="meta-template-live-preview__buttons">
                {previewButtons.map((button) => (
                  <span key={button.key} className="meta-template-live-preview__button">
                    <FaExternalLinkAlt aria-hidden="true" />
                    <span>{button.label}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </aside>
  );
}
