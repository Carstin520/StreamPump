import Head from "next/head";
import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";

import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import {
  presignSponsorDocument,
  registerSponsorProfile,
} from "@/lib/api/auth";
import { SponsorType } from "@/lib/api/types";
import { getStoredAuthSession } from "@/lib/auth-session";
import { buildLoginHref } from "@/lib/routes";

type Step = 0 | 1 | 2 | 3;

type SponsorForm = {
  sponsorType: SponsorType;
  companyName: string;
  registrationNumber: string;
  legalRepresentative: string;
  contactPhone: string;
  contactEmail: string;
  businessLicenseKey: string;
  powerOfAttorneyKey: string;
};

const INITIAL_FORM: SponsorForm = {
  sponsorType: "BRAND",
  companyName: "",
  registrationNumber: "",
  legalRepresentative: "",
  contactPhone: "",
  contactEmail: "",
  businessLicenseKey: "",
  powerOfAttorneyKey: "",
};

const SPONSOR_TYPES: Array<{ value: SponsorType; label: string; body: string }> = [
  { value: "BRAND", label: "品牌方", body: "以自有品牌预算发起 S2 Campaign" },
  { value: "AGENCY", label: "代理商 / MCN", body: "代表多个品牌或创作者进行商业投放" },
  { value: "INDIVIDUAL", label: "个人商家", body: "小型商家或个人经营主体" },
];

function SponsorOfferLockNotice() {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const deadline = Date.now() + 24 * 3_600_000;
    const update = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const hours = remainingMs === null ? "--" : String(Math.floor(remainingMs / 3_600_000));
  const minutes =
    remainingMs === null ? "--" : String(Math.floor((remainingMs % 3_600_000) / 60_000));

  return (
    <div className="rounded-[14px] border border-[#f3b33e]/18 bg-[#1f1708]/45 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3c66e]">
        S1 Buyout 报价锁定
      </p>
      <p className="mt-1 text-sm text-[#f5d391]">锁定期剩余 {hours} 小时 {minutes} 分钟</p>
    </div>
  );
}

