import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BadgeInfo,
  DatabaseBackup,
  RefreshCcw,
  RotateCcw,
  Settings,
} from "lucide-react";

import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  backupDatabase,
  getAppVersionInfo,
  getDatabasePath,
  restoreDatabase,
  type RestoreDatabaseResult,
  selectRestoreDatabaseFile,
} from "@/features/settings/api/settings-api";
import {
  readLastBackupInfo,
  saveLastBackupInfo,
  type LastBackupInfo,
} from "@/features/settings/api/settings-storage";
import { formatAppDateTime } from "@/lib/datetime";
import { getErrorMessage } from "@/lib/errors";

const restoreDialogContentClassName =
  "w-[min(520px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-md";
const restorePathCardClassName =
  "min-w-0 overflow-hidden rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground";

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [restorePath, setRestorePath] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] =
    useState<RestoreDatabaseResult | null>(null);
  const [lastBackup, setLastBackup] = useState<LastBackupInfo | null>(() =>
    readLastBackupInfo(),
  );
  const databasePathQuery = useQuery({
    queryKey: ["database-path"],
    queryFn: getDatabasePath,
  });
  const appVersionQuery = useQuery({
    queryKey: ["app-version-info"],
    queryFn: getAppVersionInfo,
  });
  const backupDatabaseMutation = useMutation({
    mutationFn: backupDatabase,
    onSuccess: (path) => {
      if (!path) {
        return;
      }

      const nextBackup: LastBackupInfo = {
        createdAt: new Date().toISOString(),
        path,
        reason: "manual",
      };

      saveLastBackupInfo(nextBackup);
      setLastBackup(nextBackup);
    },
  });
  const restoreDatabaseMutation = useMutation({
    mutationFn: (path: string) => restoreDatabase(path),
    onSuccess: async (result) => {
      const nextBackup: LastBackupInfo = {
        createdAt: new Date().toISOString(),
        path: result.safetyBackupPath,
        reason: "restore-safety",
      };

      saveLastBackupInfo(nextBackup);
      setLastBackup(nextBackup);
      await queryClient.invalidateQueries();
      setRestorePath(null);
      setRestoreSuccess(result);
      void databasePathQuery.refetch();
    },
  });
  const databasePath = databasePathQuery.data ?? "正在读取本地数据库路径";
  const appVersionInfo = appVersionQuery.data;
  const appVersionText = appVersionInfo
    ? `${appVersionInfo.version} · ${
        appVersionInfo.runtime === "tauri" ? "桌面 App" : "浏览器预览"
      }`
    : "正在读取应用版本";
  const appBuildTimeText = appVersionInfo?.buildTime
    ? formatAppDateTime(appVersionInfo.buildTime, { includeYear: true })
    : "正在读取构建时间";

  async function chooseRestoreFile() {
    restoreDatabaseMutation.reset();
    setRestoreSuccess(null);
    const path = await selectRestoreDatabaseFile();

    if (path) {
      setRestorePath(path);
    }
  }

  return (
    <section className="workspace-card settings-card overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="border-b px-4 py-3">
        <SectionHeading
          description="管理本地数据文件、备份和后续应用偏好。"
          icon={<Settings className="size-4" />}
          title="系统设置"
        />
      </div>

      <div className="settings-content divide-y">
        <div className="grid gap-3 px-4 py-4 md:grid-cols-[160px_1fr_auto] md:items-center">
          <div>
            <div className="text-sm font-medium">应用版本</div>
            <div className="mt-1 text-xs text-muted-foreground">
              当前正在运行的应用包信息
            </div>
          </div>
          <div className="min-w-0 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{appVersionText}</div>
            <div className="mt-1 break-all font-mono text-xs">
              构建时间：{appBuildTimeText}
            </div>
          </div>
          <Button
            disabled={appVersionQuery.isFetching}
            onClick={() => void appVersionQuery.refetch()}
            size="sm"
            variant="outline"
          >
            <BadgeInfo className="size-4" />
            核对版本
          </Button>
        </div>

        <div className="grid gap-3 px-4 py-4 md:grid-cols-[160px_1fr_auto] md:items-center">
          <div>
            <div className="text-sm font-medium">数据库位置</div>
            <div className="mt-1 text-xs text-muted-foreground">
              当前订单、商品等数据保存位置
            </div>
          </div>
          <div className="min-w-0 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
            <div className="truncate">{databasePath}</div>
          </div>
          <Button
            disabled={databasePathQuery.isFetching}
            onClick={() => void databasePathQuery.refetch()}
            size="sm"
            variant="outline"
          >
            <RefreshCcw
              className={
                databasePathQuery.isFetching ? "size-4 animate-spin" : "size-4"
              }
            />
            刷新
          </Button>
        </div>

        <div className="grid gap-3 px-4 py-4 md:grid-cols-[160px_1fr_auto] md:items-center">
          <div>
            <div className="text-sm font-medium">数据库备份</div>
            <div className="mt-1 text-xs text-muted-foreground">
              生成可恢复的 SQLite 备份文件
            </div>
          </div>
          <div className="min-w-0 text-sm text-muted-foreground">
            {backupDatabaseMutation.data ? (
              <span className="break-all">
                已备份到：{backupDatabaseMutation.data}
              </span>
            ) : lastBackup ? (
              <span className="break-all">
                最近备份：
                {formatAppDateTime(lastBackup.createdAt, {
                  includeYear: true,
                })}
                {" · "}
                {lastBackup.reason === "restore-safety"
                  ? "恢复前安全备份"
                  : "手动备份"}
                {" · "}
                {lastBackup.path}
              </span>
            ) : (
              "建议在重要数据变更后手动备份一次。"
            )}
          </div>
          <Button
            disabled={backupDatabaseMutation.isPending}
            onClick={() => backupDatabaseMutation.mutate()}
            size="sm"
          >
            <DatabaseBackup className="size-4" />
            {backupDatabaseMutation.isPending ? "备份中" : "备份数据库"}
          </Button>
        </div>

        <div className="grid gap-3 px-4 py-4 md:grid-cols-[160px_1fr_auto] md:items-center">
          <div>
            <div className="text-sm font-medium">恢复备份</div>
            <div className="mt-1 text-xs text-muted-foreground">
              从 SQLite 备份文件恢复当前数据
            </div>
          </div>
          <div className="min-w-0 truncate text-sm text-muted-foreground">
            {restoreSuccess
              ? `已恢复，恢复前安全备份：${restoreSuccess.safetyBackupPath}`
              : "恢复会覆盖当前数据；系统会先自动备份当前数据库。"}
          </div>
          <Button
            disabled={restoreDatabaseMutation.isPending}
            onClick={() => void chooseRestoreFile()}
            size="sm"
            variant="outline"
          >
            <RotateCcw className="size-4" />
            {restoreDatabaseMutation.isPending ? "恢复中" : "恢复备份"}
          </Button>
        </div>

        {(appVersionQuery.isError ||
          databasePathQuery.isError ||
          backupDatabaseMutation.isError ||
          restoreDatabaseMutation.isError) && (
          <div className="px-4 py-3 text-sm text-destructive">
            {getErrorMessage(
              appVersionQuery.error ??
                databasePathQuery.error ??
                backupDatabaseMutation.error ??
                restoreDatabaseMutation.error,
            )}
          </div>
        )}
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRestorePath(null);
            restoreDatabaseMutation.reset();
          }
        }}
        open={Boolean(restorePath)}
      >
        <DialogContent className={restoreDialogContentClassName}>
          <DialogHeader>
            <DialogTitle>恢复数据库备份</DialogTitle>
            <DialogDescription>
              这会覆盖当前订单、商品和相关数据。恢复前系统会自动备份当前数据库。
            </DialogDescription>
          </DialogHeader>

          {restorePath && (
            <div className={`${restorePathCardClassName} font-mono`}>
              <div className="break-all">{restorePath}</div>
            </div>
          )}

          {restoreDatabaseMutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(restoreDatabaseMutation.error)}
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={restoreDatabaseMutation.isPending}
              onClick={() => setRestorePath(null)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={restoreDatabaseMutation.isPending || !restorePath}
              onClick={() => {
                if (restorePath) {
                  restoreDatabaseMutation.mutate(restorePath);
                }
              }}
              type="button"
              variant="destructive"
            >
              {restoreDatabaseMutation.isPending ? "恢复中" : "确认恢复"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && restoreSuccess) {
            setRestoreSuccess(null);
            navigate({ to: "/" });
          }
        }}
        open={Boolean(restoreSuccess)}
      >
        <DialogContent className={restoreDialogContentClassName}>
          <DialogHeader>
            <DialogTitle>数据库已恢复</DialogTitle>
            <DialogDescription>
              当前数据已切换为所选备份。恢复前，系统已自动保存一份安全备份。
            </DialogDescription>
          </DialogHeader>

          {restoreSuccess && (
            <div className={`${restorePathCardClassName} space-y-2`}>
              <div className="min-w-0">
                <div className="mb-1 font-medium text-foreground">
                  当前数据库
                </div>
                <div className="break-all font-mono">
                  {restoreSuccess.restoredPath}
                </div>
              </div>
              <div className="min-w-0">
                <div className="mb-1 font-medium text-foreground">
                  恢复前安全备份
                </div>
                <div className="break-all font-mono">
                  {restoreSuccess.safetyBackupPath}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setRestoreSuccess(null);
                navigate({ to: "/" });
              }}
              type="button"
            >
              查看订单列表
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
