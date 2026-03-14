import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import clsx from 'clsx'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label?: string
  error?: string
  hint?: string
  id: string
  register?: UseFormRegisterReturn
  leftAddon?: React.ReactNode
  rightAddon?: React.ReactNode
  fullWidth?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      id,
      register,
      leftAddon,
      rightAddon,
      fullWidth = true,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={clsx('flex flex-col gap-1', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-gray-700"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-gray-400">
              {leftAddon}
            </div>
          )}
          <input
            id={id}
            ref={ref}
            autoComplete="off"
            spellCheck="false"
            className={clsx(
              'w-full px-3 py-2 border rounded-lg transition-colors duration-200',
              'bg-white text-gray-900 placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              error
                ? 'border-red-400 focus:ring-red-300 focus:border-red-400'
                : 'border-gray-300 focus:ring-primary-300 focus:border-primary-500',
              leftAddon && 'pl-10',
              rightAddon && 'pr-10',
              'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
              className,
            )}
            {...(register || {})}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-gray-400">
              {rightAddon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'

export default Input
