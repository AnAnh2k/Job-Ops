import * as api from "@client/api";
import { ListItem } from "@client/components/layout";
import { PipelineProgress } from "@client/components/PipelineProgress";
import { queryKeys } from "@client/lib/queryKeys";
import { sourceLabel } from "@shared/extractors";
import type { PipelineRun, PipelineRunInsights } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Clock3,
  GitCompareArrows,
  History,
  Loader2,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/utils";
import {
  formatPipelineDuration,
  getPipelineRunDisplayStatus,
  getPipelineRunStatusLabel,
  type PipelineRunDisplayStatus,
} from "./pipelineRuns";

const RECENT_RUN_LIMIT = 8;

const statusBadgeClasses: Record<PipelineRunDisplayStatus, string> = {
  running: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  cancelled: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  incomplete: "border-slate-500/30 bg-slate-500/10 text-slate-200",
};

function getDurationMs(run: PipelineRun): number | null {
  if (run.completedAt == null) return null;
  return Math.max(
    0,
    new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime(),
  );
}

function getRunReason(
  run: PipelineRun,
  displayStatus: PipelineRunDisplayStatus,
) {
  if (run.errorMessage) return run.errorMessage;
  if (displayStatus === "cancelled")
    return "Lần chạy bị hủy trước khi hoàn thành.";
  if (displayStatus === "incomplete") {
    return "Lần chạy lịch sử này không ghi nhận mốc thời gian hoàn thành.";
  }
  return null;
}

function MetricCard(props: {
  label: string;
  value: React.ReactNode;
  hint?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        {props.value}
      </div>
      {props.hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div>
      ) : null}
    </div>
  );
}

function RunStatusBadge(props: { status: PipelineRunDisplayStatus }) {
  return (
    <Badge variant="outline" className={statusBadgeClasses[props.status]}>
      {getPipelineRunStatusLabel(props.status)}
    </Badge>
  );
}

function formatSourceList(sources: string[]) {
  if (sources.length === 0) return "Không";
  return sources.join(", ");
}

function formatToggleState(value: boolean) {
  return value ? "Đã bật" : "Đã tắt";
}

function formatStageLabel(stage: string) {
  return stage.replace(/_/g, " ");
}

