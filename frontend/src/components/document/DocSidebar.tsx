import { useEffect, useState } from 'react'
import styles from './DocSidebar.module.css'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'who-it-serves', label: 'Who it serves' },
      { id: 'the-problem', label: 'The problem it solves' },
    ],
  },
  {
    label: 'The Platform',
    items: [
      { id: 'how-form-works', label: 'How the form works' },
      { id: 'final-section', label: 'The intelligence layer' },
      { id: 'q1', label: 'Q1 — Reporter narrative' },
      { id: 'q2', label: 'Q2 — AI follow-up' },
      { id: 'q3', label: 'Q3 — Policy match' },
    ],
  },
  {
    label: 'For Investigators',
    items: [
      { id: 'investigator-view', label: 'What investigators see' },
      { id: 'analysis', label: 'AI analysis summary' },
    ],
  },
  {
    label: 'Compatibility',
    items: [
      { id: 'data-privacy', label: 'Data & privacy' },
      { id: 'legal', label: 'Legal framework' },
    ],
  },
]

const ALL_IDS = NAV_GROUPS.flatMap(g => g.items.map(i => i.id))

export function DocSidebar() {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )

    ALL_IDS.forEach(id => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    observers.push(observer)
    return () => observers.forEach(o => o.disconnect())
  }, [])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className={styles.sidebar} aria-label="Document navigation">
      {NAV_GROUPS.map(group => (
        <div key={group.label}>
          <div className={styles.navSection}>{group.label}</div>
          {group.items.map(item => (
            <button
              key={item.id}
              className={`${styles.navLink} ${activeId === item.id ? styles.navLinkActive : ''}`}
              onClick={() => scrollTo(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}
