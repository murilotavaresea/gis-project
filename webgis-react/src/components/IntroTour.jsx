import { useEffect, useLayoutEffect, useRef, useState } from "react";

const VIEWPORT_PADDING = 16;
const TOOLTIP_GAP = 18;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeQuerySelector(selector) {
  if (!selector || typeof document === "undefined") {
    return null;
  }

  try {
    return document.querySelector(selector);
  } catch (_error) {
    return null;
  }
}

function getTargetRect(selector) {
  if (!selector || typeof document === "undefined") {
    return null;
  }

  const candidateSelectors = [selector];

  if (selector.includes("Gerar")) {
    candidateSelectors.push('button[title*="Gerar"]');
    candidateSelectors.push('img[src="/icons/plant.svg"]');
  }

  const element = candidateSelectors
    .map((candidate) => safeQuerySelector(candidate))
    .find(Boolean);

  if (!element) {
    return null;
  }

  if (typeof element.scrollIntoView === "function") {
    element.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }

  return element.getBoundingClientRect();
}

function buildTooltipPosition({ rect, tooltipWidth, tooltipHeight, placement }) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (!rect) {
    return {
      left: clamp((viewportWidth - tooltipWidth) / 2, VIEWPORT_PADDING, viewportWidth - tooltipWidth - VIEWPORT_PADDING),
      top: clamp((viewportHeight - tooltipHeight) / 2, VIEWPORT_PADDING, viewportHeight - tooltipHeight - VIEWPORT_PADDING),
    };
  }

  let left = VIEWPORT_PADDING;
  let top = VIEWPORT_PADDING;

  switch (placement) {
    case "left":
      left = rect.left - tooltipWidth - TOOLTIP_GAP;
      top = rect.top + (rect.height - tooltipHeight) / 2;
      break;
    case "bottom":
      left = rect.left + (rect.width - tooltipWidth) / 2;
      top = rect.bottom + TOOLTIP_GAP;
      break;
    case "top":
      left = rect.left + (rect.width - tooltipWidth) / 2;
      top = rect.top - tooltipHeight - TOOLTIP_GAP;
      break;
    case "right":
    default:
      left = rect.right + TOOLTIP_GAP;
      top = rect.top + (rect.height - tooltipHeight) / 2;
      break;
  }

  return {
    left: clamp(left, VIEWPORT_PADDING, viewportWidth - tooltipWidth - VIEWPORT_PADDING),
    top: clamp(top, VIEWPORT_PADDING, viewportHeight - tooltipHeight - VIEWPORT_PADDING),
  };
}

export default function IntroTour({
  isOpen,
  steps = [],
  currentStepIndex = 0,
  onPrev,
  onNext,
  onSkip,
  onFinish,
}) {
  const tooltipRef = useRef(null);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });

  const currentStep = steps[currentStepIndex] || null;
  const isLastStep = currentStepIndex >= steps.length - 1;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onSkip?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onSkip]);

  useLayoutEffect(() => {
    if (!isOpen || !currentStep) {
      return undefined;
    }

    let animationFrame = 0;

    const updateLayout = () => {
      const rect = getTargetRect(currentStep.selector);
      setTargetRect(rect);

      const tooltipNode = tooltipRef.current;
      if (!tooltipNode) {
        return;
      }

      const placement = currentStep.placement || "right";
      setTooltipPosition(
        buildTooltipPosition({
          rect,
          tooltipWidth: tooltipNode.offsetWidth,
          tooltipHeight: tooltipNode.offsetHeight,
          placement,
        })
      );
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateLayout);
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [currentStep, isOpen]);

  if (!isOpen || !currentStep) {
    return null;
  }

  const placement = currentStep.placement || "right";

  return (
    <>
      {targetRect ? (
        <>
          <div className="tour-overlay" style={{ left: 0, top: 0, width: "100vw", height: `${Math.max(targetRect.top, 0)}px` }} />
          <div className="tour-overlay" style={{ left: 0, top: `${Math.max(targetRect.top, 0)}px`, width: `${Math.max(targetRect.left, 0)}px`, height: `${Math.max(targetRect.height, 0)}px` }} />
          <div className="tour-overlay" style={{ left: `${Math.max(targetRect.right, 0)}px`, top: `${Math.max(targetRect.top, 0)}px`, width: `${Math.max(window.innerWidth - targetRect.right, 0)}px`, height: `${Math.max(targetRect.height, 0)}px` }} />
          <div className="tour-overlay" style={{ left: 0, top: `${Math.max(targetRect.bottom, 0)}px`, width: "100vw", height: `${Math.max(window.innerHeight - targetRect.bottom, 0)}px` }} />
          <div
            className="tour-highlight"
            style={{
              left: `${targetRect.left - 8}px`,
              top: `${targetRect.top - 8}px`,
              width: `${targetRect.width + 16}px`,
              height: `${targetRect.height + 16}px`,
            }}
          />
        </>
      ) : (
        <div className="tour-overlay" style={{ inset: 0 }} />
      )}

      <div
        ref={tooltipRef}
        className="tour-card"
        style={{
          left: `${tooltipPosition.left}px`,
          top: `${tooltipPosition.top}px`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={currentStep.title}
      >
        {targetRect && <div className={`tour-arrow placement-${placement}`} aria-hidden="true" />}

        <div className="tour-stepMeta">
          <span>Tutorial do portal</span>
          <strong>
            {currentStepIndex + 1} / {steps.length}
          </strong>
        </div>

        <div className="tour-title">{currentStep.title}</div>
        <div className="tour-description">{currentStep.description}</div>

        <div className="tour-actions">
          <button type="button" className="tour-btn ghost" onClick={onSkip}>
            Pular
          </button>
          <div className="tour-actionsGroup">
            <button
              type="button"
              className="tour-btn secondary"
              onClick={onPrev}
              disabled={currentStepIndex === 0}
            >
              Voltar
            </button>
            <button
              type="button"
              className="tour-btn primary"
              onClick={isLastStep ? onFinish : onNext}
            >
              {isLastStep ? "Concluir" : "Proximo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
