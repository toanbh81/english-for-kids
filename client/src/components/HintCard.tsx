export function HintCard({ hint }: { hint: { word: string; phoneme?: string; tip: string } }) {
  return <div className="rounded-3xl bg-white shadow p-5 flex gap-4 items-center max-w-xl">
    <span className="text-4xl">👄</span>
    <div><div className="font-extrabold text-xl">Sửa từ này: <span className="text-fix">{hint.word}</span>{hint.phoneme && <span className="text-slate-500"> (âm "{hint.phoneme}")</span>}</div>
      <div className="text-lg">{hint.tip}</div></div></div>
}
