import * as api from "@client/api";
import { fileToDataUrl } from "@client/components/design-resume/utils";
import { useDemoInfo } from "@client/hooks/useDemoInfo";
import { useRxResumeConfigState } from "@client/hooks/useRxResumeConfigState";
import { useSettings } from "@client/hooks/useSettings";
import { isOnboardingComplete } from "@client/lib/onboarding";
import { queryKeys } from "@client/lib/queryKeys";
import {
  getRxResumeCredentialDrafts,
  getRxResumeMissingCredentialLabels,
  validateAndMaybePersistRxResumeMode,
} from "@client/lib/rxresume-config";
import {
  getLlmProviderConfig,
  normalizeLlmProvider,
} from "@client/pages/settings/utils";
import { getDefaultModelForProvider } from "@shared/settings-registry";
import type { UpdateSettingsInput } from "@shared/settings-schema.js";
import type {
  AppSettings,
  SearchTermsSuggestionResponse,
  ValidationResult,
} from "@shared/types.js";
import { normalizeSearchTerms } from "@shared/utils/search-terms";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { formatUserFacingError } from "@/client/lib/error-format";
import { showErrorToast } from "@/client/lib/error-toast";
import { EMPTY_VALIDATION_STATE, STEP_COPY } from "./content";
import type {
  OnboardingFormData,
  OnboardingStep,
  ResumeSetupMode,
  StepId,
  ValidationState,
} from "./types";

