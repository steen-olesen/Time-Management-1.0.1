import { 
  startOfWeek as dateStartOfWeek, 
  endOfWeek as dateEndOfWeek,
  format as dateFormat,
  Locale
} from 'date-fns'
import { da } from 'date-fns/locale'

// Danish locale configuration
export const danishLocale: Locale = da

// Week starts on Monday (weekStartsOn: 1)
export const startOfWeek = (date: Date): Date => {
  return dateStartOfWeek(date, { weekStartsOn: 1 })
}

export const endOfWeek = (date: Date): Date => {
  return dateEndOfWeek(date, { weekStartsOn: 1 })
}

// Format date with Danish locale - supports custom format strings
export const format = (date: Date, formatStr: string): string => {
  return dateFormat(date, formatStr, { locale: danishLocale })
}

// Currency formatting for Danish Kroner
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Date formatting for Danish format (DD/MM-YYYY) - default format
export const formatDate = (date: Date, formatStr?: string): string => {
  const defaultFormat = 'dd/MM-yyyy'
  return dateFormat(date, formatStr || defaultFormat, { locale: danishLocale })
}

// Short date format (DD/MM)
export const formatShortDate = (date: Date): string => {
  return dateFormat(date, 'dd/MM', { locale: danishLocale })
}

// Month and year format (MMM yyyy) - e.g., "Jan 2024"
export const formatMonthYear = (date: Date): string => {
  return dateFormat(date, 'MMM yyyy', { locale: danishLocale })
}
