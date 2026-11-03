import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiStar,
} from "react-icons/fi";
import { npsService } from "../../service/npsService";
import type { NpsQuestion } from "../../types/nps";
import "./NpsPage.css";

type AnswerMap = Record<number, number>;

type NpsRequestSource = {
  token: string | null;
  atendimentoId: number | null;
};

function getQuestionarioSources(
  paramValue?: string,
  queryValue?: string | null,
): NpsRequestSource {
  const rawParam = String(paramValue || "").trim();
  const rawQuery = String(queryValue || "").trim();

  const raw = rawParam || rawQuery;
  const parsedNumeric = Number(raw);
  if (Number.isInteger(parsedNumeric) && parsedNumeric > 0) {
    return { token: null, atendimentoId: parsedNumeric };
  }

  const explicitAtendimentoId = Number(rawQuery);
  if (Number.isInteger(explicitAtendimentoId) && explicitAtendimentoId > 0) {
    return { token: null, atendimentoId: explicitAtendimentoId };
  }

  if (rawParam.length > 0) {
    return { token: rawParam, atendimentoId: null };
  }

  return { token: null, atendimentoId: null };
}

export function NpsPage() {
  const { token: tokenParam } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const source = useMemo(
    () => getQuestionarioSources(tokenParam, searchParams.get("os_id")),
    [tokenParam, searchParams],
  );
  const hasPublicTarget = Boolean(source.token) || Boolean(source.atendimentoId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<NpsQuestion[]>([]);
  const [resolvedAtendimentoId, setResolvedAtendimentoId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const totalSteps = questions.length;
  const currentQuestion = questions[currentStep] ?? null;
  const currentAnswer =
    currentQuestion && Number.isInteger(answers[currentQuestion.id])
      ? answers[currentQuestion.id]
      : null;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const atendimentoIdLabel = resolvedAtendimentoId || source.atendimentoId || "-";

  useEffect(() => {
    let cancelled = false;

    const loadQuestions = async () => {
      try {
        setLoading(true);
        setError("");
        const questionario = await npsService.listQuestions({
          token: source.token || undefined,
          atendimento_id: source.atendimentoId || undefined,
        });
        if (cancelled) return;
        setQuestions(questionario.perguntas);
        setResolvedAtendimentoId(
          Number.isInteger(questionario.atendimento_id) && questionario.atendimento_id > 0
            ? questionario.atendimento_id
            : null,
        );
        setCurrentStep(0);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Erro ao carregar o questionario.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [source.atendimentoId, source.token]);

  const handleSelectAnswer = (questionId: number, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handlePrevious = () => {
    setSubmitError("");
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = async () => {
    if (!currentQuestion || currentAnswer === null || !hasPublicTarget) return;

    setSubmitError("");

    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    try {
      setSubmitting(true);
      await npsService.submit({
        token: source.token || undefined,
        atendimento_id: resolvedAtendimentoId || source.atendimentoId || undefined,
        respostas: questions.map((question) => ({
          pergunta_id: question.id,
          nota: answers[question.id],
        })),
      });
      setIsSuccess(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Nao foi possivel enviar as respostas.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="nps-page">
        <div className="nps-shell">
          <div className="nps-state-card">
            <p className="nps-eyebrow">Pesquisa de satisfacao</p>
            <h1>Carregando perguntas</h1>
            <p>Estamos preparando o questionario do atendimento #{atendimentoIdLabel}.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nps-page">
        <div className="nps-shell">
          <div className="nps-state-card">
            <p className="nps-eyebrow">Pesquisa de satisfacao</p>
            <h1>Nao foi possivel abrir o NPS</h1>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="nps-page">
        <div className="nps-shell">
          <div className="nps-state-card success">
            <div className="nps-success-icon">
              <FiCheckCircle size={28} />
            </div>
            <p className="nps-eyebrow">Pesquisa enviada</p>
            <h1>Obrigado pela avaliação</h1>
            <p>Suas respostas do atendimento #{atendimentoIdLabel} foram registradas com sucesso.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nps-page">
      <div className="nps-shell">
        <div className="nps-card">
          <div className="nps-card-hero">
            <p className="nps-eyebrow">Pesquisa de satisfação</p>
            <h1>
              {atendimentoIdLabel !== "-"
                ? `NPS do atendimento #${atendimentoIdLabel}`
                : "Pesquisa de satisfação"}
            </h1>
            <div className="nps-description">
              <p className="nps-subtitle">
                Avalie cada item com uma nota de 1 a 10, onde 1 significa muito
                insatisfeito e 10 significa muito satisfeito.
              </p>
              <div className="nps-score-caption">
                <div className="nps-score-caption-text">
                  <span>Muito insatisfeito</span>
                  <span>Muito satisfeito</span>
                </div>
                <div className="nps-score-legend">
                  <span>1</span>
                  <div className="nps-score-line" />
                  <span>10</span>
                </div>
              </div>
            </div>
          </div>

          {!hasPublicTarget ? (
            <div className="nps-inline-warning">
              Link invalido. Use o link completo recebido no disparo do NPS.
            </div>
          ) : null}

          {currentQuestion ? (
            <div
              className="nps-question-card"
              style={{ "--progress-width": `${progress}%` } as CSSProperties}
            >
              <div className="nps-question-header">
                <div className="nps-step-badge">{currentStep + 1}</div>
                <div>
                  <h2>{currentQuestion.pergunta}</h2>
                  <p>Escolha apenas uma nota.</p>
                </div>
              </div>

              <div className="nps-rating-grid">
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (value) => {
                    const isSelected = currentAnswer === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={
                          isSelected
                            ? "nps-rating-option selected"
                            : "nps-rating-option"
                        }
                        onClick={() =>
                          handleSelectAnswer(currentQuestion.id, value)
                        }
                      >
                        <span className="nps-rating-value">{value}</span>
                        <FiStar size={14} />
                      </button>
                    );
                  },
                )}
              </div>

              <div className="nps-rating-labels">
                <span>Muito insatisfeito</span>
                <span>Muito satisfeito</span>
              </div>
            </div>
          ) : (
            <div className="nps-state-card compact">
              <h2>Nenhuma pergunta encontrada</h2>
              <p>O questionario ainda nao possui perguntas ativas.</p>
            </div>
          )}

          {submitError ? (
            <div className="nps-inline-error">{submitError}</div>
          ) : null}

          <div className="nps-actions">
            <button
              type="button"
              className="nps-secondary-button"
              onClick={handlePrevious}
              disabled={currentStep === 0 || submitting}
            >
              <FiChevronLeft size={16} />
              Anterior
            </button>

            <button
              type="button"
              className="nps-primary-button"
              onClick={() => void handleNext()}
              disabled={
                !currentQuestion ||
                currentAnswer === null ||
                submitting ||
                !hasPublicTarget
              }
            >
              {submitting
                ? "Enviando..."
                : currentStep === totalSteps - 1
                  ? "Finalizar"
                  : "Proximo"}
              {!submitting ? <FiChevronRight size={16} /> : null}
            </button>
          </div>

          {/* <footer className="nps-footer-logo">
            <img src="/logo-wide.svg" alt="Órbita CRM" />
          </footer> */}
        </div>
      </div>
    </div>
  );
}
