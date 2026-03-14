import type { ReactNode } from 'react'
import clsx from 'clsx'

interface CardProps {
  children: ReactNode
  title?: string
  actions?: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddingClasses = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export default function Card({
  children,
  title,
  actions,
  className,
  padding = 'md',
  hover = false,
}: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-sm border border-gray-200',
        hover && 'hover:shadow-md transition-shadow duration-200',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          {title && (
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={clsx(paddingClasses[padding])}>{children}</div>
    </div>
  )
}