const uploadFileWithProgress = (
  url: string,
  file: File,
  onProgress: (value: number) => void
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(`upload failed with ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("upload failed"));
    xhr.send(file);
  });

export default function SponsorOnboardingPage() {
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<SponsorForm>(INITIAL_FORM);
  const [session, setSession] = useState(() => getStoredAuthSession());
  const [uploadProgress, setUploadProgress] = useState(0);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSession(getStoredAuthSession());
  }, []);

  const loginHref = useMemo(
    () => buildLoginHref({ nextPath: "/workspace/sponsor-onboarding" }),
    []
  );

  const updateField = <K extends keyof SponsorForm>(key: K, value: SponsorForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const uploadLicense = async (file: File) => {
    if (!session) {
      setStatusMessage("请先登录后再上传认证材料。");
      return;
    }

    setBusy(true);
    setUploadProgress(0);
    setStatusMessage("正在上传营业执照...");

    try {
      const upload = await presignSponsorDocument(
        {
          documentType: "BUSINESS_LICENSE",
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        },
        session.accessToken
      );
      await uploadFileWithProgress(upload.presignedUrl, file, setUploadProgress);
      updateField("businessLicenseKey", upload.storageKey);
      setLicensePreview(URL.createObjectURL(file));
      setStatusMessage("营业执照已上传，等待随表单提交。");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "营业执照上传失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadLicense(file);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadLicense(file);
  };

  const submit = async () => {
    if (!session) {
      setStatusMessage("请先登录。");
      return;
    }

    if (!form.businessLicenseKey) {
      setStatusMessage("请先上传营业执照。");
      setStep(1);
      return;
    }

    setBusy(true);
    setStatusMessage("正在提交 Sponsor KYB 资料...");

    try {
      await registerSponsorProfile(
        {
          ...form,
          powerOfAttorneyKey: form.powerOfAttorneyKey || null,
        },
        session.accessToken
      );
      setStatusMessage("资料已提交，当前状态为 PENDING_REVIEW。");
      setStep(3);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Sponsor 资料提交失败。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>StreamPump | Sponsor Onboarding</title>
      </Head>
      <WorkspaceShell stage="S2_ACTIVE" wallet={session?.wallet}>
        <div className="space-y-5">
          <ProductReadinessBanner
            description="Sponsor KYB submissions now write to backend SponsorProfile and operator review routes. Approval gates production proposal intent creation when a sponsor has submitted KYB; existing seeded/demo sponsors without KYB remain compatible."
            status="BACKEND_READY_UI_GAP"
            title="Sponsor KYB onboarding is connected to backend review state"
          />

          {!session ? (
            <section className="rounded-[18px] border border-white/[0.08] bg-[#111827]/90 p-6">
              <h1 className="text-2xl font-semibold text-white">Sponsor 企业认证</h1>
              <p className="mt-3 text-sm leading-6 text-[#9fb0ca]">
                提交企业认证前需要先完成 StreamPump 登录，并选择托管账户或绑定官方管理钱包。
              </p>
              <Link className="mt-5 inline-flex rounded-full bg-[#de402a] px-5 py-2.5 text-sm font-semibold text-white" href={loginHref}>
                登录后继续
              </Link>
            </section>
          ) : (
            <section className="rounded-[18px] border border-white/[0.08] bg-[#111827]/90 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7f90ab]">Sponsor KYB</p>
                  <h1 className="mt-2 text-2xl font-semibold text-white">赞助商准入申请</h1>
                </div>
                <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-[#9fb0ca]">
                  {session.wallet.slice(0, 4)}...{session.wallet.slice(-4)}
                </div>
              </div>

              <div className="mt-4">
                <SponsorOfferLockNotice />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
                <nav className="space-y-2">
                  {["主体选择", "合规信息", "授权绑定", "等待审核"].map((label, index) => (
                    <button
                      className={`w-full rounded-xl px-4 py-3 text-left text-sm transition ${
                        step === index
                          ? "bg-[#de402a] text-white"
                          : "bg-white/[0.04] text-[#9fb0ca] hover:bg-white/[0.07]"
                      }`}
                      key={label}
                      onClick={() => setStep(index as Step)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                <div className="min-h-[420px]">
                  {step === 0 ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      {SPONSOR_TYPES.map((type) => (
                        <button
                          className={`rounded-[14px] border p-4 text-left transition ${
                            form.sponsorType === type.value
                              ? "border-[#de402a]/70 bg-[#2a1714] text-white"
                              : "border-white/[0.08] bg-white/[0.03] text-[#b9c5d8]"
                          }`}
                          key={type.value}
                          onClick={() => updateField("sponsorType", type.value)}
                          type="button"
                        >
                          <span className="block text-base font-semibold">{type.label}</span>
                          <span className="mt-2 block text-xs leading-5 text-[#8ea0ba]">{type.body}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField label="企业 / 主体名称" value={form.companyName} onChange={(value) => updateField("companyName", value)} />
                      <TextField label="统一社会信用代码 / EIN" value={form.registrationNumber} onChange={(value) => updateField("registrationNumber", value)} />
                      <TextField label="法人 / 负责人" value={form.legalRepresentative} onChange={(value) => updateField("legalRepresentative", value)} />
                      <TextField label="联系电话" value={form.contactPhone} onChange={(value) => updateField("contactPhone", value)} />
                      <TextField label="联系邮箱" value={form.contactEmail} onChange={(value) => updateField("contactEmail", value)} />
                      <label
                        className="flex min-h-[168px] cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.14] bg-white/[0.03] p-4 text-center transition hover:border-[#de402a]/60 md:row-span-2"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleDrop}
                      >
                        {licensePreview ? (
                          <img alt="Business license preview" className="mb-3 max-h-28 rounded-lg object-contain" src={licensePreview} />
                        ) : null}
                        <span className="text-sm font-semibold text-white">上传营业执照图片</span>
                        <span className="mt-2 text-xs text-[#8ea0ba]">PNG / JPG / WebP，最大 12 MiB</span>
                        <input accept="image/*" className="hidden" onChange={handleFileInput} type="file" />
                        {uploadProgress > 0 ? (
                          <span className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                            <span className="block h-full bg-[#65ecaf]" style={{ width: `${uploadProgress}%` }} />
                          </span>
                        ) : null}
                      </label>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-4">
                      <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4">
                        <p className="text-sm font-semibold text-white">官方管理钱包</p>
                        <p className="mt-2 break-all text-sm text-[#9fb0ca]">{session.wallet}</p>
                        <p className="mt-3 text-xs leading-5 text-[#7f90ab]">
                          若需要使用 Gnosis Safe 或其他多签钱包，请先在登录页选择“连接自己的 Solana 钱包”，再返回本页提交。
                        </p>
                      </div>
                      <TextField label="授权委托书 storageKey（非法人经办时填写）" value={form.powerOfAttorneyKey} onChange={(value) => updateField("powerOfAttorneyKey", value)} />
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="rounded-[14px] border border-[#65ecaf]/20 bg-[#0e1f17]/45 p-5">
                      <p className="text-lg font-semibold text-[#8df0c4]">已进入审核队列</p>
                      <p className="mt-3 text-sm leading-6 text-[#a7d8c3]">
                        Operator 审核通过后，该钱包对应的 SponsorProfile 会变为 APPROVED，并解锁生产 S2 Proposal 创建与注资权限。
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="min-h-5 text-sm text-[#8ea0ba]">{statusMessage}</p>
                    <div className="flex gap-2">
                      {step > 0 && step < 3 ? (
                        <button className="glass-button-ghost px-4 py-2 text-sm" onClick={() => setStep((step - 1) as Step)} type="button">
                          上一步
                        </button>
                      ) : null}
                      {step < 2 ? (
                        <button className="rounded-full bg-[#de402a] px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60" disabled={busy} onClick={() => setStep((step + 1) as Step)} type="button">
                          下一步
                        </button>
                      ) : step === 2 ? (
                        <button className="rounded-full bg-[#de402a] px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60" disabled={busy} onClick={() => void submit()} type="button">
                          提交审核
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </WorkspaceShell>
    </>
  );
}

const TextField = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[#7f90ab]">
      {label}
    </span>
    <input
      className="input-glass w-full rounded-xl border border-white/[0.08] bg-[#0d1420]/90 px-4 py-3 text-sm text-white outline-none transition focus:border-[#de513c]/60"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  </label>
);
