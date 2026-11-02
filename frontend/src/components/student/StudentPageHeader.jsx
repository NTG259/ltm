export default function StudentPageHeader({ eyebrow = 'Không gian học tập', title, actions }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          {eyebrow}
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
