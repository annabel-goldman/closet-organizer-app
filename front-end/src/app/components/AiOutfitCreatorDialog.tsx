import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, LoaderCircle, Lock, RefreshCw, Sparkles, Star, WandSparkles, X } from "lucide-react";

import {
  createOutfit,
  fetchOutfitRecommendation,
  fetchWardrobeAnalysisStatus,
  generateOutfitRecommendations,
  recordOutfitRecommendationFeedback,
  retryOutfitRecommendationJudge,
  startWardrobeAnalysis,
  type Outfit,
  type OutfitRecommendation,
  type OutfitRecommendationResponse,
  type WardrobeAnalysisStatus,
} from "../lib/closet";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Textarea } from "./ui/textarea";

interface AiOutfitCreatorDialogProps {
  initialRecommendationRunId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOutfitCreated: (outfit: Outfit) => void;
  onGenerationTaskStarted: (workflow: NonNullable<WardrobeAnalysisStatus["workflow"]>, label: string) => void;
  userId: number;
}

function progressLabel(status: WardrobeAnalysisStatus) {
  if (status.complete) return "Your closet is ready.";
  if (
    status.processing > 0 ||
    status.pending > 0 ||
    status.enrichment_processing > 0 ||
    status.workflow?.status === "processing"
  ) {
    return `Preparing your closet: ${status.ready} embedded and ${status.enriched} visually enriched of ${status.total}.`;
  }
  const failedCount = Math.max(status.failed, status.enrichment_failed);
  if (failedCount > 0) return `${failedCount} items need another try.`;
  const remainingCount = Math.max(
    status.pending + status.processing + status.stale,
    status.enrichment_pending + status.enrichment_processing,
  );
  return `${remainingCount} items need a one-time analysis.`;
}

