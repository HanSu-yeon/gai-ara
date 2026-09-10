export function BigNumberCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-pale-mint px-5 py-4 text-center">
      <p className="text-3xl font-bold text-deep-green">{value.toLocaleString("ko-KR")}</p>
      <p className="mt-1 text-sm text-ink/60">{label}</p>
    </div>
  );
}
