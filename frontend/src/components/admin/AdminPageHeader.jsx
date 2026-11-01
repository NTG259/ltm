export default function AdminPageHeader({ title, description, eyebrow, icon, actions }) {
  return (
    <div className="page-head admin-page-head">
      <div>
        {eyebrow && <span className="admin-page-head__eyebrow">{eyebrow}</span>}
        <h1>
          {icon && <span className="admin-page-head__icon">{icon}</span>}
          {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-page-head__actions">{actions}</div>}
    </div>
  )
}