export function AiOutfitCreatorDialog({
  initialRecommendationRunId,
  open,
  onOpenChange,
  onOutfitCreated,
  onGenerationTaskStarted,
  userId,
}: AiOutfitCreatorDialogProps) {
  const [status, setStatus] = useState<WardrobeAnalysisStatus | null>(null);
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<OutfitRecommendationResponse | null>(null);
  const [lockedItemIds, setLockedItemIds] = useState<number[]>([]);
  const [excludedItemIds, setExcludedItemIds] = useState<number[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingRecommendationId, setSavingRecommendationId] = useState<number | null>(null);
  const [bestRecommendationId, setBestRecommendationId] = useState<number | null>(null);
  const [ratedNone, setRatedNone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const resultId = results?.id;
  const resultStatus = results?.status;

  const refreshStatus = useCallback(async () => {
    try {
      const nextStatus = await fetchWardrobeAnalysisStatus();
      setStatus(nextStatus);
      if (nextStatus.complete) setIsPreparing(false);
      return nextStatus;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to check your closet.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    setIsLoadingStatus(true);
    setErrorMessage("");
    void refreshStatus().finally(() => setIsLoadingStatus(false));
  }, [open, refreshStatus]);

  useEffect(() => {
    if (!open || !initialRecommendationRunId || resultId === initialRecommendationRunId) return;

    setIsGenerating(true);
    void fetchOutfitRecommendation(initialRecommendationRunId)
      .then((next) => {
        setResults(next);
        setPrompt(next.prompt);
        setIsGenerating(["pending", "processing"].includes(next.status));
        if (next.status === "failed") setErrorMessage(next.error_message || "Unable to finish this outfit run.");
      })
      .catch((error) => {
        setIsGenerating(false);
        setErrorMessage(error instanceof Error ? error.message : "Unable to reopen this outfit run.");
      });
  }, [initialRecommendationRunId, open, resultId]);

  useEffect(() => {
    if (!open || (!isPreparing && status?.workflow?.status !== "processing" && status?.workflow?.status !== "pending")) {
      return;
    }

    const interval = window.setInterval(() => void refreshStatus(), 1800);
    return () => window.clearInterval(interval);
  }, [isPreparing, open, refreshStatus, status?.workflow?.status]);

  useEffect(() => {
    if (!open || !resultId || !resultStatus || !["pending", "processing"].includes(resultStatus)) return;

    const controller = new AbortController();
    let timeoutId: number | undefined;
    const poll = async () => {
      try {
        const next = await fetchOutfitRecommendation(resultId, controller.signal);
        setResults(next);
        if (next.workflow) onGenerationTaskStarted(next.workflow, "your outfit");
        if (next.status === "failed") {
          setIsGenerating(false);
          setErrorMessage(next.error_message || "Unable to finish judging these looks.");
          return;
        }
        if (next.status === "succeeded") {
          setIsGenerating(false);
          return;
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to refresh outfit options.");
        }
      }
      if (!controller.signal.aborted) timeoutId = window.setTimeout(() => void poll(), 1500);
    };

    timeoutId = window.setTimeout(() => void poll(), 1000);
    return () => {
      controller.abort();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [onGenerationTaskStarted, open, resultId, resultStatus]);

  const canGenerate = Boolean(status?.complete && status.ready > 0 && prompt.trim() && !isGenerating);
  const constraintSummary = useMemo(() => {
    const parts = [];
    if (lockedItemIds.length) parts.push(`${lockedItemIds.length} kept`);
    if (excludedItemIds.length) parts.push(`${excludedItemIds.length} excluded`);
    return parts.join(" · ");
  }, [excludedItemIds.length, lockedItemIds.length]);

  async function prepareCloset() {
    setIsPreparing(true);
    setErrorMessage("");
    try {
      const nextStatus = await startWardrobeAnalysis();
      setStatus(nextStatus);
      if (nextStatus.workflow) onGenerationTaskStarted(nextStatus.workflow, "your closet");
    } catch (error) {
      setIsPreparing(false);
      setErrorMessage(error instanceof Error ? error.message : "Unable to prepare your closet.");
    }
  }

  async function generate(overrides?: { locked: number[]; excluded: number[] }) {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setErrorMessage("");
    try {
      const next = await generateOutfitRecommendations({
        prompt: prompt.trim(),
        lockedItemIds: overrides?.locked ?? lockedItemIds,
        excludedItemIds: overrides?.excluded ?? excludedItemIds,
        parentRunId: results?.id,
      });
      setResults(next);
      setBestRecommendationId(null);
      setRatedNone(false);
      if (next.workflow) onGenerationTaskStarted(next.workflow, "your outfit");
      if (["succeeded", "failed"].includes(next.status)) setIsGenerating(false);
    } catch (error) {
      setIsGenerating(false);
      setErrorMessage(error instanceof Error ? error.message : "Unable to create outfit options.");
      await refreshStatus();
    }
  }

  function toggleKeep(itemId: number) {
    const adding = !lockedItemIds.includes(itemId);
    setExcludedItemIds((current) => current.filter((id) => id !== itemId));
    setLockedItemIds((current) => current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]);
    if (adding && results) {
      void recordOutfitRecommendationFeedback({ runId: results.id, eventType: "keep", clothingItemId: itemId })
        .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Unable to save that preference."));
    }
  }

  function toggleExclude(itemId: number) {
    const adding = !excludedItemIds.includes(itemId);
    setLockedItemIds((current) => current.filter((id) => id !== itemId));
    setExcludedItemIds((current) => current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]);
    if (adding && results) {
      void recordOutfitRecommendationFeedback({ runId: results.id, eventType: "exclude", clothingItemId: itemId })
        .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Unable to save that preference."));
    }
  }

  async function swapItem(recommendation: OutfitRecommendation, itemId: number) {
    try {
      if (results) {
        await recordOutfitRecommendationFeedback({
          runId: results.id,
          eventType: "swap",
          optionId: recommendation.id,
          clothingItemId: itemId,
        });
      }
      const nextLocked = Array.from(new Set([
        ...lockedItemIds,
        ...recommendation.item_ids.filter((id) => id !== itemId),
      ])).filter((id) => id !== itemId);
      const nextExcluded = Array.from(new Set([...excludedItemIds, itemId])).filter((id) => !nextLocked.includes(id));
      setLockedItemIds(nextLocked);
      setExcludedItemIds(nextExcluded);
      await generate({ locked: nextLocked, excluded: nextExcluded });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to swap that piece.");
    }
  }

  async function saveRecommendation(recommendation: OutfitRecommendation) {
    setSavingRecommendationId(recommendation.id);
    setErrorMessage("");
    try {
      const outfit = await createOutfit({
        userId,
        name: recommendation.title,
        itemIds: recommendation.item_ids,
        notes: recommendation.summary,
        tags: [
          ...(results?.brief.preferred_colors ?? []),
          ...(results?.brief.style_terms ?? []),
          ...(results?.brief.seasons ?? []),
        ],
        recommendationOptionId: recommendation.id,
      });
      onOutfitCreated(outfit);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save this outfit.");
    } finally {
      setSavingRecommendationId(null);
    }
  }

  async function chooseBest(recommendation: OutfitRecommendation) {
    if (!results) return;
    setBestRecommendationId(recommendation.id);
    setRatedNone(false);
    try {
      await recordOutfitRecommendationFeedback({ runId: results.id, eventType: "best", optionId: recommendation.id });
    } catch (error) {
      setBestRecommendationId(null);
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that preference.");
    }
  }

  async function chooseNone() {
    if (!results) return;
    setRatedNone(true);
    setBestRecommendationId(null);
    try {
      await recordOutfitRecommendationFeedback({ runId: results.id, eventType: "none" });
    } catch (error) {
      setRatedNone(false);
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that preference.");
    }
  }

  async function retryJudge() {
    if (!results) return;
    setIsGenerating(true);
    setErrorMessage("");
    try {
      const next = await retryOutfitRecommendationJudge(results.id);
      setResults(next);
      if (next.workflow) onGenerationTaskStarted(next.workflow, "your outfit");
    } catch (error) {
      setIsGenerating(false);
      setErrorMessage(error instanceof Error ? error.message : "Unable to retry the final check.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,92rem)] overflow-y-auto rounded-none p-0">
        <DialogHeader className="border-b border-border px-6 py-5 pr-16 md:px-8">
          <DialogTitle className="flex items-center gap-2 font-[Outfit] text-xl">
            <WandSparkles className="h-5 w-5" />
            Create an outfit with AI
          </DialogTitle>
          <DialogDescription>
            Describe the occasion, mood, weather, colors, or specific pieces you want to wear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-6 md:px-8">
          {isLoadingStatus ? (
            <div className="flex items-center gap-3 border border-border bg-muted/30 p-4">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <PrimitiveText variant="bodySm">Checking your closet…</PrimitiveText>
            </div>
          ) : status && !status.complete ? (
            <div className="flex flex-col gap-4 border border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <PrimitiveText variant="label" weight="semibold">One-time closet setup</PrimitiveText>
                <PrimitiveText variant="bodySm" tone="muted" className="mt-1">
                  {progressLabel(status)} Gemini analyzes each item image and its saved metadata through OpenRouter. New and edited items update automatically afterward.
                </PrimitiveText>
              </div>
              <PrimitiveButton type="button" onClick={() => void prepareCloset()} disabled={isPreparing}>
                {isPreparing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isPreparing ? "Preparing…" : status.failed || status.enrichment_failed ? "Retry analysis" : "Prepare closet"}
              </PrimitiveButton>
            </div>
          ) : null}

          <div className="space-y-3">
            <label htmlFor="ai-outfit-prompt">
              <PrimitiveText as="span" variant="label" weight="semibold">What do you want to wear?</PrimitiveText>
            </label>
            <Textarea
              id="ai-outfit-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Early-2000s fall look for apple picking with friends—warm browns and burgundy, comfortable shoes, not too dressy."
              className="min-h-28 rounded-none font-[Outfit]"
              maxLength={500}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canGenerate) void generate();
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PrimitiveText variant="caption" tone="muted">
                {constraintSummary || "You can keep or exclude pieces after the first results."}
              </PrimitiveText>
              <div className="flex gap-2">
                {(lockedItemIds.length > 0 || excludedItemIds.length > 0) ? (
                  <PrimitiveButton
                    type="button"
                    variant="ghost"
                    onClick={() => { setLockedItemIds([]); setExcludedItemIds([]); }}
                  >
                    Clear choices
                  </PrimitiveButton>
                ) : null}
                <PrimitiveButton type="button" disabled={!canGenerate} onClick={() => void generate()}>
                  {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {results ? "Try again" : "Create three looks"}
                </PrimitiveButton>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="flex items-center justify-between gap-3 border border-destructive/25 bg-destructive/5 p-3">
              <PrimitiveText role="alert" variant="bodySm" tone="destructive">{errorMessage}</PrimitiveText>
              {results?.status === "failed" ? (
                <PrimitiveButton type="button" variant="outline" size="sm" onClick={() => void retryJudge()}>
                  Retry final check
                </PrimitiveButton>
              ) : null}
            </div>
          ) : null}

          {isGenerating ? (
            <div className="flex items-center gap-3 border border-border bg-muted/30 p-4">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <PrimitiveText variant="bodySm">
                {results?.workflow?.stages.find((stage) => stage.status === "processing")?.key === "judge"
                  ? "Checking the complete looks for color, proportion, and cohesion…"
                  : "Planning and assembling complete looks from your closet…"}
              </PrimitiveText>
            </div>
          ) : null}

          {results?.status === "succeeded" ? (
            <div className="space-y-4">
              {results.result_message ? <PrimitiveText variant="bodySm" tone="muted">{results.result_message}</PrimitiveText> : null}
              {results.recommendations.length > 0 ? <div className="grid gap-5 lg:grid-cols-3">
              {results.recommendations.map((recommendation) => (
                <article key={recommendation.id} className="flex flex-col border border-border bg-background">
                  <div className="grid grid-cols-2 gap-px bg-border">
                    {recommendation.items.map((item) => {
                      const kept = lockedItemIds.includes(item.id);
                      const excluded = excludedItemIds.includes(item.id);
                      return (
                        <div key={item.id} className="group relative aspect-square overflow-hidden bg-white">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-2" />
                          ) : null}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-white">
                            <PrimitiveText as="p" variant="caption" weight="medium" className="line-clamp-2 text-white">
                              {item.name}
                            </PrimitiveText>
                          </div>
                          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <PrimitiveButton
                              type="button"
                              size="icon"
                              variant={kept ? "default" : "outline"}
                              className="h-8 w-8 bg-background/95"
                              onClick={() => toggleKeep(item.id)}
                              aria-label={kept ? `Stop keeping ${item.name}` : `Keep ${item.name}`}
                            >
                              {kept ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </PrimitiveButton>
                            <PrimitiveButton
                              type="button"
                              size="icon"
                              variant={excluded ? "destructive" : "outline"}
                              className="h-8 w-8 bg-background/95"
                              onClick={() => toggleExclude(item.id)}
                              aria-label={excluded ? `Allow ${item.name}` : `Exclude ${item.name}`}
                            >
                              <Ban className="h-4 w-4" />
                            </PrimitiveButton>
                            <PrimitiveButton
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 bg-background/95"
                              onClick={() => void swapItem(recommendation, item.id)}
                              disabled={isGenerating}
                              aria-label={`Swap ${item.name}`}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </PrimitiveButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <PrimitiveText as="h3" variant="title" font="serif" weight="semibold">{recommendation.title}</PrimitiveText>
                      <PrimitiveText variant="bodySm" tone="muted" className="mt-1 line-clamp-3">{recommendation.summary}</PrimitiveText>
                    </div>
                    <ul className="space-y-1">
                      {recommendation.reasons.slice(0, 2).map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <PrimitiveText as="span" variant="caption" tone="muted">{reason}</PrimitiveText>
                        </li>
                      ))}
                    </ul>
                    <PrimitiveButton
                      type="button"
                      className="mt-auto w-full"
                      disabled={Boolean(savingRecommendationId)}
                      onClick={() => void saveRecommendation(recommendation)}
                    >
                      {savingRecommendationId === recommendation.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      Save and edit
                    </PrimitiveButton>
                    <PrimitiveButton
                      type="button"
                      variant={bestRecommendationId === recommendation.id ? "default" : "outline"}
                      className="w-full"
                      onClick={() => void chooseBest(recommendation)}
                      disabled={bestRecommendationId === recommendation.id}
                    >
                      <Star className="h-4 w-4" />
                      {bestRecommendationId === recommendation.id ? "Best look selected" : "Best look"}
                    </PrimitiveButton>
                  </div>
                </article>
              ))}
              </div> : null}
              <div className="flex justify-end">
                <PrimitiveButton type="button" variant="ghost" onClick={() => void chooseNone()} disabled={ratedNone}>
                  <X className="h-4 w-4" />
                  {ratedNone ? "Feedback saved" : "None of these"}
                </PrimitiveButton>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