function RunsList(props: {
  runs: PipelineRun[];
  activeRunId: string | null;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[minmax(0,1.6fr)_auto_auto_auto] gap-3 px-3 text-xs text-muted-foreground md:grid">
        <div>Lần chạy</div>
        <div>Trạng thái</div>
        <div>Tìm thấy</div>
        <div>Đã xử lý</div>
      </div>

      <div className="space-y-2">
        {props.runs.map((run) => {
          const displayStatus = getPipelineRunDisplayStatus(run, {
            isActive: props.activeRunId === run.id,
          });
          const duration = formatPipelineDuration(getDurationMs(run));
          const isSelected = props.selectedRunId === run.id;

          return (
            <ListItem
              key={run.id}
              onClick={() => props.onSelectRun(run.id)}
              selected={isSelected}
              className={`grid gap-3 rounded-lg border px-3 py-3 md:grid-cols-[minmax(0,1.6fr)_auto_auto_auto] ${
                isSelected
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 hover:bg-muted/30"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {formatDateTime(run.startedAt) ?? run.startedAt}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Lần chạy {run.id.slice(0, 8)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Thời gian: {duration}
                </div>
              </div>
              <div className="md:self-center">
                <RunStatusBadge status={displayStatus} />
              </div>
              <div className="md:self-center md:text-right">
                <div className="text-xs text-muted-foreground md:hidden">
                  Tìm thấy
                </div>
                <div className="font-medium tabular-nums">
                  {run.jobsDiscovered.toLocaleString()}
                </div>
              </div>
              <div className="md:self-center md:text-right">
                <div className="text-xs text-muted-foreground md:hidden">
                  Đã xử lý
                </div>
                <div className="font-medium tabular-nums">
                  {run.jobsProcessed.toLocaleString()}
                </div>
              </div>
            </ListItem>
          );
        })}
      </div>
    </div>
  );
}

function RunInsightsBody(props: {
  insights: PipelineRunInsights;
  isActiveRun: boolean;
}) {
  const { run, exactMetrics, inferredMetrics } = props.insights;
  const savedDetails = props.insights.savedDetails;
  const displayStatus = getPipelineRunDisplayStatus(run, {
    isActive: props.isActiveRun,
  });
  const runReason = getRunReason(run, displayStatus);
  const inferredHint =
    inferredMetrics.jobsCreated.quality === "unavailable"
      ? "Không khả dụng cho các tiến trình chưa hoàn tất."
      : "Số lượng ước tính được suy luận từ mốc thời gian công việc trong cửa sổ chạy. Các hoạt động công việc khác trong cùng khoảng thời gian có thể được bao gồm.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <RunStatusBadge status={displayStatus} />
        <span className="text-sm text-muted-foreground">
          Đã bắt đầu {formatDateTime(run.startedAt) ?? run.startedAt}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Thời gian"
          value={formatPipelineDuration(exactMetrics.durationMs)}
        />
        <MetricCard
          label="Công việc tìm thấy"
          value={run.jobsDiscovered.toLocaleString()}
        />
        <MetricCard
          label="Công việc đã xử lý"
          value={run.jobsProcessed.toLocaleString()}
        />
        <MetricCard
          label="Đã hoàn thành"
          value={formatDateTime(run.completedAt) ?? "Không được ghi nhận"}
        />
      </div>

      {runReason ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          <div className="font-medium">Ghi chú</div>
          <div className="mt-1 text-muted-foreground">{runReason}</div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="font-medium">Cài đặt đã lưu</div>
        {savedDetails ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-sm font-medium">Yêu cầu chạy</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Top N"
                  value={savedDetails.requestedConfig.topN.toLocaleString()}
                />
                <MetricCard
                  label="Điểm phù hợp tối thiểu"
                  value={savedDetails.requestedConfig.minSuitabilityScore.toLocaleString()}
                />
                <MetricCard
                  label="Nguồn tuyển dụng"
                  value={formatSourceList(
                    savedDetails.requestedConfig.sources.map(sourceLabel),
                  )}
                />
                <MetricCard
                  label="Thu thập dữ liệu (Crawling)"
                  value={formatToggleState(
                    savedDetails.requestedConfig.enableCrawling,
                  )}
                />
                <MetricCard
                  label="Chấm điểm (Scoring)"
                  value={formatToggleState(
                    savedDetails.requestedConfig.enableScoring,
                  )}
                />
                <MetricCard
                  label="Nhập dữ liệu (Importing)"
                  value={formatToggleState(
                    savedDetails.requestedConfig.enableImporting,
                  )}
                />
                <MetricCard
                  label="Tự động tinh chỉnh CV"
                  value={formatToggleState(
                    savedDetails.requestedConfig.enableAutoTailoring,
                  )}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-sm font-medium">Cài đặt hiệu dụng</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Quốc gia"
                  value={
                    savedDetails.effectiveConfig.countryLabel ??
                    "Không giới hạn"
                  }
                />
                <MetricCard
                  label="Thành phố"
                  value={
                    savedDetails.effectiveConfig.searchCities.length > 0
                      ? savedDetails.effectiveConfig.searchCities.join(", ")
                      : "Không giới hạn"
                  }
                />
                <MetricCard
                  label="Hình thức làm việc"
                  value={
                    savedDetails.effectiveConfig.workplaceTypes.length > 0
                      ? savedDetails.effectiveConfig.workplaceTypes.join(", ")
                      : "Không giới hạn"
                  }
                />
                <MetricCard
                  label="Khớp địa điểm"
                  value={`${formatStageLabel(
                    savedDetails.effectiveConfig.locationSearchScope,
                  )}; ${formatStageLabel(
                    savedDetails.effectiveConfig.locationMatchStrictness,
                  )}`}
                />
                <MetricCard
                  label="Nguồn tương thích"
                  value={formatSourceList(
                    savedDetails.effectiveConfig.compatibleSources.map(
                      sourceLabel,
                    ),
                  )}
                />
                <MetricCard
                  label="Nguồn bị bỏ qua"
                  value={
                    savedDetails.effectiveConfig.skippedSources.length > 0
                      ? savedDetails.effectiveConfig.skippedSources
                          .map((entry) => sourceLabel(entry.source))
                          .join(", ")
                      : "Không"
                  }
                  hint={
                    savedDetails.effectiveConfig.skippedSources.length > 0
                      ? savedDetails.effectiveConfig.skippedSources
                          .map((entry) => entry.reason)
                          .join(" ")
                      : null
                  }
                />
                <MetricCard
                  label="Từ khóa tìm kiếm"
                  value={savedDetails.effectiveConfig.searchTermsCount.toLocaleString()}
                />
                <MetricCard
                  label="Bộ lọc công ty bị chặn"
                  value={savedDetails.effectiveConfig.blockedCompanyKeywordsCount.toLocaleString()}
                />
                <MetricCard
                  label="Ngưỡng tự động bỏ qua"
                  value={
                    savedDetails.effectiveConfig.autoSkipScoreThreshold == null
                      ? "Tắt"
                      : savedDetails.effectiveConfig.autoSkipScoreThreshold.toLocaleString()
                  }
                />
                <MetricCard
                  label="Cơ chế dựng PDF"
                  value={savedDetails.effectiveConfig.pdfRenderer}
                />
                <MetricCard
                  label="Giới hạn nguồn"
                  value={`Indeed ${savedDetails.effectiveConfig.sourceLimits.jobspyResultsWanted}; UK Visa Jobs ${savedDetails.effectiveConfig.sourceLimits.ukvisajobsMaxJobs}`}
                  hint={`Adzuna ${savedDetails.effectiveConfig.sourceLimits.adzunaMaxJobsPerTerm}; Gradcracker ${savedDetails.effectiveConfig.sourceLimits.gradcrackerMaxJobsPerTerm}; startup.jobs ${savedDetails.effectiveConfig.sourceLimits.startupjobsMaxJobsPerTerm}; Jobindex ${savedDetails.effectiveConfig.sourceLimits.jobindexMaxJobsPerTerm}`}
                />
                <MetricCard
                  label="Dự án trong CV"
                  value={`${savedDetails.effectiveConfig.resumeProjects.maxProjects} tối đa`}
                  hint={`${savedDetails.effectiveConfig.resumeProjects.lockedProjectCount} đã khóa, ${savedDetails.effectiveConfig.resumeProjects.aiSelectableProjectCount} AI có thể chọn`}
                />
                <MetricCard
                  label="Mô hình"
                  value={savedDetails.effectiveConfig.models.scorer}
                  hint={`Tinh chỉnh: ${savedDetails.effectiveConfig.models.tailoring}; Chọn dự án: ${savedDetails.effectiveConfig.models.projectSelection}`}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-sm font-medium">Tóm tắt thực thi đã lưu</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Giai đoạn ghi nhận cuối"
                  value={formatStageLabel(savedDetails.resultSummary.stage)}
                />
                <MetricCard
                  label="Công việc đã chấm điểm"
                  value={
                    savedDetails.resultSummary.jobsScored == null
                      ? "Không được ghi nhận"
                      : savedDetails.resultSummary.jobsScored.toLocaleString()
                  }
                />
                <MetricCard
                  label="Công việc được chọn"
                  value={
                    savedDetails.resultSummary.jobsSelected == null
                      ? "Không được ghi nhận"
                      : savedDetails.resultSummary.jobsSelected.toLocaleString()
                  }
                />
                <MetricCard
                  label="Lỗi nguồn dữ liệu"
                  value={savedDetails.resultSummary.sourceErrors.length.toLocaleString()}
                />
              </div>
              {savedDetails.resultSummary.sourceErrors.length > 0 ? (
                <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
                  {savedDetails.resultSummary.sourceErrors.join(" ")}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
            Các cài đặt chạy đã lưu khả dụng cho các tiến trình chạy pipeline
            mới hơn.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium">Thay đổi</div>
          <Badge variant="outline">Suy luận từ mốc thời gian</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{inferredHint}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Công việc đã tạo"
            value={
              inferredMetrics.jobsCreated.value == null
                ? "Không có sẵn"
                : inferredMetrics.jobsCreated.value.toLocaleString()
            }
          />
          <MetricCard
            label="Công việc đã cập nhật"
            value={
              inferredMetrics.jobsUpdated.value == null
                ? "Không có sẵn"
                : inferredMetrics.jobsUpdated.value.toLocaleString()
            }
          />
          <MetricCard
            label="Công việc đã xử lý"
            value={
              inferredMetrics.jobsProcessed.value == null
                ? "Không có sẵn"
                : inferredMetrics.jobsProcessed.value.toLocaleString()
            }
          />
        </div>
      </div>
    </div>
  );
}

export const OverviewPipelineRunsSection: React.FC = () => {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const pipelineStatusQuery = useQuery({
    queryKey: queryKeys.pipeline.status(),
    queryFn: api.getPipelineStatus,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const pipelineRunsQuery = useQuery({
    queryKey: queryKeys.pipeline.runs(),
    queryFn: api.getPipelineRuns,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });
  const runInsightsQuery = useQuery({
    queryKey: queryKeys.pipeline.runInsights(selectedRunId ?? ""),
    queryFn: () => api.getPipelineRunInsights(selectedRunId as string),
    enabled: selectedRunId != null,
  });

  const recentRuns = useMemo(
    () => (pipelineRunsQuery.data ?? []).slice(0, RECENT_RUN_LIMIT),
    [pipelineRunsQuery.data],
  );
  const latestRun = pipelineStatusQuery.data?.lastRun ?? recentRuns[0] ?? null;
  const activeRunId = pipelineStatusQuery.data?.isRunning
    ? (latestRun?.id ?? null)
    : null;
  const currentStatus = latestRun
    ? getPipelineRunDisplayStatus(latestRun, {
        isActive: activeRunId === latestRun.id,
      })
    : null;
  const currentStatusText = pipelineStatusQuery.data?.isRunning
    ? "Tiến trình chạy pipeline hiện đang được thực hiện."
    : latestRun
      ? (getRunReason(latestRun, currentStatus as PipelineRunDisplayStatus) ??
        "Hoạt động pipeline gần nhất được hiển thị bên dưới.")
      : "Chưa ghi nhận tiến trình chạy pipeline nào.";
  const selectedRun = useMemo(
    () =>
      (pipelineRunsQuery.data ?? []).find((run) => run.id === selectedRunId) ??
      (latestRun?.id === selectedRunId ? latestRun : null),
    [latestRun, pipelineRunsQuery.data, selectedRunId],
  );

  const isLoading =
    pipelineStatusQuery.isLoading ||
    pipelineRunsQuery.isLoading ||
    (selectedRunId != null && runInsightsQuery.isLoading);
  const error =
    pipelineStatusQuery.error ??
    pipelineRunsQuery.error ??
    runInsightsQuery.error;
  const statusError = pipelineStatusQuery.error;
  const runsError = pipelineRunsQuery.error;

  return (
    <>
      <Card className="border-border/60 bg-card shadow-none">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Tiến trình chạy Pipeline</CardTitle>
              </div>
              <CardDescription>
                Xem các hoạt động gần đây của pipeline ngay tại trang Tổng quan.
              </CardDescription>
            </div>
            {currentStatus ? <RunStatusBadge status={currentStatus} /> : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {pipelineStatusQuery.data?.isRunning ? (
            <PipelineProgress isRunning />
          ) : null}

          {isLoading && !latestRun && recentRuns.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tải lịch sử pipeline…</span>
            </div>
          ) : null}

          {error && !latestRun && recentRuns.length === 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Tải lịch sử pipeline thất bại"}
            </div>
          ) : null}

          {latestRun ? (
            <>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span>Trạng thái hiện tại</span>
                  </div>
                  {statusError ? (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      Trạng thái trực tiếp tạm thời không khả dụng. Đang hiển
                      thị lịch sử chạy được lưu gần nhất.
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {currentStatus ? (
                      <RunStatusBadge status={currentStatus} />
                    ) : null}
                    <span className="text-sm text-muted-foreground">
                      {currentStatusText}
                    </span>
                  </div>
                  {pipelineStatusQuery.data?.nextScheduledRun ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Lần chạy dự kiến tiếp theo{" "}
                      {formatDateTime(
                        pipelineStatusQuery.data.nextScheduledRun,
                      ) ?? pipelineStatusQuery.data.nextScheduledRun}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Lần chạy cuối"
                    value={
                      formatDateTime(latestRun.startedAt) ?? latestRun.startedAt
                    }
                  />
                  <MetricCard
                    label="Thời gian"
                    value={formatPipelineDuration(getDurationMs(latestRun))}
                  />
                  <MetricCard
                    label="Công việc tìm thấy"
                    value={latestRun.jobsDiscovered.toLocaleString()}
                  />
                  <MetricCard
                    label="Công việc đã xử lý"
                    value={latestRun.jobsProcessed.toLocaleString()}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                  <div className="font-medium">Các lần chạy gần đây</div>
                </div>
                {runsError ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    Lịch sử các lần chạy gần đây tạm thời chưa thể làm mới.
                  </div>
                ) : null}
                <RunsList
                  runs={recentRuns}
                  activeRunId={activeRunId}
                  selectedRunId={selectedRunId}
                  onSelectRun={setSelectedRunId}
                />
              </div>
            </>
          ) : null}

          {!isLoading && !error && !latestRun ? (
            <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center">
              <div className="font-medium">
                Chưa có tiến trình chạy pipeline nào
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Khi pipeline chạy, phần này sẽ hiển thị trạng thái, lịch sử gần
                đây và các thay đổi được suy luận.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Sheet
        open={selectedRunId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedRunId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4" />
              Chi tiết lần chạy
            </SheetTitle>
            <SheetDescription>
              {selectedRun
                ? `Kiểm tra các tín hiệu chính xác và suy luận cho lần chạy ${selectedRun.id.slice(
                    0,
                    8,
                  )}.`
                : "Kiểm tra các tín hiệu chính xác và suy luận cho lần chạy được chọn."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {runInsightsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang tải chi tiết lần chạy…</span>
              </div>
            ) : null}

            {runInsightsQuery.error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {runInsightsQuery.error instanceof Error
                  ? runInsightsQuery.error.message
                  : "Tải chi tiết lần chạy thất bại"}
              </div>
            ) : null}

            {runInsightsQuery.data ? (
              <RunInsightsBody
                insights={runInsightsQuery.data}
                isActiveRun={activeRunId === runInsightsQuery.data.run.id}
              />
            ) : null}

            {!runInsightsQuery.isLoading &&
            !runInsightsQuery.error &&
            selectedRunId != null &&
            !runInsightsQuery.data ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>Chi tiết lần chạy không khả dụng</span>
                </div>
                <div className="mt-2">
                  Không thể tải lần chạy được chọn. Vui lòng thử chọn lại.
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