export function useOnboardingFlow() {
  const queryClient = useQueryClient();
  const { settings, isLoading: settingsLoading } = useSettings();
  const { storedRxResume, setBaseResumeId, syncBaseResumeId } =
    useRxResumeConfigState(settings);
  const demoInfo = useDemoInfo();
  const demoMode = demoInfo?.demoMode ?? false;

  const [isSaving, setIsSaving] = useState(false);
  const [isValidatingLlm, setIsValidatingLlm] = useState(false);
  const [isValidatingRxresume, setIsValidatingRxresume] = useState(false);
  const [isValidatingBaseResume, setIsValidatingBaseResume] = useState(false);
  const [isImportingResume, setIsImportingResume] = useState(false);
  const [isGeneratingSearchTerms, setIsGeneratingSearchTerms] = useState(false);
  const [llmValidation, setLlmValidation] = useState<ValidationState>(
    EMPTY_VALIDATION_STATE,
  );
  const [rxresumeValidation, setRxresumeValidation] = useState<ValidationState>(
    EMPTY_VALIDATION_STATE,
  );
  const [baseResumeValidation, setBaseResumeValidation] =
    useState<ValidationState>(EMPTY_VALIDATION_STATE);
  const [isRxResumeSelfHosted, setIsRxResumeSelfHosted] = useState(false);
  const [resumeSetupMode, setResumeSetupMode] =
    useState<ResumeSetupMode>("upload");
  const [searchTermsSaved, setSearchTermsSaved] = useState(false);
  const [hasSavedSearchTermsInSession, setHasSavedSearchTermsInSession] =
    useState(false);
  const [searchTermsSource, setSearchTermsSource] = useState<
    SearchTermsSuggestionResponse["source"] | null
  >(null);
  const [searchTermsStale, setSearchTermsStale] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId | null>(null);
  const resumeSetupModeTouchedRef = useRef(false);
  const searchTermsOverrideKeyRef = useRef<string | null>(null);
  const autoSuggestionAttemptedRef = useRef(false);

  const { control, getValues, reset, setValue, watch } =
    useForm<OnboardingFormData>({
      defaultValues: {
        llmProvider: "",
        llmBaseUrl: "",
        llmApiKey: "",
        model: "",
        pdfRenderer: "latex",
        rxresumeUrl: "",
        rxresumeApiKey: "",
        rxresumeBaseResumeId: null,
        searchTerms: [],
        searchTermDraft: "",
      },
    });

  const syncSettingsCache = useCallback(
    (nextSettings: AppSettings) => {
      queryClient.setQueryData(queryKeys.settings.current(), nextSettings);
    },
    [queryClient],
  );

  useEffect(() => {
    if (!settings) return;

    const selectedId = syncBaseResumeId();
    const searchTermsOverride = settings.searchTerms?.override ?? null;
    const hasExplicitSearchTermsOverride =
      Array.isArray(searchTermsOverride) && searchTermsOverride.length > 0;
    const searchTermsOverrideKey = JSON.stringify(searchTermsOverride);
    setLlmValidation(EMPTY_VALIDATION_STATE);
    setRxresumeValidation(EMPTY_VALIDATION_STATE);
    setBaseResumeValidation(EMPTY_VALIDATION_STATE);
    reset({
      llmProvider: settings.llmProvider?.value || "",
      llmBaseUrl: settings.llmBaseUrl?.value || "",
      llmApiKey: "",
      model: settings.model?.override ?? "",
      pdfRenderer: selectedId ? "rxresume" : "latex",
      rxresumeUrl: settings.rxresumeUrl ?? "",
      rxresumeApiKey: "",
      rxresumeBaseResumeId: selectedId,
      searchTerms: settings.searchTerms?.value ?? [],
      searchTermDraft: "",
    });
    setIsRxResumeSelfHosted(Boolean(settings.rxresumeUrl));
    if (!resumeSetupModeTouchedRef.current) {
      setResumeSetupMode(selectedId ? "rxresume" : "upload");
    }
    if (searchTermsOverrideKeyRef.current !== searchTermsOverrideKey) {
      searchTermsOverrideKeyRef.current = searchTermsOverrideKey;
      setSearchTermsSaved(hasExplicitSearchTermsOverride);
      setHasSavedSearchTermsInSession(hasExplicitSearchTermsOverride);
      setSearchTermsSource(null);
      setSearchTermsStale(false);
      autoSuggestionAttemptedRef.current = hasExplicitSearchTermsOverride;
    }
  }, [reset, settings, syncBaseResumeId]);

  const llmProvider = watch("llmProvider");
  const llmBaseUrlValue = watch("llmBaseUrl");
  const llmApiKeyValue = watch("llmApiKey");
  const modelDraftValue = watch("model");
  const selectedProvider = normalizeLlmProvider(
    llmProvider || settings?.llmProvider?.value || "openrouter",
  );
  const providerConfig = getLlmProviderConfig(selectedProvider);
  const {
    normalizedProvider,
    showApiKey,
    showBaseUrl,
    requiresApiKey: requiresLlmKey,
  } = providerConfig;

  const llmKeyHint = settings?.llmApiKeyHint ?? null;
  const hasLlmKey = Boolean(llmKeyHint);
  const llmValidated = llmValidation.valid;
  const searchTermsOverride = settings?.searchTerms?.override ?? null;
  const hasExplicitSearchTermsOverride = Boolean(
    Array.isArray(searchTermsOverride) && searchTermsOverride.length > 0,
  );
  const searchTermsComplete = searchTermsSaved && !searchTermsStale;

  const toValidationState = useCallback(
    (
      result: ValidationResult,
      options?: {
        markChecked?: boolean;
      },
    ): ValidationState => ({
      ...result,
      checked: options?.markChecked ?? true,
      hydrated: true,
    }),
    [],
  );

  const validateLlm = useCallback(
    async (options?: { markChecked?: boolean }) => {
      const values = getValues();

      setIsValidatingLlm(true);
      try {
        const result = await api.validateLlm({
          provider: selectedProvider,
          baseUrl: showBaseUrl
            ? values.llmBaseUrl.trim() || undefined
            : undefined,
          apiKey: requiresLlmKey
            ? values.llmApiKey.trim() || undefined
            : undefined,
        });
        setLlmValidation(toValidationState(result, options));
        return result;
      } catch (error) {
        const result = {
          valid: false,
          message: formatUserFacingError(error, "LLM validation failed"),
        };
        setLlmValidation(toValidationState(result, options));
        return result;
      } finally {
        setIsValidatingLlm(false);
      }
    },
    [
      getValues,
      requiresLlmKey,
      selectedProvider,
      showBaseUrl,
      toValidationState,
    ],
  );

  const validateBaseResume = useCallback(
    async (options?: { markChecked?: boolean }) => {
      setIsValidatingBaseResume(true);
      try {
        const result = await api.validateResumeConfig();
        setBaseResumeValidation(toValidationState(result, options));
        return result;
      } catch (error) {
        const result = {
          valid: false,
          message:
            error instanceof Error
              ? error.message
              : "Base resume validation failed",
        };
        setBaseResumeValidation(toValidationState(result, options));
        return result;
      } finally {
        setIsValidatingBaseResume(false);
      }
    },
    [toValidationState],
  );

  const validateRxresume = useCallback(
    async (options?: { markChecked?: boolean }) => {
      setIsValidatingRxresume(true);
      try {
        const preserveBlankFields = isRxResumeSelfHosted
          ? undefined
          : (["baseUrl"] as const);
        const result = await validateAndMaybePersistRxResumeMode({
          stored: storedRxResume,
          draft: getRxResumeCredentialDrafts({
            ...getValues(),
            rxresumeUrl: isRxResumeSelfHosted ? getValues().rxresumeUrl : "",
          }),
          validationPayloadOptions: preserveBlankFields
            ? {
                preserveBlankFields: [...preserveBlankFields],
              }
            : undefined,
          validate: api.validateRxresume,
          getPrecheckMessage: () =>
            "Yêu cầu khóa API v5. Vui lòng thêm khóa API v5 rồi thử lại.",
          getValidationErrorMessage: (error: unknown) =>
            error instanceof Error
              ? error.message
              : "RxResume validation failed",
        });
        setRxresumeValidation(toValidationState(result.validation, options));
        return result.validation;
      } finally {
        setIsValidatingRxresume(false);
      }
    },
    [getValues, isRxResumeSelfHosted, storedRxResume, toValidationState],
  );

  useEffect(() => {
    if (!showBaseUrl) {
      setValue("llmBaseUrl", "");
    }
  }, [setValue, showBaseUrl]);

  useEffect(() => {
    if (!selectedProvider) return;
    setLlmValidation(EMPTY_VALIDATION_STATE);
  }, [selectedProvider]);

  const runAllValidations = useCallback(async () => {
    if (!settings || demoMode) return;

    const validations: Promise<ValidationResult>[] = [
      validateLlm({ markChecked: false }),
      validateRxresume({ markChecked: false }),
      validateBaseResume({ markChecked: false }),
    ];
    await Promise.allSettled(validations);
  }, [demoMode, settings, validateBaseResume, validateLlm, validateRxresume]);

  useEffect(() => {
    if (demoMode || !settings || settingsLoading) return;

    const needsValidation =
      !llmValidation.hydrated ||
      !rxresumeValidation.hydrated ||
      !baseResumeValidation.hydrated;
    if (!needsValidation) return;

    void runAllValidations();
  }, [
    baseResumeValidation.hydrated,
    demoMode,
    llmValidation.hydrated,
    runAllValidations,
    rxresumeValidation.hydrated,
    settings,
    settingsLoading,
  ]);

  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "llm",
        label: "LLM (Trí tuệ nhân tạo)",
        subtitle: "Nhà cung cấp, thông tin xác thực và endpoint",
        complete: llmValidated,
        disabled: false,
      },
      {
        id: "baseresume",
        label: "CV",
        subtitle: "Tải lên tệp hoặc dùng Reactive Resume",
        complete: baseResumeValidation.valid,
        disabled: false,
      },
      {
        id: "searchterms",
        label: "Từ khóa tìm kiếm",
        subtitle: "Các chức danh công việc cần tìm",
        complete: searchTermsComplete,
        disabled: false,
      },
    ],
    [baseResumeValidation.valid, llmValidated, searchTermsComplete],
  );

  useEffect(() => {
    if (!steps.length) return;

    setCurrentStep((existing) => {
      if (!existing) return steps[0].id;
      const existingStep = steps.find((step) => step.id === existing);
      if (!existingStep) return steps[0].id;
      return existing;
    });
  }, [steps]);

  const progressValue =
    steps.length > 0
      ? Math.round(
          (steps.filter((step) => step.complete).length / steps.length) * 100,
        )
      : 0;

  const complete = isOnboardingComplete({
    demoMode,
    settings,
    llmValid: llmValidated,
    baseResumeValid: baseResumeValidation.valid,
    searchTermsValid: searchTermsComplete,
  });

  const handleSaveLlm = useCallback(async () => {
    const values = getValues();
    const apiKeyValue = values.llmApiKey.trim();
    const baseUrlValue = values.llmBaseUrl.trim();
    const modelValue = values.model.trim();

    if (requiresLlmKey && !apiKeyValue && !hasLlmKey) {
      toast.info("Vui lòng thêm khóa API LLM để tiếp tục");
      return null;
    }

    const validation = await validateLlm();

    if (!validation.valid) {
      toast.error(validation.message || "Xác thực LLM thất bại");
      return null;
    }

    const update: Partial<UpdateSettingsInput> = {
      llmProvider: normalizedProvider,
      llmBaseUrl: showBaseUrl ? baseUrlValue || null : null,
      model: modelValue || null,
      modelScorer: null,
      modelTailoring: null,
      modelProjectSelection: null,
    };

    if (showApiKey && apiKeyValue) {
      update.llmApiKey = apiKeyValue;
    }

    try {
      setIsSaving(true);
      const nextSettings = await api.updateSettings(update);
      syncSettingsCache(nextSettings);
      setValue("llmApiKey", "");
      const defaultModel = getDefaultModelForProvider(normalizedProvider);
      toast.success("Đã kết nối nhà cung cấp LLM", {
        description: modelValue
          ? `Mô hình mặc định: ${modelValue}.`
          : normalizedProvider === "openai" ||
              normalizedProvider === "gemini" ||
              normalizedProvider === "gemini_cli"
            ? `Mặc định cho ${providerConfig.label}: ${defaultModel}.`
            : "Bạn có thể tinh chỉnh các mô hình sau trong phần Cài đặt.",
      });
      return nextSettings;
    } catch (error) {
      showErrorToast(error, "Lưu cài đặt LLM thất bại");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [
    getValues,
    hasLlmKey,
    normalizedProvider,
    providerConfig.label,
    requiresLlmKey,
    setValue,
    showApiKey,
    showBaseUrl,
    syncSettingsCache,
    validateLlm,
  ]);

  const handleSaveRxresume = useCallback(async () => {
    const values = getValues();
    const draftCredentials = getRxResumeCredentialDrafts({
      ...values,
      rxresumeUrl: isRxResumeSelfHosted ? values.rxresumeUrl : "",
    });
    const missing = getRxResumeMissingCredentialLabels({
      stored: storedRxResume,
      draft: draftCredentials,
    });

    if (missing.length > 0) {
      toast.info("Sắp hoàn tất", {
        description: `Còn thiếu: ${missing.join(", ")}`,
      });
      return null;
    }

    try {
      setIsValidatingRxresume(true);
      let nextSettings: AppSettings | null = null;
      const preserveBlankFields = isRxResumeSelfHosted
        ? undefined
        : (["baseUrl"] as const);
      const result = await validateAndMaybePersistRxResumeMode({
        stored: storedRxResume,
        draft: draftCredentials,
        validationPayloadOptions: preserveBlankFields
          ? {
              preserveBlankFields: [...preserveBlankFields],
            }
          : undefined,
        validate: api.validateRxresume,
        persist: async (update: Parameters<typeof api.updateSettings>[0]) => {
          setIsSaving(true);
          try {
            nextSettings = await api.updateSettings({
              ...update,
              pdfRenderer: "rxresume",
              rxresumeBaseResumeId: values.rxresumeBaseResumeId,
            });
            syncSettingsCache(nextSettings);
          } finally {
            setIsSaving(false);
          }
        },
        persistOnSuccess: true,
        getPrecheckMessage: () =>
          "Yêu cầu khóa API v5. Vui lòng thêm khóa API v5 rồi thử lại.",
        getValidationErrorMessage: (error: unknown) =>
          formatUserFacingError(error, "Xác thực RxResume thất bại"),
        getPersistErrorMessage: (error: unknown) =>
          formatUserFacingError(
            error,
            "Lưu thông tin xác thực RxResume thất bại",
          ),
      });

      setRxresumeValidation(toValidationState(result.validation));
      if (!result.validation.valid) {
        toast.error(result.validation.message || "Xác thực RxResume thất bại");
        return null;
      }

      setValue("rxresumeApiKey", "");
      const resumeValidation = await validateBaseResume();
      if (resumeValidation.valid) {
        toast.success("Đã kết nối Reactive Resume");
        return nextSettings ?? settings;
      }

      toast.info("Đã kết nối Reactive Resume", {
        description:
          resumeValidation.message || "Chọn một CV mẫu để hoàn thành bước này.",
      });
      return nextSettings ?? settings;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Lưu thông tin xác thực RxResume thất bại",
      );
      return null;
    } finally {
      setIsValidatingRxresume(false);
      setIsSaving(false);
    }
  }, [
    getValues,
    isRxResumeSelfHosted,
    settings,
    setValue,
    storedRxResume,
    syncSettingsCache,
    toValidationState,
    validateBaseResume,
  ]);

  const handleRxresumeSelfHostedChange = useCallback(
    (next: boolean) => {
      setIsRxResumeSelfHosted(next);
      if (!next) {
        setValue("rxresumeUrl", "");
      }
    },
    [setValue],
  );

  const handleResumeSetupModeChange = useCallback((mode: ResumeSetupMode) => {
    resumeSetupModeTouchedRef.current = true;
    setResumeSetupMode(mode);
  }, []);

  const markSearchTermsStale = useCallback(() => {
    const currentTerms = getValues().searchTerms;
    if (currentTerms.length === 0 && !hasSavedSearchTermsInSession) return;
    setSearchTermsSaved(false);
    setSearchTermsStale(true);
    setSearchTermsSource(null);
  }, [getValues, hasSavedSearchTermsInSession]);

  const handleGenerateSearchTerms = useCallback(
    async (options?: { showToast?: boolean }) => {
      try {
        setIsGeneratingSearchTerms(true);
        const result = await api.suggestOnboardingSearchTerms();
        setValue("searchTerms", result.terms, { shouldDirty: true });
        setValue("searchTermDraft", "");
        setSearchTermsSaved(false);
        setSearchTermsSource(result.source);
        setSearchTermsStale(false);

        if (options?.showToast) {
          toast.success("Đã làm mới các chức danh tìm kiếm", {
            description:
              result.source === "ai"
                ? "Các chức danh công việc đã được tạo từ CV hiện tại của bạn."
                : "Các chức danh công việc đã được làm mới từ nguồn dự phòng dựa trên CV.",
          });
        }

        return result;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to suggest search terms",
        );
        return null;
      } finally {
        setIsGeneratingSearchTerms(false);
      }
    },
    [setValue],
  );

  useEffect(() => {
    if (currentStep !== "searchterms") return;
    if (hasExplicitSearchTermsOverride) return;
    if (!baseResumeValidation.valid) return;
    if (autoSuggestionAttemptedRef.current) return;

    autoSuggestionAttemptedRef.current = true;
    void handleGenerateSearchTerms();
  }, [
    baseResumeValidation.valid,
    currentStep,
    handleGenerateSearchTerms,
    hasExplicitSearchTermsOverride,
  ]);

  const handleSaveBaseResume = useCallback(async () => {
    try {
      const validation = await validateBaseResume();
      if (!validation.valid) {
        toast.error(validation.message || "Xác thực CV thất bại");
        return null;
      }

      toast.success("Nguồn CV đã sẵn sàng");
      return settings ?? null;
    } catch (error) {
      showErrorToast(error, "Xác thực CV thất bại");
      return null;
    }
  }, [settings, validateBaseResume]);

  const handleImportResumeFile = useCallback(
    async (file: File) => {
      try {
        setIsImportingResume(true);
        const dataUrl = await fileToDataUrl(file);
        const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());

        if (!match) {
          throw new Error("Không thể mã hóa tệp CV để tải lên.");
        }

        const document = await api.importDesignResumeFromFile({
          fileName: file.name,
          mediaType: file.type || match[1],
          dataBase64: match[2],
        });

        queryClient.setQueryData(queryKeys.designResume.current(), document);
        queryClient.setQueryData(queryKeys.designResume.status(), {
          exists: true,
          documentId: document.id,
          updatedAt: document.updatedAt,
        });

        if (settings?.pdfRenderer?.value !== "latex") {
          const nextSettings = await api.updateSettings({
            pdfRenderer: "latex",
          });
          syncSettingsCache(nextSettings);
          setValue("pdfRenderer", "latex");
        }

        const validation = await validateBaseResume();
        if (!validation.valid) {
          throw new Error(validation.message || "Xác thực CV thất bại.");
        }

        toast.success("Đã tải lên CV", {
          description:
            settings?.pdfRenderer?.value === "latex"
              ? "Tài liệu Resume Studio cục bộ của bạn đã sẵn sàng."
              : "Tài liệu Resume Studio cục bộ của bạn đã sẵn sàng và cơ chế dựng PDF đã được chuyển sang LaTeX.",
        });
        markSearchTermsStale();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Nhập tệp CV thất bại",
        );
      } finally {
        setIsImportingResume(false);
      }
    },
    [
      queryClient,
      markSearchTermsStale,
      settings?.pdfRenderer?.value,
      setValue,
      syncSettingsCache,
      validateBaseResume,
    ],
  );

  const handleSaveSearchTerms = useCallback(async () => {
    const nextTerms = normalizeSearchTerms(getValues().searchTerms);

    if (nextTerms.length === 0) {
      toast.info("Vui lòng thêm ít nhất một chức danh công việc để tiếp tục");
      return null;
    }

    try {
      setIsSaving(true);
      const nextSettings = await api.updateSettings({
        searchTerms: nextTerms,
      });
      syncSettingsCache(nextSettings);
      setValue("searchTerms", nextTerms);
      setValue("searchTermDraft", "");
      setSearchTermsSaved(true);
      setHasSavedSearchTermsInSession(true);
      setSearchTermsStale(false);
      toast.success("Đã lưu các từ khóa tìm kiếm");
      return nextSettings;
    } catch (error) {
      showErrorToast(error, "Lưu từ khóa tìm kiếm thất bại");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [getValues, setValue, syncSettingsCache]);

  const baseResumeValue = watch("rxresumeBaseResumeId");
  const hasRxResumeAccess =
    rxresumeValidation.valid || Boolean(settings?.rxresumeApiKeyHint);
  const hasPendingLlmChanges = useMemo(() => {
    if (!settings) return true;

    const normalizedProviderDraft = normalizeLlmProvider(
      llmProvider || settings.llmProvider?.value || "openrouter",
    );
    const normalizedSavedProvider = normalizeLlmProvider(
      settings.llmProvider?.value || "openrouter",
    );
    const draftBaseUrl = llmBaseUrlValue.trim();
    const savedBaseUrl = settings.llmBaseUrl?.value?.trim() ?? "";
    const draftModel = modelDraftValue.trim();
    const savedModelOverride = settings.model?.override?.trim() ?? "";

    return (
      normalizedProviderDraft !== normalizedSavedProvider ||
      draftBaseUrl !== savedBaseUrl ||
      draftModel !== savedModelOverride ||
      llmApiKeyValue.trim().length > 0
    );
  }, [llmApiKeyValue, llmBaseUrlValue, llmProvider, modelDraftValue, settings]);

  const handleConfirmRxresumeTemplate = useCallback(async () => {
    const selectedResumeId = getValues().rxresumeBaseResumeId;
    if (!selectedResumeId) {
      toast.info("Vui lòng chọn một CV mẫu để tiếp tục");
      return null;
    }

    try {
      const validation = await validateBaseResume();
      if (!validation.valid) {
        toast.error(validation.message || "Xác thực CV thất bại");
        return null;
      }

      toast.success("Nguồn CV đã sẵn sàng");
      return settings ?? null;
    } catch (error) {
      showErrorToast(error, "Xác thực CV thất bại");
      return null;
    }
  }, [getValues, settings, validateBaseResume]);

  const handlePrimaryAction = useCallback(async () => {
    if (!currentStep) return null;
    if (currentStep === "llm") {
      if (llmValidated && !hasPendingLlmChanges) {
        return settings ?? null;
      }
      return await handleSaveLlm();
    }
    if (currentStep === "baseresume") {
      if (resumeSetupMode === "rxresume") {
        if (hasRxResumeAccess && !getValues().rxresumeApiKey.trim()) {
          return await handleConfirmRxresumeTemplate();
        }
        return await handleSaveRxresume();
      }
      return await handleSaveBaseResume();
    }
    if (currentStep === "searchterms") {
      return await handleSaveSearchTerms();
    }
    return null;
  }, [
    currentStep,
    getValues,
    handleSaveBaseResume,
    handleConfirmRxresumeTemplate,
    handleSaveLlm,
    handleSaveSearchTerms,
    handleSaveRxresume,
    hasRxResumeAccess,
    hasPendingLlmChanges,
    llmValidated,
    resumeSetupMode,
    settings,
  ]);

  const stepIndex = currentStep
    ? steps.findIndex((step) => step.id === currentStep)
    : 0;
  const canGoBack = stepIndex > 0;
  const isBusy =
    isSaving ||
    settingsLoading ||
    isImportingResume ||
    isGeneratingSearchTerms ||
    isValidatingLlm ||
    isValidatingRxresume ||
    isValidatingBaseResume;

  const currentCopy = currentStep ? STEP_COPY[currentStep] : STEP_COPY.llm;

  const primaryLabel =
    currentStep === "llm"
      ? llmValidated
        ? hasPendingLlmChanges
          ? "Xác thực lại kết nối"
          : "Tiếp tục"
        : "Lưu kết nối"
      : currentStep === "baseresume"
        ? resumeSetupMode === "rxresume"
          ? hasRxResumeAccess
            ? baseResumeValue
              ? "Kiểm tra lại Reactive Resume"
              : "Xác nhận CV mẫu"
            : "Kết nối Reactive Resume"
          : baseResumeValidation.valid
            ? "Kiểm tra lại CV"
            : "Kiểm tra CV"
        : currentStep === "searchterms"
          ? hasSavedSearchTermsInSession
            ? "Cập nhật từ khóa"
            : "Lưu từ khóa"
          : "Tiếp tục";

  return {
    baseResumeValidation,
    baseResumeValue,
    canGoBack,
    complete,
    control,
    currentCopy,
    currentStep,
    demoMode,
    handleRxresumeSelfHostedChange,
    handleImportResumeFile,
    isBusy,
    isGeneratingSearchTerms,
    isImportingResume,
    isRxResumeSelfHosted,
    hasSavedSearchTermsInSession,
    llmKeyHint,
    llmValidated,
    llmValidation,
    primaryLabel,
    progressValue,
    resumeSetupMode,
    rxresumeValidation,
    searchTermsComplete,
    searchTermsSource,
    searchTermsStale,
    selectedProvider,
    settings,
    settingsLoading,
    steps,
    watch,
    setCurrentStep,
    setResumeSetupMode: handleResumeSetupModeChange,
    setValue,
    setBaseResumeId,
    handleRegenerateSearchTerms: async () => {
      await handleGenerateSearchTerms({ showToast: true });
    },
    handleBack: () => {
      if (!canGoBack) return;
      setCurrentStep(steps[stepIndex - 1]?.id ?? currentStep);
    },
    handlePrimaryAction,
    handleTemplateResumeChange: (value: string | null) => {
      const currentValue = getValues().rxresumeBaseResumeId;
      if (currentValue === value) return;

      if (currentValue !== value) {
        markSearchTermsStale();
      }
      setBaseResumeId(value);
      setValue("rxresumeBaseResumeId", value);

      void (async () => {
        try {
          setIsSaving(true);
          const nextSettings = await api.updateSettings({
            pdfRenderer: "rxresume",
            rxresumeBaseResumeId: value,
          });
          syncSettingsCache(nextSettings);
          await validateBaseResume();
        } catch (error) {
          setBaseResumeId(currentValue);
          setValue("rxresumeBaseResumeId", currentValue);
          showErrorToast(error, "Lưu CV được chọn thất bại");
        } finally {
          setIsSaving(false);
        }
      })();
    },
  };
}
