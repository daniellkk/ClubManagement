import { ArrowLeft, ArrowRight, Save, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { fetchFan, seatLabel, subTypeLabel, updateFan, type FanDetail } from "../lib/fans-api";
import { currentLang } from "../lib/i18n";
import { useAsync } from "../lib/use-async";

export function FanEditPage() {
  const { id } = useParams();
  const { data: fan, loading, error } = useAsync(
    () => (id ? fetchFan(id) : Promise.reject(new Error("missing id"))),
    [id],
  );

  if (loading && !fan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !fan) return <Navigate to="/fans" replace />;
  return <FanEditForm key={fan.id} fan={fan} />;
}

function FanEditForm({ fan }: { fan: FanDetail }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const BackArrow = currentLang() === "he" ? ArrowRight : ArrowLeft;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: fan.firstName,
    lastName: fan.lastName,
    age: fan.age,
    city: fan.city ?? "",
    email: fan.email ?? "",
    phone: fan.phone ?? "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await updateFan(fan.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(form.age !== null ? { age: form.age } : {}),
        ...(form.city.trim() ? { city: form.city.trim() } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      navigate(`/fans/${fan.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("fans.errLoad"));
    } finally {
      setSaving(false);
    }
  }

  const seat = seatLabel(fan, t);
  const subLabel = subTypeLabel(fan.currentSubscription?.type, t);
  const input =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <form key={i18n.language} onSubmit={(e) => void save(e)}>
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/fans/${fan.id}`}
              className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
              title={t("common.back")}
            >
              <BackArrow className="size-4" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("fanEdit.title", { name: `${fan.firstName} ${fan.lastName}` })}
            </h1>
          </div>
          <div className="flex gap-3">
            <Button type="submit" icon={<Save className="size-4" />} loading={saving}>
              {t("common.save")}
            </Button>
            <Button type="button" variant="ghost" icon={<X className="size-4" />} onClick={() => navigate(`/fans/${fan.id}`)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
        {saveError && (
          <div className="mt-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{saveError}</div>
        )}
      </div>

      <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        <Card title={t("fanProfile.personalDetails")}>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">{t("fanEdit.firstName")}</span>
              <input className={input} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">{t("fanEdit.lastName")}</span>
              <input className={input} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">{t("common.age")}</span>
              <input
                type="number"
                min={0}
                max={120}
                className={input}
                value={form.age ?? ""}
                onChange={(e) => set("age", e.target.value === "" ? null : Number(e.target.value))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">{t("common.city")}</span>
              <input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} />
            </label>
            <label className="text-sm col-span-2">
              <span className="mb-1 block text-gray-500">{t("common.email")}</span>
              <input type="email" dir="ltr" className={input} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label className="text-sm col-span-2">
              <span className="mb-1 block text-gray-500">{t("common.phone")}</span>
              <input dir="ltr" className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
          </div>
        </Card>

        <Card title={t("fanEdit.subscription")}>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">{t("fanEdit.subType")}</dt>
              <dd className="font-medium text-gray-900">{subLabel ?? t("subTypes.none")}</dd>
            </div>
            {seat && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">{t("fans.colSeat")}</dt>
                <dd className="font-medium text-gray-900">{seat}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </form>
  );
}
