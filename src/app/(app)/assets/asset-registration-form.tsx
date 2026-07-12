"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CategoryOption = {
  id: string;
  name: string;
};

type ApiResult =
  | { ok: true; data: { assetTag: string } }
  | { ok: false; error: string; details?: unknown };

export function AssetRegistrationForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = (key: string) => String(formData.get(key) ?? "").trim();
    const payload = {
      name: text("name"),
      categoryId: text("categoryId"),
      serialNumber: text("serialNumber"),
      acquisitionDate: text("acquisitionDate"),
      acquisitionCost: text("acquisitionCost"),
      condition: text("condition"),
      location: text("location"),
      photoUrl: text("photoUrl"),
      documentsUrl: text("documentsUrl"),
      isBookable: formData.get("isBookable") === "on",
    };

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      form.reset();
      setMessage(`Registered ${result.data.assetTag}`);
      router.refresh();
    } catch {
      setError("Could not register asset. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm font-medium">
        Asset name
        <Input name="name" required placeholder="Dell Latitude Laptop" />
      </label>
      <label className="space-y-1 text-sm font-medium">
        Category
        <select
          name="categoryId"
          required
          disabled={!categories.length}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">
        Serial number
        <Input name="serialNumber" placeholder="SN-LAP-114" />
      </label>
      <label className="space-y-1 text-sm font-medium">
        Acquisition date
        <Input name="acquisitionDate" type="date" />
      </label>
      <label className="space-y-1 text-sm font-medium">
        Acquisition cost
        <Input name="acquisitionCost" inputMode="decimal" placeholder="1250.00" />
      </label>
      <label className="space-y-1 text-sm font-medium">
        Condition
        <Input name="condition" placeholder="Good" />
      </label>
      <label className="space-y-1 text-sm font-medium">
        Location
        <Input name="location" placeholder="IT Store Room" />
      </label>
      <label className="space-y-1 text-sm font-medium">
        Photo URL
        <Input name="photoUrl" type="url" placeholder="https://..." />
      </label>
      <label className="space-y-1 text-sm font-medium md:col-span-2">
        Documents URL
        <Input name="documentsUrl" type="url" placeholder="https://..." />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="isBookable" type="checkbox" className="h-4 w-4 rounded border-input" />
        Shared/bookable resource
      </label>
      <div className="flex items-center justify-end gap-3 md:col-span-2">
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting || !categories.length}>
          {isSubmitting ? "Registering..." : "Register asset"}
        </Button>
      </div>
    </form>
  );
}
